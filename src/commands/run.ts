import chalk from 'chalk';
import { spawnPnpm } from '../utils/exec.js';
import { logger } from '../utils/logger.js';

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
 * WARNING: This command downloads and executes arbitrary code from npm.
 * It bypasses unpm's install script protections.
 */
export async function dlx(args: string[]): Promise<number> {
  // Check for --yes or -y flag which skips confirmation
  const skipWarning = args.includes('--yes') || args.includes('-y');

  if (!skipWarning && args.length > 0) {
    const packageName = args.find((arg) => !arg.startsWith('-')) ?? args[0];
    logger.warn('');
    logger.warn(
      chalk.yellow(`  Warning: \`dlx\` downloads and executes "${packageName}" directly from npm.`)
    );
    logger.warn('');
    logger.warn(chalk.yellow('  This bypasses unpm\'s install script protections.'));
    logger.warn(chalk.yellow('  Only run packages you trust.'));
    logger.warn('');
    logger.warn('  To suppress this warning, use:');
    logger.warn(chalk.cyan(`    unpm dlx --yes ${args.join(' ')}`));
    logger.warn('');
  }

  // Remove our custom --yes flag before passing to pnpm
  const pnpmArgs = ['dlx', ...args.filter((arg) => arg !== '--yes' && arg !== '-y')];
  const result = await spawnPnpm(pnpmArgs);
  return result.exitCode ?? 0;
}
