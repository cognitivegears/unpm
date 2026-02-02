import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  getExoticSubdepsConfig,
  extractExoticSubdepsFlags,
} from '../../src/security/exotic-subdeps.js';
import * as config from '../../src/utils/config.js';

// Mock the config module
vi.mock('../../src/utils/config.js', async () => {
  const actual = await vi.importActual('../../src/utils/config.js');
  return {
    ...actual,
    readPackageJson: vi.fn(),
  };
});

describe('getExoticSubdepsConfig', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('should return false by default (not enabled)', async () => {
    vi.mocked(config.readPackageJson).mockResolvedValue({
      name: 'test-package',
      version: '1.0.0',
    });

    const result = await getExoticSubdepsConfig();

    expect(result.blockExoticSubdeps).toBe(false);
  });

  it('should return true when enabled in package.json', async () => {
    vi.mocked(config.readPackageJson).mockResolvedValue({
      name: 'test-package',
      version: '1.0.0',
      unpm: {
        blockExoticSubdeps: true,
      },
    });

    const result = await getExoticSubdepsConfig();

    expect(result.blockExoticSubdeps).toBe(true);
  });

  it('should return false when explicitly disabled in package.json', async () => {
    vi.mocked(config.readPackageJson).mockResolvedValue({
      name: 'test-package',
      version: '1.0.0',
      unpm: {
        blockExoticSubdeps: false,
      },
    });

    const result = await getExoticSubdepsConfig();

    expect(result.blockExoticSubdeps).toBe(false);
  });
});

describe('extractExoticSubdepsFlags', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(config.readPackageJson).mockResolvedValue({
      name: 'test-package',
      version: '1.0.0',
    });
  });

  it('should return empty flags when not enabled', async () => {
    const result = await extractExoticSubdepsFlags([]);

    expect(result.cleanedArgs).toEqual([]);
    expect(result.exoticSubdepsFlags.enabled).toBe(false);
    expect(result.exoticSubdepsFlags.flags).toEqual([]);
  });

  it('should enable when --block-exotic-subdeps flag is present', async () => {
    const result = await extractExoticSubdepsFlags([
      '--block-exotic-subdeps',
      'lodash',
    ]);

    expect(result.cleanedArgs).toEqual(['lodash']);
    expect(result.exoticSubdepsFlags.enabled).toBe(true);
    expect(result.exoticSubdepsFlags.flags).toContain(
      '--config.block-exotic-subdeps=true'
    );
  });

  it('should disable when --no-block-exotic-subdeps flag is present', async () => {
    vi.mocked(config.readPackageJson).mockResolvedValue({
      name: 'test-package',
      version: '1.0.0',
      unpm: {
        blockExoticSubdeps: true, // enabled in config
      },
    });

    const result = await extractExoticSubdepsFlags([
      '--no-block-exotic-subdeps',
      'lodash',
    ]);

    expect(result.cleanedArgs).toEqual(['lodash']);
    expect(result.exoticSubdepsFlags.enabled).toBe(false);
    expect(result.exoticSubdepsFlags.flags).toEqual([]);
  });

  it('should use config from package.json', async () => {
    vi.mocked(config.readPackageJson).mockResolvedValue({
      name: 'test-package',
      version: '1.0.0',
      unpm: {
        blockExoticSubdeps: true,
      },
    });

    const result = await extractExoticSubdepsFlags(['lodash']);

    expect(result.cleanedArgs).toEqual(['lodash']);
    expect(result.exoticSubdepsFlags.enabled).toBe(true);
    expect(result.exoticSubdepsFlags.flags).toContain(
      '--config.block-exotic-subdeps=true'
    );
  });

  it('should pass through other flags unchanged', async () => {
    const result = await extractExoticSubdepsFlags([
      '--save-dev',
      '--block-exotic-subdeps',
      'lodash',
      '--registry=https://example.com',
    ]);

    expect(result.cleanedArgs).toEqual([
      '--save-dev',
      'lodash',
      '--registry=https://example.com',
    ]);
  });
});
