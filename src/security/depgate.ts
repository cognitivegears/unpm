import {
  hasFlag,
  getFlagValue,
  isUpstreamOverrideFlag,
} from '../mappers/args.js';
import { getUnpmConfig, type DepGateConfig } from '../utils/config.js';

export type DepGateDecisionMode = 'block' | 'warn' | 'audit';

export interface DepGateRuntimeOptions {
  binaryPath: string;
  configPath?: string;
  decisionMode?: DepGateDecisionMode;
  passthroughArgs: string[];
  startupTimeoutMs: number;
}

const DECISION_MODES = new Set<DepGateDecisionMode>(['block', 'warn', 'audit']);

function hasDepGateCliOption(args: string[]): boolean {
  return args.some((arg) => {
    if (!arg.startsWith('--')) {
      return false;
    }
    if (arg === '--depgate') {
      return true;
    }
    return (
      arg.startsWith('--depgate-bin') ||
      arg.startsWith('--depgate-config') ||
      arg.startsWith('--depgate-decision-mode') ||
      arg.startsWith('--depgate-upstream')
    );
  });
}

function collectFlagValues(
  args: string[],
  flag: string,
  allowDashValues = false
): string[] {
  const values: string[] = [];

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (!arg) continue;

    if (arg === flag) {
      const nextArg = args[i + 1];
      if (nextArg && (allowDashValues || !nextArg.startsWith('-'))) {
        values.push(nextArg);
        i++;
      }
      continue;
    }

    if (arg.startsWith(`${flag}=`)) {
      const value = arg.slice(flag.length + 1);
      if (value.length > 0) {
        values.push(value);
      }
    }
  }

  return values;
}

function extractUpstreamOverrideArgs(args: string[]): string[] {
  const upstreamArgs: string[] = [];

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (!arg) continue;

    const flagName = arg.split('=')[0] ?? '';
    if (!isUpstreamOverrideFlag(flagName)) {
      continue;
    }

    upstreamArgs.push(arg);

    if (!arg.includes('=')) {
      const nextArg = args[i + 1];
      if (nextArg && !nextArg.startsWith('-')) {
        upstreamArgs.push(nextArg);
        i++;
      }
    }
  }

  return upstreamArgs;
}

function getConfigUpstreamOverrides(config: DepGateConfig | undefined): string[] {
  if (!config?.upstreamOverrides) {
    return [];
  }

  return config.upstreamOverrides.filter((value) => value.trim().length > 0);
}

function validateDecisionMode(
  mode: string | undefined
): DepGateDecisionMode | undefined {
  if (!mode) {
    return undefined;
  }

  if (DECISION_MODES.has(mode as DepGateDecisionMode)) {
    return mode as DepGateDecisionMode;
  }

  throw new Error(
    `Invalid --depgate-decision-mode value "${mode}". Expected one of: block, warn, audit.`
  );
}

export async function resolveDepGateRuntimeOptions(
  args: string[],
  cwd?: string
): Promise<DepGateRuntimeOptions | undefined> {
  const config = (await getUnpmConfig(cwd)).depgate;
  const cliUpstreamArgs = collectFlagValues(args, '--depgate-upstream', true);
  const rawUpstreamArgs = extractUpstreamOverrideArgs(args);

  const enabled =
    hasFlag(args, '--depgate') ||
    config?.enabled === true ||
    hasDepGateCliOption(args) ||
    cliUpstreamArgs.length > 0 ||
    rawUpstreamArgs.length > 0;

  if (!enabled) {
    return undefined;
  }

  const binaryPath =
    getFlagValue(args, '--depgate-bin') ?? config?.binaryPath ?? 'depgate';
  const configPath = getFlagValue(args, '--depgate-config') ?? config?.configPath;
  const decisionMode = validateDecisionMode(
    getFlagValue(args, '--depgate-decision-mode') ?? config?.decisionMode
  );

  const passthroughArgs = [
    ...new Set([
      ...getConfigUpstreamOverrides(config),
      ...cliUpstreamArgs,
      ...rawUpstreamArgs,
    ]),
  ];

  return {
    binaryPath,
    configPath,
    decisionMode,
    passthroughArgs,
    startupTimeoutMs: 10_000,
  };
}
