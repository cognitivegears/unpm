import chalk from 'chalk';
import { execa } from 'execa';
import { logger } from '../utils/logger.js';

/**
 * Check if knip is available locally (installed as a dev dependency).
 */
async function isKnipInstalledLocally(): Promise<boolean> {
  try {
    await execa('pnpm', ['exec', 'knip', '--version'], {
      reject: true,
      stdio: 'pipe',
    });
    return true;
  } catch {
    return false;
  }
}

/**
 * Run knip to check for unused dependencies.
 *
 * Knip is a tool for finding unused files, dependencies, and exports.
 * https://knip.dev/
 *
 * By default, only checks for unused dependencies. Use --everything for full analysis.
 *
 * If knip is installed locally, it uses that. Otherwise, it runs via pnpm dlx
 * to download and execute knip on-the-fly.
 *
 * @param args - Arguments to pass to knip
 */
export async function unused(args: string[]): Promise<number> {
  const hasFix = args.includes('--fix');
  const hasEverything = args.includes('--everything');
  const isLocal = await isKnipInstalledLocally();

  // Remove our custom flags before passing to knip
  const knipArgs = args.filter((arg) => arg !== '--everything');

  // By default, only check for unused dependencies (not unlisted binaries, etc.)
  // Use --include to specifically select only unused dependency issue types
  if (!hasEverything) {
    knipArgs.push(
      '--include',
      'dependencies,devDependencies,optionalPeerDependencies'
    );
  }

  if (hasFix) {
    logger.info('');
    if (hasEverything) {
      logger.info(chalk.cyan('  Finding and fixing all unused code...'));
    } else {
      logger.info(chalk.cyan('  Finding and fixing unused dependencies...'));
    }
    logger.info('');
  } else {
    logger.info('');
    if (hasEverything) {
      logger.info(chalk.cyan('  Checking for all unused code...'));
    } else {
      logger.info(chalk.cyan('  Checking for unused dependencies...'));
    }
    logger.info('');
  }

  try {
    let result;

    if (isLocal) {
      // Use local installation
      logger.debug('Using locally installed knip');
      result = await execa('pnpm', ['exec', 'knip', ...knipArgs], {
        stdio: 'inherit',
        reject: false,
      });
    } else {
      // Use pnpm dlx to run knip on-the-fly
      logger.debug('Running knip via pnpm dlx');
      result = await execa('pnpm', ['dlx', 'knip', ...knipArgs], {
        stdio: 'inherit',
        reject: false,
      });
    }

    if (result.exitCode === 0) {
      if (!hasFix) {
        logger.info('');
        if (hasEverything) {
          logger.success('  No unused code found.');
        } else {
          logger.success('  No unused dependencies found.');
        }
        logger.info('');
      }
    } else if (!hasFix && result.exitCode === 1) {
      // knip exits with 1 when it finds issues
      logger.info('');
      if (hasEverything) {
        logger.info(chalk.yellow('  Unused code found. To fix, run:'));
        logger.info(chalk.cyan('    unpm unused --everything --fix'));
      } else {
        logger.info(
          chalk.yellow('  Unused dependencies found. To remove them, run:')
        );
        logger.info(chalk.cyan('    unpm unused --fix'));
      }
      logger.info('');
    }

    return result.exitCode ?? 0;
  } catch (error) {
    logger.error(`Failed to run knip: ${error}`);
    return 1;
  }
}
