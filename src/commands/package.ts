import chalk from 'chalk';
import { spawnPnpm } from '../utils/exec.js';
import { passthroughToNpm } from './passthrough.js';
import { logger } from '../utils/logger.js';
import { validateStrictModeAction, removeStrictFlag } from '../security/strict-mode.js';

/**
 * Manage package.json properties.
 * This is an npm-only command for package.json manipulation.
 */
export async function pkg(args: string[]): Promise<number> {
  return passthroughToNpm('pkg', args, false);
}

/**
 * Query installed packages using CSS-like selectors.
 * Maps to pnpm ls with appropriate flags.
 */
export async function query(args: string[]): Promise<number> {
  // pnpm doesn't have a direct query command, but we can use ls with filters
  // For basic queries, map to pnpm ls --json for structured output
  const pnpmArgs = ['ls', '--json', ...args];
  const result = await spawnPnpm(pnpmArgs);
  return result.exitCode ?? 0;
}

/**
 * Open an editor in a package's directory.
 * This is an npm-only command.
 */
export async function edit(args: string[]): Promise<number> {
  return passthroughToNpm('edit', args, false);
}

/**
 * Explore a package in a subshell.
 *
 * SECURITY: This command spawns a shell in a package directory, allowing
 * arbitrary command execution. It is BLOCKED by default.
 *
 * Use --allow-explore to enable this command.
 * In strict mode, this command is blocked entirely.
 */
export async function explore(args: string[], globalArgs: string[] = []): Promise<number> {
  // Check if --allow-explore is present
  const hasAllowExplore = args.includes('--allow-explore');

  // Combine args for strict mode check
  const allArgs = [...globalArgs, ...args];

  // Check strict mode validation
  const validation = await validateStrictModeAction('explore', allArgs);
  if (!validation.allowed) {
    logger.error('');
    logger.error(chalk.red('  Error: explore is blocked in strict mode.'));
    logger.error('');
    logger.error(chalk.dim(`  ${validation.reason}`));
    logger.error('');
    return 1;
  }

  // If no --allow-explore flag, block execution
  if (!hasAllowExplore) {
    const packageName = args.find((arg) => !arg.startsWith('-')) ?? 'package';
    logger.error('');
    logger.error(chalk.red('  Error: explore is blocked by default for security.'));
    logger.error('');
    logger.error(
      chalk.yellow(`  explore spawns a shell in "${packageName}"'s directory,`)
    );
    logger.error(chalk.yellow('  allowing arbitrary command execution.'));
    logger.error('');
    logger.error('  To run this command, explicitly allow it:');
    logger.error(chalk.cyan(`    unpm explore --allow-explore ${args.join(' ')}`));
    logger.error('');
    return 1;
  }

  // Remove our custom flags before passing to npm
  const npmArgs = removeStrictFlag(args).filter((arg) => arg !== '--allow-explore');
  return passthroughToNpm('explore', npmArgs, false);
}

/**
 * Generate a Software Bill of Materials (SBOM).
 * This is an npm-only command for security/compliance.
 */
export async function sbom(args: string[]): Promise<number> {
  return passthroughToNpm('sbom', args, false);
}

/**
 * Find duplicate packages in the dependency tree.
 * Maps to pnpm dedupe --check.
 */
export async function findDupes(args: string[]): Promise<number> {
  // pnpm dedupe --check shows what would be deduped without making changes
  const pnpmArgs = ['dedupe', '--check', ...removeStrictFlag(args)];
  const result = await spawnPnpm(pnpmArgs);
  return result.exitCode ?? 0;
}
