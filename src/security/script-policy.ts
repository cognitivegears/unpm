import chalk from 'chalk';
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { getLavamoatAllowScripts, readPackageJson, fileExists } from '../utils/config.js';
import { logger } from '../utils/logger.js';
import { execPnpm } from '../utils/exec.js';

// Re-export UnpmConfig as ScriptPolicy for backwards compatibility
export type { UnpmConfig as ScriptPolicy } from '../utils/config.js';

export interface PackageScripts {
  preinstall?: string;
  install?: string;
  postinstall?: string;
  prepublish?: string;
  preprepare?: string;
  prepare?: string;
  postprepare?: string;
}

const INSTALL_SCRIPTS = [
  'preinstall',
  'install',
  'postinstall',
  'prepublish',
  'preprepare',
  'prepare',
  'postprepare',
] as const;

/**
 * Check if a package is allowed to run scripts based on the allowlist.
 */
export async function isPackageAllowedToRunScripts(
  packageName: string,
  cwd?: string
): Promise<boolean> {
  const packageJson = await readPackageJson(cwd);
  const unpmConfig = packageJson?.['unpm'] as { trustedPackages?: string[]; lavamoatEnabled?: boolean; allowDependencyScripts?: boolean } | undefined;

  // Check if all dependency scripts are allowed (not recommended)
  if (unpmConfig?.allowDependencyScripts === true) {
    return true;
  }

  // Check trusted packages list
  if (unpmConfig?.trustedPackages?.includes(packageName)) {
    return true;
  }

  // Check LavaMoat allowlist (default behavior)
  if (unpmConfig?.lavamoatEnabled !== false) {
    const allowScripts = await getLavamoatAllowScripts(cwd);
    if (allowScripts[packageName] === true) {
      return true;
    }
  }

  return false;
}

/**
 * Print a warning when a package's scripts are blocked.
 */
export function printScriptBlockedWarning(packageName: string): void {
  logger.warn('');
  logger.warn(
    chalk.yellow(
      `  Package "${packageName}" has install scripts but is not in the allowlist.`
    )
  );
  logger.warn('');
  logger.warn('  To allow this package\'s scripts, run:');
  logger.warn(chalk.cyan(`    unpm allow-scripts add ${packageName}`));
  logger.warn('');
}

/**
 * Get install scripts from the local package.json.
 */
export async function getLocalPackageScripts(cwd?: string): Promise<PackageScripts> {
  const packageJson = await readPackageJson(cwd);
  if (!packageJson?.scripts) {
    return {};
  }

  const scripts: PackageScripts = {};
  for (const scriptName of INSTALL_SCRIPTS) {
    if (packageJson.scripts[scriptName]) {
      scripts[scriptName] = packageJson.scripts[scriptName];
    }
  }
  return scripts;
}

/**
 * Run local package scripts (preinstall, install, postinstall, etc.).
 * These are scripts defined in the project's own package.json.
 */
export async function runLocalScripts(
  phase: 'preinstall' | 'postinstall',
  cwd?: string
): Promise<void> {
  const scripts = await getLocalPackageScripts(cwd);

  if (phase === 'preinstall') {
    // Run preinstall before installation
    if (scripts.preinstall) {
      logger.info('Running preinstall script...');
      await runScript('preinstall', cwd);
    }
  } else if (phase === 'postinstall') {
    // Run install and postinstall after installation
    if (scripts.install) {
      logger.info('Running install script...');
      await runScript('install', cwd);
    }
    if (scripts.postinstall) {
      logger.info('Running postinstall script...');
      await runScript('postinstall', cwd);
    }
    // Run prepare scripts (commonly used for building)
    if (scripts.preprepare) {
      logger.info('Running preprepare script...');
      await runScript('preprepare', cwd);
    }
    if (scripts.prepare) {
      logger.info('Running prepare script...');
      await runScript('prepare', cwd);
    }
    if (scripts.postprepare) {
      logger.info('Running postprepare script...');
      await runScript('postprepare', cwd);
    }
  }
}

/**
 * Run a specific npm script using pnpm.
 */
