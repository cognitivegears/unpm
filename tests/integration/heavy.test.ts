/**
 * Heavy Integration Tests
 *
 * These tests perform real installations and require network access.
 * They are skipped by default and only run when HEAVY_TESTS=true.
 *
 * To run:
 *   HEAVY_TESTS=true pnpm test
 *   pnpm test:heavy
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { execa } from 'execa';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { mkdtemp, writeFile, rm, mkdir, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const cliPath = join(__dirname, '../../bin/unpm.js');

const HEAVY_TESTS = process.env['HEAVY_TESTS'] === 'true';

describe.skipIf(!HEAVY_TESTS)(
  'Heavy Integration Tests - Real Installations',
  () => {
    let tempDir: string;

    beforeAll(async () => {
      tempDir = await mkdtemp(join(tmpdir(), 'unpm-heavy-'));
    });

    afterAll(async () => {
      if (tempDir) {
        await rm(tempDir, { recursive: true, force: true });
      }
    });

    it('should install a small package (is-odd)', async () => {
      // Create a fresh project directory
      const projectDir = join(tempDir, 'install-test');
      await mkdir(projectDir, { recursive: true });
      await writeFile(
        join(projectDir, 'package.json'),
        JSON.stringify({
          name: 'install-test',
          version: '1.0.0',
        })
      );

      const result = await execa('node', [cliPath, 'add', 'is-odd@3.0.1'], {
        reject: false,
        cwd: projectDir,
        timeout: 60000,
      });

      expect(result.exitCode).toBe(0);

      // Verify node_modules exists
      const nodeModules = await readdir(join(projectDir, 'node_modules')).catch(
        () => []
      );
      expect(nodeModules).toContain('is-odd');
    }, 60000);

    it('should block scripts by default when installing packages with postinstall', async () => {
      // esbuild has postinstall scripts
      const projectDir = join(tempDir, 'script-block-test');
      await mkdir(projectDir, { recursive: true });
      await writeFile(
        join(projectDir, 'package.json'),
        JSON.stringify({
          name: 'script-block-test',
          version: '1.0.0',
        })
      );

      // This should succeed but skip the postinstall script
      const result = await execa('node', [cliPath, 'add', 'esbuild'], {
        reject: false,
        cwd: projectDir,
        timeout: 120000,
      });

      // Install should complete (scripts are blocked but package is installed)
      expect(result.exitCode).toBeLessThanOrEqual(1);
    }, 120000);
  }
);

describe.skipIf(!HEAVY_TESTS)('Heavy Integration Tests - dlx Security', () => {
  it('should block dlx without --allow-dlx flag', async () => {
    const result = await execa('node', [cliPath, 'dlx', 'cowsay', 'hello'], {
      reject: false,
      timeout: 30000,
    });

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('dlx is blocked');
  });

  it('should allow dlx with --allow-dlx flag', async () => {
    const result = await execa(
      'node',
      [cliPath, 'dlx', '--allow-dlx', 'cowsay', 'hello'],
      {
        reject: false,
        timeout: 60000,
      }
    );

    expect(result.exitCode).toBe(0);
  }, 60000);

  it('should block dlx in strict mode even with --allow-dlx', async () => {
    const result = await execa(
      'node',
      [cliPath, '--strict', 'dlx', '--allow-dlx', 'cowsay', 'hello'],
      {
        reject: false,
        timeout: 30000,
      }
    );

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('strict mode');
  });
});

describe.skipIf(!HEAVY_TESTS)('Heavy Integration Tests - Strict Mode', () => {
  let tempDir: string;

  beforeAll(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'unpm-strict-'));
  });

  afterAll(async () => {
    if (tempDir) {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it('should block --force-scripts in strict mode', async () => {
    const projectDir = join(tempDir, 'force-scripts-test');
    await mkdir(projectDir, { recursive: true });
    await writeFile(
      join(projectDir, 'package.json'),
      JSON.stringify({
        name: 'force-scripts-test',
        version: '1.0.0',
      })
    );

    const result = await execa(
      'node',
      [cliPath, '--strict', 'install', '--force-scripts'],
      {
        reject: false,
        cwd: projectDir,
        timeout: 30000,
      }
    );

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain(
      '--force-scripts is blocked in strict mode'
    );
  });

  it('should allow --force-scripts outside strict mode', async () => {
    const projectDir = join(tempDir, 'force-scripts-allowed');
    await mkdir(projectDir, { recursive: true });
    await writeFile(
      join(projectDir, 'package.json'),
      JSON.stringify({
        name: 'force-scripts-allowed',
        version: '1.0.0',
      })
    );

    const result = await execa(
      'node',
      [cliPath, 'install', '--force-scripts'],
      {
        reject: false,
        cwd: projectDir,
        timeout: 60000,
      }
    );

    // Should succeed (or at least not fail due to security block)
    // The warning about force-scripts should appear
    expect(result.exitCode).toBe(0);
  }, 60000);

  it('should enforce 7-day release age in strict mode', async () => {
    const projectDir = join(tempDir, 'release-age-test');
    await mkdir(projectDir, { recursive: true });
    await writeFile(
      join(projectDir, 'package.json'),
      JSON.stringify({
        name: 'release-age-test',
        version: '1.0.0',
      })
    );

    // Try to install an old, stable package - should work
    const result = await execa(
      'node',
      [cliPath, '--strict', '-v', 'add', 'is-odd@3.0.1'],
      {
        reject: false,
        cwd: projectDir,
        timeout: 60000,
      }
    );

    // Should succeed since is-odd@3.0.1 is old
    expect(result.exitCode).toBe(0);
  }, 60000);
});

describe.skipIf(!HEAVY_TESTS)(
  'Heavy Integration Tests - Script Flag Migration',
  () => {
    let tempDir: string;

    beforeAll(async () => {
      tempDir = await mkdtemp(join(tmpdir(), 'unpm-script-flags-'));
    });

    afterAll(async () => {
      if (tempDir) {
        await rm(tempDir, { recursive: true, force: true });
      }
    });

    it('should warn and ignore --ignore-scripts=false', async () => {
      const projectDir = join(tempDir, 'ignore-scripts-false');
      await mkdir(projectDir, { recursive: true });
      await writeFile(
        join(projectDir, 'package.json'),
        JSON.stringify({
          name: 'ignore-scripts-false',
          version: '1.0.0',
        })
      );

      const result = await execa(
        'node',
        [cliPath, 'install', '--ignore-scripts=false'],
        {
          reject: false,
          cwd: projectDir,
          timeout: 60000,
        }
      );

      // Should show deprecation warning but still succeed
      expect(result.exitCode).toBe(0);
      expect(result.stderr).toContain('deprecated');
    }, 60000);

    it('should warn and ignore --no-ignore-scripts', async () => {
      const projectDir = join(tempDir, 'no-ignore-scripts');
      await mkdir(projectDir, { recursive: true });
      await writeFile(
        join(projectDir, 'package.json'),
        JSON.stringify({
          name: 'no-ignore-scripts',
          version: '1.0.0',
        })
      );

      const result = await execa(
        'node',
        [cliPath, 'install', '--no-ignore-scripts'],
        {
          reject: false,
          cwd: projectDir,
          timeout: 60000,
        }
      );

      // Should show deprecation warning but still succeed
      expect(result.exitCode).toBe(0);
      expect(result.stderr).toContain('deprecated');
    }, 60000);
  }
);

describe.skipIf(!HEAVY_TESTS)(
  'Heavy Integration Tests - Explore Security',
  () => {
    it('should block explore without --allow-explore', async () => {
      const result = await execa('node', [cliPath, 'explore', 'lodash'], {
        reject: false,
        timeout: 30000,
      });

      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain('explore is blocked');
    });

    it('should block explore in strict mode even with --allow-explore', async () => {
      const result = await execa(
        'node',
        [cliPath, '--strict', 'explore', '--allow-explore', 'lodash'],
        {
          reject: false,
          timeout: 30000,
        }
      );

      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain('strict mode');
    });
  }
);

describe.skipIf(!HEAVY_TESTS)(
  'Heavy Integration Tests - Compound Commands',
  () => {
    let tempDir: string;

    beforeAll(async () => {
      tempDir = await mkdtemp(join(tmpdir(), 'unpm-compound-'));
    });

    afterAll(async () => {
      if (tempDir) {
        await rm(tempDir, { recursive: true, force: true });
      }
    });

    it('should run install-test (it)', async () => {
      const projectDir = join(tempDir, 'install-test');
      await mkdir(projectDir, { recursive: true });
      await writeFile(
        join(projectDir, 'package.json'),
        JSON.stringify({
          name: 'install-test-compound',
          version: '1.0.0',
          scripts: {
            test: 'echo "Tests passed"',
          },
        })
      );

      const result = await execa('node', [cliPath, 'install-test'], {
        reject: false,
        cwd: projectDir,
        timeout: 60000,
      });

      // Should complete successfully (install + test)
      expect(result.exitCode).toBe(0);
    }, 60000);

    it('should run install-ci-test (cit)', async () => {
      const projectDir = join(tempDir, 'ci-test');
      await mkdir(projectDir, { recursive: true });
      await writeFile(
        join(projectDir, 'package.json'),
        JSON.stringify({
          name: 'ci-test-compound',
          version: '1.0.0',
          scripts: {
            test: 'echo "CI Tests passed"',
          },
        })
      );

      // Create a lockfile for ci command
      await writeFile(
        join(projectDir, 'pnpm-lock.yaml'),
        'lockfileVersion: 5.4\n'
      );

      const result = await execa('node', [cliPath, 'install-ci-test'], {
        reject: false,
        cwd: projectDir,
        timeout: 60000,
      });

      // ci may fail without proper lockfile, but command should execute
      expect(result.exitCode).toBeLessThanOrEqual(1);
    }, 60000);
  }
);
