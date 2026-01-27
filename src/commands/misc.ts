import { spawnPnpm } from '../utils/exec.js';
import { mapNpmFlagsToPnpm } from '../mappers/args.js';

export async function init(args: string[]): Promise<number> {
  const pnpmArgs = ['init', ...args];
  const result = await spawnPnpm(pnpmArgs);
  return result.exitCode ?? 0;
}

export async function ls(args: string[]): Promise<number> {
  const mappedArgs = mapNpmFlagsToPnpm(args);
  const pnpmArgs = ['ls', ...mappedArgs];
  const result = await spawnPnpm(pnpmArgs);
  return result.exitCode ?? 0;
}

export async function outdated(args: string[]): Promise<number> {
  const pnpmArgs = ['outdated', ...args];
  const result = await spawnPnpm(pnpmArgs);
  return result.exitCode ?? 0;
}

export async function version(args: string[]): Promise<number> {
  const pnpmArgs = ['version', ...args];
  const result = await spawnPnpm(pnpmArgs);
  return result.exitCode ?? 0;
}

export async function bin(args: string[]): Promise<number> {
  const pnpmArgs = ['bin', ...args];
  const result = await spawnPnpm(pnpmArgs);
  return result.exitCode ?? 0;
}

export async function root(args: string[]): Promise<number> {
  const pnpmArgs = ['root', ...args];
  const result = await spawnPnpm(pnpmArgs);
  return result.exitCode ?? 0;
}

export async function prefix(args: string[]): Promise<number> {
  const pnpmArgs = ['prefix', ...args];
  const result = await spawnPnpm(pnpmArgs);
  return result.exitCode ?? 0;
}

export async function dedupe(args: string[]): Promise<number> {
  const pnpmArgs = ['dedupe', ...args];
  const result = await spawnPnpm(pnpmArgs);
  return result.exitCode ?? 0;
}

export async function prune(args: string[]): Promise<number> {
  const pnpmArgs = ['prune', ...args];
  const result = await spawnPnpm(pnpmArgs);
  return result.exitCode ?? 0;
}

export async function rebuild(args: string[]): Promise<number> {
  const pnpmArgs = ['rebuild', ...args];
  const result = await spawnPnpm(pnpmArgs);
  return result.exitCode ?? 0;
}

export async function why(args: string[]): Promise<number> {
  const pnpmArgs = ['why', ...args];
  const result = await spawnPnpm(pnpmArgs);
  return result.exitCode ?? 0;
}

export async function help(args: string[]): Promise<number> {
  const pnpmArgs = ['help', ...args];
  const result = await spawnPnpm(pnpmArgs);
  return result.exitCode ?? 0;
}

export async function completion(args: string[]): Promise<number> {
  const pnpmArgs = ['completion', ...args];
  const result = await spawnPnpm(pnpmArgs);
  return result.exitCode ?? 0;
}
