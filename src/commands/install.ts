import { spawnPnpm } from '../utils/exec.js';
import { mapNpmFlagsToPnpm, mapNpmCiToPnpm, extractPackagesFromArgs } from '../mappers/args.js';
import { shouldIgnoreScriptsForInstall } from '../security/script-policy.js';

export async function install(args: string[]): Promise<number> {
  const { packages, flags } = extractPackagesFromArgs(args);
  let mappedFlags = mapNpmFlagsToPnpm(flags);

  // Add --ignore-scripts for dependency installation if not already present
  if (shouldIgnoreScriptsForInstall(mappedFlags, packages.length > 0)) {
    if (!mappedFlags.includes('--ignore-scripts')) {
      mappedFlags = ['--ignore-scripts', ...mappedFlags];
    }
  }

  const pnpmArgs = ['install', ...packages, ...mappedFlags];
  const result = await spawnPnpm(pnpmArgs);
  return result.exitCode ?? 0;
}

export async function ci(args: string[]): Promise<number> {
  const mappedArgs = mapNpmCiToPnpm(args);

  // Add --ignore-scripts for ci
  if (!mappedArgs.includes('--ignore-scripts')) {
    mappedArgs.unshift('--ignore-scripts');
  }

  const pnpmArgs = ['install', ...mappedArgs];
  const result = await spawnPnpm(pnpmArgs);
  return result.exitCode ?? 0;
}

export async function add(args: string[]): Promise<number> {
  const { packages, flags } = extractPackagesFromArgs(args);
  let mappedFlags = mapNpmFlagsToPnpm(flags);

  // Add --ignore-scripts for adding packages
  if (!mappedFlags.includes('--ignore-scripts')) {
    mappedFlags = ['--ignore-scripts', ...mappedFlags];
  }

  const pnpmArgs = ['add', ...packages, ...mappedFlags];
  const result = await spawnPnpm(pnpmArgs);
  return result.exitCode ?? 0;
}

export async function remove(args: string[]): Promise<number> {
  const mappedArgs = mapNpmFlagsToPnpm(args);
  const pnpmArgs = ['remove', ...mappedArgs];
  const result = await spawnPnpm(pnpmArgs);
  return result.exitCode ?? 0;
}

export async function update(args: string[]): Promise<number> {
  const mappedArgs = mapNpmFlagsToPnpm(args);
  const pnpmArgs = ['update', ...mappedArgs];
  const result = await spawnPnpm(pnpmArgs);
  return result.exitCode ?? 0;
}
