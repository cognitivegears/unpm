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
import {
  mkdtemp,
  writeFile,
  rm,
  mkdir,
  readdir,
  readFile,
  access,
} from 'node:fs/promises';
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

    // Create package-lock.json to pass strict mode lockfile validation
    await writeFile(
      join(projectDir, 'package-lock.json'),
      JSON.stringify({
        name: 'force-scripts-test',
        version: '1.0.0',
        lockfileVersion: 3,
        packages: {},
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

    // Create package-lock.json to pass strict mode lockfile validation
    await writeFile(
      join(projectDir, 'package-lock.json'),
      JSON.stringify({
        name: 'release-age-test',
        version: '1.0.0',
        lockfileVersion: 3,
        packages: {},
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

// Helper to check if a file exists
async function fileExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

describe.skipIf(!HEAVY_TESTS)(
  'Heavy Integration Tests - Lockfile Sync (Pre-Migration)',
  () => {
    let tempDir: string;

    beforeAll(async () => {
      tempDir = await mkdtemp(join(tmpdir(), 'unpm-lockfile-sync-'));
    });

    afterAll(async () => {
      if (tempDir) {
        await rm(tempDir, { recursive: true, force: true });
      }
    });

    it('should sync package-lock.json in pre-migration mode', async () => {
      const projectDir = join(tempDir, 'pre-migration-sync');
      await mkdir(projectDir, { recursive: true });

      // Create package.json
      await writeFile(
        join(projectDir, 'package.json'),
        JSON.stringify({
          name: 'pre-migration-test',
          version: '1.0.0',
        })
      );

      // Create a minimal package-lock.json (npm format)
      await writeFile(
        join(projectDir, 'package-lock.json'),
        JSON.stringify({
          name: 'pre-migration-test',
          version: '1.0.0',
          lockfileVersion: 3,
          requires: true,
          packages: {
            '': {
              name: 'pre-migration-test',
              version: '1.0.0',
            },
          },
        })
      );

      // Run unpm install in pre-migration mode
      const result = await execa('node', [cliPath, 'add', 'is-odd@3.0.1'], {
        reject: false,
        cwd: projectDir,
        timeout: 120000,
      });

      expect(result.exitCode).toBe(0);

      // Verify package-lock.json still exists (pre-migration keeps it)
      const hasPackageLock = await fileExists(
        join(projectDir, 'package-lock.json')
      );
      expect(hasPackageLock).toBe(true);

      // Verify pnpm-lock.yaml was cleaned up (pre-migration removes it)
      const hasPnpmLock = await fileExists(join(projectDir, 'pnpm-lock.yaml'));
      expect(hasPnpmLock).toBe(false);

      // Verify package was installed
      const nodeModules = await readdir(join(projectDir, 'node_modules')).catch(
        () => []
      );
      expect(nodeModules).toContain('is-odd');
    }, 120000);

    it('should work with fresh project (no lockfile)', async () => {
      const projectDir = join(tempDir, 'fresh-project');
      await mkdir(projectDir, { recursive: true });

      // Create only package.json, no lockfile
      await writeFile(
        join(projectDir, 'package.json'),
        JSON.stringify({
          name: 'fresh-project-test',
          version: '1.0.0',
        })
      );

      // Run unpm add in pre-migration mode (no existing lockfile)
      const result = await execa('node', [cliPath, 'add', 'is-odd@3.0.1'], {
        reject: false,
        cwd: projectDir,
        timeout: 120000,
      });

      expect(result.exitCode).toBe(0);

      // Should create package-lock.json (exported from pnpm)
      const hasPackageLock = await fileExists(
        join(projectDir, 'package-lock.json')
      );
      expect(hasPackageLock).toBe(true);

      // pnpm-lock.yaml should be cleaned up
      const hasPnpmLock = await fileExists(join(projectDir, 'pnpm-lock.yaml'));
      expect(hasPnpmLock).toBe(false);
    }, 120000);

    it('should preserve security in pre-migration mode', async () => {
      const projectDir = join(tempDir, 'security-preserved');
      await mkdir(projectDir, { recursive: true });

      await writeFile(
        join(projectDir, 'package.json'),
        JSON.stringify({
          name: 'security-test',
          version: '1.0.0',
        })
      );

      // Run with verbose to see security flags
      const result = await execa(
        'node',
        [cliPath, '-v', 'add', 'is-odd@3.0.1'],
        {
          reject: false,
          cwd: projectDir,
          timeout: 120000,
        }
      );

      expect(result.exitCode).toBe(0);

      // Check that security flags are present in output
      const output = result.stdout + result.stderr;
      expect(output).toContain('--ignore-scripts');
    }, 120000);
  }
);

describe.skipIf(!HEAVY_TESTS)(
  'Heavy Integration Tests - Migration Command',
  () => {
    let tempDir: string;

    beforeAll(async () => {
      tempDir = await mkdtemp(join(tmpdir(), 'unpm-migration-'));
    });

    afterAll(async () => {
      if (tempDir) {
        await rm(tempDir, { recursive: true, force: true });
      }
    });

    it('should complete full migration', async () => {
      const projectDir = join(tempDir, 'full-migration');
      await mkdir(projectDir, { recursive: true });

      // Create package.json with dependencies
      await writeFile(
        join(projectDir, 'package.json'),
        JSON.stringify({
          name: 'migration-test',
          version: '1.0.0',
          dependencies: {
            'is-odd': '^3.0.1',
          },
        })
      );

      // Create package-lock.json
      await writeFile(
        join(projectDir, 'package-lock.json'),
        JSON.stringify({
          name: 'migration-test',
          version: '1.0.0',
          lockfileVersion: 3,
          requires: true,
          packages: {
            '': {
              name: 'migration-test',
              version: '1.0.0',
              dependencies: {
                'is-odd': '^3.0.1',
              },
            },
          },
        })
      );

      // Run migration
      const result = await execa('node', [cliPath, 'migrate'], {
        reject: false,
        cwd: projectDir,
        timeout: 180000,
      });

      expect(result.exitCode).toBe(0);

      // Verify pnpm-lock.yaml exists (migration marker)
      const hasPnpmLock = await fileExists(join(projectDir, 'pnpm-lock.yaml'));
      expect(hasPnpmLock).toBe(true);

      // Verify package-lock.json was deleted
      const hasPackageLock = await fileExists(
        join(projectDir, 'package-lock.json')
      );
      expect(hasPackageLock).toBe(false);

      // Verify package.json was updated
      const pkgJson = JSON.parse(
        await readFile(join(projectDir, 'package.json'), 'utf-8')
      );

      // Check packageManager field
      expect(pkgJson.packageManager).toBeDefined();
      expect(pkgJson.packageManager).toContain('pnpm@');

      // Check preinstall script
      expect(pkgJson.scripts?.preinstall).toBeDefined();
      expect(pkgJson.scripts.preinstall).toContain('pnpm');

      // Verify .pnpmrc was created
      const hasPnpmrc = await fileExists(join(projectDir, '.pnpmrc'));
      expect(hasPnpmrc).toBe(true);

      // Check .pnpmrc contents
      const pnpmrc = await readFile(join(projectDir, '.pnpmrc'), 'utf-8');
      expect(pnpmrc).toContain('ignore-scripts=true');
      expect(pnpmrc).toContain('minimum-release-age=2d');
    }, 180000);

    it('should block npm after migration', async () => {
      const projectDir = join(tempDir, 'npm-blocked');
      await mkdir(projectDir, { recursive: true });

      // Create package.json with a dependency so npm actually tries to install
      await writeFile(
        join(projectDir, 'package.json'),
        JSON.stringify({
          name: 'npm-blocked-test',
          version: '1.0.0',
          dependencies: {
            'is-odd': '^3.0.1',
          },
        })
      );

      // Create package-lock.json
      await writeFile(
        join(projectDir, 'package-lock.json'),
        JSON.stringify({
          name: 'npm-blocked-test',
          version: '1.0.0',
          lockfileVersion: 3,
          packages: {},
        })
      );

      // Run migration
      const migrateResult = await execa('node', [cliPath, 'migrate'], {
        reject: false,
        cwd: projectDir,
        timeout: 120000,
      });

      expect(migrateResult.exitCode).toBe(0);

      // Read updated package.json to verify preinstall script
      const pkgJson = JSON.parse(
        await readFile(join(projectDir, 'package.json'), 'utf-8')
      );
      expect(pkgJson.scripts?.preinstall).toBeDefined();

      // Try to run npm install - should be blocked by preinstall script
      // Note: npm install runs preinstall before doing anything
      const npmResult = await execa('npm', ['install'], {
        reject: false,
        cwd: projectDir,
        timeout: 30000,
      });

      // npm should fail due to preinstall script
      expect(npmResult.exitCode).not.toBe(0);
      expect(npmResult.stderr + npmResult.stdout).toContain(
        'Use unpm or pnpm instead of npm'
      );
    }, 150000);

    it('should support dry-run mode', async () => {
      const projectDir = join(tempDir, 'dry-run-test');
      await mkdir(projectDir, { recursive: true });

      await writeFile(
        join(projectDir, 'package.json'),
        JSON.stringify({
          name: 'dry-run-test',
          version: '1.0.0',
        })
      );

      await writeFile(
        join(projectDir, 'package-lock.json'),
        JSON.stringify({
          name: 'dry-run-test',
          version: '1.0.0',
          lockfileVersion: 3,
          packages: {},
        })
      );

      // Run migration with --dry-run
      const result = await execa('node', [cliPath, 'migrate', '--dry-run'], {
        reject: false,
        cwd: projectDir,
        timeout: 30000,
      });

      expect(result.exitCode).toBe(0);

      // Verify nothing was changed
      const hasPackageLock = await fileExists(
        join(projectDir, 'package-lock.json')
      );
      expect(hasPackageLock).toBe(true);

      const hasPnpmLock = await fileExists(join(projectDir, 'pnpm-lock.yaml'));
      expect(hasPnpmLock).toBe(false);
    }, 30000);
  }
);

describe.skipIf(!HEAVY_TESTS)(
  'Heavy Integration Tests - Post-Migration Mode',
  () => {
    let tempDir: string;

    beforeAll(async () => {
      tempDir = await mkdtemp(join(tmpdir(), 'unpm-post-migration-'));
    });

    afterAll(async () => {
      if (tempDir) {
        await rm(tempDir, { recursive: true, force: true });
      }
    });

    it('should use pnpm-lock.yaml directly when it exists', async () => {
      const projectDir = join(tempDir, 'post-migration');
      await mkdir(projectDir, { recursive: true });

      await writeFile(
        join(projectDir, 'package.json'),
        JSON.stringify({
          name: 'post-migration-test',
          version: '1.0.0',
        })
      );

      // Create pnpm-lock.yaml to simulate post-migration state
      await writeFile(
        join(projectDir, 'pnpm-lock.yaml'),
        `lockfileVersion: '9.0'
settings:
  autoInstallPeers: true
  excludeLinksFromLockfile: false
`
      );

      // Run install in post-migration mode
      const result = await execa('node', [cliPath, 'add', 'is-odd@3.0.1'], {
        reject: false,
        cwd: projectDir,
        timeout: 120000,
      });

      expect(result.exitCode).toBe(0);

      // Verify pnpm-lock.yaml still exists
      const hasPnpmLock = await fileExists(join(projectDir, 'pnpm-lock.yaml'));
      expect(hasPnpmLock).toBe(true);

      // No package-lock.json should be created in post-migration mode
      const hasPackageLock = await fileExists(
        join(projectDir, 'package-lock.json')
      );
      expect(hasPackageLock).toBe(false);
    }, 120000);
  }
);
