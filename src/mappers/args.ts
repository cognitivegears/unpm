export interface FlagMapping {
  npmFlag: string;
  pnpmFlag: string | null; // null means flag should be removed
}

const flagMappings: FlagMapping[] = [
  { npmFlag: '--save', pnpmFlag: null }, // pnpm default
  { npmFlag: '-S', pnpmFlag: null }, // pnpm default
  { npmFlag: '--save-dev', pnpmFlag: '-D' },
  { npmFlag: '--save-optional', pnpmFlag: '-O' },
  { npmFlag: '--save-exact', pnpmFlag: '-E' },
  { npmFlag: '--global', pnpmFlag: '-g' },
  { npmFlag: '--production', pnpmFlag: '--prod' },
  { npmFlag: '--no-save', pnpmFlag: '--save=false' },
  { npmFlag: '--legacy-peer-deps', pnpmFlag: '--legacy-peer-deps' },
  { npmFlag: '--force', pnpmFlag: '--force' },
  { npmFlag: '--verbose', pnpmFlag: '--reporter=default' },
  { npmFlag: '--silent', pnpmFlag: '--silent' },
  { npmFlag: '--quiet', pnpmFlag: '--silent' },
  { npmFlag: '--no-optional', pnpmFlag: '--no-optional' },
  { npmFlag: '--ignore-scripts', pnpmFlag: '--ignore-scripts' },
  { npmFlag: '--prefer-offline', pnpmFlag: '--prefer-offline' },
  { npmFlag: '--prefer-online', pnpmFlag: '--prefer-online' },
  { npmFlag: '--offline', pnpmFlag: '--offline' },
  { npmFlag: '--no-package-lock', pnpmFlag: '--no-lockfile' },
  { npmFlag: '--package-lock-only', pnpmFlag: '--lockfile-only' },
  { npmFlag: '--dry-run', pnpmFlag: '--dry-run' },
  { npmFlag: '--json', pnpmFlag: '--json' },
  { npmFlag: '--parseable', pnpmFlag: '--parseable' },
  { npmFlag: '--long', pnpmFlag: '--long' },
  { npmFlag: '--depth', pnpmFlag: '--depth' },
];

const shortFlagMappings: Record<string, string | null> = {
  '-S': null, // save is default in pnpm
  '-D': '-D',
  '-O': '-O',
  '-E': '-E',
  '-g': '-g',
  '-f': '--force',
};

const flagsWithValues = new Set([
  '--access',
  '--audit-level',
  '--cache',
  '--changed-files-ignore-pattern',
  '--child-concurrency',
  '--color',
  '--config',
  '--cpu',
  '--cwd',
  '--depth',
  '--dir',
  '--filter',
  '--global-dir',
  '--globalconfig',
  '--hoist-pattern',
  '--ignore',
  '--libc',
  '--lockfile-dir',
  '--loglevel',
  '--modules-dir',
  '--network-concurrency',
  '--omit',
  '--os',
  '--otp',
  '--prefix',
  '--public-hoist-pattern',
  '--publish-branch',
  '--registry',
  '--reporter',
  '--scope',
  '--store-dir',
  '--tag',
  '--test-pattern',
  '--userconfig',
  '--virtual-store-dir',
  '--workspace',
  '-C',
  '-w',
]);

export function mapNpmFlagsToPnpm(args: string[]): string[] {
  const result: string[] = [];

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (!arg) continue;

    // Handle flags with = (e.g., --depth=2)
    const [flag, value] = arg.includes('=') ? arg.split('=', 2) : [arg, null];

    // Check long flag mappings
    const mapping = flagMappings.find((m) => m.npmFlag === flag);
    if (mapping) {
      if (mapping.pnpmFlag !== null) {
        result.push(value ? `${mapping.pnpmFlag}=${value}` : mapping.pnpmFlag);
      }
      continue;
    }

    // Check short flag mappings
    if (flag && Object.prototype.hasOwnProperty.call(shortFlagMappings, flag)) {
      const pnpmFlag = shortFlagMappings[flag] as string | null;
      if (pnpmFlag !== null) {
        // Preserve value if present (e.g., -C=value)
        result.push(value ? `${pnpmFlag}=${value}` : pnpmFlag);
      }
      continue;
    }

    // Pass through unrecognized args
    result.push(arg);
  }

  return result;
}

export function mapNpmCiToPnpm(args: string[]): string[] {
  // npm ci -> pnpm install --frozen-lockfile
  const mappedArgs = mapNpmFlagsToPnpm(args);
  if (!mappedArgs.includes('--frozen-lockfile')) {
    mappedArgs.push('--frozen-lockfile');
  }
  return mappedArgs;
}

export function extractPackagesFromArgs(args: string[]): {
  packages: string[];
  flags: string[];
} {
  const packages: string[] = [];
  const flags: string[] = [];

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (!arg) continue;

    if (arg === '--') {
      packages.push(...args.slice(i + 1));
      break;
    }

    if (arg.startsWith('-')) {
      flags.push(arg);
      if (
        !arg.includes('=') &&
        flagsWithValues.has(arg) &&
        args[i + 1] &&
        !args[i + 1]?.startsWith('-')
      ) {
        flags.push(args[i + 1] as string);
        i++;
      }
      continue;
    }

    packages.push(arg);
  }

  return { packages, flags };
}

export function hasFlag(args: string[], flag: string): boolean {
  return args.some((arg) => arg === flag || arg.startsWith(`${flag}=`));
}

export function getFlagValue(args: string[], flag: string): string | undefined {
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === flag && args[i + 1] && !args[i + 1]?.startsWith('-')) {
      return args[i + 1];
    }
    if (arg?.startsWith(`${flag}=`)) {
      return arg.slice(flag.length + 1);
    }
  }
  return undefined;
}

export function removeFlag(args: string[], flag: string): string[] {
  const result: string[] = [];
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === flag) {
      // Only skip the next arg if this flag is known to take a value
      if (
        flagsWithValues.has(flag) &&
        args[i + 1] &&
        !args[i + 1]?.startsWith('-')
      ) {
        i++;
      }
      continue;
    }
    if (arg?.startsWith(`${flag}=`)) {
      continue;
    }
    if (arg) {
      result.push(arg);
    }
  }
  return result;
}
