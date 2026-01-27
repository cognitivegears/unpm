import { spawnPnpm } from '../utils/exec.js';
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

export async function pack(args: string[]): Promise<number> {
  const pnpmArgs = ['pack', ...args];
  const result = await spawnPnpm(pnpmArgs);
  return result.exitCode ?? 0;
}
