import { describe, it, expect, afterEach } from 'vitest';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { mkdtemp, writeFile, readFile, rm, access } from 'node:fs/promises';
import { runWithDepGate } from '../../src/utils/depgate.js';

const tempDirs: string[] = [];

async function makeTempDir(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), 'unpm-depgate-'));
  tempDirs.push(dir);
  return dir;
}

async function writeExecutable(path: string, body: string): Promise<void> {
  await writeFile(path, `#!/usr/bin/env node\n${body}\n`, { mode: 0o755 });
}

async function buildManagerScript(tempDir: string): Promise<string> {
  const scriptPath = join(tempDir, 'fake-manager.cjs');
  await writeExecutable(
    scriptPath,
    `
const fs = require('node:fs');
const outputPath = process.env.UNPM_TEST_OUTPUT;
if (outputPath) {
  fs.writeFileSync(outputPath, JSON.stringify({
    args: process.argv.slice(2),
    registry: process.env.npm_config_registry || null,
    marker: process.env.UNPM_TEST_MARKER || null
  }));
}
const code = Number(process.env.UNPM_TEST_EXIT_CODE || '0');
process.exit(Number.isNaN(code) ? 1 : code);
`
  );
  return scriptPath;
}

async function buildDepGateScript(
  tempDir: string,
  options: {
    payload?: Record<string, unknown> | null;
    holdOpen?: boolean;
    stderrLine?: string;
    teardownMarkerPath?: string;
    exitImmediately?: boolean;
  }
): Promise<string> {
  const scriptPath = join(tempDir, 'fake-depgate.cjs');
  const payloadLiteral =
    options.payload === undefined ? 'undefined' : JSON.stringify(options.payload);
  const stderrLine = options.stderrLine ? JSON.stringify(options.stderrLine) : 'null';
  const teardownMarkerPath = options.teardownMarkerPath
    ? JSON.stringify(options.teardownMarkerPath)
    : 'null';

  await writeExecutable(
    scriptPath,
    `
const fs = require('node:fs');
const payload = ${payloadLiteral};
const stderrLine = ${stderrLine};
const teardownMarkerPath = ${teardownMarkerPath};

if (stderrLine) {
  process.stderr.write(stderrLine + '\\n');
}

if (payload !== undefined) {
  process.stdout.write(JSON.stringify(payload) + '\\n');
}

if (${options.exitImmediately ? 'true' : 'false'}) {
  process.exit(7);
}

if (${options.holdOpen === false ? 'false' : 'true'}) {
  process.stdin.resume();
  process.stdin.on('end', () => {
    if (teardownMarkerPath) {
      fs.writeFileSync(teardownMarkerPath, 'closed');
    }
    process.exit(0);
  });
  setInterval(() => {}, 1000);
}
`
  );
  return scriptPath;
}

afterEach(async () => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir) {
      await rm(dir, { recursive: true, force: true });
    }
  }
});

