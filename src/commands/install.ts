import chalk from 'chalk';
import { spawnPnpm } from '../utils/exec.js';
import {
  mapNpmFlagsToPnpm,
  mapNpmCiToPnpm,
  extractPackagesFromArgs,
  removeUnpmOnlyFlags,
} from '../mappers/args.js';
import {
  runLocalScripts,
  runAllowedPackageScripts,
  getSecurityFlags,
  getUnreviewedBuildScripts,
} from '../security/script-policy.js';
import {
  extractReleaseAgeFlags,
  formatDuration,
  type ReleaseAgeFlagsResult,
} from '../security/release-age.js';
import {
  extractTrustPolicyFlags,
  type TrustPolicyFlagsResult,
} from '../security/trust-policy.js';
import {
  extractExoticSubdepsFlags,
  type ExoticSubdepsFlagsResult,
} from '../security/exotic-subdeps.js';
import {
  isStrictMode,
  getStrictModeConfig,
  validateStrictModeAction,
  removeStrictFlag,
} from '../security/strict-mode.js';
import { validateLockfile } from '../security/lockfile.js';
import {
  detectMigrationMode,
  preSyncLockfile,
  postSyncLockfile,
  cleanupTempLockfile,
  getCompatibilityFlags,
} from '../security/lockfile-sync.js';
import { resolveDepGateRuntimeOptions } from '../security/depgate.js';
import { logger } from '../utils/logger.js';
import {
  runPostInstallAudit,
  shouldRunPostInstallAudit,
  getConfiguredAuditLevel,
} from './audit.js';

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
      chalk.yellow(
        '  Warning: --ignore-scripts=false and --no-ignore-scripts are deprecated.'
      )
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
      logger.error(
        chalk.red('  Error: --force-scripts is blocked in strict mode.')
      );
      logger.error('');
      logger.error(chalk.dim(`  ${validation.reason}`));
      logger.error('');
      return { allowed: false, forceScripts: false, reason: validation.reason };
    }

    logger.warn('');
    logger.warn(
      chalk.yellow(
        '  Warning: --force-scripts enabled. Dependency scripts will run.'
      )
    );
    logger.warn(
      chalk.dim('  Only use this flag if you trust all dependencies.')
    );
    logger.warn('');
    return { allowed: true, forceScripts: true };
  }

  return { allowed: true, forceScripts: false };
}

/**
 * Remove unpm-only flags from the args before passing to pnpm.
 */
function removeUnpmFlags(args: string[]): string[] {
  return removeUnpmOnlyFlags(args).filter(
    (arg) => arg !== '--ignore-scripts=false' && arg !== '--no-ignore-scripts'
  );
}

interface SecurityConfig {
  releaseAgeConfig: ReleaseAgeFlagsResult;
  trustPolicyConfig: TrustPolicyFlagsResult;
  exoticSubdepsConfig: ExoticSubdepsFlagsResult;
  cleanedArgs: string[];
}

/**
 * Get all security settings, potentially adjusted for strict mode.
 * Returns CLI flags to pass to pnpm for various security settings.
 */
async function getSecurityConfig(
  args: string[],
  cwd?: string
): Promise<SecurityConfig> {
  const strictConfig = await getStrictModeConfig(args, cwd);

  // Extract release age config
  let { cleanedArgs, releaseAgeFlags } = await extractReleaseAgeFlags(
    args,
    cwd
  );

  // In strict mode, enforce minimum 7 days if not explicitly disabled
  if (strictConfig.enabled && !releaseAgeFlags.disabled) {
    const strictMinAge = strictConfig.minReleaseAgeDays * 24 * 60; // Convert days to minutes
    if (releaseAgeFlags.minAgeMinutes < strictMinAge) {
      const { formatDurationForPnpm } =
        await import('../security/release-age.js');
      const durationStr = formatDurationForPnpm(strictMinAge);
      releaseAgeFlags = {
        ...releaseAgeFlags,
        minAgeMinutes: strictMinAge,
        flags: [`--config.minimum-release-age=${durationStr}`],
        envVars: {},
      };
      logger.debug(
        `Strict mode: Enforcing minimum release age of ${strictConfig.minReleaseAgeDays} days`
      );
    }
  }

  // Extract trust policy config
  const trustPolicyResult = await extractTrustPolicyFlags(cleanedArgs, cwd);
  cleanedArgs = trustPolicyResult.cleanedArgs;

  // Extract exotic subdeps config
  const exoticSubdepsResult = await extractExoticSubdepsFlags(cleanedArgs, cwd);
  cleanedArgs = exoticSubdepsResult.cleanedArgs;

  return {
    releaseAgeConfig: releaseAgeFlags,
    trustPolicyConfig: trustPolicyResult.trustPolicyFlags,
    exoticSubdepsConfig: exoticSubdepsResult.exoticSubdepsFlags,
    cleanedArgs,
  };
}

