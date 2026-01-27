import { spawnPnpm } from '../utils/exec.js';

export async function audit(args: string[]): Promise<number> {
  const pnpmArgs = ['audit', ...args];
  const result = await spawnPnpm(pnpmArgs);
  return result.exitCode ?? 0;
}

export async function fund(args: string[]): Promise<number> {
  const pnpmArgs = ['fund', ...args];
  const result = await spawnPnpm(pnpmArgs);
  return result.exitCode ?? 0;
}
