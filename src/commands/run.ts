import chalk from 'chalk';
import { spawnPnpm } from '../utils/exec.js';
import { logger } from '../utils/logger.js';
import { validateStrictModeAction, removeStrictFlag } from '../security/strict-mode.js';

export async function run(args: string[]): Promise<number> {
  const pnpmArgs = ['run', ...args];
  const result = await spawnPnpm(pnpmArgs);
  return result.exitCode ?? 0;
}

export async function test(args: string[]): Promise<number> {
  const pnpmArgs = ['test', ...args];
  const result = await spawnPnpm(pnpmArgs);
  return result.exitCode ?? 0;
}

export async function start(args: string[]): Promise<number> {
  const pnpmArgs = ['start', ...args];
  const result = await spawnPnpm(pnpmArgs);
  return result.exitCode ?? 0;
}

export async function stop(args: string[]): Promise<number> {
  const pnpmArgs = ['stop', ...args];
  const result = await spawnPnpm(pnpmArgs);
  return result.exitCode ?? 0;
}

export async function restart(args: string[]): Promise<number> {
  const pnpmArgs = ['restart', ...args];
  const result = await spawnPnpm(pnpmArgs);
  return result.exitCode ?? 0;
}

export async function exec(args: string[]): Promise<number> {
  const pnpmArgs = ['exec', ...args];
  const result = await spawnPnpm(pnpmArgs);
  return result.exitCode ?? 0;
}

/**
 * Download and execute a package.
 *
 * SECURITY: This command downloads and executes arbitrary code from npm.
 * It bypasses unpm's install script protections.
 *
 * By default, dlx is BLOCKED and requires --allow-dlx to execute.
 * In strict mode, dlx is blocked entirely even with --allow-dlx.
 */
export async function dlx(args: string[], globalArgs: string[] = []): Promise<number> {
  // Check if --allow-dlx is present
  const hasAllowDlx = args.includes('--allow-dlx');

  // Combine args for strict mode check
  const allArgs = [...globalArgs, ...args];

  // Check strict mode validation
  const validation = await validateStrictModeAction('dlx', allArgs);
  if (!validation.allowed) {
    logger.error('');
    logger.error(chalk.red('  Error: dlx is blocked in strict mode.'));
    logger.error('');
    logger.error(chalk.dim(`  ${validation.reason}`));
    logger.error('');
    return 1;
  }

  // If no --allow-dlx flag, block execution
  if (!hasAllowDlx) {
    const packageName = args.find((arg) => !arg.startsWith('-')) ?? 'package';
    logger.error('');
    logger.error(chalk.red('  Error: dlx is blocked by default for security.'));
    logger.error('');
    logger.error(
      chalk.yellow(`  dlx downloads and executes "${packageName}" directly from npm,`)
    );
    logger.error(chalk.yellow('  bypassing unpm\'s install script protections.'));
    logger.error('');
    logger.error('  To run this command, explicitly allow it:');
    logger.error(chalk.cyan(`    unpm dlx --allow-dlx ${args.join(' ')}`));
    logger.error('');
    logger.error(chalk.dim('  Only run packages you trust.'));
    logger.error('');
    return 1;
  }

  // Remove our custom flags before passing to pnpm
  const pnpmArgs = [
    'dlx',
    ...removeStrictFlag(args).filter((arg) => arg !== '--allow-dlx'),
  ];
  const result = await spawnPnpm(pnpmArgs);
  return result.exitCode ?? 0;
}
