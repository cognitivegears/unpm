import { unlink } from 'node:fs/promises';
import { join } from 'node:path';
import chalk from 'chalk';
import { hasPackageLock, hasPnpmLock, fileExists } from '../utils/config.js';
import { execPnpm, execNpm } from '../utils/exec.js';
import { isStrictMode } from './strict-mode.js';
import { logger } from '../utils/logger.js';

export type MigrationMode = 'pre-migration' | 'post-migration';

export interface MigrationModeResult {
  mode: MigrationMode;
  hasPackageLock: boolean;
  hasPnpmLock: boolean;
}

/**
 * Get flags needed for npm compatibility in pre-migration mode.
 *
 * In pre-migration mode, we use --shamefully-hoist to create a flat node_modules
 * structure compatible with npm. This allows npm and unpm to be used interchangeably
 * by different team members.
 */
export function getCompatibilityFlags(mode: MigrationModeResult): string[] {
  if (mode.mode === 'pre-migration') {
    return ['--shamefully-hoist'];
  }
  return [];
}

/**
 * Detect whether the project is in pre-migration or post-migration mode.
 *
 * Pre-migration: pnpm-lock.yaml does NOT exist (npm interop enabled)
 * Post-migration: pnpm-lock.yaml exists (pnpm-only mode)
 */
export async function detectMigrationMode(
  cwd?: string
): Promise<MigrationModeResult> {
  const dir = cwd ?? process.cwd();
  const hasNpmLock = await hasPackageLock(dir);
  const hasPnpm = await hasPnpmLock(dir);

  return {
    mode: hasPnpm ? 'post-migration' : 'pre-migration',
    hasPackageLock: hasNpmLock,
    hasPnpmLock: hasPnpm,
  };
}

/**
 * Pre-sync: Import package-lock.json to create a temporary pnpm-lock.yaml.
 *
 * This runs `pnpm import` to convert package-lock.json to pnpm-lock.yaml.
 * If package-lock.json doesn't exist, this is a no-op (pnpm will create fresh lockfile).
 *
 * @returns true if sync succeeded or was skipped, false if it failed in strict mode
 */
export async function preSyncLockfile(
  args: string[] = [],
  cwd?: string
): Promise<boolean> {
  const dir = cwd ?? process.cwd();
  const strict = await isStrictMode(args, dir);
  const hasNpmLock = await hasPackageLock(dir);

  if (!hasNpmLock) {
    logger.debug('No package-lock.json found, skipping pre-sync');
    return true;
  }

  logger.debug('Pre-sync: Importing package-lock.json to pnpm-lock.yaml');

  try {
    const result = await execPnpm(['import'], { cwd: dir, stdio: 'pipe' });

    if (result.exitCode !== 0) {
      const message =
        'Could not import package-lock.json. Continuing with fresh resolution.';
      if (strict) {
        logger.error(chalk.red(`  Error: ${message}`));
        logger.error(
          chalk.dim('  In strict mode, lockfile sync must succeed.')
        );
        return false;
      }
      logger.warn(chalk.yellow(`  Warning: ${message}`));
    } else {
      logger.debug(
        'Pre-sync complete: pnpm-lock.yaml created from package-lock.json'
      );
    }

    return true;
  } catch (error) {
    const message = `Pre-sync failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
    if (strict) {
      logger.error(chalk.red(`  Error: ${message}`));
      return false;
    }
    logger.warn(chalk.yellow(`  Warning: ${message}`));
    return true;
  }
}

/**
 * Post-sync: Export pnpm-lock.yaml back to package-lock.json.
 *
 * Uses `pnpm dlx pnpm-lock-export` for accurate conversion.
 * Falls back to `npm install --package-lock-only` if that fails.
 *
 * @returns true if sync succeeded, false if it failed (warning only)
 */
export async function postSyncLockfile(
  args: string[] = [],
  cwd?: string
): Promise<boolean> {
  const dir = cwd ?? process.cwd();
  const strict = await isStrictMode(args, dir);
  const hasPnpm = await hasPnpmLock(dir);

  if (!hasPnpm) {
    logger.debug('No pnpm-lock.yaml found, skipping post-sync');
    return true;
  }

  logger.debug('Post-sync: Exporting pnpm-lock.yaml to package-lock.json');

  // Try pnpm-lock-export first (most accurate conversion)
  try {
    const result = await execPnpm(
      ['dlx', 'pnpm-lock-export', '--output', 'package-lock.json'],
      { cwd: dir, stdio: 'pipe' }
    );

    if (result.exitCode === 0) {
      logger.debug(
        'Post-sync complete: package-lock.json updated via pnpm-lock-export'
      );
      return true;
    }

    logger.debug('pnpm-lock-export failed, trying npm fallback');
  } catch (error) {
    logger.debug(
      `pnpm-lock-export error: ${error instanceof Error ? error.message : 'Unknown'}`
    );
  }

  // Fallback: Use npm to regenerate package-lock.json
  try {
    const result = await execNpm(
      ['install', '--package-lock-only', '--ignore-scripts'],
      { cwd: dir, stdio: 'pipe' }
    );

    if (result.exitCode === 0) {
      logger.debug('Post-sync complete: package-lock.json regenerated via npm');
      return true;
    }

    const message =
      'Could not export to package-lock.json. npm interop may be affected.';
    if (strict) {
      logger.error(chalk.red(`  Error: ${message}`));
      return false;
    }
    logger.warn(chalk.yellow(`  Warning: ${message}`));
    return true;
  } catch (error) {
    const message = `Post-sync failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
    if (strict) {
      logger.error(chalk.red(`  Error: ${message}`));
      return false;
    }
    logger.warn(chalk.yellow(`  Warning: ${message}`));
    return true;
  }
}

