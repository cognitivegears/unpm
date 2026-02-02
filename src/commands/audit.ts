import { spawnPnpm, execPnpm } from '../utils/exec.js';
import { isStrictMode, removeStrictFlag } from '../security/strict-mode.js';
import { logger } from '../utils/logger.js';
import { getUnpmConfig } from '../utils/config.js';

/**
 * Run security audit.
 *
 * In strict mode, returns non-zero exit code for high/critical vulnerabilities
 * by adding --audit-level=high.
 */
export async function audit(
  args: string[],
  globalArgs: string[] = []
): Promise<number> {
  const allArgs = [...globalArgs, ...args];
  const strictMode = await isStrictMode(allArgs);

  let pnpmArgs = ['audit', ...removeStrictFlag(args)];

  // In strict mode, fail on high/critical vulnerabilities if not already specified
  if (strictMode) {
    const hasAuditLevel = args.some(
      (arg) => arg === '--audit-level' || arg.startsWith('--audit-level=')
    );

    if (!hasAuditLevel) {
      pnpmArgs.push('--audit-level=high');
      logger.debug(
        'Strict mode: Failing audit on high/critical vulnerabilities'
      );
    }
  }

  const result = await spawnPnpm(pnpmArgs);
  return result.exitCode ?? 0;
}

export async function fund(args: string[]): Promise<number> {
  const pnpmArgs = ['fund', ...removeStrictFlag(args)];
  const result = await spawnPnpm(pnpmArgs);
  return result.exitCode ?? 0;
}

/**
 * Run a post-install security audit.
 * Returns 0 if no vulnerabilities at or above the specified level, 1 otherwise.
 *
 * @param auditLevel - Minimum severity level to fail on ('low', 'moderate', 'high', 'critical')
 * @param cwd - Working directory
 */
export async function runPostInstallAudit(
  auditLevel: 'low' | 'moderate' | 'high' | 'critical' = 'high',
  cwd?: string
): Promise<number> {
  logger.info('Running post-install security audit...');

  const pnpmArgs = ['audit', `--audit-level=${auditLevel}`];

  const result = await execPnpm(pnpmArgs, { cwd, stdio: 'inherit' });
  return result.exitCode ?? 0;
}

/**
 * Check if post-install audit should run based on config.
 */
export async function shouldRunPostInstallAudit(
  cwd?: string
): Promise<boolean> {
  const config = await getUnpmConfig(cwd);
  return config.auditAfterInstall === true;
}

/**
 * Get the configured audit level.
 */
export async function getConfiguredAuditLevel(
  cwd?: string
): Promise<'low' | 'moderate' | 'high' | 'critical'> {
  const config = await getUnpmConfig(cwd);
  return config.auditLevel ?? 'high';
}
