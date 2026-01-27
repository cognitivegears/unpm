import { spawnPnpm } from '../utils/exec.js';
import { mapNpmFlagsToPnpm, mapNpmCiToPnpm, extractPackagesFromArgs } from '../mappers/args.js';
import {
  runLocalScripts,
  runAllowedPackageScripts,
  getSecurityFlags,
} from '../security/script-policy.js';
import {
  extractReleaseAgeFlags,
  formatDuration,
} from '../security/release-age.js';
import { logger } from '../utils/logger.js';

/**
 * Install dependencies with security protections.
 * - Always runs pnpm with --ignore-scripts to block dependency scripts
 * - Enforces minimum release age for packages (default: 2 days)
 * - Runs local package scripts (preinstall, postinstall, etc.) after installation
 * - Runs scripts for packages in the allowlist
 */
export async function install(args: string[]): Promise<number> {
  // Extract release age flags first
  const { cleanedArgs, releaseAgeFlags } = await extractReleaseAgeFlags(args);

  const { packages, flags } = extractPackagesFromArgs(cleanedArgs);
  let mappedFlags = mapNpmFlagsToPnpm(flags);

  // Check if user explicitly wants scripts
  const userWantsScripts = flags.some(
    (f) => f === '--ignore-scripts=false' || f === '--no-ignore-scripts'
  );

  // Always add --ignore-scripts unless user explicitly opts out
  if (!userWantsScripts && !mappedFlags.includes('--ignore-scripts')) {
    mappedFlags = [...getSecurityFlags(), ...mappedFlags];
  }

  // Add release age flags
  mappedFlags = [...releaseAgeFlags.flags, ...mappedFlags];

  // Log security info
  if (releaseAgeFlags.minAgeMinutes > 0) {
    logger.debug(`Minimum release age: ${formatDuration(releaseAgeFlags.minAgeMinutes)}`);
  }

  // Run preinstall scripts from local package.json
  if (!userWantsScripts) {
    try {
      await runLocalScripts('preinstall');
    } catch (error) {
      logger.error(`Preinstall script failed: ${error}`);
      return 1;
    }
  }

  // Run pnpm install
  const pnpmArgs = ['install', ...packages, ...mappedFlags];
  const result = await spawnPnpm(pnpmArgs);

  if (result.exitCode !== 0) {
    return result.exitCode ?? 1;
  }

  // Run postinstall scripts from local package.json and allowed packages
  if (!userWantsScripts) {
    try {
      // Run scripts for allowed dependency packages
      await runAllowedPackageScripts();

      // Run local package scripts (install, postinstall, prepare, etc.)
      await runLocalScripts('postinstall');
    } catch (error) {
      logger.error(`Postinstall script failed: ${error}`);
      return 1;
    }
  }

  return 0;
}

/**
 * CI install - frozen lockfile with security protections.
 */
export async function ci(args: string[]): Promise<number> {
  // Extract release age flags first
  const { cleanedArgs, releaseAgeFlags } = await extractReleaseAgeFlags(args);

  let mappedArgs = mapNpmCiToPnpm(cleanedArgs);

  // Check if user explicitly wants scripts
  const userWantsScripts = cleanedArgs.some(
    (f) => f === '--ignore-scripts=false' || f === '--no-ignore-scripts'
  );

  // Always add --ignore-scripts unless user explicitly opts out
  if (!userWantsScripts && !mappedArgs.includes('--ignore-scripts')) {
    mappedArgs = [...getSecurityFlags(), ...mappedArgs];
  }

  // Add release age flags
  mappedArgs = [...releaseAgeFlags.flags, ...mappedArgs];

  // Run preinstall scripts from local package.json
  if (!userWantsScripts) {
    try {
      await runLocalScripts('preinstall');
    } catch (error) {
      logger.error(`Preinstall script failed: ${error}`);
      return 1;
    }
  }

  // Run pnpm install with frozen lockfile
  const pnpmArgs = ['install', ...mappedArgs];
  const result = await spawnPnpm(pnpmArgs);

  if (result.exitCode !== 0) {
    return result.exitCode ?? 1;
  }

  // Run postinstall scripts
  if (!userWantsScripts) {
    try {
      await runAllowedPackageScripts();
      await runLocalScripts('postinstall');
    } catch (error) {
      logger.error(`Postinstall script failed: ${error}`);
      return 1;
    }
  }

  return 0;
}

/**
 * Add packages with security protections.
 */
export async function add(args: string[]): Promise<number> {
  // Extract release age flags first
  const { cleanedArgs, releaseAgeFlags } = await extractReleaseAgeFlags(args);

  const { packages, flags } = extractPackagesFromArgs(cleanedArgs);
  let mappedFlags = mapNpmFlagsToPnpm(flags);

  // Check if user explicitly wants scripts
  const userWantsScripts = flags.some(
    (f) => f === '--ignore-scripts=false' || f === '--no-ignore-scripts'
  );

  // Always add --ignore-scripts unless user explicitly opts out
  if (!userWantsScripts && !mappedFlags.includes('--ignore-scripts')) {
    mappedFlags = [...getSecurityFlags(), ...mappedFlags];
  }

  // Add release age flags
  mappedFlags = [...releaseAgeFlags.flags, ...mappedFlags];

  // Run pnpm add
  const pnpmArgs = ['add', ...packages, ...mappedFlags];
  const result = await spawnPnpm(pnpmArgs);

  if (result.exitCode !== 0) {
    return result.exitCode ?? 1;
  }

  // Run scripts for allowed packages
  if (!userWantsScripts) {
    try {
      await runAllowedPackageScripts();
    } catch (error) {
      logger.error(`Package script failed: ${error}`);
      return 1;
    }
  }

  return 0;
}

/**
 * Remove packages.
 */
export async function remove(args: string[]): Promise<number> {
  const mappedArgs = mapNpmFlagsToPnpm(args);
  const pnpmArgs = ['remove', ...mappedArgs];
  const result = await spawnPnpm(pnpmArgs);
  return result.exitCode ?? 0;
}

/**
 * Update packages with security protections.
 */
export async function update(args: string[]): Promise<number> {
  // Extract release age flags first
  const { cleanedArgs, releaseAgeFlags } = await extractReleaseAgeFlags(args);

  let mappedArgs = mapNpmFlagsToPnpm(cleanedArgs);

  // Check if user explicitly wants scripts
  const userWantsScripts = cleanedArgs.some(
    (f) => f === '--ignore-scripts=false' || f === '--no-ignore-scripts'
  );

  // Always add --ignore-scripts unless user explicitly opts out
  if (!userWantsScripts && !mappedArgs.includes('--ignore-scripts')) {
    mappedArgs = [...getSecurityFlags(), ...mappedArgs];
  }

  // Add release age flags
  mappedArgs = [...releaseAgeFlags.flags, ...mappedArgs];

  // Run pnpm update
  const pnpmArgs = ['update', ...mappedArgs];
  const result = await spawnPnpm(pnpmArgs);

  if (result.exitCode !== 0) {
    return result.exitCode ?? 1;
  }

  // Run scripts for allowed packages
  if (!userWantsScripts) {
    try {
      await runAllowedPackageScripts();
    } catch (error) {
      logger.error(`Package script failed: ${error}`);
      return 1;
    }
  }

  return 0;
}
