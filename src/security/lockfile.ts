import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import chalk from 'chalk';
import { fileExists, hasPnpmLock } from '../utils/config.js';
import { isStrictMode } from './strict-mode.js';
import { logger } from '../utils/logger.js';

export interface LockfileCheckResult {
  /** Whether the command should proceed */
  allowed: boolean;
  /** Whether a lockfile exists */
  hasLockfile: boolean;
  /** Whether the lockfile is gitignored (only set if in a git repo) */
  isGitignored?: boolean;
  /** Warning or error messages */
  messages: string[];
}

/**
 * Check if we're in a git repository by looking for .git directory.
 */
export async function isGitRepo(cwd?: string): Promise<boolean> {
  const dir = cwd ?? process.cwd();
  return fileExists(join(dir, '.git'));
}

/**
 * Check if a file is in .gitignore.
 * This is a simple check that looks for the filename in .gitignore.
 */
export async function isInGitignore(
  filename: string,
  cwd?: string
): Promise<boolean> {
  const dir = cwd ?? process.cwd();
  const gitignorePath = join(dir, '.gitignore');

  try {
    const content = await readFile(gitignorePath, 'utf-8');
    const lines = content.split('\n').map((line) => line.trim());

    // Check for exact match or pattern match
    for (const line of lines) {
      // Skip comments and empty lines
      if (line.startsWith('#') || line === '') {
        continue;
      }

      // Check for exact match
      if (line === filename || line === `/${filename}`) {
        return true;
      }

      // Check for wildcard patterns that would match the filename
      // e.g., "*.yaml" would match "pnpm-lock.yaml"
      if (line.startsWith('*') && filename.endsWith(line.slice(1))) {
        return true;
      }

      // Check for negation patterns (these override previous ignores)
      // We don't handle negation here - it would require git's full algorithm
    }

    return false;
  } catch {
    // .gitignore doesn't exist or can't be read
    return false;
  }
}

/**
 * Check lockfile status and report warnings/errors.
 *
 * Checks:
 * 1. Is pnpm-lock.yaml missing?
 * 2. Is lockfile in .gitignore (if in a git repo)?
 *
 * In strict mode, these are errors (blocks the command).
 * In normal mode, these are warnings.
 */
export async function checkLockfile(
  args: string[] = [],
  cwd?: string
): Promise<LockfileCheckResult> {
  const strict = await isStrictMode(args, cwd);
  const hasLockfile = await hasPnpmLock(cwd);
  const inGitRepo = await isGitRepo(cwd);

  const messages: string[] = [];
  let isGitignored: boolean | undefined;

  // Check if lockfile exists
  if (!hasLockfile) {
    if (strict) {
      messages.push(
        'No pnpm-lock.yaml found. Lockfile is required in strict mode.'
      );
      messages.push('Run "unpm install" to generate a lockfile.');
    } else {
      messages.push(
        'No pnpm-lock.yaml found. Consider committing a lockfile for reproducible builds.'
      );
    }
  }

  // Check if lockfile is gitignored (only if we're in a git repo and have a lockfile)
  if (inGitRepo && hasLockfile) {
    isGitignored = await isInGitignore('pnpm-lock.yaml', cwd);
    if (isGitignored) {
      if (strict) {
        messages.push(
          'pnpm-lock.yaml is in .gitignore. Lockfile must be committed in strict mode.'
        );
        messages.push(
          'Remove pnpm-lock.yaml from .gitignore to enable reproducible builds.'
        );
      } else {
        messages.push(
          'pnpm-lock.yaml is in .gitignore. Consider committing the lockfile for reproducible builds.'
        );
      }
    }
  }

  // In strict mode, any issue blocks the command
  const allowed = strict ? messages.length === 0 : true;

  return {
    allowed,
    hasLockfile,
    isGitignored,
    messages,
  };
}

/**
 * Validate lockfile and log warnings/errors.
 * Returns true if the command should proceed, false if it should be blocked.
 */
export async function validateLockfile(
  args: string[] = [],
  cwd?: string
): Promise<boolean> {
  const result = await checkLockfile(args, cwd);
  const strict = await isStrictMode(args, cwd);

  if (result.messages.length === 0) {
    return true;
  }

  logger.info('');
  for (const message of result.messages) {
    if (strict) {
      logger.error(chalk.red(`  ${message}`));
    } else {
      logger.warn(chalk.yellow(`  Warning: ${message}`));
    }
  }
  logger.info('');

  return result.allowed;
}