/**
 * Cleanup: Delete temporary pnpm-lock.yaml in pre-migration mode.
 *
 * This ensures only package-lock.json remains after pre-migration commands,
 * allowing npm to be used interchangeably with unpm.
 */
export async function cleanupTempLockfile(cwd?: string): Promise<void> {
  const dir = cwd ?? process.cwd();
  const lockfilePath = join(dir, 'pnpm-lock.yaml');

  if (await fileExists(lockfilePath)) {
    try {
      await unlink(lockfilePath);
      logger.debug('Cleanup: Removed temporary pnpm-lock.yaml');
    } catch (error) {
      logger.debug(
        `Could not remove pnpm-lock.yaml: ${error instanceof Error ? error.message : 'Unknown'}`
      );
    }
  }
}

/**
 * Check if the project has been migrated (pnpm-lock.yaml exists as migration marker).
 */
export async function isMigrated(cwd?: string): Promise<boolean> {
  return hasPnpmLock(cwd);
}

/**
 * Execute lockfile sync for a command that modifies dependencies.
 *
 * This is a helper that wraps the full pre-migration sync workflow:
 * 1. Pre-sync (if in pre-migration mode)
 * 2. Execute the provided command
 * 3. Post-sync (if in pre-migration mode and command succeeded)
 * 4. Cleanup (if in pre-migration mode)
 *
 * @param commandFn The command function to execute between syncs
 * @param modifiesDependencies Whether the command modifies dependencies (determines if post-sync is needed)
 * @param args CLI args (for strict mode detection)
 * @param cwd Working directory
 */
export async function withLockfileSync<T>(
  commandFn: () => Promise<T>,
  options: {
    modifiesDependencies?: boolean;
    args?: string[];
    cwd?: string;
  } = {}
): Promise<{ result: T; syncFailed: boolean }> {
  const { modifiesDependencies = true, args = [], cwd } = options;
  const mode = await detectMigrationMode(cwd);

  // Post-migration mode: no sync needed
  if (mode.mode === 'post-migration') {
    const result = await commandFn();
    return { result, syncFailed: false };
  }

  // Pre-migration mode: sync lockfiles
  const preSyncSuccess = await preSyncLockfile(args, cwd);
  if (!preSyncSuccess) {
    // Strict mode failed pre-sync, return early
    // Return a placeholder result - caller should check syncFailed
    return { result: 1 as T, syncFailed: true };
  }

  let result: T;
  let commandSucceeded = false;

  try {
    result = await commandFn();
    // Assume numeric exit codes, 0 = success
    commandSucceeded = typeof result === 'number' ? result === 0 : true;
  } catch (error) {
    // Cleanup even on command failure
    await cleanupTempLockfile(cwd);
    throw error;
  }

  // Post-sync only if command succeeded and modifies dependencies
  if (commandSucceeded && modifiesDependencies) {
    await postSyncLockfile(args, cwd);
  }

  // Always cleanup in pre-migration mode
  await cleanupTempLockfile(cwd);

  return { result, syncFailed: false };
}