async function runScript(scriptName: string, cwd?: string): Promise<void> {
  const result = await execPnpm(['run', scriptName], { cwd, stdio: 'inherit' });
  if (result.exitCode !== 0) {
    throw new Error(`Script "${scriptName}" failed with exit code ${result.exitCode}`);
  }
}

/**
 * Scan node_modules for packages that have install scripts.
 */
export async function getPackagesWithScripts(cwd?: string): Promise<string[]> {
  const dir = cwd ?? process.cwd();
  const nodeModulesPath = join(dir, 'node_modules');

  if (!(await fileExists(nodeModulesPath))) {
    return [];
  }

  const packagesWithScripts: string[] = [];

  try {
    const entries = await readdir(nodeModulesPath, { withFileTypes: true });

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;

      // Handle scoped packages (@org/package)
      if (entry.name.startsWith('@')) {
        const scopePath = join(nodeModulesPath, entry.name);
        const scopedEntries = await readdir(scopePath, { withFileTypes: true });

        for (const scopedEntry of scopedEntries) {
          if (!scopedEntry.isDirectory()) continue;
          const pkgName = `${entry.name}/${scopedEntry.name}`;
          if (await packageHasInstallScripts(join(scopePath, scopedEntry.name))) {
            packagesWithScripts.push(pkgName);
          }
        }
      } else {
        // Regular package
        if (await packageHasInstallScripts(join(nodeModulesPath, entry.name))) {
          packagesWithScripts.push(entry.name);
        }
      }
    }
  } catch (error) {
    logger.debug(`Error scanning node_modules: ${error}`);
  }

  return packagesWithScripts;
}

/**
 * Check if a package directory contains install scripts.
 */
async function packageHasInstallScripts(packagePath: string): Promise<boolean> {
  const packageJsonPath = join(packagePath, 'package.json');

  try {
    const content = await readFile(packageJsonPath, 'utf-8');
    const pkg = JSON.parse(content) as { scripts?: Record<string, string> };

    if (!pkg.scripts) return false;

    return INSTALL_SCRIPTS.some((script) => !!pkg.scripts?.[script]);
  } catch {
    return false;
  }
}

/**
 * Run install scripts for allowed packages.
 * This should be called after pnpm install --ignore-scripts.
 */
export async function runAllowedPackageScripts(cwd?: string): Promise<void> {
  const packagesWithScripts = await getPackagesWithScripts(cwd);

  if (packagesWithScripts.length === 0) {
    return;
  }

  logger.debug(`Found ${packagesWithScripts.length} packages with install scripts`);

  const blockedPackages: string[] = [];

  for (const packageName of packagesWithScripts) {
    const allowed = await isPackageAllowedToRunScripts(packageName, cwd);

    if (allowed) {
      logger.info(`Running scripts for allowed package: ${packageName}`);
      try {
        // Use pnpm rebuild to run the package's install scripts
        await execPnpm(['rebuild', packageName], { cwd, stdio: 'inherit' });
      } catch (error) {
        logger.error(`Failed to run scripts for ${packageName}: ${error}`);
      }
    } else {
      blockedPackages.push(packageName);
    }
  }

  // Warn about blocked packages
  if (blockedPackages.length > 0) {
    logger.warn('');
    logger.warn(chalk.yellow(`  ${blockedPackages.length} package(s) have install scripts that were blocked:`));
    for (const pkg of blockedPackages.slice(0, 10)) {
      logger.warn(chalk.yellow(`    - ${pkg}`));
    }
    if (blockedPackages.length > 10) {
      logger.warn(chalk.yellow(`    ... and ${blockedPackages.length - 10} more`));
    }
    logger.warn('');
    logger.warn('  To allow a package\'s scripts, run:');
    logger.warn(chalk.cyan('    unpm allow-scripts add <package-name>'));
    logger.warn('');
  }
}

/**
 * Security flags to add to pnpm commands.
 * Always includes --ignore-scripts for dependency installations.
 */
export function getSecurityFlags(): string[] {
  return ['--ignore-scripts'];
}
