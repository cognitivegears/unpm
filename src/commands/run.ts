import { spawnPnpm } from '../utils/exec.js';

export async function run(args: string[]): Promise<number> {
  const pnpmArgs = ['run', ...args];
  const result = await spawnPnpm(pnpmArgs);
  return result.exitCode ?? 0;
}

export async function test(args: string[]): Promise<number> {
  const pnpmArgs = ['test', ...args];
  const result = await spawnPnpm(pnpmArgs);
  return result.exitCode ?? 0;
}

export async function start(args: string[]): Promise<number> {
  const pnpmArgs = ['start', ...args];
  const result = await spawnPnpm(pnpmArgs);
  return result.exitCode ?? 0;
}

export async function stop(args: string[]): Promise<number> {
  const pnpmArgs = ['stop', ...args];
  const result = await spawnPnpm(pnpmArgs);
  return result.exitCode ?? 0;
}

export async function restart(args: string[]): Promise<number> {
  const pnpmArgs = ['restart', ...args];
  const result = await spawnPnpm(pnpmArgs);
  return result.exitCode ?? 0;
}

export async function exec(args: string[]): Promise<number> {
  const pnpmArgs = ['exec', ...args];
  const result = await spawnPnpm(pnpmArgs);
  return result.exitCode ?? 0;
}

export async function dlx(args: string[]): Promise<number> {
  const pnpmArgs = ['dlx', ...args];
  const result = await spawnPnpm(pnpmArgs);
  return result.exitCode ?? 0;
}
