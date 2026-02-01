import { join } from 'node:path';
import { readFile } from 'node:fs/promises';
import {
  readPackageJson,
  fileExists,
  getLavamoatAllowScripts,
  hasPnpmLock,
  hasPackageLock,
} from '../utils/config.js';
import { getPackagesWithScripts } from './script-policy.js';

export interface SecurityCheckResult {
  name: string;
  status: 'pass' | 'warn' | 'fail';
  message: string;
  suggestion?: string;
}

/**
 * Run all security checks and return results.
 */
export async function runSecurityChecks(
  cwd?: string
): Promise<SecurityCheckResult[]> {
  const results: SecurityCheckResult[] = [];

  results.push(await checkTrustPolicy(cwd));
  results.push(await checkMinReleaseAge(cwd));
  results.push(await checkLockfilePresent(cwd));
  results.push(await checkLockfileGitignored(cwd));
  results.push(await checkStaleAllowlistEntries(cwd));
  results.push(await checkExoticDirectDeps(cwd));
  results.push(await checkMigrationStatus(cwd));
  results.push(await checkNpmBlocking(cwd));

  return results;
}

/**
 * Check if trust policy is configured.
 */
async function checkTrustPolicy(cwd?: string): Promise<SecurityCheckResult> {
  const packageJson = await readPackageJson(cwd);
  const unpmConfig = packageJson?.['unpm'] as
    | { trustPolicy?: string }
    | undefined;

  if (unpmConfig?.trustPolicy === 'no-downgrade') {
    return {
      name: 'Trust Policy',
      status: 'pass',
      message: 'Trust policy is set to "no-downgrade"',
    };
  }

  if (unpmConfig?.trustPolicy === 'none') {
    return {
      name: 'Trust Policy',
      status: 'warn',
      message: 'Trust policy is disabled',
      suggestion: 'Consider setting trustPolicy to "no-downgrade" in package.json unpm config',
    };
  }

  return {
    name: 'Trust Policy',
    status: 'pass',
    message: 'Trust policy uses default (no-downgrade)',
  };
}

/**
 * Check if minimum release age is configured.
 */
async function checkMinReleaseAge(cwd?: string): Promise<SecurityCheckResult> {
  const packageJson = await readPackageJson(cwd);
  const unpmConfig = packageJson?.['unpm'] as
    | { minReleaseAge?: string | number }
    | undefined;

  if (unpmConfig?.minReleaseAge !== undefined) {
    return {
      name: 'Minimum Release Age',
      status: 'pass',
      message: `Minimum release age is set to ${unpmConfig.minReleaseAge}`,
    };
  }

  return {
    name: 'Minimum Release Age',
    status: 'pass',
    message: 'Minimum release age uses default (2 days)',
  };
}

/**
 * Check if a lockfile is present.
 */
async function checkLockfilePresent(cwd?: string): Promise<SecurityCheckResult> {
  const hasPnpm = await hasPnpmLock(cwd);
  const hasNpm = await hasPackageLock(cwd);

  if (hasPnpm) {
    return {
      name: 'Lockfile Present',
      status: 'pass',
      message: 'pnpm-lock.yaml is present',
    };
  }

  if (hasNpm) {
    return {
      name: 'Lockfile Present',
      status: 'warn',
      message: 'Only package-lock.json is present',
      suggestion: 'Run "unpm migrate" to switch to pnpm-lock.yaml',
    };
  }

  return {
    name: 'Lockfile Present',
    status: 'fail',
    message: 'No lockfile found',
    suggestion:
      'Run "unpm install" to create a lockfile for reproducible builds',
  };
}

/**
 * Check if lockfile is in .gitignore.
 */
async function checkLockfileGitignored(
  cwd?: string
): Promise<SecurityCheckResult> {
  const dir = cwd ?? process.cwd();
  const gitDir = join(dir, '.git');
  const gitignorePath = join(dir, '.gitignore');

  // Only check if this is a git repo
  if (!(await fileExists(gitDir))) {
    return {
      name: 'Lockfile Gitignore',
      status: 'pass',
      message: 'Not a git repository',
    };
  }

  if (!(await fileExists(gitignorePath))) {
    return {
      name: 'Lockfile Gitignore',
      status: 'pass',
      message: 'No .gitignore file',
    };
  }

  const gitignoreContent = await readFile(gitignorePath, 'utf-8');
  const lines = gitignoreContent.split('\n').map((l) => l.trim());

  const lockfileIgnored =
    lines.includes('pnpm-lock.yaml') ||
    lines.includes('package-lock.json') ||
    lines.includes('*.lock') ||
    lines.includes('*.yaml');

  if (lockfileIgnored) {
    return {
      name: 'Lockfile Gitignore',
      status: 'fail',
      message: 'Lockfile appears to be in .gitignore',
      suggestion:
        'Remove lockfile from .gitignore to ensure reproducible builds',
    };
  }

  return {
    name: 'Lockfile Gitignore',
    status: 'pass',
    message: 'Lockfile is not gitignored',
  };
}

/**
 * Check for stale allowlist entries (in allowlist but not installed).
 */
