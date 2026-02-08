import { execa, type Options as ExecaOptions } from 'execa';
import type { DepGateRuntimeOptions } from '../security/depgate.js';
import { runWithDepGate } from './depgate.js';
import { logger } from './logger.js';

export interface ExecOptions {
  cwd?: string;
  env?: Record<string, string>;
  stdio?: 'inherit' | 'pipe';
  shell?: boolean;
  depgate?: DepGateRuntimeOptions;
}

export interface ExecResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

function buildExecaOptions(options: ExecOptions = {}): ExecaOptions {
  return {
    cwd: options.cwd ?? process.cwd(),
    env: { ...process.env, ...options.env },
    stdio: options.stdio ?? 'inherit',
    shell: options.shell ?? false,
    reject: false,
  };
}

export async function execPnpm(
  args: string[],
  options: ExecOptions = {}
): Promise<ExecResult> {
  const cmd = `pnpm ${args.join(' ')}`;
  logger.command(cmd);

  const result = await execa('pnpm', args, buildExecaOptions(options));

  return {
    stdout: typeof result.stdout === 'string' ? result.stdout : '',
    stderr: typeof result.stderr === 'string' ? result.stderr : '',
    exitCode: result.exitCode ?? 0,
  };
}

export async function execNpm(
  args: string[],
  options: ExecOptions = {}
): Promise<ExecResult> {
  const cmd = `npm ${args.join(' ')}`;
  logger.command(cmd);

  const result = await execa('npm', args, buildExecaOptions(options));

  return {
    stdout: typeof result.stdout === 'string' ? result.stdout : '',
    stderr: typeof result.stderr === 'string' ? result.stderr : '',
    exitCode: result.exitCode ?? 0,
  };
}

export function spawnPnpm(
  args: string[],
  options: ExecOptions = {}
): Promise<ExecResult> {
  const cmd = `pnpm ${args.join(' ')}`;
  logger.command(cmd);

  if (options.depgate) {
    return runWithDepGate({
      depgate: options.depgate,
      manager: 'pnpm',
      managerBin: 'pnpm',
      managerArgs: args,
      cwd: options.cwd ?? process.cwd(),
      env: options.env,
      stdio: options.stdio ?? 'inherit',
      shell: options.shell,
    });
  }

  return execa('pnpm', args, {
    ...buildExecaOptions(options),
    stdio: 'inherit',
  }).then((result) => ({
    stdout: typeof result.stdout === 'string' ? result.stdout : '',
    stderr: typeof result.stderr === 'string' ? result.stderr : '',
    exitCode: result.exitCode ?? 0,
  }));
}

/**
 * Spawn pnpm with additional environment variables.
 * Useful for setting pnpm config via npm_config_ prefix.
 */
export function spawnPnpmWithEnv(
  args: string[],
  envVars: Record<string, string>,
  options: ExecOptions = {}
): Promise<ExecResult> {
  const cmd = `pnpm ${args.join(' ')}`;
  logger.command(cmd);

  return execa('pnpm', args, {
    ...buildExecaOptions({
      ...options,
      env: { ...options.env, ...envVars },
    }),
    stdio: 'inherit',
  }).then((result) => ({
    stdout: typeof result.stdout === 'string' ? result.stdout : '',
    stderr: typeof result.stderr === 'string' ? result.stderr : '',
    exitCode: result.exitCode ?? 0,
  }));
}

export function spawnNpm(
  args: string[],
  options: ExecOptions = {}
): Promise<ExecResult> {
  const cmd = `npm ${args.join(' ')}`;
  logger.command(cmd);

  if (options.depgate) {
    return runWithDepGate({
      depgate: options.depgate,
      manager: 'npm',
      managerBin: 'npm',
      managerArgs: args,
      cwd: options.cwd ?? process.cwd(),
      env: options.env,
      stdio: options.stdio ?? 'inherit',
      shell: options.shell,
    });
  }

  return execa('npm', args, {
    ...buildExecaOptions(options),
    stdio: 'inherit',
  }).then((result) => ({
    stdout: typeof result.stdout === 'string' ? result.stdout : '',
    stderr: typeof result.stderr === 'string' ? result.stderr : '',
    exitCode: result.exitCode ?? 0,
  }));
}

/**
 * Get the installed pnpm version string.
 * Returns the version (e.g., "9.15.0") or null if pnpm is not found.
 */
export async function getPnpmVersion(): Promise<string | null> {
  try {
    const result = await execa('pnpm', ['--version'], {
      reject: false,
      stdio: 'pipe',
    });
    if (result.exitCode === 0 && typeof result.stdout === 'string') {
      return result.stdout.trim();
    }
    return null;
  } catch {
    return null;
  }
}
