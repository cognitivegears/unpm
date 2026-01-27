import { spawnPnpm } from '../utils/exec.js';

export async function link(args: string[]): Promise<number> {
  const pnpmArgs = ['link', ...args];
  const result = await spawnPnpm(pnpmArgs);
  return result.exitCode ?? 0;
}

export async function unlink(args: string[]): Promise<number> {
  const pnpmArgs = ['unlink', ...args];
  const result = await spawnPnpm(pnpmArgs);
  return result.exitCode ?? 0;
}
