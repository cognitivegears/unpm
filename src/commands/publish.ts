import { spawnPnpm } from '../utils/exec.js';
import { passthroughToNpm } from './passthrough.js';
import { mapNpmFlagsToPnpm } from '../mappers/args.js';

export async function publish(args: string[]): Promise<number> {
  const mappedArgs = mapNpmFlagsToPnpm(args);
  const pnpmArgs = ['publish', ...mappedArgs];
  const result = await spawnPnpm(pnpmArgs);
  return result.exitCode ?? 0;
}

export async function unpublish(args: string[]): Promise<number> {
  const pnpmArgs = ['unpublish', ...args];
  const result = await spawnPnpm(pnpmArgs);
  return result.exitCode ?? 0;
}

export async function deprecate(args: string[]): Promise<number> {
  const pnpmArgs = ['deprecate', ...args];
  const result = await spawnPnpm(pnpmArgs);
  return result.exitCode ?? 0;
}

/**
 * Remove deprecation warning from a package version.
 * This is the reverse of `npm deprecate`.
 *
 * Usage: unpm undeprecate <package>[@<version>]
 *
 * Sets an empty deprecation message to remove the warning.
 */
export async function undeprecate(args: string[]): Promise<number> {
  // npm deprecate with empty message removes the deprecation
  // npm deprecate <package> ""
  if (args.length === 0) {
    return passthroughToNpm('deprecate', args, false);
  }

  // Add empty string as the message to remove deprecation
  const undeprecateArgs = [...args, ''];
  return passthroughToNpm('deprecate', undeprecateArgs, false);
}

export async function pack(args: string[]): Promise<number> {
  const pnpmArgs = ['pack', ...args];
  const result = await spawnPnpm(pnpmArgs);
  return result.exitCode ?? 0;
}
