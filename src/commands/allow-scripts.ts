import chalk from 'chalk';
import {
  addToAllowlist,
  removeFromAllowlist,
  listAllowlist,
  initializeLavamoatConfig,
  hasLavamoatConfig,
} from '../security/lavamoat.js';
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

function printAllowScriptsHelp(): void {
  logger.info(chalk.bold('unpm allow-scripts - Manage LavaMoat script allowlist'));
  logger.info('');
  logger.info('Usage:');
  logger.info('  unpm allow-scripts <command> [options]');
  logger.info('');
  logger.info('Commands:');
  logger.info('  add <pkg>     Add package(s) to the allowlist');
  logger.info('  remove <pkg>  Remove package(s) from the allowlist');
  logger.info('  list          List all allowed packages');
  logger.info('  init          Initialize LavaMoat configuration');
  logger.info('');
  logger.info('Examples:');
  logger.info('  unpm allow-scripts add esbuild');
  logger.info('  unpm allow-scripts add node-sass sharp');
  logger.info('  unpm allow-scripts remove esbuild');
  logger.info('  unpm allow-scripts list');
}
