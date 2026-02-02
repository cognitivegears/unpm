import { readPackageJson } from '../utils/config.js';

export interface ExoticSubdepsConfig {
  /** Whether to block exotic subdependencies (git/tarball URLs) */
  blockExoticSubdeps: boolean;
}

/**
 * Get the exotic subdeps configuration from package.json or defaults.
 * NOT enabled by default - must be explicitly set via CLI or config.
 */
export async function getExoticSubdepsConfig(
  cwd?: string
): Promise<ExoticSubdepsConfig> {
  const packageJson = await readPackageJson(cwd);
  const unpmConfig = packageJson?.['unpm'] as
    | {
        blockExoticSubdeps?: boolean;
      }
    | undefined;

  return {
    blockExoticSubdeps: unpmConfig?.blockExoticSubdeps ?? false,
  };
}

export interface ExoticSubdepsFlagsResult {
  /**
   * CLI flags to pass to pnpm.
   */
  flags: string[];
  /** Whether exotic subdeps blocking is enabled */
  enabled: boolean;
}

/**
 * Extract exotic subdeps related flags from args and return pnpm flags.
 *
 * Supported flags:
 * - --block-exotic-subdeps: Enable blocking of exotic subdependencies
 * - --no-block-exotic-subdeps: Disable blocking
 */
export async function extractExoticSubdepsFlags(
  args: string[],
  cwd?: string
): Promise<{
  cleanedArgs: string[];
  exoticSubdepsFlags: ExoticSubdepsFlagsResult;
}> {
  const config = await getExoticSubdepsConfig(cwd);

  let enabled = config.blockExoticSubdeps;
  const cleanedArgs: string[] = [];

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (!arg) continue;

    // --block-exotic-subdeps
    if (arg === '--block-exotic-subdeps') {
      enabled = true;
      continue;
    }

    // --no-block-exotic-subdeps
    if (arg === '--no-block-exotic-subdeps') {
      enabled = false;
      continue;
    }

    // Pass through all other args
    cleanedArgs.push(arg);
  }

  // Build pnpm CLI flags for the setting
  const flags: string[] = [];

  if (enabled) {
    flags.push('--config.block-exotic-subdeps=true');
  }

  return {
    cleanedArgs,
    exoticSubdepsFlags: {
      flags,
      enabled,
    },
  };
}
