import chalk from 'chalk';
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
  type ReleaseAgeFlagsResult,
} from '../security/release-age.js';
import {
  isStrictMode,
  getStrictModeConfig,
  validateStrictModeAction,
  removeStrictFlag,
} from '../security/strict-mode.js';
import { logger } from '../utils/logger.js';

/**
 * Check for deprecated script bypass flags and handle --force-scripts.
 *
 * Returns:
 * - { allowed: true, forceScripts: boolean } if the command should proceed
 * - { allowed: false } if the command should be blocked
 */
async function handleScriptFlags(
  flags: string[],
  allArgs: string[]
): Promise<{ allowed: boolean; forceScripts: boolean; reason?: string }> {
  // Check for deprecated flags
  const hasDeprecatedBypass = flags.some(
    (f) => f === '--ignore-scripts=false' || f === '--no-ignore-scripts'
  );

  if (hasDeprecatedBypass) {
    logger.warn('');
    logger.warn(
      chalk.yellow('  Warning: --ignore-scripts=false and --no-ignore-scripts are deprecated.')
    );
    logger.warn('');
    logger.warn('  To enable dependency scripts, use:');
    logger.warn(chalk.cyan('    unpm install --force-scripts'));
    logger.warn('');
    logger.warn(chalk.dim('  This flag was ignored. Scripts remain blocked.'));
    logger.warn('');
  }

  // Check for --force-scripts
  const hasForceScripts = flags.includes('--force-scripts');

  if (hasForceScripts) {
    // Validate against strict mode
    const validation = await validateStrictModeAction('force-scripts', allArgs);
    if (!validation.allowed) {
      logger.error('');
      logger.error(chalk.red('  Error: --force-scripts is blocked in strict mode.'));
      logger.error('');
      logger.error(chalk.dim(`  ${validation.reason}`));
      logger.error('');
      return { allowed: false, forceScripts: false, reason: validation.reason };
    }

    logger.warn('');
    logger.warn(chalk.yellow('  Warning: --force-scripts enabled. Dependency scripts will run.'));
    logger.warn(chalk.dim('  Only use this flag if you trust all dependencies.'));
    logger.warn('');
    return { allowed: true, forceScripts: true };
  }

  return { allowed: true, forceScripts: false };
}

/**
 * Remove unpm-only flags from the args before passing to pnpm.
 */
function removeUnpmFlags(args: string[]): string[] {
  return args.filter((arg) =>
    arg !== '--force-scripts' &&
    arg !== '--ignore-scripts=false' &&
    arg !== '--no-ignore-scripts' &&
    arg !== '--strict' &&
    arg !== '--allow-dlx' &&
    arg !== '--allow-explore'
  );
}

/**
 * Get release age settings, potentially adjusted for strict mode.
 * Returns CLI flags to pass to pnpm for minimum-release-age setting.
 */
async function getEffectiveReleaseAgeConfig(
  args: string[],
  cwd?: string
): Promise<{ cleanedArgs: string[]; releaseAgeConfig: ReleaseAgeFlagsResult }> {
  const strictConfig = await getStrictModeConfig(args, cwd);
  let { cleanedArgs, releaseAgeFlags } = await extractReleaseAgeFlags(args, cwd);

  // In strict mode, enforce minimum 7 days if not explicitly disabled
  if (strictConfig.enabled && !releaseAgeFlags.disabled) {
    const strictMinAge = strictConfig.minReleaseAgeDays * 24 * 60; // Convert days to minutes
    if (releaseAgeFlags.minAgeMinutes < strictMinAge) {
      const { formatDurationForPnpm } = await import('../security/release-age.js');
      const durationStr = formatDurationForPnpm(strictMinAge);
      releaseAgeFlags = {
        ...releaseAgeFlags,
        minAgeMinutes: strictMinAge,
        flags: [`--config.minimum-release-age=${durationStr}`],
        envVars: {},
      };
      logger.debug(`Strict mode: Enforcing minimum release age of ${strictConfig.minReleaseAgeDays} days`);
    }
  }

  return { cleanedArgs, releaseAgeConfig: releaseAgeFlags };
}

