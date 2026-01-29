import chalk from 'chalk';
import { execPnpm } from '../utils/exec.js';
import {
  hasPackageLock,
  hasPnpmLock,
  fileExists,
  readPackageJson,
  writePackageJson,
} from '../utils/config.js';
import { initializeLavamoatConfig } from '../security/lavamoat.js';
import { logger } from '../utils/logger.js';
import { readFile, appendFile } from 'node:fs/promises';
import { join } from 'node:path';

export async function migrate(args: string[]): Promise<number> {
  const cwd = process.cwd();
  const dryRun = args.includes('--dry-run');
  const skipLavamoat = args.includes('--skip-lavamoat');

  logger.info(chalk.bold('UNPM Migration'));
  logger.info('');

  // Check for package.json
  const packageJson = await readPackageJson(cwd);
  if (!packageJson) {
    logger.error('No package.json found in current directory');
    return 1;
  }

  logger.info(`Migrating project: ${packageJson.name ?? 'unnamed'}`);
  logger.info('');

  // Step 1: Convert package-lock.json to pnpm-lock.yaml
  const hasNpmLock = await hasPackageLock(cwd);
  const hasPnpm = await hasPnpmLock(cwd);

  if (hasNpmLock && !hasPnpm) {
    logger.info('Converting package-lock.json to pnpm-lock.yaml...');
    if (!dryRun) {
      const result = await execPnpm(['import'], { stdio: 'pipe' });
      if (result.exitCode !== 0) {
        logger.warn(
          'Could not convert package-lock.json. Running fresh install instead.'
        );
      } else {
        logger.success('Converted package-lock.json to pnpm-lock.yaml');
      }
    } else {
      logger.info('  [dry-run] Would convert package-lock.json');
    }
  } else if (hasPnpm) {
    logger.info('pnpm-lock.yaml already exists');
  } else {
    logger.info('No package-lock.json found, will create fresh pnpm-lock.yaml');
  }
  logger.info('');

  // Step 2: Initialize LavaMoat configuration
  if (!skipLavamoat) {
    logger.info('Setting up LavaMoat configuration...');
    if (!dryRun) {
      try {
        await initializeLavamoatConfig(cwd);
      } catch (error) {
        logger.warn(
          `Could not initialize LavaMoat config: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
      }
    } else {
      logger.info(
        '  [dry-run] Would initialize lavamoat config in package.json'
      );
    }
  }
  logger.info('');

  // Step 3: Update .gitignore
  const gitignorePath = join(cwd, '.gitignore');
  const hasGitignore = await fileExists(gitignorePath);

  if (hasGitignore) {
    const gitignoreContent = await readFile(gitignorePath, 'utf-8');
    const linesToAdd: string[] = [];

    if (!gitignoreContent.includes('node_modules')) {
      linesToAdd.push('node_modules/');
    }

    if (linesToAdd.length > 0) {
      logger.info('Updating .gitignore...');
      if (!dryRun) {
        await appendFile(gitignorePath, '\n' + linesToAdd.join('\n') + '\n');
        logger.success('Updated .gitignore');
      } else {
        logger.info(
          `  [dry-run] Would add to .gitignore: ${linesToAdd.join(', ')}`
        );
      }
    }
  }
  logger.info('');

  // Step 4: Add unpm config to package.json
  logger.info('Adding unpm configuration to package.json...');
  if (!dryRun) {
    if (!packageJson['unpm']) {
      packageJson['unpm'] = {
        allowLocalScripts: true,
        allowDependencyScripts: false,
        lavamoatEnabled: true,
      };
      await writePackageJson(packageJson, cwd);
      logger.success('Added unpm configuration');
    } else {
      logger.info('unpm configuration already exists');
    }
  } else {
    logger.info('  [dry-run] Would add unpm config to package.json');
  }
  logger.info('');

  // Step 5: Install dependencies
  logger.info('Installing dependencies with pnpm...');
  if (!dryRun) {
    const result = await execPnpm(['install', '--ignore-scripts'], {
      stdio: 'inherit',
    });
    if (result.exitCode !== 0) {
      logger.error('Failed to install dependencies');
      return result.exitCode;
    }
    logger.success('Dependencies installed');
  } else {
    logger.info('  [dry-run] Would run pnpm install --ignore-scripts');
  }
  logger.info('');

  // Summary
  logger.info(chalk.bold('Migration complete!'));
  logger.info('');
  logger.info('Next steps:');
  logger.info('  1. Review the changes and commit them');
  logger.info('  2. If you have packages that need to run install scripts:');
  logger.info('     unpm allow-scripts add <package-name>');
  logger.info('  3. Update your CI/CD to use: unpm ci');
  logger.info('');

  return 0;
}
