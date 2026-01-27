import { spawnPnpm } from '../utils/exec.js';

export async function cache(args: string[]): Promise<number> {
  // Map npm cache commands to pnpm store commands
  const subcommand = args[0];
  const subArgs = args.slice(1);

  switch (subcommand) {
    case 'clean':
    case 'clear':
    case 'rm':
      return cacheClean(subArgs);
    case 'ls':
    case 'list':
      return cacheList(subArgs);
    case 'verify':
      return cacheVerify(subArgs);
    default: {
      // Pass through to pnpm store
      const pnpmArgs = ['store', ...args];
      const result = await spawnPnpm(pnpmArgs);
      return result.exitCode ?? 0;
    }
  }
}

async function cacheClean(_args: string[]): Promise<number> {
  const pnpmArgs = ['store', 'prune'];
  const result = await spawnPnpm(pnpmArgs);
  return result.exitCode ?? 0;
}

async function cacheList(_args: string[]): Promise<number> {
  const pnpmArgs = ['store', 'status'];
  const result = await spawnPnpm(pnpmArgs);
  return result.exitCode ?? 0;
}

async function cacheVerify(_args: string[]): Promise<number> {
  const pnpmArgs = ['store', 'status'];
  const result = await spawnPnpm(pnpmArgs);
  return result.exitCode ?? 0;
}
