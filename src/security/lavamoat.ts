import {
  getLavamoatAllowScripts,
  setLavamoatAllowScripts,
  readPackageJson,
  writePackageJson,
} from '../utils/config.js';
import { logger } from '../utils/logger.js';

export async function addToAllowlist(
  packageName: string,
  cwd?: string
): Promise<void> {
  const allowScripts = await getLavamoatAllowScripts(cwd);
  allowScripts[packageName] = true;
  await setLavamoatAllowScripts(allowScripts, cwd);
  logger.success(`Added "${packageName}" to allow-scripts list`);
}

export async function removeFromAllowlist(
  packageName: string,
  cwd?: string
): Promise<void> {
  const allowScripts = await getLavamoatAllowScripts(cwd);
  delete allowScripts[packageName];
  await setLavamoatAllowScripts(allowScripts, cwd);
  logger.success(`Removed "${packageName}" from allow-scripts list`);
}

export async function listAllowlist(cwd?: string): Promise<string[]> {
  const allowScripts = await getLavamoatAllowScripts(cwd);
  return Object.entries(allowScripts)
    .filter(([_, allowed]) => allowed === true)
    .map(([pkg]) => pkg);
}

export async function isInAllowlist(
  packageName: string,
  cwd?: string
): Promise<boolean> {
  const allowScripts = await getLavamoatAllowScripts(cwd);
  return allowScripts[packageName] === true;
}

export async function initializeLavamoatConfig(cwd?: string): Promise<void> {
  const packageJson = await readPackageJson(cwd);

  if (!packageJson) {
    throw new Error('package.json not found');
  }

  if (!packageJson.lavamoat) {
    packageJson.lavamoat = {
      allowScripts: {},
    };
    await writePackageJson(packageJson, cwd);
    logger.success('Initialized lavamoat configuration in package.json');
  } else {
    logger.info('lavamoat configuration already exists in package.json');
  }
}

export async function hasLavamoatConfig(cwd?: string): Promise<boolean> {
  const packageJson = await readPackageJson(cwd);
  return !!packageJson?.lavamoat;
}