/**
 * Install dependencies with security protections.
 * - Always runs pnpm with --ignore-scripts to block dependency scripts
 * - Enforces minimum release age for packages (default: 2 days, 7 days in strict mode)
 * - Runs local package scripts (preinstall, postinstall, etc.) after installation
 * - Runs scripts for packages in the allowlist
 * - In pre-migration mode, syncs lockfiles for npm interoperability
 */
export async function install(
  args: string[],
  globalArgs: string[] = []
): Promise<number> {
  const allArgs = [...globalArgs, ...args];

  // Detect migration mode for lockfile sync
  const mode = await detectMigrationMode();

  // Pre-migration: sync package-lock.json to pnpm-lock.yaml
  if (mode.mode === 'pre-migration') {
    const preSyncSuccess = await preSyncLockfile(allArgs);
    if (!preSyncSuccess) {
      return 1; // Strict mode sync failure
    }
  }

  // Validate lockfile status (warn in normal mode, error in strict mode)
  const lockfileValid = await validateLockfile(allArgs);
  if (!lockfileValid) {
    if (mode.mode === 'pre-migration') {
      await cleanupTempLockfile();
    }
    return 1;
  }

  // Extract all security config (with strict mode adjustments)
  const securityConfig = await getSecurityConfig(allArgs);

  const { packages, flags } = extractPackagesFromArgs(
    securityConfig.cleanedArgs
  );

  // Handle script flags
  const scriptResult = await handleScriptFlags(flags, allArgs);
  if (!scriptResult.allowed) {
    if (mode.mode === 'pre-migration') {
      await cleanupTempLockfile();
    }
    return 1;
  }

  let mappedFlags = mapNpmFlagsToPnpm(removeUnpmFlags(flags));

  // Always add --ignore-scripts unless --force-scripts was used
  if (!scriptResult.forceScripts && !mappedFlags.includes('--ignore-scripts')) {
    mappedFlags = [...getSecurityFlags(), ...mappedFlags];
  }

  // Log security info
  if (securityConfig.releaseAgeConfig.minAgeMinutes > 0) {
    logger.debug(
      `Minimum release age: ${formatDuration(securityConfig.releaseAgeConfig.minAgeMinutes)}`
    );
  }
  if (securityConfig.trustPolicyConfig.trustPolicy !== 'none') {
    logger.debug(
      `Trust policy: ${securityConfig.trustPolicyConfig.trustPolicy}`
    );
  }
  if (securityConfig.exoticSubdepsConfig.enabled) {
    logger.debug('Exotic subdependencies blocking: enabled');
  }

  // Run preinstall scripts from local package.json
  if (!scriptResult.forceScripts) {
    try {
      await runLocalScripts('preinstall');
    } catch (error) {
      logger.error(`Preinstall script failed: ${error}`);
      if (mode.mode === 'pre-migration') {
        await cleanupTempLockfile();
      }
      return 1;
    }
  }

  // Run pnpm install with security flags and compatibility flags
  const pnpmArgs = [
    'install',
    ...packages,
    ...removeStrictFlag(mappedFlags),
    ...securityConfig.releaseAgeConfig.flags,
    ...securityConfig.trustPolicyConfig.flags,
    ...securityConfig.exoticSubdepsConfig.flags,
    ...getCompatibilityFlags(mode),
  ];
  const depgateOptions = await resolveDepGateRuntimeOptions(allArgs);
  const result = await spawnPnpm(pnpmArgs, { depgate: depgateOptions });

  if (result.exitCode !== 0) {
    if (mode.mode === 'pre-migration') {
      await cleanupTempLockfile();
    }
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
      if (mode.mode === 'pre-migration') {
        await cleanupTempLockfile();
      }
      return 1;
    }
  }

  // Check for unreviewed build scripts in strict mode
  const strictConfig = await getStrictModeConfig(allArgs);
  if (strictConfig.strictDepBuilds) {
    const unreviewedPackages = await getUnreviewedBuildScripts();
    if (unreviewedPackages.length > 0) {
      logger.error('');
      logger.error(
        chalk.red(
          `  Strict mode: ${unreviewedPackages.length} package(s) have unreviewed build scripts:`
        )
      );
      for (const pkg of unreviewedPackages.slice(0, 10)) {
        logger.error(chalk.red(`    - ${pkg}`));
      }
      if (unreviewedPackages.length > 10) {
        logger.error(
          chalk.red(`    ... and ${unreviewedPackages.length - 10} more`)
        );
      }
      logger.error('');
      logger.error('  To allow these scripts, run:');
      logger.error(chalk.cyan('    unpm allow-scripts add <package-name>'));
      logger.error('');
      if (mode.mode === 'pre-migration') {
        await cleanupTempLockfile();
      }
      return 1;
    }
  }

  // Run post-install audit if enabled
  if (await shouldRunPostInstallAudit()) {
    const auditLevel = strictConfig.enabled
      ? strictConfig.auditLevel
      : await getConfiguredAuditLevel();
    const auditResult = await runPostInstallAudit(auditLevel);
    if (auditResult !== 0 && strictConfig.blockAuditFailures) {
      logger.error('');
      logger.error(
        chalk.red(
          '  Strict mode: Audit found vulnerabilities. Install blocked.'
        )
      );
      logger.error('');
      if (mode.mode === 'pre-migration') {
        await cleanupTempLockfile();
      }
      return 1;
    }
  }

  // Pre-migration: sync pnpm-lock.yaml back to package-lock.json, then cleanup
  if (mode.mode === 'pre-migration') {
    await postSyncLockfile(allArgs);
    await cleanupTempLockfile();
  }

  return 0;
}

