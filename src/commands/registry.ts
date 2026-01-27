import { spawnPnpm, spawnNpm } from '../utils/exec.js';
import { getSecurityFlags } from '../security/script-policy.js';

export async function login(args: string[]): Promise<number> {
  const pnpmArgs = ['login', ...args];
  const result = await spawnPnpm(pnpmArgs);
  return result.exitCode ?? 0;
}

export async function logout(args: string[]): Promise<number> {
  const pnpmArgs = ['logout', ...args];
  const result = await spawnPnpm(pnpmArgs);
  return result.exitCode ?? 0;
}

export async function whoami(args: string[]): Promise<number> {
  const pnpmArgs = ['whoami', ...args];
  const result = await spawnPnpm(pnpmArgs);
  return result.exitCode ?? 0;
}

export async function token(args: string[]): Promise<number> {
  // Token command is npm-only, use with security flags
  const securityFlags = getSecurityFlags();
  const npmArgs = ['token', ...args, ...securityFlags];
  const result = await spawnNpm(npmArgs);
  return result.exitCode ?? 0;
}

export async function access(args: string[]): Promise<number> {
  // Access command is npm-only, use with security flags
  const securityFlags = getSecurityFlags();
  const npmArgs = ['access', ...args, ...securityFlags];
  const result = await spawnNpm(npmArgs);
  return result.exitCode ?? 0;
}

export async function owner(args: string[]): Promise<number> {
  const pnpmArgs = ['owner', ...args];
  const result = await spawnPnpm(pnpmArgs);
  return result.exitCode ?? 0;
}

export async function distTag(args: string[]): Promise<number> {
  const pnpmArgs = ['dist-tag', ...args];
  const result = await spawnPnpm(pnpmArgs);
  return result.exitCode ?? 0;
}
