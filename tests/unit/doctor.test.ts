import { describe, it, expect, vi, beforeEach } from 'vitest';
import { runSecurityChecks } from '../../src/security/doctor.js';
import * as config from '../../src/utils/config.js';
import * as scriptPolicy from '../../src/security/script-policy.js';

// Mock the modules
vi.mock('../../src/utils/config.js', async () => {
  const actual = await vi.importActual('../../src/utils/config.js');
  return {
    ...actual,
    readPackageJson: vi.fn(),
    fileExists: vi.fn(),
    getLavamoatAllowScripts: vi.fn(),
    hasPnpmLock: vi.fn(),
    hasPackageLock: vi.fn(),
  };
});

vi.mock('../../src/security/script-policy.js', async () => {
  const actual = await vi.importActual('../../src/security/script-policy.js');
  return {
    ...actual,
    getPackagesWithScripts: vi.fn(),
  };
});

vi.mock('node:fs/promises', async () => {
  return {
    readFile: vi.fn().mockResolvedValue(''),
    readdir: vi.fn().mockResolvedValue([]),
  };
});

describe('runSecurityChecks', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    // Set up defaults
    vi.mocked(config.readPackageJson).mockResolvedValue({
      name: 'test-package',
      version: '1.0.0',
    });
    vi.mocked(config.fileExists).mockResolvedValue(false);
    vi.mocked(config.getLavamoatAllowScripts).mockResolvedValue({});
    vi.mocked(config.hasPnpmLock).mockResolvedValue(false);
    vi.mocked(config.hasPackageLock).mockResolvedValue(false);
    vi.mocked(scriptPolicy.getPackagesWithScripts).mockResolvedValue([]);
  });

  it('should return array of security check results', async () => {
    const results = await runSecurityChecks();

    expect(Array.isArray(results)).toBe(true);
    expect(results.length).toBeGreaterThan(0);
    for (const result of results) {
      expect(result).toHaveProperty('name');
      expect(result).toHaveProperty('status');
      expect(result).toHaveProperty('message');
      expect(['pass', 'warn', 'fail']).toContain(result.status);
    }
  });

  it('should pass trust policy check with default', async () => {
    const results = await runSecurityChecks();
    const trustPolicyCheck = results.find((r) => r.name === 'Trust Policy');

    expect(trustPolicyCheck).toBeDefined();
    expect(trustPolicyCheck?.status).toBe('pass');
  });

  it('should pass trust policy when explicitly set', async () => {
    vi.mocked(config.readPackageJson).mockResolvedValue({
      name: 'test-package',
      version: '1.0.0',
      unpm: {
        trustPolicy: 'no-downgrade',
      },
    });

    const results = await runSecurityChecks();
    const trustPolicyCheck = results.find((r) => r.name === 'Trust Policy');

    expect(trustPolicyCheck?.status).toBe('pass');
  });

  it('should warn when trust policy is disabled', async () => {
    vi.mocked(config.readPackageJson).mockResolvedValue({
      name: 'test-package',
      version: '1.0.0',
      unpm: {
        trustPolicy: 'none',
      },
    });

    const results = await runSecurityChecks();
    const trustPolicyCheck = results.find((r) => r.name === 'Trust Policy');

    expect(trustPolicyCheck?.status).toBe('warn');
  });

  it('should fail lockfile check when no lockfile exists', async () => {
    vi.mocked(config.hasPnpmLock).mockResolvedValue(false);
    vi.mocked(config.hasPackageLock).mockResolvedValue(false);

    const results = await runSecurityChecks();
    const lockfileCheck = results.find((r) => r.name === 'Lockfile Present');

    expect(lockfileCheck?.status).toBe('fail');
  });

  it('should pass lockfile check when pnpm-lock.yaml exists', async () => {
    vi.mocked(config.hasPnpmLock).mockResolvedValue(true);

    const results = await runSecurityChecks();
    const lockfileCheck = results.find((r) => r.name === 'Lockfile Present');

    expect(lockfileCheck?.status).toBe('pass');
  });

  it('should warn when only package-lock.json exists', async () => {
    vi.mocked(config.hasPackageLock).mockResolvedValue(true);
    vi.mocked(config.hasPnpmLock).mockResolvedValue(false);

    const results = await runSecurityChecks();
    const lockfileCheck = results.find((r) => r.name === 'Lockfile Present');

    expect(lockfileCheck?.status).toBe('warn');
  });

  it('should pass stale allowlist check when no entries', async () => {
    vi.mocked(config.getLavamoatAllowScripts).mockResolvedValue({});

    const results = await runSecurityChecks();
    const staleCheck = results.find((r) => r.name === 'Stale Allowlist');

    expect(staleCheck?.status).toBe('pass');
  });

  it('should warn when stale allowlist entries exist', async () => {
    vi.mocked(config.getLavamoatAllowScripts).mockResolvedValue({
      'old-package': true,
    });
    vi.mocked(scriptPolicy.getPackagesWithScripts).mockResolvedValue([]);

    const results = await runSecurityChecks();
    const staleCheck = results.find((r) => r.name === 'Stale Allowlist');

    expect(staleCheck?.status).toBe('warn');
    expect(staleCheck?.message).toContain('old-package');
  });

  it('should pass exotic deps check when no exotic deps', async () => {
    vi.mocked(config.readPackageJson).mockResolvedValue({
      name: 'test-package',
      version: '1.0.0',
      dependencies: {
        lodash: '^4.17.21',
      },
    });

    const results = await runSecurityChecks();
    const exoticCheck = results.find((r) => r.name === 'Exotic Dependencies');

    expect(exoticCheck?.status).toBe('pass');
  });

  it('should warn when exotic deps are present', async () => {
    vi.mocked(config.readPackageJson).mockResolvedValue({
      name: 'test-package',
      version: '1.0.0',
      dependencies: {
        'git-pkg': 'git+https://github.com/user/repo.git',
      },
    });

    const results = await runSecurityChecks();
    const exoticCheck = results.find((r) => r.name === 'Exotic Dependencies');

    expect(exoticCheck?.status).toBe('warn');
    expect(exoticCheck?.message).toContain('git-pkg');
  });

  it('should pass migration check when migrated', async () => {
    vi.mocked(config.readPackageJson).mockResolvedValue({
      name: 'test-package',
      version: '1.0.0',
      unpm: {
        migrated: true,
      },
    });

    const results = await runSecurityChecks();
    const migrationCheck = results.find((r) => r.name === 'Migration Status');

    expect(migrationCheck?.status).toBe('pass');
  });

  it('should warn when not migrated and has npm lockfile', async () => {
    vi.mocked(config.hasPackageLock).mockResolvedValue(true);
    vi.mocked(config.hasPnpmLock).mockResolvedValue(false);

    const results = await runSecurityChecks();
    const migrationCheck = results.find((r) => r.name === 'Migration Status');

    expect(migrationCheck?.status).toBe('warn');
    expect(migrationCheck?.suggestion).toContain('migrate');
  });
});
