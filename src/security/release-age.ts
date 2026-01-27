import { readPackageJson } from '../utils/config.js';

/**
 * Default minimum release age in minutes (2 days = 2880 minutes).
 * This protects against recently published malicious packages.
 */
export const DEFAULT_MIN_RELEASE_AGE_MINUTES = 2880; // 2 days

/**
 * Parse a duration string (e.g., "2d", "4h", "30m") into minutes.
 * Supported suffixes:
 * - m: minutes
 * - h: hours
 * - d: days
 * - w: weeks
 */
export function parseDuration(duration: string): number {
  const match = duration.match(/^(\d+(?:\.\d+)?)\s*(m|min|h|hr|hours?|d|days?|w|weeks?)$/i);

  if (!match || !match[1] || !match[2]) {
    // Try parsing as plain number (minutes)
    const num = parseInt(duration, 10);
    if (!isNaN(num)) {
      return num;
    }
    throw new Error(`Invalid duration format: "${duration}". Use format like "2d", "4h", "30m", or a number of minutes.`);
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
    default:
      return Math.round(value);
  }
}

/**
 * Format minutes as a human-readable duration string.
 */
export function formatDuration(minutes: number): string {
  if (minutes < 60) {
    return `${minutes} minute${minutes === 1 ? '' : 's'}`;
  } else if (minutes < 60 * 24) {
    const hours = Math.round(minutes / 60 * 10) / 10;
    return `${hours} hour${hours === 1 ? '' : 's'}`;
  } else if (minutes < 60 * 24 * 7) {
    const days = Math.round(minutes / (60 * 24) * 10) / 10;
    return `${days} day${days === 1 ? '' : 's'}`;
  } else {
    const weeks = Math.round(minutes / (60 * 24 * 7) * 10) / 10;
    return `${weeks} week${weeks === 1 ? '' : 's'}`;
  }
}

export interface ReleaseAgeConfig {
  /** Minimum release age in minutes. Set to 0 to disable. */
  minReleaseAge: number;
  /** Packages excluded from the minimum release age requirement. */
  excludePackages: string[];
}

/**
 * Get the release age configuration from package.json or defaults.
 */
export async function getReleaseAgeConfig(cwd?: string): Promise<ReleaseAgeConfig> {
  const packageJson = await readPackageJson(cwd);
  const unpmConfig = packageJson?.['unpm'] as {
    minReleaseAge?: number | string;
    minReleaseAgeExclude?: string[];
  } | undefined;

  let minReleaseAge = DEFAULT_MIN_RELEASE_AGE_MINUTES;

  if (unpmConfig?.minReleaseAge !== undefined) {
    if (typeof unpmConfig.minReleaseAge === 'string') {
      minReleaseAge = parseDuration(unpmConfig.minReleaseAge);
    } else {
      minReleaseAge = unpmConfig.minReleaseAge;
    }
  }

  return {
    minReleaseAge,
    excludePackages: unpmConfig?.minReleaseAgeExclude ?? [],
  };
}

export interface ReleaseAgeFlagsResult {
  /** Flags to pass to pnpm */
  flags: string[];
  /** Whether min release age is disabled */
  disabled: boolean;
  /** The effective minimum release age in minutes */
  minAgeMinutes: number;
}

/**
 * Extract release age related flags from args and return pnpm flags.
 *
 * Supported flags:
 * - --min-release-age=<duration>: Override minimum release age (e.g., "2d", "4h", "30m")
 * - --allow-recent=<pkg>: Allow a specific package regardless of age (can be repeated)
 * - --no-min-release-age: Disable minimum release age entirely
 */
export async function extractReleaseAgeFlags(
  args: string[],
  cwd?: string
): Promise<{ cleanedArgs: string[]; releaseAgeFlags: ReleaseAgeFlagsResult }> {
  const config = await getReleaseAgeConfig(cwd);

  let minAgeMinutes = config.minReleaseAge;
  let disabled = false;
  const excludePackages = [...config.excludePackages];
  const cleanedArgs: string[] = [];

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (!arg) continue;

    // --no-min-release-age
    if (arg === '--no-min-release-age' || arg === '--no-minimum-release-age') {
      disabled = true;
      continue;
    }

    // --min-release-age=<value> or --min-release-age <value>
    if (arg === '--min-release-age' || arg === '--minimum-release-age') {
      const nextArg = args[i + 1];
      if (nextArg && !nextArg.startsWith('-')) {
        minAgeMinutes = parseDuration(nextArg);
        i++; // Skip the next arg
      }
      continue;
    }
    if (arg.startsWith('--min-release-age=') || arg.startsWith('--minimum-release-age=')) {
      const value = arg.split('=')[1];
      if (value) {
        minAgeMinutes = parseDuration(value);
      }
      continue;
    }

    // --allow-recent=<pkg> or --allow-recent <pkg>
    if (arg === '--allow-recent') {
      const nextArg = args[i + 1];
      if (nextArg && !nextArg.startsWith('-')) {
        excludePackages.push(nextArg);
        i++; // Skip the next arg
      }
      continue;
    }
    if (arg.startsWith('--allow-recent=')) {
      const value = arg.split('=')[1];
      if (value) {
        excludePackages.push(value);
      }
      continue;
    }

    // Pass through all other args
    cleanedArgs.push(arg);
  }

  // Build pnpm flags
  const flags: string[] = [];

  if (!disabled && minAgeMinutes > 0) {
    flags.push(`--minimum-release-age=${minAgeMinutes}`);

    // Add exclusions
    for (const pkg of excludePackages) {
      flags.push(`--minimum-release-age-exclude=${pkg}`);
    }
  }

  return {
    cleanedArgs,
    releaseAgeFlags: {
      flags,
      disabled,
      minAgeMinutes: disabled ? 0 : minAgeMinutes,
    },
  };
}
