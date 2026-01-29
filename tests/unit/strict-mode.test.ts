import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  isStrictMode,
  getStrictModeConfig,
  validateStrictModeAction,
  removeStrictFlag,
} from '../../src/security/strict-mode.js';
import * as configModule from '../../src/utils/config.js';

// Mock the config module
vi.mock('../../src/utils/config.js', () => ({
  readPackageJson: vi.fn(),
}));

describe('isStrictMode', () => {
  beforeEach(() => {
    // Clear env vars
    delete process.env['UNPM_STRICT'];
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  it('should return true when --strict flag is present', async () => {
    vi.mocked(configModule.readPackageJson).mockResolvedValue(null);
    expect(await isStrictMode(['--strict'])).toBe(true);
  });

  it('should return true when UNPM_STRICT=true', async () => {
    process.env['UNPM_STRICT'] = 'true';
    vi.mocked(configModule.readPackageJson).mockResolvedValue(null);
    expect(await isStrictMode([])).toBe(true);
  });

  it('should return true when UNPM_STRICT=1', async () => {
    process.env['UNPM_STRICT'] = '1';
    vi.mocked(configModule.readPackageJson).mockResolvedValue(null);
    expect(await isStrictMode([])).toBe(true);
  });

  it('should return false when UNPM_STRICT=false', async () => {
    process.env['UNPM_STRICT'] = 'false';
    vi.mocked(configModule.readPackageJson).mockResolvedValue(null);
    expect(await isStrictMode([])).toBe(false);
  });

  it('should return false when UNPM_STRICT=0', async () => {
    process.env['UNPM_STRICT'] = '0';
    vi.mocked(configModule.readPackageJson).mockResolvedValue(null);
    expect(await isStrictMode([])).toBe(false);
  });

  it('should return true when package.json unpm.strict is true', async () => {
    vi.mocked(configModule.readPackageJson).mockResolvedValue({
      name: 'test',
      unpm: { strict: true },
    });
    expect(await isStrictMode([])).toBe(true);
  });

  it('should return true when package.json unpm.strict.enabled is true', async () => {
    vi.mocked(configModule.readPackageJson).mockResolvedValue({
      name: 'test',
      unpm: { strict: { enabled: true } },
    });
    expect(await isStrictMode([])).toBe(true);
  });

  it('should return false when package.json unpm.strict is false', async () => {
    vi.mocked(configModule.readPackageJson).mockResolvedValue({
      name: 'test',
      unpm: { strict: false },
    });
    expect(await isStrictMode([])).toBe(false);
  });

  it('should return false when no strict config is present', async () => {
    vi.mocked(configModule.readPackageJson).mockResolvedValue({
      name: 'test',
    });
    expect(await isStrictMode([])).toBe(false);
  });

  it('should return false when package.json is null', async () => {
    vi.mocked(configModule.readPackageJson).mockResolvedValue(null);
    expect(await isStrictMode([])).toBe(false);
  });

  it('should prioritize CLI flag over env var', async () => {
    process.env['UNPM_STRICT'] = 'false';
    vi.mocked(configModule.readPackageJson).mockResolvedValue(null);
    expect(await isStrictMode(['--strict'])).toBe(true);
  });

  it('should prioritize env var over package.json', async () => {
    process.env['UNPM_STRICT'] = 'true';
    vi.mocked(configModule.readPackageJson).mockResolvedValue({
      name: 'test',
      unpm: { strict: false },
    });
    expect(await isStrictMode([])).toBe(true);
  });
});

describe('getStrictModeConfig', () => {
  beforeEach(() => {
    delete process.env['UNPM_STRICT'];
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  it('should return default non-strict config when not enabled', async () => {
    vi.mocked(configModule.readPackageJson).mockResolvedValue(null);
    const config = await getStrictModeConfig([]);

    expect(config.enabled).toBe(false);
    expect(config.minReleaseAgeDays).toBe(2);
    expect(config.blockDlx).toBe(false);
    expect(config.blockForceScripts).toBe(false);
    expect(config.requireFrozenLockfile).toBe(false);
    expect(config.blockExplore).toBe(false);
  });

  it('should return strict mode defaults when enabled via flag', async () => {
    vi.mocked(configModule.readPackageJson).mockResolvedValue(null);
    const config = await getStrictModeConfig(['--strict']);

    expect(config.enabled).toBe(true);
    expect(config.minReleaseAgeDays).toBe(7);
    expect(config.blockDlx).toBe(true);
    expect(config.blockForceScripts).toBe(true);
    expect(config.requireFrozenLockfile).toBe(true);
    expect(config.blockExplore).toBe(true);
  });

  it('should allow overriding strict mode settings in package.json', async () => {
    vi.mocked(configModule.readPackageJson).mockResolvedValue({
      name: 'test',
      unpm: {
        strict: {
          enabled: true,
          minReleaseAgeDays: 14,
          blockDlx: false,
        },
      },
    });
    const config = await getStrictModeConfig([]);

    expect(config.enabled).toBe(true);
    expect(config.minReleaseAgeDays).toBe(14);
    expect(config.blockDlx).toBe(false);
    expect(config.blockForceScripts).toBe(true); // Still default
  });
});

describe('validateStrictModeAction', () => {
  beforeEach(() => {
    delete process.env['UNPM_STRICT'];
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  it('should allow dlx when not in strict mode', async () => {
    vi.mocked(configModule.readPackageJson).mockResolvedValue(null);
    const result = await validateStrictModeAction('dlx', []);
    expect(result.allowed).toBe(true);
  });

  it('should block dlx in strict mode', async () => {
    vi.mocked(configModule.readPackageJson).mockResolvedValue(null);
    const result = await validateStrictModeAction('dlx', ['--strict']);
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('dlx is blocked in strict mode');
  });

  it('should allow force-scripts when not in strict mode', async () => {
    vi.mocked(configModule.readPackageJson).mockResolvedValue(null);
    const result = await validateStrictModeAction('force-scripts', []);
    expect(result.allowed).toBe(true);
  });

  it('should block force-scripts in strict mode', async () => {
    vi.mocked(configModule.readPackageJson).mockResolvedValue(null);
    const result = await validateStrictModeAction('force-scripts', ['--strict']);
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('--force-scripts is blocked in strict mode');
  });

  it('should allow explore when not in strict mode', async () => {
    vi.mocked(configModule.readPackageJson).mockResolvedValue(null);
    const result = await validateStrictModeAction('explore', []);
    expect(result.allowed).toBe(true);
  });

  it('should block explore in strict mode', async () => {
    vi.mocked(configModule.readPackageJson).mockResolvedValue(null);
    const result = await validateStrictModeAction('explore', ['--strict']);
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('explore is blocked in strict mode');
  });

  it('should allow dlx in strict mode when blockDlx is false', async () => {
    vi.mocked(configModule.readPackageJson).mockResolvedValue({
      name: 'test',
      unpm: {
        strict: {
          enabled: true,
          blockDlx: false,
        },
      },
    });
    const result = await validateStrictModeAction('dlx', []);
    expect(result.allowed).toBe(true);
  });
});

describe('removeStrictFlag', () => {
  it('should remove --strict flag from args', () => {
    const result = removeStrictFlag(['--strict', 'package', '--dev']);
    expect(result).toEqual(['package', '--dev']);
  });

  it('should handle args without --strict flag', () => {
    const result = removeStrictFlag(['package', '--dev']);
    expect(result).toEqual(['package', '--dev']);
  });

  it('should handle empty array', () => {
    const result = removeStrictFlag([]);
    expect(result).toEqual([]);
  });

  it('should remove multiple --strict flags', () => {
    const result = removeStrictFlag(['--strict', 'package', '--strict']);
    expect(result).toEqual(['package']);
  });
});
