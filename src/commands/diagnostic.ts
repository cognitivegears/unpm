import chalk from 'chalk';
import { passthroughToNpm } from './passthrough.js';
import { runSecurityChecks, type SecurityCheckResult } from '../security/doctor.js';
import { logger } from '../utils/logger.js';

/**
 * Ping the npm registry.
 * This is a read-only diagnostic command that verifies registry connectivity.
 */
export async function ping(args: string[]): Promise<number> {
  return passthroughToNpm('ping', args, false);
}

/**
 * Run npm doctor to diagnose environment issues.
 * With --security flag, runs unpm security checks instead.
 */
export async function doctor(args: string[]): Promise<number> {
  if (args.includes('--security')) {
    return runSecurityDoctor();
  }
  return passthroughToNpm('doctor', args, false);
}

/**
 * Run security-focused doctor checks.
 */
async function runSecurityDoctor(): Promise<number> {
  logger.info(chalk.bold('UNPM Security Doctor'));
  logger.info('');

  const results = await runSecurityChecks();

  let hasFailures = false;
  let hasWarnings = false;

  for (const result of results) {
    const statusIcon = getStatusIcon(result.status);
    const statusColor = getStatusColor(result.status);

    logger.info(`${statusIcon} ${chalk.bold(result.name)}`);
    logger.info(`   ${statusColor(result.message)}`);
    if (result.suggestion) {
      logger.info(chalk.dim(`   Suggestion: ${result.suggestion}`));
    }
    logger.info('');

    if (result.status === 'fail') hasFailures = true;
    if (result.status === 'warn') hasWarnings = true;
  }

  // Summary
  const passCount = results.filter((r) => r.status === 'pass').length;
  const warnCount = results.filter((r) => r.status === 'warn').length;
  const failCount = results.filter((r) => r.status === 'fail').length;

  logger.info(chalk.bold('Summary'));
  logger.info(`  ${chalk.green(`${passCount} passed`)}, ${chalk.yellow(`${warnCount} warnings`)}, ${chalk.red(`${failCount} failures`)}`);
  logger.info('');

  if (hasFailures) {
    logger.info(chalk.red('Security issues detected. Please address the failures above.'));
    return 1;
  }

  if (hasWarnings) {
    logger.info(chalk.yellow('Some security recommendations. Consider addressing the warnings above.'));
    return 0;
  }

  logger.info(chalk.green('All security checks passed!'));
  return 0;
}

function getStatusIcon(status: SecurityCheckResult['status']): string {
  switch (status) {
    case 'pass':
      return chalk.green('\u2713');
    case 'warn':
      return chalk.yellow('\u26A0');
    case 'fail':
      return chalk.red('\u2717');
  }
}

function getStatusColor(status: SecurityCheckResult['status']): (text: string) => string {
  switch (status) {
    case 'pass':
      return chalk.green;
    case 'warn':
      return chalk.yellow;
    case 'fail':
      return chalk.red;
  }
}

/**
 * Search npm help documentation.
 * This is a read-only help command.
 */
export async function helpSearch(args: string[]): Promise<number> {
  return passthroughToNpm('help-search', args, false);
}
