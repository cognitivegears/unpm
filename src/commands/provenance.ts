import chalk from 'chalk';
import { execNpm } from '../utils/exec.js';
import { logger } from '../utils/logger.js';

interface NpmPackageInfo {
  name?: string;
  version?: string;
  'dist-tags'?: Record<string, string>;
  versions?: Record<string, unknown>;
  time?: Record<string, string>;
  repository?: {
    type?: string;
    url?: string;
    directory?: string;
  };
  homepage?: string;
  bugs?: {
    url?: string;
  };
  maintainers?: Array<{
    name?: string;
    email?: string;
  }>;
  attestations?: {
    url?: string;
    provenance?: {
      predicateType?: string;
    };
  };
  signatures?: Array<{
    keyid?: string;
    sig?: string;
  }>;
  dist?: {
    attestations?: {
      url?: string;
      provenance?: {
        predicateType?: string;
      };
    };
    signatures?: Array<{
      keyid?: string;
      sig?: string;
    }>;
    integrity?: string;
    shasum?: string;
    tarball?: string;
    fileCount?: number;
    unpackedSize?: number;
  };
  publishConfig?: {
    registry?: string;
  };
  _npmUser?: {
    name?: string;
    email?: string;
  };
  _npmOperationalInternal?: {
    host?: string;
    tmp?: string;
  };
}

/**
 * Display package provenance and attestation information.
 */
