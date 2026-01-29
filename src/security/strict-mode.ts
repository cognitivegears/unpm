import { readPackageJson } from '../utils/config.js';

/**
 * Strict mode configuration for CI environments.
 * Enables enhanced security defaults.
 */
export interface StrictModeConfig {
  /** Whether strict mode is enabled */
  enabled: boolean;
  /** Minimum release age in days (default: 7 in strict mode, 2 otherwise) */
  minReleaseAgeDays: number;
  /** Block dlx entirely, even with --allow-dlx */
  blockDlx: boolean;
  /** Block --force-scripts flag */
  blockForceScripts: boolean;
  /** Require frozen lockfile for ci command */
  requireFrozenLockfile: boolean;
  /** Block explore command entirely */
  blockExplore: boolean;
}

/**
 * Default strict mode configuration.
 */
const STRICT_MODE_DEFAULTS: StrictModeConfig = {
  enabled: true,
  minReleaseAgeDays: 7,
  blockDlx: true,
  blockForceScripts: true,
  requireFrozenLockfile: true,
  blockExplore: true,
};

/**
 * Default non-strict mode configuration.
 */
const NORMAL_MODE_DEFAULTS: StrictModeConfig = {
  enabled: false,
  minReleaseAgeDays: 2,
  blockDlx: false,
  blockForceScripts: false,
  requireFrozenLockfile: false,
  blockExplore: false,
};

/**
 * Check if strict mode is enabled.
 *
 * Strict mode can be enabled via:
 * 1. --strict CLI flag (passed in args)
 * 2. UNPM_STRICT=true environment variable
 * 3. package.json unpm.strict.enabled: true
 *
 * @param args - CLI arguments to check for --strict flag
 * @param cwd - Working directory to read package.json from
 */
export async function isStrictMode(args: string[] = [], cwd?: string): Promise<boolean> {
  // Check CLI flag first (highest priority)
  if (args.includes('--strict')) {
    return true;
  }

  // Check environment variable
  const envValue = process.env['UNPM_STRICT'];
  if (envValue === 'true' || envValue === '1') {
    return true;
  }
  if (envValue === 'false' || envValue === '0') {
    return false;
  }

  // Check package.json config
  const packageJson = await readPackageJson(cwd);
  const unpmConfig = packageJson?.['unpm'] as {
    strict?: { enabled?: boolean } | boolean;
  } | undefined;

  if (unpmConfig?.strict !== undefined) {
    if (typeof unpmConfig.strict === 'boolean') {
      return unpmConfig.strict;
    }
    if (typeof unpmConfig.strict === 'object' && unpmConfig.strict.enabled !== undefined) {
      return unpmConfig.strict.enabled;
    }
  }

  return false;
}

/**
 * Get the full strict mode configuration.
 *
 * @param args - CLI arguments to check for --strict flag
 * @param cwd - Working directory to read package.json from
 */
export async function getStrictModeConfig(args: string[] = [], cwd?: string): Promise<StrictModeConfig> {
  const enabled = await isStrictMode(args, cwd);

  if (!enabled) {
    return { ...NORMAL_MODE_DEFAULTS };
  }

  // In strict mode, start with defaults and allow package.json overrides
  const config = { ...STRICT_MODE_DEFAULTS };

  const packageJson = await readPackageJson(cwd);
  const unpmConfig = packageJson?.['unpm'] as {
    strict?: Partial<StrictModeConfig>;
  } | undefined;

  if (unpmConfig?.strict && typeof unpmConfig.strict === 'object') {
    // Allow overriding specific settings in package.json
    // (but enabled is already true if we're here)
    if (unpmConfig.strict.minReleaseAgeDays !== undefined) {
      config.minReleaseAgeDays = unpmConfig.strict.minReleaseAgeDays;
    }
    if (unpmConfig.strict.blockDlx !== undefined) {
      config.blockDlx = unpmConfig.strict.blockDlx;
    }
    if (unpmConfig.strict.blockForceScripts !== undefined) {
      config.blockForceScripts = unpmConfig.strict.blockForceScripts;
    }
    if (unpmConfig.strict.requireFrozenLockfile !== undefined) {
      config.requireFrozenLockfile = unpmConfig.strict.requireFrozenLockfile;
    }
    if (unpmConfig.strict.blockExplore !== undefined) {
      config.blockExplore = unpmConfig.strict.blockExplore;
    }
  }

  return config;
}

export type StrictModeAction = 'dlx' | 'force-scripts' | 'explore';

export interface StrictModeValidationResult {
  allowed: boolean;
  reason?: string;
}

/**
 * Validate if an action is allowed under the current strict mode settings.
 *
 * @param action - The action to validate
 * @param args - CLI arguments
 * @param cwd - Working directory
 */
export async function validateStrictModeAction(
  action: StrictModeAction,
  args: string[] = [],
  cwd?: string
): Promise<StrictModeValidationResult> {
  const config = await getStrictModeConfig(args, cwd);

  if (!config.enabled) {
    return { allowed: true };
  }

  switch (action) {
    case 'dlx':
      if (config.blockDlx) {
        return {
          allowed: false,
          reason: 'dlx is blocked in strict mode. Remove --strict or disable via package.json unpm.strict.blockDlx: false',
        };
      }
      return { allowed: true };

    case 'force-scripts':
      if (config.blockForceScripts) {
        return {
          allowed: false,
          reason: '--force-scripts is blocked in strict mode. Remove --strict or disable via package.json unpm.strict.blockForceScripts: false',
        };
      }
      return { allowed: true };

    case 'explore':
      if (config.blockExplore) {
        return {
          allowed: false,
          reason: 'explore is blocked in strict mode. Remove --strict or disable via package.json unpm.strict.blockExplore: false',
        };
      }
      return { allowed: true };

    default:
      return { allowed: true };
  }
}

/**
 * Remove --strict flag from args (it's handled separately and shouldn't be passed to pnpm).
 */
export function removeStrictFlag(args: string[]): string[] {
  return args.filter((arg) => arg !== '--strict');
}
