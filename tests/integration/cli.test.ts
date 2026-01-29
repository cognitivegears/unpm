import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { execa } from 'execa';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { mkdtemp, writeFile, rm, mkdir, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const cliPath = join(__dirname, '../../bin/unpm.js');

describe('CLI Integration', () => {
  it('should show help', async () => {
    const result = await execa('node', [cliPath, '--help'], { reject: false });
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('npm wrapper that delegates to pnpm');
  });

  it('should show version', async () => {
    const result = await execa('node', [cliPath, '--version'], {
      reject: false,
    });
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toMatch(/\d+\.\d+\.\d+/);
  });

  it('should show help for allow-scripts', async () => {
    const result = await execa('node', [cliPath, 'allow-scripts'], {
      reject: false,
    });
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('unpm allow-scripts');
    expect(result.stdout).toContain('add');
    expect(result.stdout).toContain('remove');
    expect(result.stdout).toContain('list');
  });

  it('should show help for migrate', async () => {
    const result = await execa('node', [cliPath, 'migrate', '--help'], {
      reject: false,
    });
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('Migrate from npm to unpm/pnpm');
  });

  it('should show help for install', async () => {
    const result = await execa('node', [cliPath, 'install', '--help'], {
      reject: false,
    });
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('install');
  });

  it('should show help for run', async () => {
    const result = await execa('node', [cliPath, 'run', '--help'], {
      reject: false,
    });
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('run');
  });
});

describe('CLI Read-Only Commands', () => {
  // Note: unpm uses stdio: 'inherit' so output goes directly to terminal.
  // Tests verify exit codes and that commands don't crash.

  it(
    'should view package info successfully',
    async () => {
      const result = await execa('node', [cliPath, 'view', 'lodash'], {
        reject: false,
        timeout: 30000,
      });
      expect(result.exitCode).toBe(0);
    },
    30000
  );

  it(
    'should view specific package version',
    async () => {
      const result = await execa(
        'node',
        [cliPath, 'view', 'lodash@4.17.21', 'version'],
        {
          reject: false,
          timeout: 30000,
        }
      );
      expect(result.exitCode).toBe(0);
    },
    30000
  );

  it(
    'should return error for non-existent package',
    async () => {
      const result = await execa(
        'node',
        [cliPath, 'view', 'this-package-definitely-does-not-exist-12345'],
        { reject: false, timeout: 30000 }
      );
      expect(result.exitCode).not.toBe(0);
    },
    30000
  );

  it('should show bin path', async () => {
    const result = await execa('node', [cliPath, 'bin'], { reject: false });
    expect(result.exitCode).toBe(0);
  });

  it('should show root path', async () => {
    const result = await execa('node', [cliPath, 'root'], { reject: false });
    expect(result.exitCode).toBe(0);
  });

  it('should show prefix path', async () => {
    const result = await execa('node', [cliPath, 'prefix'], { reject: false });
    expect(result.exitCode).toBe(0);
  });
});

describe('CLI Isolated Directory Tests', () => {
  // Note: unpm uses stdio: 'inherit' so output goes directly to terminal.
  // Tests verify exit codes and that commands execute without crashing.

  let tempDir: string;

  beforeAll(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'unpm-test-'));
    await writeFile(
      join(tempDir, 'package.json'),
      JSON.stringify({
        name: 'test-package',
        version: '1.0.0',
        dependencies: {},
      })
    );
    // Create empty node_modules to avoid "not found" errors
    await mkdir(join(tempDir, 'node_modules'), { recursive: true });
  });

  afterAll(async () => {
    if (tempDir) {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it('should run ls in isolated directory', async () => {
    const result = await execa('node', [cliPath, 'ls'], {
      reject: false,
      cwd: tempDir,
    });
    // Exit code 0 or 1 is acceptable (1 when no deps)
    expect(result.exitCode).toBeLessThanOrEqual(1);
  });

  it('should run ls with depth flag in isolated directory', async () => {
    const result = await execa('node', [cliPath, 'ls', '--depth=0'], {
      reject: false,
      cwd: tempDir,
    });
    expect(result.exitCode).toBeLessThanOrEqual(1);
  });

  it('should run outdated in isolated directory', async () => {
    const result = await execa('node', [cliPath, 'outdated'], {
      reject: false,
      cwd: tempDir,
    });
    // Exit code 0 means no outdated packages (expected for empty deps)
    expect(result.exitCode).toBe(0);
  });

  it('should run why in isolated directory', async () => {
    const result = await execa('node', [cliPath, 'why', 'lodash'], {
      reject: false,
      cwd: tempDir,
    });
    // Will fail since lodash isn't installed, but should not crash
    expect(result.exitCode).toBeLessThanOrEqual(1);
  });
});

describe('CLI Flag Mapping', () => {
  // Note: These tests verify that flag mapping works by checking
  // that commands execute successfully with various npm-style flags.

  let tempDir: string;

  beforeAll(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'unpm-flags-'));
    await writeFile(
      join(tempDir, 'package.json'),
      JSON.stringify({
        name: 'flag-test-package',
        version: '1.0.0',
      })
    );
    await mkdir(join(tempDir, 'node_modules'), { recursive: true });
  });

  afterAll(async () => {
    if (tempDir) {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it('should pass --json flag through', async () => {
    const result = await execa('node', [cliPath, 'ls', '--json'], {
      reject: false,
      cwd: tempDir,
    });
    // Command should execute successfully
    expect(result.exitCode).toBeLessThanOrEqual(1);
  });

  it('should map --depth flag correctly', async () => {
    const result = await execa('node', [cliPath, 'ls', '--depth=0'], {
      reject: false,
      cwd: tempDir,
    });
    expect(result.exitCode).toBeLessThanOrEqual(1);
  });

  it('should handle --production flag mapping to --prod', async () => {
    const result = await execa('node', [cliPath, 'ls', '--production'], {
      reject: false,
      cwd: tempDir,
    });
    // Should not error - flag is mapped correctly
    expect(result.exitCode).toBeLessThanOrEqual(1);
  });

  it('should handle --silent flag', async () => {
    const result = await execa('node', [cliPath, 'ls', '--silent'], {
      reject: false,
      cwd: tempDir,
    });
    expect(result.exitCode).toBeLessThanOrEqual(1);
  });

  it('should handle --long flag', async () => {
    const result = await execa('node', [cliPath, 'ls', '--long'], {
      reject: false,
      cwd: tempDir,
    });
    expect(result.exitCode).toBeLessThanOrEqual(1);
  });
});

describe('CLI Migration', () => {
  let tempDir: string;

  beforeAll(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'unpm-migrate-'));
  });

  afterAll(async () => {
    if (tempDir) {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it('should fail migration without package.json', async () => {
    const result = await execa('node', [cliPath, 'migrate', '--dry-run'], {
      reject: false,
      cwd: tempDir,
    });
    expect(result.exitCode).toBe(1);
  });

  it('should run migration dry-run with package.json', async () => {
    await writeFile(
      join(tempDir, 'package.json'),
      JSON.stringify({
        name: 'migrate-test',
        version: '1.0.0',
      })
    );

    const result = await execa('node', [cliPath, 'migrate', '--dry-run'], {
      reject: false,
      cwd: tempDir,
    });
    expect(result.exitCode).toBe(0);
  });

  it('should run migration dry-run with --skip-lavamoat', async () => {
    const result = await execa(
      'node',
      [cliPath, 'migrate', '--dry-run', '--skip-lavamoat'],
      {
        reject: false,
        cwd: tempDir,
      }
    );
    expect(result.exitCode).toBe(0);
  });

  it('should run migration dry-run with existing package-lock.json', async () => {
    // Create a minimal package-lock.json
    await writeFile(
      join(tempDir, 'package-lock.json'),
      JSON.stringify({
        name: 'migrate-test',
        version: '1.0.0',
        lockfileVersion: 3,
        packages: {},
      })
    );

    const result = await execa('node', [cliPath, 'migrate', '--dry-run'], {
      reject: false,
      cwd: tempDir,
    });
    expect(result.exitCode).toBe(0);
  });

  it('should run migration dry-run with existing .gitignore', async () => {
    await writeFile(join(tempDir, '.gitignore'), '# test gitignore\n');

    const result = await execa('node', [cliPath, 'migrate', '--dry-run'], {
      reject: false,
      cwd: tempDir,
    });
    expect(result.exitCode).toBe(0);
  });
});

describe('CLI Allow-Scripts', () => {
  let tempDir: string;

  beforeAll(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'unpm-allow-'));
    await writeFile(
      join(tempDir, 'package.json'),
      JSON.stringify({
        name: 'allow-scripts-test',
        version: '1.0.0',
      })
    );
  });

  afterAll(async () => {
    if (tempDir) {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it('should show allow-scripts help', async () => {
    const result = await execa('node', [cliPath, 'allow-scripts'], {
      reject: false,
      cwd: tempDir,
    });
    expect(result.exitCode).toBe(0);
  });

  it('should list empty allowlist', async () => {
    const result = await execa('node', [cliPath, 'allow-scripts', 'list'], {
      reject: false,
      cwd: tempDir,
    });
    expect(result.exitCode).toBe(0);
  });

  it('should initialize lavamoat config', async () => {
    const result = await execa('node', [cliPath, 'allow-scripts', 'init'], {
      reject: false,
      cwd: tempDir,
    });
    expect(result.exitCode).toBe(0);

    // Verify package.json was updated
    const pkgContent = await readFile(join(tempDir, 'package.json'), 'utf-8');
    const pkg = JSON.parse(pkgContent);
    expect(pkg.lavamoat).toBeDefined();
  });

  it('should add package to allowlist', async () => {
    const result = await execa(
      'node',
      [cliPath, 'allow-scripts', 'add', 'esbuild'],
      {
        reject: false,
        cwd: tempDir,
      }
    );
    expect(result.exitCode).toBe(0);

    // Verify package.json was updated
    const pkgContent = await readFile(join(tempDir, 'package.json'), 'utf-8');
    const pkg = JSON.parse(pkgContent);
    expect(pkg.lavamoat?.allowScripts?.esbuild).toBe(true);
  });

  it('should list allowlist with packages', async () => {
    const result = await execa('node', [cliPath, 'allow-scripts', 'list'], {
      reject: false,
      cwd: tempDir,
    });
    expect(result.exitCode).toBe(0);
  });

  it('should add multiple packages to allowlist', async () => {
    const result = await execa(
      'node',
      [cliPath, 'allow-scripts', 'add', 'sharp', 'node-sass'],
      {
        reject: false,
        cwd: tempDir,
      }
    );
    expect(result.exitCode).toBe(0);

    const pkgContent = await readFile(join(tempDir, 'package.json'), 'utf-8');
    const pkg = JSON.parse(pkgContent);
    expect(pkg.lavamoat?.allowScripts?.sharp).toBe(true);
    expect(pkg.lavamoat?.allowScripts?.['node-sass']).toBe(true);
  });

  it('should remove package from allowlist', async () => {
    const result = await execa(
      'node',
      [cliPath, 'allow-scripts', 'remove', 'esbuild'],
      {
        reject: false,
        cwd: tempDir,
      }
    );
    expect(result.exitCode).toBe(0);

    const pkgContent = await readFile(join(tempDir, 'package.json'), 'utf-8');
    const pkg = JSON.parse(pkgContent);
    expect(pkg.lavamoat?.allowScripts?.esbuild).toBeUndefined();
  });

  it('should fail add without package name', async () => {
    const result = await execa('node', [cliPath, 'allow-scripts', 'add'], {
      reject: false,
      cwd: tempDir,
    });
    expect(result.exitCode).toBe(1);
  });

  it('should fail remove without package name', async () => {
    const result = await execa('node', [cliPath, 'allow-scripts', 'remove'], {
      reject: false,
      cwd: tempDir,
    });
    expect(result.exitCode).toBe(1);
  });

  it('should fail with unknown subcommand', async () => {
    const result = await execa(
      'node',
      [cliPath, 'allow-scripts', 'unknown-command'],
      {
        reject: false,
        cwd: tempDir,
      }
    );
    expect(result.exitCode).toBe(1);
  });
});

describe('CLI New Commands', () => {
  // Test new diagnostic and safe read-only commands

  it('should show help for ping', async () => {
    const result = await execa('node', [cliPath, 'ping', '--help'], {
      reject: false,
    });
    expect(result.exitCode).toBe(0);
  });

  it('should show help for doctor', async () => {
    const result = await execa('node', [cliPath, 'doctor', '--help'], {
      reject: false,
    });
    expect(result.exitCode).toBe(0);
  });

  it('should show help for sbom', async () => {
    const result = await execa('node', [cliPath, 'sbom', '--help'], {
      reject: false,
    });
    expect(result.exitCode).toBe(0);
  });

  it('should show help for install-test', async () => {
    const result = await execa('node', [cliPath, 'install-test', '--help'], {
      reject: false,
    });
    expect(result.exitCode).toBe(0);
  });

  it('should show help for install-ci-test', async () => {
    const result = await execa('node', [cliPath, 'install-ci-test', '--help'], {
      reject: false,
    });
    expect(result.exitCode).toBe(0);
  });

  it('should show help for undeprecate', async () => {
    const result = await execa('node', [cliPath, 'undeprecate', '--help'], {
      reject: false,
    });
    expect(result.exitCode).toBe(0);
  });

  it('should show help for find-dupes', async () => {
    const result = await execa('node', [cliPath, 'find-dupes', '--help'], {
      reject: false,
    });
    expect(result.exitCode).toBe(0);
  });
});

describe('CLI Security Hardening', () => {
  it('should block dlx without --allow-dlx', async () => {
    const result = await execa('node', [cliPath, 'dlx', 'cowsay'], {
      reject: false,
    });
    expect(result.exitCode).toBe(1);
    // Check stderr for the error message
    expect(result.stderr).toContain('dlx is blocked');
  });

  it('should block explore without --allow-explore', async () => {
    const result = await execa('node', [cliPath, 'explore', 'lodash'], {
      reject: false,
    });
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('explore is blocked');
  });

  it('should show --strict in help output', async () => {
    const result = await execa('node', [cliPath, '--help'], {
      reject: false,
    });
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('--strict');
  });
});

describe('CLI Deprecated Flag Handling', () => {
  let tempDir: string;

  beforeAll(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'unpm-deprecated-'));
    await writeFile(
      join(tempDir, 'package.json'),
      JSON.stringify({
        name: 'deprecated-test',
        version: '1.0.0',
      })
    );
    await mkdir(join(tempDir, 'node_modules'), { recursive: true });
  });

  afterAll(async () => {
    if (tempDir) {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it('should warn when using --ignore-scripts=false', async () => {
    const result = await execa(
      'node',
      [cliPath, 'install', '--ignore-scripts=false', '--dry-run'],
      {
        reject: false,
        cwd: tempDir,
      }
    );
    // Command should still succeed (flag is ignored)
    expect(result.exitCode).toBeLessThanOrEqual(1);
  });
});

describe('CLI Unused Command', () => {
  it('should show help for unused', async () => {
    const result = await execa('node', [cliPath, 'unused', '--help'], {
      reject: false,
    });
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('unused');
  });
});

describe('CLI Lockfile Warnings', () => {
  it('should warn when no lockfile exists', async () => {
    const tempDir = await mkdtemp(join(tmpdir(), 'unpm-lockfile-'));
    await writeFile(
      join(tempDir, 'package.json'),
      JSON.stringify({
        name: 'lockfile-test',
        version: '1.0.0',
      })
    );

    const result = await execa('node', [cliPath, 'install', '--dry-run'], {
      reject: false,
      cwd: tempDir,
    });

    // Should still work (warning only) in normal mode
    expect(result.exitCode).toBeLessThanOrEqual(1);

    await rm(tempDir, { recursive: true, force: true });
  });

  it('should error in strict mode when no lockfile exists', async () => {
    const tempDir = await mkdtemp(join(tmpdir(), 'unpm-lockfile-strict-'));
    await writeFile(
      join(tempDir, 'package.json'),
      JSON.stringify({
        name: 'lockfile-strict-test',
        version: '1.0.0',
      })
    );

    const result = await execa('node', [cliPath, 'install', '--strict'], {
      reject: false,
      cwd: tempDir,
    });

    // Should fail in strict mode
    expect(result.exitCode).toBe(1);

    await rm(tempDir, { recursive: true, force: true });
  });

  it('should error in strict mode when lockfile is in .gitignore', async () => {
    const tempDir = await mkdtemp(join(tmpdir(), 'unpm-lockfile-gitignore-'));
    await writeFile(
      join(tempDir, 'package.json'),
      JSON.stringify({
        name: 'lockfile-gitignore-test',
        version: '1.0.0',
      })
    );
    // Create .git directory to make it a git repo
    await mkdir(join(tempDir, '.git'), { recursive: true });
    // Create pnpm-lock.yaml
    await writeFile(join(tempDir, 'pnpm-lock.yaml'), 'lockfileVersion: 6.0\n');
    // Create .gitignore with lockfile
    await writeFile(join(tempDir, '.gitignore'), 'pnpm-lock.yaml\n');

    const result = await execa('node', [cliPath, 'install', '--strict'], {
      reject: false,
      cwd: tempDir,
    });

    // Should fail in strict mode
    expect(result.exitCode).toBe(1);

    await rm(tempDir, { recursive: true, force: true });
  });
});
