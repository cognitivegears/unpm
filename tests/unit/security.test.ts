import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  getSecurityFlags,
  isPackageAllowedToRunScripts,
  getLocalPackageScripts,
  getPackagesWithScripts,
} from '../../src/security/script-policy.js';
import * as config from '../../src/utils/config.js';

// Mock the config module
vi.mock('../../src/utils/config.js', async () => {
  const actual = await vi.importActual('../../src/utils/config.js');
  return {
    ...actual,
    readPackageJson: vi.fn(),
    getLavamoatAllowScripts: vi.fn(),
    fileExists: vi.fn(),
  };
});

describe('getSecurityFlags', () => {
  it('should return --ignore-scripts', () => {
    const flags = getSecurityFlags();
    expect(flags).toContain('--ignore-scripts');
  });
});

describe('isPackageAllowedToRunScripts', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('should return false when package is not in allowlist', async () => {
    vi.mocked(config.readPackageJson).mockResolvedValue({
      name: 'test-package',
      version: '1.0.0',
    });
    vi.mocked(config.getLavamoatAllowScripts).mockResolvedValue({});

    const result = await isPackageAllowedToRunScripts('some-package');
    expect(result).toBe(false);
  });

  it('should return true when package is in LavaMoat allowlist', async () => {
    vi.mocked(config.readPackageJson).mockResolvedValue({
      name: 'test-package',
      version: '1.0.0',
    });
    vi.mocked(config.getLavamoatAllowScripts).mockResolvedValue({
      'allowed-package': true,
    });

    const result = await isPackageAllowedToRunScripts('allowed-package');
    expect(result).toBe(true);
  });

  it('should return true when package is in trustedPackages', async () => {
    vi.mocked(config.readPackageJson).mockResolvedValue({
      name: 'test-package',
      version: '1.0.0',
      unpm: {
        trustedPackages: ['trusted-package'],
      },
    });
    vi.mocked(config.getLavamoatAllowScripts).mockResolvedValue({});

    const result = await isPackageAllowedToRunScripts('trusted-package');
    expect(result).toBe(true);
  });

  it('should return true when allowDependencyScripts is enabled', async () => {
    vi.mocked(config.readPackageJson).mockResolvedValue({
      name: 'test-package',
      version: '1.0.0',
      unpm: {
        allowDependencyScripts: true,
      },
    });
    vi.mocked(config.getLavamoatAllowScripts).mockResolvedValue({});

    const result = await isPackageAllowedToRunScripts('any-package');
    expect(result).toBe(true);
  });
});

describe('getLocalPackageScripts', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('should return empty object when no scripts defined', async () => {
    vi.mocked(config.readPackageJson).mockResolvedValue({
      name: 'test-package',
      version: '1.0.0',
    });

    const scripts = await getLocalPackageScripts();
    expect(scripts).toEqual({});
  });

  it('should return only install-related scripts', async () => {
    vi.mocked(config.readPackageJson).mockResolvedValue({
      name: 'test-package',
      version: '1.0.0',
      scripts: {
        preinstall: 'echo preinstall',
        postinstall: 'echo postinstall',
        prepare: 'echo prepare',
        build: 'echo build', // Not an install script
        test: 'echo test', // Not an install script
      },
    });

    const scripts = await getLocalPackageScripts();
    expect(scripts).toEqual({
      preinstall: 'echo preinstall',
      postinstall: 'echo postinstall',
      prepare: 'echo prepare',
    });
    expect(scripts).not.toHaveProperty('build');
    expect(scripts).not.toHaveProperty('test');
  });
});

describe('getPackagesWithScripts', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('should return empty array when node_modules does not exist', async () => {
    vi.mocked(config.fileExists).mockResolvedValue(false);

    const packages = await getPackagesWithScripts('/some/path');
    expect(packages).toEqual([]);
  });
});
