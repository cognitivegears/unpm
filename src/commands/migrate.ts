import chalk from 'chalk';
import { execPnpm, getPnpmVersion } from '../utils/exec.js';
import {
  hasPackageLock,
  hasPnpmLock,
  fileExists,
  readPackageJson,
  writePackageJson,
} from '../utils/config.js';
import { initializeLavamoatConfig } from '../security/lavamoat.js';
import { logger } from '../utils/logger.js';
import { readFile, appendFile, unlink, writeFile } from 'node:fs/promises';
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

  // Step 4: Add unpm config to package.json (including migrated flag)
  logger.info('Adding unpm configuration to package.json...');
  if (!dryRun) {
    const existingUnpm = packageJson['unpm'] as Record<string, unknown> | undefined;
    packageJson['unpm'] = {
      ...existingUnpm,
      migrated: true,
      allowLocalScripts: existingUnpm?.allowLocalScripts ?? true,
      allowDependencyScripts: existingUnpm?.allowDependencyScripts ?? false,
      lavamoatEnabled: existingUnpm?.lavamoatEnabled ?? true,
    };
    await writePackageJson(packageJson, cwd);
    logger.success('Added unpm configuration (migrated: true)');
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

  // Step 6: Delete package-lock.json (pnpm-lock.yaml persists as migration marker)
  if (hasNpmLock) {
    logger.info('Removing package-lock.json...');
    if (!dryRun) {
      try {
        await unlink(join(cwd, 'package-lock.json'));
        logger.success('Removed package-lock.json');
      } catch (error) {
        logger.warn(
          `Could not remove package-lock.json: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
      }
    } else {
      logger.info('  [dry-run] Would remove package-lock.json');
    }
    logger.info('');
  }

  // Step 7: Set packageManager field for corepack
  const pnpmVersion = await getPnpmVersion();
  if (pnpmVersion) {
    logger.info('Setting packageManager field for corepack...');
    if (!dryRun) {
      // Re-read package.json in case it was modified
      const updatedPackageJson = await readPackageJson(cwd);
      if (updatedPackageJson) {
        updatedPackageJson['packageManager'] = `pnpm@${pnpmVersion}`;
        await writePackageJson(updatedPackageJson, cwd);
        logger.success(`Set packageManager to pnpm@${pnpmVersion}`);
      }
    } else {
      logger.info(
        `  [dry-run] Would set packageManager to pnpm@${pnpmVersion}`
      );
    }
    logger.info('');
  }

  // Step 8: Add engines field and preinstall script to block npm
  // engines.npm + engine-strict blocks: npm update, npm outdated, etc.
  // preinstall script blocks: npm install, npm ci
  logger.info('Adding npm blocking mechanisms...');
  if (!dryRun) {
    const updatedPackageJson = await readPackageJson(cwd);
    if (updatedPackageJson) {
      let modified = false;

      // Add engines field to block npm with an unsatisfiable version
      if (!updatedPackageJson['engines']) {
        updatedPackageJson['engines'] = {};
      }
      const engines = updatedPackageJson['engines'] as Record<string, string>;
      if (!engines['npm']) {
        engines['npm'] = 'use-pnpm-instead';
        modified = true;
        logger.success('Added engines.npm constraint (blocks npm update, outdated, etc.)');
      }

      // Add preinstall script to block npm install/ci
      if (!updatedPackageJson.scripts) {
        updatedPackageJson.scripts = {};
      }
      if (!updatedPackageJson.scripts['preinstall']) {
        updatedPackageJson.scripts['preinstall'] =
          "node -e \"if(!process.env.npm_execpath?.includes('pnpm')){console.error('Use unpm or pnpm instead of npm');process.exit(1)}\"";
        modified = true;
        logger.success('Added preinstall script (blocks npm install, ci)');
      }

      if (modified) {
        await writePackageJson(updatedPackageJson, cwd);
      } else {
        logger.info('npm blocking mechanisms already exist, skipping');
      }
    }
  } else {
    logger.info('  [dry-run] Would add engines constraint and preinstall script');
  }
  logger.info('');

  // Step 9: Create .npmrc with engine-strict to enforce npm blocking
  const npmrcPath = join(cwd, '.npmrc');
  const hasNpmrc = await fileExists(npmrcPath);
  if (!hasNpmrc) {
    logger.info('Creating .npmrc to enforce npm blocking...');
    if (!dryRun) {
      const npmrcContent = `# Block npm - use unpm or pnpm instead
engine-strict=true
`;
      await writeFile(npmrcPath, npmrcContent, 'utf-8');
      logger.success('Created .npmrc with engine-strict=true');
    } else {
      logger.info('  [dry-run] Would create .npmrc with engine-strict=true');
    }
    logger.info('');
  }

  // Step 10: Create npm-shrinkwrap.json to block npm before it parses node_modules
  // npm reads shrinkwrap before parsing node_modules, so the engine check happens early
  const shrinkwrapPath = join(cwd, 'npm-shrinkwrap.json');
  const hasShrinkwrap = await fileExists(shrinkwrapPath);
  if (!hasShrinkwrap) {
    logger.info('Creating npm-shrinkwrap.json to block npm...');
    if (!dryRun) {
      const pkgJson = await readPackageJson(cwd);
      const shrinkwrapContent = {
        name: pkgJson?.name ?? 'unknown',
        version: pkgJson?.version ?? '0.0.0',
        lockfileVersion: 3,
        requires: true,
        packages: {
          '': {
            name: pkgJson?.name ?? 'unknown',
            version: pkgJson?.version ?? '0.0.0',
            engines: {
              npm: 'use-pnpm-instead',
            },
          },
        },
      };
      await writeFile(
        shrinkwrapPath,
        JSON.stringify(shrinkwrapContent, null, 2) + '\n',
        'utf-8'
      );
      logger.success('Created npm-shrinkwrap.json (blocks npm before node_modules parsing)');
    } else {
      logger.info('  [dry-run] Would create npm-shrinkwrap.json');
    }
    logger.info('');
  }

  // Step 11: Create .pnpmrc with secure defaults
  const pnpmrcPath = join(cwd, '.pnpmrc');
  const hasPnpmrc = await fileExists(pnpmrcPath);
  if (!hasPnpmrc) {
    logger.info('Creating .pnpmrc with secure defaults...');
    if (!dryRun) {
      const pnpmrcContent = `# UNPM security defaults
ignore-scripts=true
minimum-release-age=2d
`;
      await writeFile(pnpmrcPath, pnpmrcContent, 'utf-8');
      logger.success('Created .pnpmrc with secure defaults');
    } else {
      logger.info('  [dry-run] Would create .pnpmrc with secure defaults');
    }
    logger.info('');
  }

  // Summary
  logger.info(chalk.bold('Migration complete!'));
  logger.info('');
  logger.info('What changed:');
  logger.info('  - unpm.migrated set to true in package.json');
  logger.info('  - pnpm-lock.yaml created (replaces package-lock.json)');
  if (hasNpmLock) {
    logger.info('  - package-lock.json removed');
  }
  if (pnpmVersion) {
    logger.info(`  - packageManager field set to pnpm@${pnpmVersion}`);
  }
  logger.info('  - npm blocking: engines.npm + shrinkwrap + preinstall');
  if (!hasNpmrc) {
    logger.info('  - .npmrc created with engine-strict=true');
  }
  if (!hasShrinkwrap) {
    logger.info('  - npm-shrinkwrap.json created (blocks npm early)');
  }
  if (!hasPnpmrc) {
    logger.info('  - .pnpmrc created with secure defaults');
  }
  logger.info('');
  logger.info('Next steps:');
  logger.info('  1. Review the changes and commit them');
  logger.info('  2. If you have packages that need to run install scripts:');
  logger.info('     unpm allow-scripts add <package-name>');
  logger.info('  3. Update your CI/CD to use: unpm ci');
  logger.info('');
  logger.info(
    chalk.dim(
      'Note: npm install/update will now be blocked. Use unpm or pnpm instead.'
    )
  );
  logger.info('');

  return 0;
}
