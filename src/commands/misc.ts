import chalk from 'chalk';
import { spawnPnpm } from '../utils/exec.js';
import { mapNpmFlagsToPnpm, extractPackagesFromArgs } from '../mappers/args.js';
import { isPackageAllowedToRunScripts } from '../security/script-policy.js';
import { logger } from '../utils/logger.js';

export async function init(args: string[]): Promise<number> {
  const pnpmArgs = ['init', ...args];
  const result = await spawnPnpm(pnpmArgs);
  return result.exitCode ?? 0;
}

export async function ls(args: string[]): Promise<number> {
  const mappedArgs = mapNpmFlagsToPnpm(args);
  const pnpmArgs = ['ls', ...mappedArgs];
  const result = await spawnPnpm(pnpmArgs);
  return result.exitCode ?? 0;
}

export async function outdated(args: string[]): Promise<number> {
  const mappedArgs = mapNpmFlagsToPnpm(args);
  const pnpmArgs = ['outdated', ...mappedArgs];
  const result = await spawnPnpm(pnpmArgs);
  return result.exitCode ?? 0;
}

export async function version(args: string[]): Promise<number> {
  const pnpmArgs = ['version', ...args];
  const result = await spawnPnpm(pnpmArgs);
  return result.exitCode ?? 0;
}

export async function bin(args: string[]): Promise<number> {
  const pnpmArgs = ['bin', ...args];
  const result = await spawnPnpm(pnpmArgs);
  return result.exitCode ?? 0;
}

export async function root(args: string[]): Promise<number> {
  const pnpmArgs = ['root', ...args];
  const result = await spawnPnpm(pnpmArgs);
  return result.exitCode ?? 0;
}

export async function prefix(args: string[]): Promise<number> {
  const pnpmArgs = ['prefix', ...args];
  const result = await spawnPnpm(pnpmArgs);
  return result.exitCode ?? 0;
}

export async function dedupe(args: string[]): Promise<number> {
  const pnpmArgs = ['dedupe', ...args];
  const result = await spawnPnpm(pnpmArgs);
  return result.exitCode ?? 0;
}

export async function prune(args: string[]): Promise<number> {
  const pnpmArgs = ['prune', ...args];
  const result = await spawnPnpm(pnpmArgs);
  return result.exitCode ?? 0;
}

/**
 * Rebuild packages - only allowed for packages in the allowlist.
 * rebuild explicitly runs install scripts, so we need to verify each package is allowed.
 */
export async function rebuild(args: string[]): Promise<number> {
  const { packages, flags } = extractPackagesFromArgs(args);

  // Check if user explicitly wants to bypass security
  const forceAll = flags.includes('--force-all-scripts');

  if (packages.length === 0 && !forceAll) {
    // Rebuilding all packages - this is dangerous
    logger.warn('');
    logger.warn(
      chalk.yellow(
        '  Warning: `rebuild` without package names would run install scripts for ALL packages.'
      )
    );
    logger.warn('');
    logger.warn("  This bypasses unpm's security protections.");
    logger.warn('');
    logger.warn('  To rebuild specific allowed packages:');
    logger.warn(chalk.cyan('    unpm rebuild <package-name>'));
    logger.warn('');
    logger.warn('  To force rebuild all packages (not recommended):');
    logger.warn(chalk.cyan('    unpm rebuild --force-all-scripts'));
    logger.warn('');
    return 1;
  }

  // Filter to only allowed packages
  const allowedPackages: string[] = [];
  const blockedPackages: string[] = [];

  for (const pkg of packages) {
    if (await isPackageAllowedToRunScripts(pkg)) {
      allowedPackages.push(pkg);
    } else {
      blockedPackages.push(pkg);
    }
  }

  // Warn about blocked packages
  if (blockedPackages.length > 0) {
    logger.warn('');
    logger.warn(
      chalk.yellow(
        `  The following packages are not in the allowlist and will be skipped:`
      )
    );
    for (const pkg of blockedPackages) {
      logger.warn(chalk.yellow(`    - ${pkg}`));
    }
    logger.warn('');
    logger.warn("  To allow a package's scripts, run:");
    logger.warn(chalk.cyan('    unpm allow-scripts add <package-name>'));
    logger.warn('');
  }

  if (allowedPackages.length === 0 && !forceAll) {
    logger.error(
      'No packages to rebuild (all were blocked by security policy)'
    );
    return 1;
  }

  // Build the pnpm args
  const pnpmArgs = forceAll
    ? ['rebuild', ...flags.filter((f) => f !== '--force-all-scripts')]
    : ['rebuild', ...allowedPackages, ...flags];

  const result = await spawnPnpm(pnpmArgs);
  return result.exitCode ?? 0;
}

export async function why(args: string[]): Promise<number> {
  const pnpmArgs = ['why', ...args];
  const result = await spawnPnpm(pnpmArgs);
  return result.exitCode ?? 0;
}

export async function help(args: string[]): Promise<number> {
  const pnpmArgs = ['help', ...args];
  const result = await spawnPnpm(pnpmArgs);
  return result.exitCode ?? 0;
}

export async function completion(args: string[]): Promise<number> {
  const pnpmArgs = ['completion', ...args];
  const result = await spawnPnpm(pnpmArgs);
  return result.exitCode ?? 0;
}