describe('runWithDepGate', () => {
  it('applies wrapper env and after_manager args on happy path', async () => {
    const tempDir = await makeTempDir();
    const outputPath = join(tempDir, 'manager-output.json');
    const managerScript = await buildManagerScript(tempDir);
    const depgateScript = await buildDepGateScript(tempDir, {
      payload: {
        mode: 'prepare',
        proxy: {
          url: 'http://127.0.0.1:59937',
          port: 59937,
        },
        manager: {
          requested: 'pnpm',
          supported: true,
        },
        wrapper: {
          env_vars: {
            npm_config_registry: 'http://127.0.0.1:59937',
            UNPM_TEST_MARKER: 'wrapped',
          },
          extra_args: ['--via-wrapper'],
          extra_args_position: 'after_manager',
        },
      },
    });

    const result = await runWithDepGate({
      depgate: {
        binaryPath: depgateScript,
        passthroughArgs: [],
        startupTimeoutMs: 1000,
      },
      manager: 'pnpm',
      managerBin: managerScript,
      managerArgs: ['install', 'left-pad'],
      cwd: tempDir,
      env: {
        UNPM_TEST_OUTPUT: outputPath,
      },
      stdio: 'pipe',
    });

    expect(result.exitCode).toBe(0);
    const output = JSON.parse(await readFile(outputPath, 'utf-8')) as {
      args: string[];
      registry: string | null;
      marker: string | null;
    };
    expect(output.args).toEqual(['--via-wrapper', 'install', 'left-pad']);
    expect(output.registry).toBe('http://127.0.0.1:59937');
    expect(output.marker).toBe('wrapped');
  });

  it('supports append arg placement from wrapper', async () => {
    const tempDir = await makeTempDir();
    const outputPath = join(tempDir, 'manager-output.json');
    const managerScript = await buildManagerScript(tempDir);
    const depgateScript = await buildDepGateScript(tempDir, {
      payload: {
        mode: 'prepare',
        proxy: {
          url: 'http://127.0.0.1:60001',
          port: 60001,
        },
        manager: {
          requested: 'pnpm',
          supported: true,
        },
        wrapper: {
          env_vars: {},
          extra_args: ['--wrapper-append'],
          extra_args_position: 'append',
        },
      },
    });

    const result = await runWithDepGate({
      depgate: {
        binaryPath: depgateScript,
        passthroughArgs: [],
        startupTimeoutMs: 1000,
      },
      manager: 'pnpm',
      managerBin: managerScript,
      managerArgs: ['install', 'pkg-a'],
      cwd: tempDir,
      env: {
        UNPM_TEST_OUTPUT: outputPath,
      },
      stdio: 'pipe',
    });

    expect(result.exitCode).toBe(0);
    const output = JSON.parse(await readFile(outputPath, 'utf-8')) as {
      args: string[];
    };
    expect(output.args).toEqual(['install', 'pkg-a', '--wrapper-append']);
  });

  it('fails clearly for unsupported manager when wrapper is null', async () => {
    const tempDir = await makeTempDir();
    const managerScript = await buildManagerScript(tempDir);
    const depgateScript = await buildDepGateScript(tempDir, {
      payload: {
        mode: 'prepare',
        proxy: {
          url: 'http://127.0.0.1:60002',
          port: 60002,
        },
        manager: {
          requested: 'pnpm',
          supported: false,
        },
        wrapper: null,
      },
    });

    await expect(
      runWithDepGate({
        depgate: {
          binaryPath: depgateScript,
          passthroughArgs: [],
          startupTimeoutMs: 1000,
        },
        manager: 'pnpm',
        managerBin: managerScript,
        managerArgs: ['install'],
        cwd: tempDir,
        stdio: 'pipe',
      })
    ).rejects.toThrow(/does not support manager/i);
  });

  it('times out if DepGate does not emit prepare JSON', async () => {
    const tempDir = await makeTempDir();
    const managerScript = await buildManagerScript(tempDir);
    const depgateScript = await buildDepGateScript(tempDir, {
      payload: undefined,
      stderrLine: 'starting proxy',
    });

    await expect(
      runWithDepGate({
        depgate: {
          binaryPath: depgateScript,
          passthroughArgs: [],
          startupTimeoutMs: 100,
        },
        manager: 'pnpm',
        managerBin: managerScript,
        managerArgs: ['install'],
        cwd: tempDir,
        stdio: 'pipe',
      })
    ).rejects.toThrow(/timed out waiting for depgate prepare output/i);
  });

  it('tears down DepGate when package manager fails', async () => {
    const tempDir = await makeTempDir();
    const managerScript = await buildManagerScript(tempDir);
    const teardownMarker = join(tempDir, 'depgate-closed.txt');
    const depgateScript = await buildDepGateScript(tempDir, {
      payload: {
        mode: 'prepare',
        proxy: {
          url: 'http://127.0.0.1:60003',
          port: 60003,
        },
        manager: {
          requested: 'pnpm',
          supported: true,
        },
        wrapper: {
          env_vars: {},
          extra_args: [],
          extra_args_position: 'after_manager',
        },
      },
      teardownMarkerPath: teardownMarker,
    });

    const result = await runWithDepGate({
      depgate: {
        binaryPath: depgateScript,
        passthroughArgs: [],
        startupTimeoutMs: 1000,
      },
      manager: 'pnpm',
      managerBin: managerScript,
      managerArgs: ['install'],
      cwd: tempDir,
      env: {
        UNPM_TEST_EXIT_CODE: '5',
      },
      stdio: 'pipe',
    });

    expect(result.exitCode).toBe(5);
    await expect(access(teardownMarker)).resolves.toBeUndefined();
  });

  it('propagates package-manager exit code', async () => {
    const tempDir = await makeTempDir();
    const managerScript = await buildManagerScript(tempDir);
    const depgateScript = await buildDepGateScript(tempDir, {
      payload: {
        mode: 'prepare',
        proxy: {
          url: 'http://127.0.0.1:60004',
          port: 60004,
        },
        manager: {
          requested: 'pnpm',
          supported: true,
        },
        wrapper: {
          env_vars: {},
          extra_args: [],
          extra_args_position: 'after_manager',
        },
      },
    });

    const result = await runWithDepGate({
      depgate: {
        binaryPath: depgateScript,
        passthroughArgs: [],
        startupTimeoutMs: 1000,
      },
      manager: 'pnpm',
      managerBin: managerScript,
      managerArgs: ['install'],
      cwd: tempDir,
      env: {
        UNPM_TEST_EXIT_CODE: '23',
      },
      stdio: 'pipe',
    });

    expect(result.exitCode).toBe(23);
  });
});
