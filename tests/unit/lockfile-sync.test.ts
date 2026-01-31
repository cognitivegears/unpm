import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  detectMigrationMode,
  preSyncLockfile,
  postSyncLockfile,
  cleanupTempLockfile,
  isMigrated,
} from '../../src/security/lockfile-sync.js';
import * as configModule from '../../src/utils/config.js';
import * as execModule from '../../src/utils/exec.js';
import * as strictModeModule from '../../src/security/strict-mode.js';
import * as fsPromises from 'node:fs/promises';

// Mock the modules
vi.mock('../../src/utils/config.js', () => ({
  hasPackageLock: vi.fn(),
  hasPnpmLock: vi.fn(),
  fileExists: vi.fn(),
}));

vi.mock('../../src/utils/exec.js', () => ({
  execPnpm: vi.fn(),
  execNpm: vi.fn(),
}));

vi.mock('../../src/security/strict-mode.js', () => ({
  isStrictMode: vi.fn(),
}));

vi.mock('node:fs/promises', () => ({
  unlink: vi.fn(),
}));

describe('detectMigrationMode', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('should return pre-migration when pnpm-lock.yaml does not exist', async () => {
    vi.mocked(configModule.hasPnpmLock).mockResolvedValue(false);
    vi.mocked(configModule.hasPackageLock).mockResolvedValue(true);

    const result = await detectMigrationMode('/test/path');

    expect(result.mode).toBe('pre-migration');
    expect(result.hasPackageLock).toBe(true);
    expect(result.hasPnpmLock).toBe(false);
  });

  it('should return post-migration when pnpm-lock.yaml exists', async () => {
    vi.mocked(configModule.hasPnpmLock).mockResolvedValue(true);
    vi.mocked(configModule.hasPackageLock).mockResolvedValue(false);

    const result = await detectMigrationMode('/test/path');

    expect(result.mode).toBe('post-migration');
    expect(result.hasPackageLock).toBe(false);
    expect(result.hasPnpmLock).toBe(true);
  });

  it('should return post-migration when both lockfiles exist', async () => {
    vi.mocked(configModule.hasPnpmLock).mockResolvedValue(true);
    vi.mocked(configModule.hasPackageLock).mockResolvedValue(true);

    const result = await detectMigrationMode('/test/path');

    expect(result.mode).toBe('post-migration');
    expect(result.hasPackageLock).toBe(true);
    expect(result.hasPnpmLock).toBe(true);
  });

  it('should return pre-migration when no lockfiles exist', async () => {
    vi.mocked(configModule.hasPnpmLock).mockResolvedValue(false);
    vi.mocked(configModule.hasPackageLock).mockResolvedValue(false);

    const result = await detectMigrationMode('/test/path');

    expect(result.mode).toBe('pre-migration');
    expect(result.hasPackageLock).toBe(false);
    expect(result.hasPnpmLock).toBe(false);
  });
});

describe('preSyncLockfile', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('should skip sync when package-lock.json does not exist', async () => {
    vi.mocked(configModule.hasPackageLock).mockResolvedValue(false);
    vi.mocked(strictModeModule.isStrictMode).mockResolvedValue(false);

    const result = await preSyncLockfile([], '/test/path');

    expect(result).toBe(true);
    expect(execModule.execPnpm).not.toHaveBeenCalled();
  });

  it('should run pnpm import when package-lock.json exists', async () => {
    vi.mocked(configModule.hasPackageLock).mockResolvedValue(true);
    vi.mocked(strictModeModule.isStrictMode).mockResolvedValue(false);
    vi.mocked(execModule.execPnpm).mockResolvedValue({
      exitCode: 0,
      stdout: '',
      stderr: '',
    });

    const result = await preSyncLockfile([], '/test/path');

    expect(result).toBe(true);
    expect(execModule.execPnpm).toHaveBeenCalledWith(['import'], {
      cwd: '/test/path',
      stdio: 'pipe',
    });
  });

  it('should warn and continue in normal mode when pnpm import fails', async () => {
    vi.mocked(configModule.hasPackageLock).mockResolvedValue(true);
    vi.mocked(strictModeModule.isStrictMode).mockResolvedValue(false);
    vi.mocked(execModule.execPnpm).mockResolvedValue({
      exitCode: 1,
      stdout: '',
      stderr: 'error',
    });

    const result = await preSyncLockfile([], '/test/path');

    expect(result).toBe(true);
  });

  it('should fail in strict mode when pnpm import fails', async () => {
    vi.mocked(configModule.hasPackageLock).mockResolvedValue(true);
    vi.mocked(strictModeModule.isStrictMode).mockResolvedValue(true);
    vi.mocked(execModule.execPnpm).mockResolvedValue({
      exitCode: 1,
      stdout: '',
      stderr: 'error',
    });

    const result = await preSyncLockfile(['--strict'], '/test/path');

    expect(result).toBe(false);
  });
});

