import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFile, writeFile, access } from 'node:fs/promises';
import {
  readPackageJson,
  writePackageJson,
  fileExists,
  getLavamoatAllowScripts,
  setLavamoatAllowScripts,
} from '../../src/utils/config.js';

vi.mock('node:fs/promises');

describe('fileExists', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('should return true when file exists', async () => {
    vi.mocked(access).mockResolvedValue(undefined);
    expect(await fileExists('/some/path')).toBe(true);
  });

  it('should return false when file does not exist', async () => {
    vi.mocked(access).mockRejectedValue(new Error('ENOENT'));
    expect(await fileExists('/some/path')).toBe(false);
  });
});

describe('readPackageJson', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('should return parsed package.json', async () => {
    const mockPackageJson = { name: 'test', version: '1.0.0' };
    vi.mocked(readFile).mockResolvedValue(JSON.stringify(mockPackageJson));

    const result = await readPackageJson('/test');
    expect(result).toEqual(mockPackageJson);
  });

  it('should return null when file not found', async () => {
    vi.mocked(readFile).mockRejectedValue(new Error('ENOENT'));

    const result = await readPackageJson('/test');
    expect(result).toBeNull();
  });
});

describe('writePackageJson', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('should write formatted JSON', async () => {
    vi.mocked(writeFile).mockResolvedValue(undefined);
    const packageJson = { name: 'test', version: '1.0.0' };

    await writePackageJson(packageJson, '/test');

    expect(writeFile).toHaveBeenCalledWith(
      '/test/package.json',
      JSON.stringify(packageJson, null, 2) + '\n'
    );
  });
});

describe('getLavamoatAllowScripts', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('should return empty object when no config', async () => {
    vi.mocked(readFile).mockResolvedValue(JSON.stringify({ name: 'test' }));

    const result = await getLavamoatAllowScripts('/test');
    expect(result).toEqual({});
  });

  it('should return allowScripts from lavamoat config', async () => {
    const mockPackageJson = {
      name: 'test',
      lavamoat: { allowScripts: { esbuild: true } },
    };
    vi.mocked(readFile).mockResolvedValue(JSON.stringify(mockPackageJson));

    const result = await getLavamoatAllowScripts('/test');
    expect(result).toEqual({ esbuild: true });
  });
});

describe('setLavamoatAllowScripts', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('should update allowScripts in package.json', async () => {
    const mockPackageJson = { name: 'test', lavamoat: {} };
    vi.mocked(readFile).mockResolvedValue(JSON.stringify(mockPackageJson));
    vi.mocked(writeFile).mockResolvedValue(undefined);

    await setLavamoatAllowScripts({ esbuild: true }, '/test');

    expect(writeFile).toHaveBeenCalledWith(
      '/test/package.json',
      expect.stringContaining('"esbuild": true')
    );
  });

  it('should throw when no package.json', async () => {
    vi.mocked(readFile).mockRejectedValue(new Error('ENOENT'));

    await expect(
      setLavamoatAllowScripts({ esbuild: true }, '/test')
    ).rejects.toThrow('package.json not found');
  });
});
