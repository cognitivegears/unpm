import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  isGitRepo,
  isInGitignore,
  checkLockfile,
} from '../../src/security/lockfile.js';
import * as configModule from '../../src/utils/config.js';
import * as strictModeModule from '../../src/security/strict-mode.js';
import * as fsPromises from 'node:fs/promises';

// Mock the modules
vi.mock('../../src/utils/config.js', () => ({
  fileExists: vi.fn(),
  hasPnpmLock: vi.fn(),
}));

vi.mock('../../src/security/strict-mode.js', () => ({
  isStrictMode: vi.fn(),
}));

vi.mock('node:fs/promises', () => ({
  readFile: vi.fn(),
}));

describe('isGitRepo', () => {
  afterEach(() => {
    vi.resetAllMocks();
  });

  it('should return true when .git directory exists', async () => {
    vi.mocked(configModule.fileExists).mockResolvedValue(true);
    expect(await isGitRepo('/test/path')).toBe(true);
    expect(configModule.fileExists).toHaveBeenCalledWith('/test/path/.git');
  });

  it('should return false when .git directory does not exist', async () => {
    vi.mocked(configModule.fileExists).mockResolvedValue(false);
    expect(await isGitRepo('/test/path')).toBe(false);
  });

  it('should use process.cwd() when no cwd provided', async () => {
    vi.mocked(configModule.fileExists).mockResolvedValue(true);
    await isGitRepo();
    expect(configModule.fileExists).toHaveBeenCalledWith(expect.stringContaining('.git'));
  });
});

describe('isInGitignore', () => {
  afterEach(() => {
    vi.resetAllMocks();
  });

  it('should return true when filename is in .gitignore', async () => {
    vi.mocked(fsPromises.readFile).mockResolvedValue('node_modules\npnpm-lock.yaml\n');
    expect(await isInGitignore('pnpm-lock.yaml', '/test/path')).toBe(true);
  });

  it('should return true when filename with leading slash is in .gitignore', async () => {
    vi.mocked(fsPromises.readFile).mockResolvedValue('/pnpm-lock.yaml\n');
    expect(await isInGitignore('pnpm-lock.yaml', '/test/path')).toBe(true);
  });

  it('should return true when wildcard pattern matches', async () => {
    vi.mocked(fsPromises.readFile).mockResolvedValue('*.yaml\n');
    expect(await isInGitignore('pnpm-lock.yaml', '/test/path')).toBe(true);
  });

  it('should return false when filename is not in .gitignore', async () => {
    vi.mocked(fsPromises.readFile).mockResolvedValue('node_modules\n.env\n');
    expect(await isInGitignore('pnpm-lock.yaml', '/test/path')).toBe(false);
  });

  it('should ignore comments in .gitignore', async () => {
    vi.mocked(fsPromises.readFile).mockResolvedValue('# pnpm-lock.yaml\nnode_modules\n');
    expect(await isInGitignore('pnpm-lock.yaml', '/test/path')).toBe(false);
  });

  it('should ignore empty lines in .gitignore', async () => {
    vi.mocked(fsPromises.readFile).mockResolvedValue('node_modules\n\n\n');
    expect(await isInGitignore('pnpm-lock.yaml', '/test/path')).toBe(false);
  });

  it('should return false when .gitignore does not exist', async () => {
    vi.mocked(fsPromises.readFile).mockRejectedValue(new Error('ENOENT'));
    expect(await isInGitignore('pnpm-lock.yaml', '/test/path')).toBe(false);
  });
});

describe('checkLockfile', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  it('should return no messages when lockfile exists and is not gitignored', async () => {
    vi.mocked(strictModeModule.isStrictMode).mockResolvedValue(false);
    vi.mocked(configModule.hasPnpmLock).mockResolvedValue(true);
    vi.mocked(configModule.fileExists).mockResolvedValue(true);
    vi.mocked(fsPromises.readFile).mockResolvedValue('node_modules\n');

    const result = await checkLockfile([], '/test/path');

    expect(result.allowed).toBe(true);
    expect(result.hasLockfile).toBe(true);
    expect(result.isGitignored).toBe(false);
    expect(result.messages).toHaveLength(0);
  });

  it('should warn when lockfile is missing in normal mode', async () => {
    vi.mocked(strictModeModule.isStrictMode).mockResolvedValue(false);
    vi.mocked(configModule.hasPnpmLock).mockResolvedValue(false);
    vi.mocked(configModule.fileExists).mockResolvedValue(false);

    const result = await checkLockfile([], '/test/path');

    expect(result.allowed).toBe(true);
    expect(result.hasLockfile).toBe(false);
    expect(result.messages.length).toBeGreaterThan(0);
    expect(result.messages[0]).toContain('No pnpm-lock.yaml found');
  });

  it('should error when lockfile is missing in strict mode', async () => {
    vi.mocked(strictModeModule.isStrictMode).mockResolvedValue(true);
    vi.mocked(configModule.hasPnpmLock).mockResolvedValue(false);
    vi.mocked(configModule.fileExists).mockResolvedValue(false);

    const result = await checkLockfile(['--strict'], '/test/path');

    expect(result.allowed).toBe(false);
    expect(result.hasLockfile).toBe(false);
    expect(result.messages.length).toBeGreaterThan(0);
    expect(result.messages[0]).toContain('required in strict mode');
  });

  it('should warn when lockfile is gitignored in normal mode', async () => {
    vi.mocked(strictModeModule.isStrictMode).mockResolvedValue(false);
    vi.mocked(configModule.hasPnpmLock).mockResolvedValue(true);
    vi.mocked(configModule.fileExists).mockResolvedValue(true);
    vi.mocked(fsPromises.readFile).mockResolvedValue('pnpm-lock.yaml\n');

    const result = await checkLockfile([], '/test/path');

    expect(result.allowed).toBe(true);
    expect(result.hasLockfile).toBe(true);
    expect(result.isGitignored).toBe(true);
    expect(result.messages.length).toBeGreaterThan(0);
    expect(result.messages[0]).toContain('in .gitignore');
  });

  it('should error when lockfile is gitignored in strict mode', async () => {
    vi.mocked(strictModeModule.isStrictMode).mockResolvedValue(true);
    vi.mocked(configModule.hasPnpmLock).mockResolvedValue(true);
    vi.mocked(configModule.fileExists).mockResolvedValue(true);
    vi.mocked(fsPromises.readFile).mockResolvedValue('pnpm-lock.yaml\n');

    const result = await checkLockfile(['--strict'], '/test/path');

    expect(result.allowed).toBe(false);
    expect(result.hasLockfile).toBe(true);
    expect(result.isGitignored).toBe(true);
    expect(result.messages.length).toBeGreaterThan(0);
    expect(result.messages[0]).toContain('must be committed in strict mode');
  });

  it('should not check gitignore when not in a git repo', async () => {
    vi.mocked(strictModeModule.isStrictMode).mockResolvedValue(false);
    vi.mocked(configModule.hasPnpmLock).mockResolvedValue(true);
    vi.mocked(configModule.fileExists).mockResolvedValue(false); // No .git directory

    const result = await checkLockfile([], '/test/path');

    expect(result.allowed).toBe(true);
    expect(result.hasLockfile).toBe(true);
    expect(result.isGitignored).toBeUndefined();
    expect(result.messages).toHaveLength(0);
  });
});