/**
 * CI install - frozen lockfile with security protections.
 * In strict mode, always uses --frozen-lockfile.
 * In pre-migration mode, syncs lockfiles (no post-sync since CI doesn't modify lockfile).
 */
export async function ci(
  args: string[],
  globalArgs: string[] = []
): Promise<number> {
  const allArgs = [...globalArgs, ...args];

  // Detect migration mode for lockfile sync
  const mode = await detectMigrationMode();

  // Pre-migration: sync package-lock.json to pnpm-lock.yaml
  if (mode.mode === 'pre-migration') {
    const preSyncSuccess = await preSyncLockfile(allArgs);
    if (!preSyncSuccess) {
      return 1; // Strict mode sync failure
    }
  }

  // Validate lockfile status (warn in normal mode, error in strict mode)
  const lockfileValid = await validateLockfile(allArgs);
  if (!lockfileValid) {
    if (mode.mode === 'pre-migration') {
      await cleanupTempLockfile();
    }
    return 1;
  }

  // Extract all security config (with strict mode adjustments)
  const securityConfig = await getSecurityConfig(allArgs);

  // Handle script flags
  const { flags } = extractPackagesFromArgs(securityConfig.cleanedArgs);
  const scriptResult = await handleScriptFlags(flags, allArgs);
  if (!scriptResult.allowed) {
    if (mode.mode === 'pre-migration') {
      await cleanupTempLockfile();
    }
    return 1;
  }

  let mappedArgs = mapNpmCiToPnpm(removeUnpmFlags(securityConfig.cleanedArgs));

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
      if (mode.mode === 'pre-migration') {
        await cleanupTempLockfile();
      }
      return 1;
    }
  }

  // Run pnpm install with frozen lockfile, security flags, and compatibility flags
  const pnpmArgs = [
    'install',
    ...removeStrictFlag(mappedArgs),
    ...securityConfig.releaseAgeConfig.flags,
    ...securityConfig.trustPolicyConfig.flags,
    ...securityConfig.exoticSubdepsConfig.flags,
    ...getCompatibilityFlags(mode),
  ];
  const depgateOptions = await resolveDepGateRuntimeOptions(allArgs);
  const result = await spawnPnpm(pnpmArgs, { depgate: depgateOptions });

  if (result.exitCode !== 0) {
    if (mode.mode === 'pre-migration') {
      await cleanupTempLockfile();
    }
    return result.exitCode ?? 1;
  }

  // Run postinstall scripts
  if (!scriptResult.forceScripts) {
    try {
      await runAllowedPackageScripts();
      await runLocalScripts('postinstall');
    } catch (error) {
      logger.error(`Postinstall script failed: ${error}`);
      if (mode.mode === 'pre-migration') {
        await cleanupTempLockfile();
      }
      return 1;
    }
  }

  // Check for unreviewed build scripts in strict mode
  const strictConfig = await getStrictModeConfig(allArgs);
  if (strictConfig.strictDepBuilds) {
    const unreviewedPackages = await getUnreviewedBuildScripts();
    if (unreviewedPackages.length > 0) {
      logger.error('');
      logger.error(
        chalk.red(
          `  Strict mode: ${unreviewedPackages.length} package(s) have unreviewed build scripts:`
        )
      );
      for (const pkg of unreviewedPackages.slice(0, 10)) {
        logger.error(chalk.red(`    - ${pkg}`));
      }
      if (unreviewedPackages.length > 10) {
        logger.error(
          chalk.red(`    ... and ${unreviewedPackages.length - 10} more`)
        );
      }
      logger.error('');
      logger.error('  To allow these scripts, run:');
      logger.error(chalk.cyan('    unpm allow-scripts add <package-name>'));
      logger.error('');
      if (mode.mode === 'pre-migration') {
        await cleanupTempLockfile();
      }
      return 1;
    }
  }

  // Run post-install audit if enabled
  if (await shouldRunPostInstallAudit()) {
    const auditLevel = strictConfig.enabled
      ? strictConfig.auditLevel
      : await getConfiguredAuditLevel();
    const auditResult = await runPostInstallAudit(auditLevel);
    if (auditResult !== 0 && strictConfig.blockAuditFailures) {
      logger.error('');
      logger.error(
        chalk.red(
          '  Strict mode: Audit found vulnerabilities. Install blocked.'
        )
      );
      logger.error('');
      if (mode.mode === 'pre-migration') {
        await cleanupTempLockfile();
      }
      return 1;
    }
  }

  // Pre-migration: cleanup (no post-sync for CI since it doesn't modify lockfile)
  if (mode.mode === 'pre-migration') {
    await cleanupTempLockfile();
  }

  return 0;
}

