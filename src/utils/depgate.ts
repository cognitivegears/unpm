import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { createInterface } from 'node:readline';
import { execa } from 'execa';
import type { DepGateRuntimeOptions } from '../security/depgate.js';

const STDERR_TAIL_LIMIT = 4000;
const TEARDOWN_GRACE_MS = 500;

interface DepGatePrepareWrapper {
  envVars: Record<string, string>;
  extraArgs: string[];
  extraArgsPosition: 'after_manager' | 'append';
}

interface ParsedPreparePayload {
  proxyUrl: string;
  proxyPort: number;
  managerSupported: boolean | undefined;
  wrapper: DepGatePrepareWrapper | undefined;
}

export interface DepGateCommandResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

export interface RunWithDepGateOptions {
  depgate: DepGateRuntimeOptions;
  manager: string;
  managerBin: string;
  managerArgs: string[];
  cwd: string;
  env?: Record<string, string>;
  stdio?: 'inherit' | 'pipe';
  shell?: boolean;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function formatStderrTail(stderrTail: string): string {
  const trimmed = stderrTail.trim();
  if (trimmed.length === 0) {
    return '';
  }
  return `\nDepGate stderr (tail):\n${trimmed}`;
}

function parsePreparePayload(
  line: string,
  managerName: string,
  stderrTail: string
): ParsedPreparePayload {
  let parsed: unknown;
  try {
    parsed = JSON.parse(line) as unknown;
  } catch {
    throw new Error(
      `DepGate prepare output was not valid JSON.${formatStderrTail(stderrTail)}`
    );
  }

  if (!isObject(parsed)) {
    throw new Error(
      `DepGate prepare output must be a JSON object.${formatStderrTail(stderrTail)}`
    );
  }

  const proxy = parsed['proxy'];
  if (!isObject(proxy)) {
    throw new Error(
      `DepGate prepare payload is missing proxy settings.${formatStderrTail(stderrTail)}`
    );
  }

  const proxyUrl = proxy['url'];
  const proxyPort = proxy['port'];
  if (typeof proxyUrl !== 'string' || typeof proxyPort !== 'number') {
    throw new Error(
      `DepGate prepare payload must include proxy.url and proxy.port.${formatStderrTail(stderrTail)}`
    );
  }

  const managerInfo = parsed['manager'];
  const managerSupported =
    isObject(managerInfo) && typeof managerInfo['supported'] === 'boolean'
      ? (managerInfo['supported'] as boolean)
      : undefined;

  const wrapperRaw = parsed['wrapper'];
  if (wrapperRaw == null) {
    if (managerSupported === false) {
      throw new Error(
        `DepGate does not support manager "${managerName}" in prepare mode. Upgrade DepGate or run without --depgate.`
      );
    }

    return {
      proxyUrl,
      proxyPort,
      managerSupported,
      wrapper: undefined,
    };
  }

  if (!isObject(wrapperRaw)) {
    throw new Error(
      `DepGate prepare payload has an invalid wrapper object.${formatStderrTail(stderrTail)}`
    );
  }

  const envVarsRaw = wrapperRaw['env_vars'];
  const envVars: Record<string, string> = {};
  if (isObject(envVarsRaw)) {
    for (const [key, value] of Object.entries(envVarsRaw)) {
      if (typeof value === 'string') {
        envVars[key] = value;
      }
    }
  }

  const extraArgsRaw = wrapperRaw['extra_args'];
  const extraArgs = Array.isArray(extraArgsRaw)
    ? extraArgsRaw.filter((arg): arg is string => typeof arg === 'string')
    : [];

  const positionRaw = wrapperRaw['extra_args_position'];
  const extraArgsPosition: 'after_manager' | 'append' =
    positionRaw === 'append' ? 'append' : 'after_manager';

  return {
    proxyUrl,
    proxyPort,
    managerSupported,
    wrapper: {
      envVars,
      extraArgs,
      extraArgsPosition,
    },
  };
}

async function waitForPrepareLine(
  depgateProcess: ChildProcessWithoutNullStreams,
  depgateBinary: string,
  startupTimeoutMs: number,
  getStderrTail: () => string
): Promise<string> {
  return await new Promise<string>((resolve, reject) => {
    const stdout = depgateProcess.stdout;
    if (!stdout) {
      reject(new Error('DepGate stdout stream is not available.'));
      return;
    }

    const rl = createInterface({ input: stdout });
    let settled = false;

    const cleanup = (): void => {
      clearTimeout(timer);
      rl.close();
      depgateProcess.off('exit', onExit);
      depgateProcess.off('error', onError);
    };

    const settle = (cb: () => void): void => {
      if (settled) {
        return;
      }
      settled = true;
      cleanup();
      cb();
    };

    const timer = setTimeout(() => {
      settle(() => {
        reject(
          new Error(
            `Timed out waiting for DepGate prepare output after ${startupTimeoutMs}ms.${formatStderrTail(getStderrTail())}`
          )
        );
      });
    }, startupTimeoutMs);

    const onLine = (line: string): void => {
      settle(() => resolve(line));
    };

    const onExit = (code: number | null, signal: string | null): void => {
      settle(() => {
        const status =
          code !== null ? `exit code ${code}` : `signal ${signal ?? 'unknown'}`;
        reject(
          new Error(
            `DepGate exited before sending prepare output (${status}).${formatStderrTail(getStderrTail())}`
          )
        );
      });
    };

    const onError = (error: Error): void => {
      settle(() => {
        const err = error as Error & { code?: string };
        if (err.code === 'ENOENT') {
          reject(
            new Error(
              `DepGate binary "${depgateBinary}" was not found. Install DepGate and ensure it is available on PATH, or set --depgate-bin.`
            )
          );
          return;
        }

        reject(
          new Error(
            `Failed to start DepGate: ${error.message}.${formatStderrTail(getStderrTail())}`
          )
        );
      });
    };

    rl.once('line', onLine);
    depgateProcess.once('exit', onExit);
    depgateProcess.once('error', onError);
  });
}

async function waitForExit(
  depgateProcess: ChildProcessWithoutNullStreams,
  timeoutMs: number
): Promise<boolean> {
  if (depgateProcess.exitCode !== null) {
    return true;
  }

  return await new Promise<boolean>((resolve) => {
    const timer = setTimeout(() => {
      cleanup();
      resolve(false);
    }, timeoutMs);

    const onExit = (): void => {
      cleanup();
      resolve(true);
    };

    const cleanup = (): void => {
      clearTimeout(timer);
      depgateProcess.off('exit', onExit);
    };

    depgateProcess.once('exit', onExit);
  });
}

async function teardownDepGateProcess(
  depgateProcess: ChildProcessWithoutNullStreams
): Promise<void> {
  if (depgateProcess.exitCode !== null) {
    return;
  }

  depgateProcess.stdin.end();

  if (await waitForExit(depgateProcess, TEARDOWN_GRACE_MS)) {
    return;
  }

  try {
    depgateProcess.kill('SIGTERM');
  } catch {
    return;
  }

  if (await waitForExit(depgateProcess, TEARDOWN_GRACE_MS)) {
    return;
  }

  try {
    depgateProcess.kill('SIGKILL');
  } catch {
    return;
  }

  await waitForExit(depgateProcess, TEARDOWN_GRACE_MS);
}

function buildManagerArgs(
  originalArgs: string[],
  wrapper: DepGatePrepareWrapper | undefined
): string[] {
  if (!wrapper || wrapper.extraArgs.length === 0) {
    return [...originalArgs];
  }

  return wrapper.extraArgsPosition === 'append'
    ? [...originalArgs, ...wrapper.extraArgs]
    : [...wrapper.extraArgs, ...originalArgs];
}

function buildDepGateArgs(manager: string, depgate: DepGateRuntimeOptions): string[] {
  const args = [
    'run',
    '--prepare',
    '--manager',
    manager,
    '--log-level',
    'WARNING',
  ];

  if (depgate.configPath) {
    args.push('--config', depgate.configPath);
  }

  if (depgate.decisionMode) {
    args.push('--decision-mode', depgate.decisionMode);
  }

  if (depgate.passthroughArgs.length > 0) {
    args.push(...depgate.passthroughArgs);
  }

  return args;
}

export async function runWithDepGate(
  options: RunWithDepGateOptions
): Promise<DepGateCommandResult> {
  let depgateStderrTail = '';
  const depgateProcess = spawn(
    options.depgate.binaryPath,
    buildDepGateArgs(options.manager, options.depgate),
    {
      cwd: options.cwd,
      env: { ...process.env, ...options.env },
      stdio: ['pipe', 'pipe', 'pipe'],
      shell: false,
    }
  );

  depgateProcess.stderr.on('data', (chunk: Buffer | string) => {
    const chunkText = chunk.toString();
    depgateStderrTail = (depgateStderrTail + chunkText).slice(-STDERR_TAIL_LIMIT);
  });

  try {
    const prepareLine = await waitForPrepareLine(
      depgateProcess,
      options.depgate.binaryPath,
      options.depgate.startupTimeoutMs,
      () => depgateStderrTail
    );

    const preparePayload = parsePreparePayload(
      prepareLine,
      options.manager,
      depgateStderrTail
    );

    const wrapper = preparePayload.wrapper;
    const managerArgs = buildManagerArgs(options.managerArgs, wrapper);
    const managerEnv = {
      ...process.env,
      ...options.env,
      ...(wrapper?.envVars ?? {}),
    };

    const managerResult = await execa(options.managerBin, managerArgs, {
      cwd: options.cwd,
      env: managerEnv,
      stdio: options.stdio ?? 'inherit',
      shell: options.shell ?? false,
      reject: false,
    });

    return {
      stdout: typeof managerResult.stdout === 'string' ? managerResult.stdout : '',
      stderr: typeof managerResult.stderr === 'string' ? managerResult.stderr : '',
      exitCode: managerResult.exitCode ?? 0,
    };
  } finally {
    await teardownDepGateProcess(depgateProcess);
  }
}