async function checkStaleAllowlistEntries(
  cwd?: string
): Promise<SecurityCheckResult> {
  const allowScripts = await getLavamoatAllowScripts(cwd);
  const allowedPackages = Object.entries(allowScripts)
    .filter(([, allowed]) => allowed === true)
    .map(([pkg]) => pkg);

  if (allowedPackages.length === 0) {
    return {
      name: 'Stale Allowlist',
      status: 'pass',
      message: 'No packages in allowlist',
    };
  }

  const packagesWithScripts = await getPackagesWithScripts(cwd);
  const staleEntries = allowedPackages.filter(
    (pkg) => !packagesWithScripts.includes(pkg)
  );

  if (staleEntries.length === 0) {
    return {
      name: 'Stale Allowlist',
      status: 'pass',
      message: 'All allowlist entries are installed packages with scripts',
    };
  }

  return {
    name: 'Stale Allowlist',
    status: 'warn',
    message: `${staleEntries.length} stale allowlist entries: ${staleEntries.slice(0, 3).join(', ')}${staleEntries.length > 3 ? '...' : ''}`,
    suggestion:
      'Remove stale entries with "unpm allow-scripts remove <package>"',
  };
}

/**
 * Check for exotic sources (git/tarball URLs) in direct dependencies.
 */
async function checkExoticDirectDeps(cwd?: string): Promise<SecurityCheckResult> {
  const packageJson = await readPackageJson(cwd);
  if (!packageJson) {
    return {
      name: 'Exotic Dependencies',
      status: 'pass',
      message: 'No package.json found',
    };
  }

  const allDeps = {
    ...packageJson.dependencies,
    ...packageJson.devDependencies,
  };

  const exoticDeps: string[] = [];
  for (const [name, version] of Object.entries(allDeps)) {
    if (!version) continue;
    if (
      version.startsWith('git') ||
      version.startsWith('git+') ||
      version.startsWith('github:') ||
      version.startsWith('gitlab:') ||
      version.startsWith('bitbucket:') ||
      version.includes('://') ||
      version.endsWith('.tgz') ||
      version.endsWith('.tar.gz')
    ) {
      exoticDeps.push(name);
    }
  }

  if (exoticDeps.length === 0) {
    return {
      name: 'Exotic Dependencies',
      status: 'pass',
      message: 'No exotic sources (git/tarball) in direct dependencies',
    };
  }

  return {
    name: 'Exotic Dependencies',
    status: 'warn',
    message: `${exoticDeps.length} exotic dependencies: ${exoticDeps.slice(0, 3).join(', ')}${exoticDeps.length > 3 ? '...' : ''}`,
    suggestion:
      'Consider using registry packages instead of git/tarball URLs',
  };
}

/**
 * Check migration status.
 */
async function checkMigrationStatus(cwd?: string): Promise<SecurityCheckResult> {
  const packageJson = await readPackageJson(cwd);
  const unpmConfig = packageJson?.['unpm'] as
    | { migrated?: boolean }
    | undefined;

  if (unpmConfig?.migrated === true) {
    return {
      name: 'Migration Status',
      status: 'pass',
      message: 'Project is fully migrated to unpm/pnpm',
    };
  }

  const hasPnpm = await hasPnpmLock(cwd);
  const hasNpm = await hasPackageLock(cwd);

  if (hasPnpm && !hasNpm) {
    return {
      name: 'Migration Status',
      status: 'warn',
      message: 'Using pnpm-lock.yaml but migration not marked complete',
      suggestion: 'Set unpm.migrated: true in package.json',
    };
  }

  if (hasNpm) {
    return {
      name: 'Migration Status',
      status: 'warn',
      message: 'Project has not been migrated from npm',
      suggestion: 'Run "unpm migrate" for full pnpm benefits',
    };
  }

  return {
    name: 'Migration Status',
    status: 'warn',
    message: 'Migration status unknown (no lockfile)',
    suggestion: 'Run "unpm migrate" to set up the project',
  };
}

/**
 * Check if npm is properly blocked after migration.
 */
async function checkNpmBlocking(cwd?: string): Promise<SecurityCheckResult> {
  const packageJson = await readPackageJson(cwd);
  const unpmConfig = packageJson?.['unpm'] as
    | { migrated?: boolean }
    | undefined;

  // Only check if migrated
  if (unpmConfig?.migrated !== true) {
    return {
      name: 'npm Blocking',
      status: 'pass',
      message: 'npm blocking check skipped (not migrated)',
    };
  }

  const engines = packageJson?.['engines'] as
    | Record<string, string>
    | undefined;
  const hasEngineBlock = engines?.['npm'] === 'use-pnpm-instead';

  const dir = cwd ?? process.cwd();
  const hasShrinkwrap = await fileExists(join(dir, 'npm-shrinkwrap.json'));

  const hasPreinstall = packageJson?.scripts?.['preinstall']?.includes(
    'pnpm'
  );

  if (hasEngineBlock && hasShrinkwrap && hasPreinstall) {
    return {
      name: 'npm Blocking',
      status: 'pass',
      message: 'npm is blocked via engines, shrinkwrap, and preinstall',
    };
  }

  const missing: string[] = [];
  if (!hasEngineBlock) missing.push('engines.npm');
  if (!hasShrinkwrap) missing.push('npm-shrinkwrap.json');
  if (!hasPreinstall) missing.push('preinstall script');

  return {
    name: 'npm Blocking',
    status: 'warn',
    message: `npm blocking incomplete: missing ${missing.join(', ')}`,
    suggestion: 'Re-run "unpm migrate" to set up complete npm blocking',
  };
}