/**
 * Add packages with security protections.
 * In pre-migration mode, syncs lockfiles for npm interoperability.
 */
export async function add(
  args: string[],
  globalArgs: string[] = []
): Promise<number> {
  const allArgs = [...globalArgs, ...args];

  // Detect migration mode for lockfile sync
  const mode = await detectMigrationMode();

  // Pre-migration: sync package-lock.json to pnpm-lock.yaml
  if (mode.mode === 'pre-migration') {
    const preSyncSuccess = await preSyncLockfile(allArgs);
    if (!preSyncSuccess) {
      return 1; // Strict mode sync failure
    }
  }

  // Validate lockfile status (warn in normal mode, error in strict mode)
  const lockfileValid = await validateLockfile(allArgs);
  if (!lockfileValid) {
    if (mode.mode === 'pre-migration') {
      await cleanupTempLockfile();
    }
    return 1;
  }

  // Extract all security config (with strict mode adjustments)
  const securityConfig = await getSecurityConfig(allArgs);

  const { packages, flags } = extractPackagesFromArgs(
    securityConfig.cleanedArgs
  );

  // Handle script flags
  const scriptResult = await handleScriptFlags(flags, allArgs);
  if (!scriptResult.allowed) {
    if (mode.mode === 'pre-migration') {
      await cleanupTempLockfile();
    }
    return 1;
  }

  let mappedFlags = mapNpmFlagsToPnpm(removeUnpmFlags(flags));

  // Always add --ignore-scripts unless --force-scripts was used
  if (!scriptResult.forceScripts && !mappedFlags.includes('--ignore-scripts')) {
    mappedFlags = [...getSecurityFlags(), ...mappedFlags];
  }

  // Run pnpm add with security flags and compatibility flags
  const pnpmArgs = [
    'add',
    ...packages,
    ...removeStrictFlag(mappedFlags),
    ...securityConfig.releaseAgeConfig.flags,
    ...securityConfig.trustPolicyConfig.flags,
    ...securityConfig.exoticSubdepsConfig.flags,
    ...getCompatibilityFlags(mode),
  ];
  const depgateOptions = await resolveDepGateRuntimeOptions(allArgs);
  const result = await spawnPnpm(pnpmArgs, { depgate: depgateOptions });

  if (result.exitCode !== 0) {
    if (mode.mode === 'pre-migration') {
      await cleanupTempLockfile();
    }
    return result.exitCode ?? 1;
  }

  // Run scripts for allowed packages
  if (!scriptResult.forceScripts) {
    try {
      await runAllowedPackageScripts();
    } catch (error) {
      logger.error(`Package script failed: ${error}`);
      if (mode.mode === 'pre-migration') {
        await cleanupTempLockfile();
      }
      return 1;
    }
  }

  // Pre-migration: sync pnpm-lock.yaml back to package-lock.json, then cleanup
  if (mode.mode === 'pre-migration') {
    await postSyncLockfile(allArgs);
    await cleanupTempLockfile();
  }

  return 0;
}

/**
 * Remove packages.
 * In pre-migration mode, syncs lockfiles for npm interoperability.
 */