describe('postSyncLockfile', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('should skip sync when pnpm-lock.yaml does not exist', async () => {
    vi.mocked(configModule.hasPnpmLock).mockResolvedValue(false);
    vi.mocked(strictModeModule.isStrictMode).mockResolvedValue(false);

    const result = await postSyncLockfile([], '/test/path');

    expect(result).toBe(true);
    expect(execModule.execPnpm).not.toHaveBeenCalled();
  });

  it('should use pnpm-lock-export when available', async () => {
    vi.mocked(configModule.hasPnpmLock).mockResolvedValue(true);
    vi.mocked(strictModeModule.isStrictMode).mockResolvedValue(false);
    vi.mocked(execModule.execPnpm).mockResolvedValue({
      exitCode: 0,
      stdout: '',
      stderr: '',
    });

    const result = await postSyncLockfile([], '/test/path');

    expect(result).toBe(true);
    expect(execModule.execPnpm).toHaveBeenCalledWith(
      ['dlx', 'pnpm-lock-export', '--output', 'package-lock.json'],
      { cwd: '/test/path', stdio: 'pipe' }
    );
  });

  it('should fallback to npm when pnpm-lock-export fails', async () => {
    vi.mocked(configModule.hasPnpmLock).mockResolvedValue(true);
    vi.mocked(strictModeModule.isStrictMode).mockResolvedValue(false);
    vi.mocked(execModule.execPnpm).mockResolvedValue({
      exitCode: 1,
      stdout: '',
      stderr: 'error',
    });
    vi.mocked(execModule.execNpm).mockResolvedValue({
      exitCode: 0,
      stdout: '',
      stderr: '',
    });

    const result = await postSyncLockfile([], '/test/path');

    expect(result).toBe(true);
    expect(execModule.execNpm).toHaveBeenCalledWith(
      ['install', '--package-lock-only', '--ignore-scripts'],
      { cwd: '/test/path', stdio: 'pipe' }
    );
  });

  it('should warn and continue in normal mode when both methods fail', async () => {
    vi.mocked(configModule.hasPnpmLock).mockResolvedValue(true);
    vi.mocked(strictModeModule.isStrictMode).mockResolvedValue(false);
    vi.mocked(execModule.execPnpm).mockResolvedValue({
      exitCode: 1,
      stdout: '',
      stderr: 'error',
    });
    vi.mocked(execModule.execNpm).mockResolvedValue({
      exitCode: 1,
      stdout: '',
      stderr: 'error',
    });

    const result = await postSyncLockfile([], '/test/path');

    expect(result).toBe(true);
  });

  it('should fail in strict mode when both methods fail', async () => {
    vi.mocked(configModule.hasPnpmLock).mockResolvedValue(true);
    vi.mocked(strictModeModule.isStrictMode).mockResolvedValue(true);
    vi.mocked(execModule.execPnpm).mockResolvedValue({
      exitCode: 1,
      stdout: '',
      stderr: 'error',
    });
    vi.mocked(execModule.execNpm).mockResolvedValue({
      exitCode: 1,
      stdout: '',
      stderr: 'error',
    });

    const result = await postSyncLockfile(['--strict'], '/test/path');

    expect(result).toBe(false);
  });
});

describe('cleanupTempLockfile', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('should delete pnpm-lock.yaml when it exists', async () => {
    vi.mocked(configModule.fileExists).mockResolvedValue(true);
    vi.mocked(fsPromises.unlink).mockResolvedValue(undefined);

    await cleanupTempLockfile('/test/path');

    expect(fsPromises.unlink).toHaveBeenCalledWith('/test/path/pnpm-lock.yaml');
  });

  it('should do nothing when pnpm-lock.yaml does not exist', async () => {
    vi.mocked(configModule.fileExists).mockResolvedValue(false);

    await cleanupTempLockfile('/test/path');

    expect(fsPromises.unlink).not.toHaveBeenCalled();
  });

  it('should handle errors gracefully', async () => {
    vi.mocked(configModule.fileExists).mockResolvedValue(true);
    vi.mocked(fsPromises.unlink).mockRejectedValue(new Error('EACCES'));

    // Should not throw
    await expect(cleanupTempLockfile('/test/path')).resolves.toBeUndefined();
  });
});

describe('isMigrated', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('should return true when pnpm-lock.yaml exists', async () => {
    vi.mocked(configModule.hasPnpmLock).mockResolvedValue(true);

    const result = await isMigrated('/test/path');

    expect(result).toBe(true);
  });

  it('should return false when pnpm-lock.yaml does not exist', async () => {
    vi.mocked(configModule.hasPnpmLock).mockResolvedValue(false);

    const result = await isMigrated('/test/path');

    expect(result).toBe(false);
  });
});
