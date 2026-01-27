import chalk from 'chalk';
import { getLavamoatAllowScripts, readPackageJson } from '../utils/config.js';
import { logger } from '../utils/logger.js';

export interface ScriptPolicy {
  allowLocalScripts: boolean;
  allowDependencyScripts: boolean;
  trustedPackages: string[];
  lavamoatEnabled: boolean;
}

const defaultPolicy: ScriptPolicy = {
  allowLocalScripts: true,
  allowDependencyScripts: false,
  trustedPackages: [],
  lavamoatEnabled: true,
};

export async function getScriptPolicy(cwd?: string): Promise<ScriptPolicy> {
  const packageJson = await readPackageJson(cwd);

  if (!packageJson) {
    return defaultPolicy;
  }

  const unpmConfig = packageJson['unpm'] as Partial<ScriptPolicy> | undefined;

  return {
    ...defaultPolicy,
    ...unpmConfig,
  };
}

export async function isPackageAllowedToRunScripts(
  packageName: string,
  cwd?: string
): Promise<boolean> {
  const policy = await getScriptPolicy(cwd);

  // Check trusted packages list
  if (policy.trustedPackages.includes(packageName)) {
    return true;
  }

  // Check LavaMoat allowlist
  if (policy.lavamoatEnabled) {
    const allowScripts = await getLavamoatAllowScripts(cwd);
    if (allowScripts[packageName] === true) {
      return true;
    }
  }

  // Default: not allowed
  return policy.allowDependencyScripts;
}

export function printScriptBlockedWarning(packageName: string): void {
  console.log('');
  console.log(
    chalk.yellow(
      `  Warning: Package "${packageName}" wants to run install scripts but is not in allowlist.`
    )
  );
  console.log('');
  console.log('  To allow this package\'s scripts, run:');
  console.log(chalk.cyan(`    unpm allow-scripts add ${packageName}`));
  console.log('');
  console.log(
    '  Or add to your package.json lavamoat.allowScripts configuration.'
  );
  console.log('');
}

export async function getPackagesWithScripts(cwd?: string): Promise<string[]> {
  // This would scan node_modules to find packages with install scripts
  // For now, return empty - will be implemented when needed
  logger.debug('Scanning for packages with install scripts...');
  return [];
}

export function shouldIgnoreScriptsForInstall(
  args: string[],
  hasPackages: boolean
): boolean {
  // If explicitly set, respect that
  if (args.includes('--ignore-scripts')) {
    return true;
  }

  // If installing specific packages (not from lockfile), ignore scripts by default
  // Local project scripts will still run
  return hasPackages;
}

export function getSecurityFlags(): string[] {
  return ['--ignore-scripts'];
}