export async function provenance(args: string[]): Promise<number> {
  const packageSpec = args[0];

  if (!packageSpec) {
    printProvenanceHelp();
    return 1;
  }

  logger.info(chalk.bold(`Fetching provenance info for ${packageSpec}...`));
  logger.info('');

  try {
    const result = await execNpm(['view', packageSpec, '--json'], {
      stdio: 'pipe',
    });

    if (result.exitCode !== 0) {
      if (result.stderr.includes('404')) {
        logger.error(`Package "${packageSpec}" not found in registry.`);
      } else {
        logger.error(`Failed to fetch package info: ${result.stderr}`);
      }
      return 1;
    }

    const pkgInfo: NpmPackageInfo = JSON.parse(result.stdout);
    displayProvenanceInfo(packageSpec, pkgInfo);

    return 0;
  } catch (error) {
    logger.error(
      `Error fetching package info: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
    return 1;
  }
}

function displayProvenanceInfo(
  packageSpec: string,
  pkgInfo: NpmPackageInfo
): void {
  const name = pkgInfo.name ?? packageSpec;
  const version =
    pkgInfo.version ?? pkgInfo['dist-tags']?.['latest'] ?? 'unknown';

  logger.info(chalk.bold.blue(`${name}@${version}`));
  logger.info('');

  // Repository info
  logger.info(chalk.bold('Repository'));
  if (pkgInfo.repository) {
    const repoUrl = pkgInfo.repository.url
      ?.replace(/^git\+/, '')
      .replace(/\.git$/, '');
    logger.info(`  URL: ${repoUrl ?? 'Not specified'}`);
    if (pkgInfo.repository.directory) {
      logger.info(`  Directory: ${pkgInfo.repository.directory}`);
    }
  } else {
    logger.info(chalk.yellow('  Not specified'));
  }
  logger.info('');

  // Homepage
  if (pkgInfo.homepage) {
    logger.info(chalk.bold('Homepage'));
    logger.info(`  ${pkgInfo.homepage}`);
    logger.info('');
  }

  // Maintainers
  logger.info(chalk.bold('Maintainers'));
  if (pkgInfo.maintainers && pkgInfo.maintainers.length > 0) {
    for (const maintainer of pkgInfo.maintainers.slice(0, 5)) {
      logger.info(
        `  - ${maintainer.name ?? 'Unknown'}${maintainer.email ? ` <${maintainer.email}>` : ''}`
      );
    }
    if (pkgInfo.maintainers.length > 5) {
      logger.info(`  ... and ${pkgInfo.maintainers.length - 5} more`);
    }
  } else {
    logger.info(chalk.yellow('  None listed'));
  }
  logger.info('');

  // Published by
  logger.info(chalk.bold('Last Published By'));
  if (pkgInfo._npmUser) {
    logger.info(
      `  ${pkgInfo._npmUser.name ?? 'Unknown'}${pkgInfo._npmUser.email ? ` <${pkgInfo._npmUser.email}>` : ''}`
    );
  } else {
    logger.info(chalk.yellow('  Not available'));
  }
  logger.info('');

  // Publication time
  if (pkgInfo.time) {
    const versionTime = pkgInfo.time[version];
    if (versionTime) {
      logger.info(chalk.bold('Published'));
      const date = new Date(versionTime);
      const age = Math.floor(
        (Date.now() - date.getTime()) / (1000 * 60 * 60 * 24)
      );
      logger.info(`  ${date.toISOString()} (${age} days ago)`);
      logger.info('');
    }
  }

  // Integrity and signatures
  logger.info(chalk.bold('Integrity'));
  if (pkgInfo.dist) {
    if (pkgInfo.dist.integrity) {
      logger.info(`  ${pkgInfo.dist.integrity}`);
    }
    if (pkgInfo.dist.shasum) {
      logger.info(`  SHA: ${pkgInfo.dist.shasum}`);
    }
  } else {
    logger.info(chalk.yellow('  Not available'));
  }
  logger.info('');

  // Attestations/Provenance
  logger.info(chalk.bold('Attestations'));
  const attestations = pkgInfo.attestations ?? pkgInfo.dist?.attestations;
  if (attestations) {
    if (attestations.url) {
      logger.info(chalk.green(`  URL: ${attestations.url}`));
    }
    if (attestations.provenance?.predicateType) {
      logger.info(
        chalk.green(
          `  Predicate Type: ${attestations.provenance.predicateType}`
        )
      );
    }
  } else {
    logger.info(chalk.yellow('  No attestations found'));
    logger.info(
      chalk.dim(
        '  Packages built with provenance on GitHub Actions will show attestations here.'
      )
    );
  }
  logger.info('');

  // Signatures
  logger.info(chalk.bold('Signatures'));
  const signatures = pkgInfo.signatures ?? pkgInfo.dist?.signatures;
  if (signatures && signatures.length > 0) {
    for (const sig of signatures) {
      logger.info(chalk.green(`  Key ID: ${sig.keyid ?? 'Unknown'}`));
      if (sig.sig) {
        logger.info(chalk.green(`  Signature: ${sig.sig.substring(0, 40)}...`));
      }
    }
  } else {
    logger.info(chalk.yellow('  No signatures found'));
  }
  logger.info('');

  // Tarball URL
  if (pkgInfo.dist?.tarball) {
    logger.info(chalk.bold('Tarball'));
    logger.info(`  ${pkgInfo.dist.tarball}`);
    if (pkgInfo.dist.fileCount !== undefined) {
      logger.info(`  Files: ${pkgInfo.dist.fileCount}`);
    }
    if (pkgInfo.dist.unpackedSize !== undefined) {
      const sizeKB = Math.round(pkgInfo.dist.unpackedSize / 1024);
      logger.info(`  Size: ${sizeKB} KB`);
    }
    logger.info('');
  }

  // Summary
  logger.info(chalk.bold('Security Summary'));
  const hasAttestations = !!attestations?.url;
  const hasSignatures = signatures && signatures.length > 0;
  const hasRepository = !!pkgInfo.repository?.url;

  if (hasAttestations && hasSignatures && hasRepository) {
    logger.info(
      chalk.green(
        '  High trust: Attestations, signatures, and repository link present'
      )
    );
  } else if (hasRepository && (hasAttestations || hasSignatures)) {
    logger.info(
      chalk.green(
        '  Good trust: Repository and attestations/signatures present'
      )
    );
  } else if (hasRepository) {
    logger.info(
      chalk.yellow('  Moderate trust: Repository link present, no attestations')
    );
  } else {
    logger.info(chalk.red('  Low trust: No repository link or attestations'));
  }
  logger.info('');
}

function printProvenanceHelp(): void {
  logger.info(
    chalk.bold('unpm provenance - Show package attestation/provenance info')
  );
  logger.info('');
  logger.info('Usage:');
  logger.info('  unpm provenance <package>');
  logger.info('  unpm prov <package>');
  logger.info('');
  logger.info('Examples:');
  logger.info('  unpm provenance lodash');
  logger.info('  unpm provenance react@18.2.0');
  logger.info('  unpm prov @types/node');
  logger.info('');
  logger.info('This command shows:');
  logger.info('  - Repository and homepage links');
  logger.info('  - Package maintainers');
  logger.info('  - Publisher information');
  logger.info('  - Integrity hashes');
  logger.info('  - Attestations (if published with provenance)');
  logger.info('  - Signatures');
}
