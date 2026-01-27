import { spawnPnpm } from '../utils/exec.js';

export async function view(args: string[]): Promise<number> {
  const pnpmArgs = ['view', ...args];
  const result = await spawnPnpm(pnpmArgs);
  return result.exitCode ?? 0;
}

export async function search(args: string[]): Promise<number> {
  const pnpmArgs = ['search', ...args];
  const result = await spawnPnpm(pnpmArgs);
  return result.exitCode ?? 0;
}

export async function docs(args: string[]): Promise<number> {
  const pnpmArgs = ['docs', ...args];
  const result = await spawnPnpm(pnpmArgs);
  return result.exitCode ?? 0;
}

export async function bugs(args: string[]): Promise<number> {
  const pnpmArgs = ['bugs', ...args];
  const result = await spawnPnpm(pnpmArgs);
  return result.exitCode ?? 0;
}

export async function repo(args: string[]): Promise<number> {
  const pnpmArgs = ['repo', ...args];
  const result = await spawnPnpm(pnpmArgs);
  return result.exitCode ?? 0;
}
