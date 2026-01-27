import { spawnPnpm } from '../utils/exec.js';

export async function config(args: string[]): Promise<number> {
  const pnpmArgs = ['config', ...args];
  const result = await spawnPnpm(pnpmArgs);
  return result.exitCode ?? 0;
}

export async function set(args: string[]): Promise<number> {
  const pnpmArgs = ['config', 'set', ...args];
  const result = await spawnPnpm(pnpmArgs);
  return result.exitCode ?? 0;
}

export async function get(args: string[]): Promise<number> {
  const pnpmArgs = ['config', 'get', ...args];
  const result = await spawnPnpm(pnpmArgs);
  return result.exitCode ?? 0;
}
