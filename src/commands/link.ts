import { spawnPnpm } from '../utils/exec.js';
import { getSecurityFlags } from '../security/script-policy.js';

/**
 * Link a package with security protections.
 * Adds --ignore-scripts to prevent linked packages from running install scripts.
 */
export async function link(args: string[]): Promise<number> {
  // Check if user explicitly wants scripts
  const userWantsScripts = args.some(
    (f) => f === '--ignore-scripts=false' || f === '--no-ignore-scripts'
  );

  let pnpmArgs = ['link', ...args];

  // Add security flags unless user opts out
  if (!userWantsScripts && !args.includes('--ignore-scripts')) {
    pnpmArgs = ['link', ...getSecurityFlags(), ...args];
  }

  const result = await spawnPnpm(pnpmArgs);
  return result.exitCode ?? 0;
}

/**
 * Unlink a package.
 */
export async function unlink(args: string[]): Promise<number> {
  const pnpmArgs = ['unlink', ...args];
  const result = await spawnPnpm(pnpmArgs);
  return result.exitCode ?? 0;
}
