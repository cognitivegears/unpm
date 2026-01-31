import { readFile, writeFile, access } from 'node:fs/promises';
import { join } from 'node:path';

export interface PackageJson {
  name?: string;
  version?: string;
  scripts?: Record<string, string>;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
  optionalDependencies?: Record<string, string>;
  lavamoat?: LavamoatConfig;
  [key: string]: unknown;
}

export interface LavamoatConfig {
  allowScripts?: Record<string, boolean>;
}

export interface UnpmConfig {
  allowLocalScripts: boolean;
  allowDependencyScripts: boolean;
  trustedPackages: string[];
  lavamoatEnabled: boolean;
}

const defaultConfig: UnpmConfig = {
  allowLocalScripts: true,
  allowDependencyScripts: false,
  trustedPackages: [],
  lavamoatEnabled: true,
};

export async function fileExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

export async function readPackageJson(
  cwd?: string
): Promise<PackageJson | null> {
  const dir = cwd ?? process.cwd();
  const packageJsonPath = join(dir, 'package.json');

  try {
    const content = await readFile(packageJsonPath, 'utf-8');
    return JSON.parse(content) as PackageJson;
  } catch {
    return null;
  }
}

export async function writePackageJson(
  packageJson: PackageJson,
  cwd?: string
): Promise<void> {
  const dir = cwd ?? process.cwd();
  const packageJsonPath = join(dir, 'package.json');
  await writeFile(packageJsonPath, JSON.stringify(packageJson, null, 2) + '\n');
}

export async function getUnpmConfig(cwd?: string): Promise<UnpmConfig> {
  const packageJson = await readPackageJson(cwd);

  if (!packageJson) {
    return defaultConfig;
  }

  const unpmConfig = packageJson['unpm'] as Partial<UnpmConfig> | undefined;

  return {
    ...defaultConfig,
    ...unpmConfig,
  };
}

export async function getLavamoatAllowScripts(
  cwd?: string
): Promise<Record<string, boolean>> {
  const packageJson = await readPackageJson(cwd);

  if (!packageJson?.lavamoat?.allowScripts) {
    return {};
  }

  return packageJson.lavamoat.allowScripts;
}

export async function setLavamoatAllowScripts(
  allowScripts: Record<string, boolean>,
  cwd?: string
): Promise<void> {
  const packageJson = await readPackageJson(cwd);

  if (!packageJson) {
    throw new Error('package.json not found');
  }

  packageJson.lavamoat = {
    ...packageJson.lavamoat,
    allowScripts,
  };

  await writePackageJson(packageJson, cwd);
}

export async function hasPackageLock(cwd?: string): Promise<boolean> {
  const dir = cwd ?? process.cwd();
  return fileExists(join(dir, 'package-lock.json'));
}

export async function hasPnpmLock(cwd?: string): Promise<boolean> {
  const dir = cwd ?? process.cwd();
  return fileExists(join(dir, 'pnpm-lock.yaml'));
}

/**
 * Check if the project has been migrated to pnpm.
 * A project is considered migrated if pnpm-lock.yaml exists.
 */
export async function isMigrated(cwd?: string): Promise<boolean> {
  return hasPnpmLock(cwd);
}
