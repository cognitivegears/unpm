import { execa, type Options as ExecaOptions, type ResultPromise } from 'execa';
import { logger } from './logger.js';

export interface ExecOptions {
  cwd?: string;
  env?: Record<string, string>;
  stdio?: 'inherit' | 'pipe';
  shell?: boolean;
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
): ResultPromise {
  const cmd = `pnpm ${args.join(' ')}`;
  logger.command(cmd);

  return execa('pnpm', args, {
    ...buildExecaOptions(options),
    stdio: 'inherit',
  });
}

/**
 * Spawn pnpm with additional environment variables.
 * Useful for setting pnpm config via npm_config_ prefix.
 */
export function spawnPnpmWithEnv(
  args: string[],
  envVars: Record<string, string>,
  options: ExecOptions = {}
): ResultPromise {
  const cmd = `pnpm ${args.join(' ')}`;
  logger.command(cmd);

  return execa('pnpm', args, {
    ...buildExecaOptions({
      ...options,
      env: { ...options.env, ...envVars },
    }),
    stdio: 'inherit',
  });
}

export function spawnNpm(
  args: string[],
  options: ExecOptions = {}
): ResultPromise {
  const cmd = `npm ${args.join(' ')}`;
  logger.command(cmd);

  return execa('npm', args, {
    ...buildExecaOptions(options),
    stdio: 'inherit',
  });
}