export async function remove(
  args: string[],
  globalArgs: string[] = []
): Promise<number> {
  const allArgs = [...globalArgs, ...args];

  // Detect migration mode for lockfile sync
  const mode = await detectMigrationMode();

  // Pre-migration: sync package-lock.json to pnpm-lock.yaml
  if (mode.mode === 'pre-migration') {
    const preSyncSuccess = await preSyncLockfile(allArgs);
    if (!preSyncSuccess) {
      return 1; // Strict mode sync failure
    }
  }

  const mappedArgs = mapNpmFlagsToPnpm(removeUnpmFlags(args));
  // Note: pnpm remove doesn't support --shamefully-hoist, so we don't pass compatibility flags
  const pnpmArgs = ['remove', ...removeStrictFlag(mappedArgs)];
  const result = await spawnPnpm(pnpmArgs);

  if (result.exitCode !== 0) {
    if (mode.mode === 'pre-migration') {
      await cleanupTempLockfile();
    }
    return result.exitCode ?? 1;
  }

  // Pre-migration: sync pnpm-lock.yaml back to package-lock.json, then cleanup
  if (mode.mode === 'pre-migration') {
    await postSyncLockfile(allArgs);
    await cleanupTempLockfile();
  }

  return 0;
}

/**
 * Update packages with security protections.
 * In pre-migration mode, syncs lockfiles for npm interoperability.
 */
export async function update(
  args: string[],
  globalArgs: string[] = []
): Promise<number> {
  const allArgs = [...globalArgs, ...args];

  // Detect migration mode for lockfile sync
  const mode = await detectMigrationMode();

  // Pre-migration: sync package-lock.json to pnpm-lock.yaml
  if (mode.mode === 'pre-migration') {
    const preSyncSuccess = await preSyncLockfile(allArgs);
    if (!preSyncSuccess) {
      return 1; // Strict mode sync failure
    }
  }

  // Validate lockfile status (warn in normal mode, error in strict mode)
  const lockfileValid = await validateLockfile(allArgs);
  if (!lockfileValid) {
    if (mode.mode === 'pre-migration') {
      await cleanupTempLockfile();
    }
    return 1;
  }

  // Extract all security config (with strict mode adjustments)
  const securityConfig = await getSecurityConfig(allArgs);

  // Handle script flags
  const { flags } = extractPackagesFromArgs(securityConfig.cleanedArgs);
  const scriptResult = await handleScriptFlags(flags, allArgs);
  if (!scriptResult.allowed) {
    if (mode.mode === 'pre-migration') {
      await cleanupTempLockfile();
    }
    return 1;
  }

  let mappedArgs = mapNpmFlagsToPnpm(
    removeUnpmFlags(securityConfig.cleanedArgs)
  );

  // Always add --ignore-scripts unless --force-scripts was used
  if (!scriptResult.forceScripts && !mappedArgs.includes('--ignore-scripts')) {
    mappedArgs = [...getSecurityFlags(), ...mappedArgs];
  }

  // Run pnpm update with security flags and compatibility flags
  const pnpmArgs = [
    'update',
    ...removeStrictFlag(mappedArgs),
    ...securityConfig.releaseAgeConfig.flags,
    ...securityConfig.trustPolicyConfig.flags,
    ...securityConfig.exoticSubdepsConfig.flags,
    ...getCompatibilityFlags(mode),
  ];
  const depgateOptions = await resolveDepGateRuntimeOptions(allArgs);
  const result = await spawnPnpm(pnpmArgs, { depgate: depgateOptions });

  if (result.exitCode !== 0) {
    if (mode.mode === 'pre-migration') {
      await cleanupTempLockfile();
    }
    return result.exitCode ?? 1;
  }

  // Run scripts for allowed packages
  if (!scriptResult.forceScripts) {
    try {
      await runAllowedPackageScripts();
    } catch (error) {
      logger.error(`Package script failed: ${error}`);
      if (mode.mode === 'pre-migration') {
        await cleanupTempLockfile();
      }
      return 1;
    }
  }

  // Pre-migration: sync pnpm-lock.yaml back to package-lock.json, then cleanup
  if (mode.mode === 'pre-migration') {
    await postSyncLockfile(allArgs);
    await cleanupTempLockfile();
  }

  return 0;
}

/**
 * Install packages and then run tests.
 * Equivalent to: npm install && npm test
 */
export async function installTest(
  args: string[],
  globalArgs: string[] = []
): Promise<number> {
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
export async function installCiTest(
  args: string[],
  globalArgs: string[] = []
): Promise<number> {
  const ciResult = await ci(args, globalArgs);
  if (ciResult !== 0) {
    return ciResult;
  }

  const testResult = await spawnPnpm(['test']);
  return testResult.exitCode ?? 0;
}
