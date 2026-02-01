import { readPackageJson } from '../utils/config.js';

/**
 * Default trust policy ignore-after value in minutes (1 year = 525600 minutes).
 * Packages unchanged for longer than this are exempt from trust policy checks.
 */
export const DEFAULT_TRUST_POLICY_IGNORE_AFTER_MINUTES = 525600; // 1 year

/**
 * Parse a duration string (e.g., "1y", "6m", "30d") into minutes.
 * Supported suffixes:
 * - m: minutes
 * - h: hours
 * - d: days
 * - w: weeks
 * - y: years
 */
export function parseTrustPolicyDuration(duration: string | number): number {
  if (typeof duration === 'number') {
    return duration;
  }

  const match = duration.match(
    /^(\d+(?:\.\d+)?)\s*(m|min|h|hr|hours?|d|days?|w|weeks?|y|years?)$/i
  );

  if (!match || !match[1] || !match[2]) {
    // Try parsing as plain number (minutes)
    const num = parseInt(duration, 10);
    if (!isNaN(num)) {
      return num;
    }
    throw new Error(
      `Invalid duration format: "${duration}". Use format like "1y", "6m", "30d", or a number of minutes.`
    );
  }

  const value = parseFloat(match[1]);
  const unit = match[2].toLowerCase();

  switch (unit) {
    case 'm':
    case 'min':
      return Math.round(value);
    case 'h':
    case 'hr':
    case 'hour':
    case 'hours':
      return Math.round(value * 60);
    case 'd':
    case 'day':
    case 'days':
      return Math.round(value * 60 * 24);
    case 'w':
    case 'week':
    case 'weeks':
      return Math.round(value * 60 * 24 * 7);
    case 'y':
    case 'year':
    case 'years':
      return Math.round(value * 60 * 24 * 365);
    default:
      return Math.round(value);
  }
}

export interface TrustPolicyConfig {
  /** Trust policy mode: 'no-downgrade' prevents version downgrades, 'none' disables */
  trustPolicy: 'no-downgrade' | 'none';
  /** Ignore packages unchanged for longer than this (in minutes) */
  ignoreAfterMinutes: number;
  /** Packages excluded from trust policy */
  excludePackages: string[];
}

/**
 * Get the trust policy configuration from package.json or defaults.
 */
export async function getTrustPolicyConfig(
  cwd?: string
): Promise<TrustPolicyConfig> {
  const packageJson = await readPackageJson(cwd);
  const unpmConfig = packageJson?.['unpm'] as
    | {
        trustPolicy?: 'no-downgrade' | 'none';
        trustPolicyIgnoreAfter?: number | string;
        trustPolicyExclude?: string[];
      }
    | undefined;

  let trustPolicy: 'no-downgrade' | 'none' = 'no-downgrade';
  let ignoreAfterMinutes = DEFAULT_TRUST_POLICY_IGNORE_AFTER_MINUTES;

  if (unpmConfig?.trustPolicy !== undefined) {
    trustPolicy = unpmConfig.trustPolicy;
  }

  if (unpmConfig?.trustPolicyIgnoreAfter !== undefined) {
    ignoreAfterMinutes = parseTrustPolicyDuration(
      unpmConfig.trustPolicyIgnoreAfter
    );
  }

  return {
    trustPolicy,
    ignoreAfterMinutes,
    excludePackages: unpmConfig?.trustPolicyExclude ?? [],
  };
}

export interface TrustPolicyFlagsResult {
  /**
   * CLI flags to pass to pnpm using --config.trust-policy format.
   */
  flags: string[];
  /** Whether trust policy is disabled */
  disabled: boolean;
  /** The effective trust policy setting */
  trustPolicy: 'no-downgrade' | 'none';
  /** The effective ignore-after duration in minutes */
  ignoreAfterMinutes: number;
}

/**
 * Extract trust policy related flags from args and return pnpm flags.
 *
 * Supported flags:
 * - --trust-policy=<mode>: Set trust policy ('no-downgrade' or 'none')
 * - --trust-policy-ignore-after=<duration>: Ignore packages unchanged for longer
 * - --trust-policy-exclude=<pkg>: Exclude a package from trust policy
 * - --no-trust-policy: Disable trust policy entirely
 */
export async function extractTrustPolicyFlags(
  args: string[],
  cwd?: string
): Promise<{ cleanedArgs: string[]; trustPolicyFlags: TrustPolicyFlagsResult }> {
  const config = await getTrustPolicyConfig(cwd);

  let trustPolicy = config.trustPolicy;
  let ignoreAfterMinutes = config.ignoreAfterMinutes;
  let disabled = false;
  const excludePackages = [...config.excludePackages];
  const cleanedArgs: string[] = [];

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (!arg) continue;

    // --no-trust-policy
    if (arg === '--no-trust-policy') {
      disabled = true;
      continue;
    }

    // --trust-policy=<value> or --trust-policy <value>
    if (arg === '--trust-policy') {
      const nextArg = args[i + 1];
      if (nextArg && !nextArg.startsWith('-')) {
        trustPolicy = nextArg as 'no-downgrade' | 'none';
        i++; // Skip the next arg
      }
      continue;
    }
    if (arg.startsWith('--trust-policy=')) {
      const value = arg.split('=')[1];
      if (value === 'no-downgrade' || value === 'none') {
        trustPolicy = value;
      }
      continue;
    }

    // --trust-policy-ignore-after=<value> or --trust-policy-ignore-after <value>
    if (arg === '--trust-policy-ignore-after') {
      const nextArg = args[i + 1];
      if (nextArg && !nextArg.startsWith('-')) {
        ignoreAfterMinutes = parseTrustPolicyDuration(nextArg);
        i++; // Skip the next arg
      }
      continue;
    }
    if (arg.startsWith('--trust-policy-ignore-after=')) {
      const value = arg.split('=')[1];
      if (value) {
        ignoreAfterMinutes = parseTrustPolicyDuration(value);
      }
      continue;
    }

    // --trust-policy-exclude=<pkg> or --trust-policy-exclude <pkg>
    if (arg === '--trust-policy-exclude') {
      const nextArg = args[i + 1];
      if (nextArg && !nextArg.startsWith('-')) {
        excludePackages.push(nextArg);
        i++; // Skip the next arg
      }
      continue;
    }
    if (arg.startsWith('--trust-policy-exclude=')) {
      const value = arg.split('=')[1];
      if (value) {
        excludePackages.push(value);
      }
      continue;
    }

    // Pass through all other args
    cleanedArgs.push(arg);
  }

  // Build pnpm CLI flags for the setting
  const flags: string[] = [];

  if (!disabled && trustPolicy !== 'none') {
    flags.push(`--config.trust-policy=${trustPolicy}`);
    flags.push(`--config.trust-policy-ignore-after=${ignoreAfterMinutes}`);
  }

  return {
    cleanedArgs,
    trustPolicyFlags: {
      flags,
      disabled,
      trustPolicy: disabled ? 'none' : trustPolicy,
      ignoreAfterMinutes: disabled ? 0 : ignoreAfterMinutes,
    },
  };
}
