import { spawnPnpm } from '../utils/exec.js';
import { isStrictMode, removeStrictFlag } from '../security/strict-mode.js';
import { logger } from '../utils/logger.js';

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
