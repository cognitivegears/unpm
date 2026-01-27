import { Command } from 'commander';
import chalk from 'chalk';
import { getCommandMapping } from './mappers/commands.js';
import * as commands from './commands/index.js';
import { passthroughToPnpm, passthroughToNpm } from './commands/passthrough.js';
import { logger, setLogLevel } from './utils/logger.js';
import packageJson from '../package.json' assert { type: 'json' };

const VERSION = packageJson.version ?? '0.0.0';

export function createCli(): Command {
  const program = new Command();

  program
    .name('unpm')
    .description('npm wrapper that delegates to pnpm for improved security')
    .version(VERSION)
    .option('-v, --verbose', 'Enable verbose output')
    .option('-q, --quiet', 'Suppress output')
    .hook('preAction', (thisCommand) => {
      const opts = thisCommand.opts();
      if (opts['verbose']) {
        setLogLevel('debug');
      } else if (opts['quiet']) {
        setLogLevel('error');
      }
    });

  // Install commands
  program
    .command('install [packages...]')
    .alias('i')
    .description('Install dependencies')
    .allowUnknownOption()
    .action(async (packages: string[], _opts, cmd) => {
      const args = [...packages, ...cmd.args];
      process.exitCode = await commands.install(args);
    });

  program
    .command('ci')
    .description('Clean install (equivalent to npm ci)')
    .allowUnknownOption()
    .action(async (_opts, cmd) => {
      process.exitCode = await commands.ci(cmd.args);
    });

  program
    .command('add <packages...>')
    .description('Add packages')
    .allowUnknownOption()
    .action(async (packages: string[], _opts, cmd) => {
      const args = [...packages, ...cmd.args];
      process.exitCode = await commands.add(args);
    });

  program
    .command('remove <packages...>')
    .aliases(['rm', 'uninstall', 'un'])
    .description('Remove packages')
    .allowUnknownOption()
    .action(async (packages: string[], _opts, cmd) => {
      const args = [...packages, ...cmd.args];
      process.exitCode = await commands.remove(args);
    });

  program
    .command('update [packages...]')
    .aliases(['up', 'upgrade'])
    .description('Update packages')
    .allowUnknownOption()
    .action(async (packages: string[], _opts, cmd) => {
      const args = [...packages, ...cmd.args];
      process.exitCode = await commands.update(args);
    });

  // Run commands
  program
    .command('run <script>')
    .alias('run-script')
    .description('Run a script')
    .allowUnknownOption()
    .action(async (script: string, _opts, cmd) => {
      process.exitCode = await commands.run([script, ...cmd.args]);
    });

  program
    .command('test')
    .alias('t')
    .description('Run tests')
    .allowUnknownOption()
    .action(async (_opts, cmd) => {
      process.exitCode = await commands.test(cmd.args);
    });

  program
    .command('start')
    .description('Start the application')
    .allowUnknownOption()
    .action(async (_opts, cmd) => {
      process.exitCode = await commands.start(cmd.args);
    });

  program
    .command('stop')
    .description('Stop the application')
    .allowUnknownOption()
    .action(async (_opts, cmd) => {
      process.exitCode = await commands.stop(cmd.args);
    });

  program
    .command('restart')
    .description('Restart the application')
    .allowUnknownOption()
    .action(async (_opts, cmd) => {
      process.exitCode = await commands.restart(cmd.args);
    });

  program
    .command('exec <command>')
    .alias('x')
    .description('Execute a command')
    .allowUnknownOption()
    .action(async (command: string, _opts, cmd) => {
      process.exitCode = await commands.exec([command, ...cmd.args]);
    });

  program
    .command('dlx <package>')
    .description('Download and execute a package')
    .allowUnknownOption()
    .action(async (pkg: string, _opts, cmd) => {
      process.exitCode = await commands.dlx([pkg, ...cmd.args]);
    });

  // Package management
  program
    .command('init')
    .alias('create')
    .description('Initialize a new package')
    .allowUnknownOption()
    .action(async (_opts, cmd) => {
      process.exitCode = await commands.init(cmd.args);
    });

  program
    .command('publish')
    .description('Publish a package')
    .allowUnknownOption()
    .action(async (_opts, cmd) => {
      process.exitCode = await commands.publish(cmd.args);
    });

  program
    .command('unpublish [package]')
    .description('Unpublish a package')
    .allowUnknownOption()
    .action(async (pkg: string | undefined, _opts, cmd) => {
      const args = pkg ? [pkg, ...cmd.args] : cmd.args;
      process.exitCode = await commands.unpublish(args);
    });

  program
    .command('deprecate <package> <message>')
    .description('Deprecate a package')
    .allowUnknownOption()
    .action(async (pkg: string, message: string, _opts, cmd) => {
      process.exitCode = await commands.deprecate([pkg, message, ...cmd.args]);
    });

  program
    .command('pack')
    .description('Create a tarball')
    .allowUnknownOption()
    .action(async (_opts, cmd) => {
      process.exitCode = await commands.pack(cmd.args);
    });

  program
    .command('link [package]')
    .alias('ln')
    .description('Link a package')
    .allowUnknownOption()
    .action(async (pkg: string | undefined, _opts, cmd) => {
      const args = pkg ? [pkg, ...cmd.args] : cmd.args;
      process.exitCode = await commands.link(args);
    });

  program
    .command('unlink [package]')
    .description('Unlink a package')
    .allowUnknownOption()
    .action(async (pkg: string | undefined, _opts, cmd) => {
      const args = pkg ? [pkg, ...cmd.args] : cmd.args;
      process.exitCode = await commands.unlink(args);
    });

  // Info commands
  program
    .command('ls [packages...]')
    .aliases(['list', 'la', 'll'])
    .description('List installed packages')
    .allowUnknownOption()
    .action(async (packages: string[], _opts, cmd) => {
      const args = [...packages, ...cmd.args];
      process.exitCode = await commands.ls(args);
    });

  program
    .command('outdated [packages...]')
    .description('Check for outdated packages')
    .allowUnknownOption()
    .action(async (packages: string[], _opts, cmd) => {
      const args = [...packages, ...cmd.args];
      process.exitCode = await commands.outdated(args);
    });

  program
    .command('view <package>')
    .aliases(['info', 'show', 'v'])
    .description('View package info')
    .allowUnknownOption()
    .action(async (pkg: string, _opts, cmd) => {
      process.exitCode = await commands.view([pkg, ...cmd.args]);
    });

  program
    .command('search <query>')
    .aliases(['s', 'se', 'find'])
    .description('Search for packages')
    .allowUnknownOption()
    .action(async (query: string, _opts, cmd) => {
      process.exitCode = await commands.search([query, ...cmd.args]);
    });

  program
    .command('docs [package]')
    .alias('home')
    .description('Open package documentation')
    .allowUnknownOption()
    .action(async (pkg: string | undefined, _opts, cmd) => {
      const args = pkg ? [pkg, ...cmd.args] : cmd.args;
      process.exitCode = await commands.docs(args);
    });

  program
    .command('bugs [package]')
    .alias('issues')
    .description('Open package issues')
    .allowUnknownOption()
    .action(async (pkg: string | undefined, _opts, cmd) => {
      const args = pkg ? [pkg, ...cmd.args] : cmd.args;
      process.exitCode = await commands.bugs(args);
    });

  program
    .command('repo [package]')
    .description('Open package repository')
    .allowUnknownOption()
    .action(async (pkg: string | undefined, _opts, cmd) => {
      const args = pkg ? [pkg, ...cmd.args] : cmd.args;
      process.exitCode = await commands.repo(args);
    });

  // Audit and security
  program
    .command('audit')
    .description('Run security audit')
    .allowUnknownOption()
    .action(async (_opts, cmd) => {
      process.exitCode = await commands.audit(cmd.args);
    });

  program
    .command('fund')
    .description('Show funding info')
    .allowUnknownOption()
    .action(async (_opts, cmd) => {
      process.exitCode = await commands.fund(cmd.args);
    });

  // Registry commands
  program
    .command('login')
    .alias('adduser')
    .description('Login to registry')
    .allowUnknownOption()
    .action(async (_opts, cmd) => {
      process.exitCode = await commands.login(cmd.args);
    });

  program
    .command('logout')
    .description('Logout from registry')
    .allowUnknownOption()
    .action(async (_opts, cmd) => {
      process.exitCode = await commands.logout(cmd.args);
    });

  program
    .command('whoami')
    .description('Show current user')
    .allowUnknownOption()
    .action(async (_opts, cmd) => {
      process.exitCode = await commands.whoami(cmd.args);
    });

  program
    .command('token')
    .description('Manage auth tokens')
    .allowUnknownOption()
    .action(async (_opts, cmd) => {
      process.exitCode = await commands.token(cmd.args);
    });

  program
    .command('access')
    .description('Manage package access')
    .allowUnknownOption()
    .action(async (_opts, cmd) => {
      process.exitCode = await commands.access(cmd.args);
    });

  program
    .command('owner')
    .alias('author')
    .description('Manage package owners')
    .allowUnknownOption()
    .action(async (_opts, cmd) => {
      process.exitCode = await commands.owner(cmd.args);
    });

  program
    .command('dist-tag')
    .alias('dist-tags')
    .description('Manage dist-tags')
    .allowUnknownOption()
    .action(async (_opts, cmd) => {
      process.exitCode = await commands.distTag(cmd.args);
    });

  // Config commands
  program
    .command('config')
    .alias('c')
    .description('Manage configuration')
    .allowUnknownOption()
    .action(async (_opts, cmd) => {
      process.exitCode = await commands.config(cmd.args);
    });

  program
    .command('set <key> <value>')
    .description('Set a config value')
    .allowUnknownOption()
    .action(async (key: string, value: string, _opts, cmd) => {
      process.exitCode = await commands.set([key, value, ...cmd.args]);
    });

  program
    .command('get <key>')
    .description('Get a config value')
    .allowUnknownOption()
    .action(async (key: string, _opts, cmd) => {
      process.exitCode = await commands.get([key, ...cmd.args]);
    });

  // Cache
  program
    .command('cache')
    .description('Manage cache')
    .allowUnknownOption()
    .action(async (_opts, cmd) => {
      process.exitCode = await commands.cache(cmd.args);
    });

  // Misc
  program
    .command('version [version]')
    .description('Bump version')
    .allowUnknownOption()
    .action(async (ver: string | undefined, _opts, cmd) => {
      const args = ver ? [ver, ...cmd.args] : cmd.args;
      process.exitCode = await commands.version(args);
    });

  program
    .command('bin')
    .description('Show bin folder')
    .allowUnknownOption()
    .action(async (_opts, cmd) => {
      process.exitCode = await commands.bin(cmd.args);
    });

  program
    .command('root')
    .description('Show root folder')
    .allowUnknownOption()
    .action(async (_opts, cmd) => {
      process.exitCode = await commands.root(cmd.args);
    });

  program
    .command('prefix')
    .description('Show prefix')
    .allowUnknownOption()
    .action(async (_opts, cmd) => {
      process.exitCode = await commands.prefix(cmd.args);
    });

  program
    .command('dedupe')
    .description('Deduplicate dependencies')
    .allowUnknownOption()
    .action(async (_opts, cmd) => {
      process.exitCode = await commands.dedupe(cmd.args);
    });

  program
    .command('prune')
    .description('Remove extraneous packages')
    .allowUnknownOption()
    .action(async (_opts, cmd) => {
      process.exitCode = await commands.prune(cmd.args);
    });

  program
    .command('rebuild')
    .alias('rb')
    .description('Rebuild packages')
    .allowUnknownOption()
    .action(async (_opts, cmd) => {
      process.exitCode = await commands.rebuild(cmd.args);
    });

  program
    .command('why <package>')
    .alias('explain')
    .description('Explain why a package is installed')
    .allowUnknownOption()
    .action(async (pkg: string, _opts, cmd) => {
      process.exitCode = await commands.why([pkg, ...cmd.args]);
    });

  program
    .command('completion')
    .description('Shell completion')
    .allowUnknownOption()
    .action(async (_opts, cmd) => {
      process.exitCode = await commands.completion(cmd.args);
    });

  // Custom UNPM commands
  program
    .command('migrate')
    .description('Migrate from npm to unpm/pnpm')
    .option('--dry-run', 'Show what would be done without making changes')
    .option('--skip-lavamoat', 'Skip LavaMoat configuration')
    .allowUnknownOption()
    .action(async (opts, cmd) => {
      const args: string[] = [];
      if (opts.dryRun) args.push('--dry-run');
      if (opts.skipLavamoat) args.push('--skip-lavamoat');
      args.push(...cmd.args);
      process.exitCode = await commands.migrate(args);
    });

  program
    .command('setup-lavamoat')
    .description('Initialize LavaMoat configuration')
    .action(async () => {
      process.exitCode = await commands.allowScripts(['init']);
    });

  program
    .command('allow-scripts')
    .description('Manage LavaMoat script allowlist')
    .allowUnknownOption()
    .action(async (_opts, cmd) => {
      process.exitCode = await commands.allowScripts(cmd.args);
    });

  // Fallback handler for any unknown commands
  program.on('command:*', async (operands) => {
    const unknownCommand = operands[0];
    if (!unknownCommand) {
      program.help();
      return;
    }

    const mapping = getCommandMapping(unknownCommand);

    if (!mapping) {
      // Try to pass through to pnpm
      logger.debug(`Unknown command "${unknownCommand}", trying pnpm passthrough`);
      process.exitCode = await passthroughToPnpm(unknownCommand, operands.slice(1));
      return;
    }

    // Handle based on command type
    switch (mapping.type) {
      case 'pnpm-direct':
      case 'pnpm-mapped':
        process.exitCode = await passthroughToPnpm(
          mapping.pnpmCommand,
          operands.slice(1)
        );
        break;
      case 'npm-passthrough':
        process.exitCode = await passthroughToNpm(
          unknownCommand,
          operands.slice(1),
          mapping.requiresSecurityFlags
        );
        break;
      default:
        logger.error(`Unknown command: ${unknownCommand}`);
        logger.info('');
        logger.info(chalk.dim('Run "unpm help" for available commands.'));
        process.exitCode = 1;
    }
  });

  return program;
}

export async function run(args: string[] = process.argv): Promise<void> {
  const program = createCli();

  try {
    await program.parseAsync(args);
  } catch (error) {
    if (error instanceof Error) {
      logger.error(error.message);
    }
    process.exitCode = 1;
  }
}