/**
 * Install dependencies with security protections.
 * - Always runs pnpm with --ignore-scripts to block dependency scripts
 * - Enforces minimum release age for packages (default: 2 days, 7 days in strict mode)
 * - Runs local package scripts (preinstall, postinstall, etc.) after installation
 * - Runs scripts for packages in the allowlist
 */
export async function install(args: string[], globalArgs: string[] = []): Promise<number> {
  const allArgs = [...globalArgs, ...args];

  // Extract release age config (with strict mode adjustments)
  const { cleanedArgs, releaseAgeConfig } = await getEffectiveReleaseAgeConfig(allArgs);

  const { packages, flags } = extractPackagesFromArgs(cleanedArgs);

  // Handle script flags
  const scriptResult = await handleScriptFlags(flags, allArgs);
  if (!scriptResult.allowed) {
    return 1;
  }

  let mappedFlags = mapNpmFlagsToPnpm(removeUnpmFlags(flags));

  // Always add --ignore-scripts unless --force-scripts was used
  if (!scriptResult.forceScripts && !mappedFlags.includes('--ignore-scripts')) {
    mappedFlags = [...getSecurityFlags(), ...mappedFlags];
  }

  // Log security info
  if (releaseAgeConfig.minAgeMinutes > 0) {
    logger.debug(`Minimum release age: ${formatDuration(releaseAgeConfig.minAgeMinutes)}`);
  }

  // Run preinstall scripts from local package.json
  if (!scriptResult.forceScripts) {
    try {
      await runLocalScripts('preinstall');
    } catch (error) {
      logger.error(`Preinstall script failed: ${error}`);
      return 1;
    }
  }

  // Run pnpm install with release age flags
  const pnpmArgs = ['install', ...packages, ...removeStrictFlag(mappedFlags), ...releaseAgeConfig.flags];
  const result = await spawnPnpm(pnpmArgs);

  if (result.exitCode !== 0) {
    return result.exitCode ?? 1;
  }

  // Run postinstall scripts from local package.json and allowed packages
  if (!scriptResult.forceScripts) {
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
 * In strict mode, always uses --frozen-lockfile.
 */
export async function ci(args: string[], globalArgs: string[] = []): Promise<number> {
  const allArgs = [...globalArgs, ...args];

  // Extract release age config (with strict mode adjustments)
  const { cleanedArgs, releaseAgeConfig } = await getEffectiveReleaseAgeConfig(allArgs);

  // Handle script flags
  const { flags } = extractPackagesFromArgs(cleanedArgs);
  const scriptResult = await handleScriptFlags(flags, allArgs);
  if (!scriptResult.allowed) {
    return 1;
  }

  let mappedArgs = mapNpmCiToPnpm(removeUnpmFlags(cleanedArgs));

  // Always add --ignore-scripts unless --force-scripts was used
  if (!scriptResult.forceScripts && !mappedArgs.includes('--ignore-scripts')) {
    mappedArgs = [...getSecurityFlags(), ...mappedArgs];
  }

  // In strict mode, ensure frozen lockfile (mapNpmCiToPnpm already adds it, but double-check)
  const strictMode = await isStrictMode(allArgs);
  if (strictMode && !mappedArgs.includes('--frozen-lockfile')) {
    mappedArgs.push('--frozen-lockfile');
  }

  // Run preinstall scripts from local package.json
  if (!scriptResult.forceScripts) {
    try {
      await runLocalScripts('preinstall');
    } catch (error) {
      logger.error(`Preinstall script failed: ${error}`);
      return 1;
    }
  }

  // Run pnpm install with frozen lockfile and release age flags
  const pnpmArgs = ['install', ...removeStrictFlag(mappedArgs), ...releaseAgeConfig.flags];
  const result = await spawnPnpm(pnpmArgs);

  if (result.exitCode !== 0) {
    return result.exitCode ?? 1;
  }

  // Run postinstall scripts
  if (!scriptResult.forceScripts) {
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
export async function add(args: string[], globalArgs: string[] = []): Promise<number> {
  const allArgs = [...globalArgs, ...args];

  // Extract release age config (with strict mode adjustments)
  const { cleanedArgs, releaseAgeConfig } = await getEffectiveReleaseAgeConfig(allArgs);

  const { packages, flags } = extractPackagesFromArgs(cleanedArgs);

  // Handle script flags
  const scriptResult = await handleScriptFlags(flags, allArgs);
  if (!scriptResult.allowed) {
    return 1;
  }

  let mappedFlags = mapNpmFlagsToPnpm(removeUnpmFlags(flags));

  // Always add --ignore-scripts unless --force-scripts was used
  if (!scriptResult.forceScripts && !mappedFlags.includes('--ignore-scripts')) {
    mappedFlags = [...getSecurityFlags(), ...mappedFlags];
  }

  // Run pnpm add with release age flags
  const pnpmArgs = ['add', ...packages, ...removeStrictFlag(mappedFlags), ...releaseAgeConfig.flags];
  const result = await spawnPnpm(pnpmArgs);

  if (result.exitCode !== 0) {
    return result.exitCode ?? 1;
  }

  // Run scripts for allowed packages
  if (!scriptResult.forceScripts) {
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
  const mappedArgs = mapNpmFlagsToPnpm(removeUnpmFlags(args));
  const pnpmArgs = ['remove', ...removeStrictFlag(mappedArgs)];
  const result = await spawnPnpm(pnpmArgs);
  return result.exitCode ?? 0;
}

/**
 * Update packages with security protections.
 */
export async function update(args: string[], globalArgs: string[] = []): Promise<number> {
  const allArgs = [...globalArgs, ...args];

  // Extract release age config (with strict mode adjustments)
  const { cleanedArgs, releaseAgeConfig } = await getEffectiveReleaseAgeConfig(allArgs);

  // Handle script flags
  const { flags } = extractPackagesFromArgs(cleanedArgs);
  const scriptResult = await handleScriptFlags(flags, allArgs);
  if (!scriptResult.allowed) {
    return 1;
  }

  let mappedArgs = mapNpmFlagsToPnpm(removeUnpmFlags(cleanedArgs));

  // Always add --ignore-scripts unless --force-scripts was used
  if (!scriptResult.forceScripts && !mappedArgs.includes('--ignore-scripts')) {
    mappedArgs = [...getSecurityFlags(), ...mappedArgs];
  }

  // Run pnpm update with release age flags
  const pnpmArgs = ['update', ...removeStrictFlag(mappedArgs), ...releaseAgeConfig.flags];
  const result = await spawnPnpm(pnpmArgs);

  if (result.exitCode !== 0) {
    return result.exitCode ?? 1;
  }

  // Run scripts for allowed packages
  if (!scriptResult.forceScripts) {
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
 * Install packages and then run tests.
 * Equivalent to: npm install && npm test
 */
export async function installTest(args: string[], globalArgs: string[] = []): Promise<number> {
  const installResult = await install(args, globalArgs);
  if (installResult !== 0) {
    return installResult;
  }

  const testResult = await spawnPnpm(['test']);
  return testResult.exitCode ?? 0;
}

/**
 * CI install and then run tests.
 * Equivalent to: npm ci && npm test
 */
export async function installCiTest(args: string[], globalArgs: string[] = []): Promise<number> {
  const ciResult = await ci(args, globalArgs);
  if (ciResult !== 0) {
    return ciResult;
  }

  const testResult = await spawnPnpm(['test']);
  return testResult.exitCode ?? 0;
}
