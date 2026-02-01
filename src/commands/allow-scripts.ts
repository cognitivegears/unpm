import chalk from 'chalk';
import {
  addToAllowlist,
  removeFromAllowlist,
  listAllowlist,
  initializeLavamoatConfig,
  hasLavamoatConfig,
} from '../security/lavamoat.js';
import { getPackagesWithScripts } from '../security/script-policy.js';
import { logger } from '../utils/logger.js';

export async function allowScripts(args: string[]): Promise<number> {
  const subcommand = args[0];
  const subArgs = args.slice(1);

  switch (subcommand) {
    case 'add':
      return allowScriptsAdd(subArgs);
    case 'remove':
    case 'rm':
      return allowScriptsRemove(subArgs);
    case 'list':
    case 'ls':
      return allowScriptsList();
    case 'init':
      return allowScriptsInit();
    case 'review':
      return allowScriptsReview();
    default:
      printAllowScriptsHelp();
      return subcommand ? 1 : 0;
  }
}

async function allowScriptsAdd(args: string[]): Promise<number> {
  if (args.length === 0) {
    logger.error('Please specify a package name');
    logger.info('Usage: unpm allow-scripts add <package-name>');
    return 1;
  }

  // Ensure LavaMoat config exists
  if (!(await hasLavamoatConfig())) {
    await initializeLavamoatConfig();
  }

  for (const packageName of args) {
    try {
      await addToAllowlist(packageName);
    } catch (error) {
      logger.error(
        `Failed to add "${packageName}": ${error instanceof Error ? error.message : 'Unknown error'}`
      );
      return 1;
    }
  }

  logger.info('');
  logger.info('Run "unpm install" to apply changes.');

  return 0;
}

async function allowScriptsRemove(args: string[]): Promise<number> {
  if (args.length === 0) {
    logger.error('Please specify a package name');
    logger.info('Usage: unpm allow-scripts remove <package-name>');
    return 1;
  }

  for (const packageName of args) {
    try {
      await removeFromAllowlist(packageName);
    } catch (error) {
      logger.error(
        `Failed to remove "${packageName}": ${error instanceof Error ? error.message : 'Unknown error'}`
      );
      return 1;
    }
  }

  return 0;
}

async function allowScriptsList(): Promise<number> {
  const packages = await listAllowlist();

  if (packages.length === 0) {
    logger.info('No packages are allowed to run scripts.');
    logger.info('');
    logger.info('To add a package, run:');
    logger.info('  unpm allow-scripts add <package-name>');
    return 0;
  }

  logger.info(chalk.bold('Packages allowed to run scripts:'));
  logger.info('');
  for (const pkg of packages) {
    logger.info(`  - ${pkg}`);
  }
  logger.info('');

  return 0;
}

async function allowScriptsInit(): Promise<number> {
  try {
    await initializeLavamoatConfig();
    return 0;
  } catch (error) {
    logger.error(
      `Failed to initialize: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
    return 1;
  }
}

async function allowScriptsReview(): Promise<number> {
  const packagesWithScripts = await getPackagesWithScripts();
  const allowedPackages = await listAllowlist();

  // Categorize packages
  const allowed: string[] = [];
  const blocked: string[] = [];

  for (const pkg of packagesWithScripts) {
    if (allowedPackages.includes(pkg)) {
      allowed.push(pkg);
    } else {
      blocked.push(pkg);
    }
  }

  // Find stale entries (in allowlist but not installed or no scripts)
  const stale = allowedPackages.filter((pkg) => !packagesWithScripts.includes(pkg));

  logger.info(chalk.bold('Script Allowlist Review'));
  logger.info('');

  // Allowed packages
  logger.info(chalk.green.bold(`Allowed (${allowed.length})`));
  if (allowed.length === 0) {
    logger.info(chalk.dim('  No packages with scripts are allowed'));
  } else {
    for (const pkg of allowed) {
      logger.info(chalk.green(`  \u2713 ${pkg}`));
    }
  }
  logger.info('');

  // Blocked packages
  logger.info(chalk.red.bold(`Blocked (${blocked.length})`));
  if (blocked.length === 0) {
    logger.info(chalk.dim('  No packages with scripts are blocked'));
  } else {
    for (const pkg of blocked.slice(0, 20)) {
      logger.info(chalk.red(`  \u2717 ${pkg}`));
    }
    if (blocked.length > 20) {
      logger.info(chalk.red(`  ... and ${blocked.length - 20} more`));
    }
  }
  logger.info('');

  // Stale entries
  if (stale.length > 0) {
    logger.info(chalk.yellow.bold(`Stale Entries (${stale.length})`));
    logger.info(chalk.dim('  In allowlist but not installed or no scripts:'));
    for (const pkg of stale) {
      logger.info(chalk.yellow(`  ? ${pkg}`));
    }
    logger.info('');
  }

  // Summary and suggestions
  logger.info(chalk.bold('Summary'));
  logger.info(`  ${chalk.green(`${allowed.length} allowed`)}, ${chalk.red(`${blocked.length} blocked`)}, ${chalk.yellow(`${stale.length} stale`)}`);
  logger.info('');

  if (blocked.length > 0) {
    logger.info(chalk.bold('Suggestions'));
    logger.info('  To allow a blocked package:');
    logger.info(chalk.cyan('    unpm allow-scripts add <package-name>'));
    logger.info('');
  }

  if (stale.length > 0) {
    logger.info('  To remove stale entries:');
    for (const pkg of stale.slice(0, 3)) {
      logger.info(chalk.cyan(`    unpm allow-scripts remove ${pkg}`));
    }
    if (stale.length > 3) {
      logger.info(chalk.dim(`    ... and ${stale.length - 3} more`));
    }
    logger.info('');
  }

  return 0;
}

function printAllowScriptsHelp(): void {
  logger.info(
    chalk.bold('unpm allow-scripts - Manage LavaMoat script allowlist')
  );
  logger.info('');
  logger.info('Usage:');
  logger.info('  unpm allow-scripts <command> [options]');
  logger.info('');
  logger.info('Commands:');
  logger.info('  add <pkg>     Add package(s) to the allowlist');
  logger.info('  remove <pkg>  Remove package(s) from the allowlist');
  logger.info('  list          List all allowed packages');
  logger.info('  review        Review all packages with scripts (allowed/blocked/stale)');
  logger.info('  init          Initialize LavaMoat configuration');
  logger.info('');
  logger.info('Examples:');
  logger.info('  unpm allow-scripts add esbuild');
  logger.info('  unpm allow-scripts add node-sass sharp');
  logger.info('  unpm allow-scripts remove esbuild');
  logger.info('  unpm allow-scripts list');
  logger.info('  unpm allow-scripts review');
}
