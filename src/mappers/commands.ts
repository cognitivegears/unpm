export type CommandType =
  | 'pnpm-direct' // Direct pnpm equivalent
  | 'pnpm-mapped' // pnpm with flag translation
  | 'npm-passthrough' // Use npm with security flags
  | 'custom'; // Custom implementation

export interface CommandMapping {
  npmCommand: string;
  pnpmCommand: string;
  type: CommandType;
  aliases?: string[];
  requiresSecurityFlags?: boolean;
}

const commandMappings: CommandMapping[] = [
  // Install commands
  { npmCommand: 'install', pnpmCommand: 'install', type: 'pnpm-mapped', aliases: ['i', 'isntall', 'add'] },
  { npmCommand: 'ci', pnpmCommand: 'install', type: 'pnpm-mapped' },
  { npmCommand: 'uninstall', pnpmCommand: 'remove', type: 'pnpm-direct', aliases: ['rm', 'remove', 'un', 'unlink'] },

  // Run commands
  { npmCommand: 'run', pnpmCommand: 'run', type: 'pnpm-direct', aliases: ['run-script'] },
  { npmCommand: 'test', pnpmCommand: 'test', type: 'pnpm-direct', aliases: ['t', 'tst'] },
  { npmCommand: 'start', pnpmCommand: 'start', type: 'pnpm-direct' },
  { npmCommand: 'stop', pnpmCommand: 'stop', type: 'pnpm-direct' },
  { npmCommand: 'restart', pnpmCommand: 'restart', type: 'pnpm-direct' },

  // Package management
  { npmCommand: 'init', pnpmCommand: 'init', type: 'pnpm-direct', aliases: ['create'] },
  { npmCommand: 'publish', pnpmCommand: 'publish', type: 'pnpm-direct' },
  { npmCommand: 'pack', pnpmCommand: 'pack', type: 'pnpm-direct' },
  { npmCommand: 'link', pnpmCommand: 'link', type: 'pnpm-direct', aliases: ['ln'] },

  // Information commands
  { npmCommand: 'ls', pnpmCommand: 'ls', type: 'pnpm-direct', aliases: ['list', 'la', 'll'] },
  { npmCommand: 'outdated', pnpmCommand: 'outdated', type: 'pnpm-direct' },
  { npmCommand: 'update', pnpmCommand: 'update', type: 'pnpm-direct', aliases: ['up', 'upgrade'] },
  { npmCommand: 'view', pnpmCommand: 'view', type: 'pnpm-direct', aliases: ['info', 'show', 'v'] },
  { npmCommand: 'search', pnpmCommand: 'search', type: 'pnpm-direct', aliases: ['s', 'se', 'find'] },

  // Audit and security
  { npmCommand: 'audit', pnpmCommand: 'audit', type: 'pnpm-direct' },
  { npmCommand: 'fund', pnpmCommand: 'fund', type: 'pnpm-direct' },

  // Registry commands
  { npmCommand: 'login', pnpmCommand: 'login', type: 'pnpm-direct', aliases: ['adduser'] },
  { npmCommand: 'logout', pnpmCommand: 'logout', type: 'pnpm-direct' },
  { npmCommand: 'whoami', pnpmCommand: 'whoami', type: 'pnpm-direct' },

  // Exec commands
  { npmCommand: 'exec', pnpmCommand: 'exec', type: 'pnpm-direct', aliases: ['x'] },
  { npmCommand: 'dlx', pnpmCommand: 'dlx', type: 'pnpm-direct' },

  // Config
  { npmCommand: 'config', pnpmCommand: 'config', type: 'pnpm-direct', aliases: ['c'] },
  { npmCommand: 'set', pnpmCommand: 'config set', type: 'pnpm-direct' },
  { npmCommand: 'get', pnpmCommand: 'config get', type: 'pnpm-direct' },

  // Cache
  { npmCommand: 'cache', pnpmCommand: 'store', type: 'pnpm-mapped' },

  // npm-only commands (passthrough with security)
  { npmCommand: 'access', pnpmCommand: 'access', type: 'npm-passthrough', requiresSecurityFlags: true },
  { npmCommand: 'deprecate', pnpmCommand: 'deprecate', type: 'pnpm-direct' },
  { npmCommand: 'unpublish', pnpmCommand: 'unpublish', type: 'pnpm-direct' },
  { npmCommand: 'dist-tag', pnpmCommand: 'dist-tag', type: 'pnpm-direct', aliases: ['dist-tags'] },
  { npmCommand: 'owner', pnpmCommand: 'owner', type: 'pnpm-direct', aliases: ['author'] },
  { npmCommand: 'token', pnpmCommand: 'token', type: 'npm-passthrough', requiresSecurityFlags: true },
  { npmCommand: 'profile', pnpmCommand: 'profile', type: 'npm-passthrough', requiresSecurityFlags: true },
  { npmCommand: 'hook', pnpmCommand: 'hook', type: 'npm-passthrough', requiresSecurityFlags: true },
  { npmCommand: 'org', pnpmCommand: 'org', type: 'npm-passthrough', requiresSecurityFlags: true },
  { npmCommand: 'team', pnpmCommand: 'team', type: 'npm-passthrough', requiresSecurityFlags: true },
  { npmCommand: 'stars', pnpmCommand: 'stars', type: 'npm-passthrough', requiresSecurityFlags: true },
  { npmCommand: 'star', pnpmCommand: 'star', type: 'npm-passthrough', requiresSecurityFlags: true },
  { npmCommand: 'unstar', pnpmCommand: 'unstar', type: 'npm-passthrough', requiresSecurityFlags: true },

  // Browser commands
  { npmCommand: 'docs', pnpmCommand: 'docs', type: 'pnpm-direct', aliases: ['home'] },
  { npmCommand: 'repo', pnpmCommand: 'repo', type: 'pnpm-direct' },
  { npmCommand: 'bugs', pnpmCommand: 'bugs', type: 'pnpm-direct', aliases: ['issues'] },

  // Misc
  { npmCommand: 'version', pnpmCommand: 'version', type: 'pnpm-direct' },
  { npmCommand: 'bin', pnpmCommand: 'bin', type: 'pnpm-direct' },
  { npmCommand: 'root', pnpmCommand: 'root', type: 'pnpm-direct' },
  { npmCommand: 'prefix', pnpmCommand: 'prefix', type: 'pnpm-direct' },
  { npmCommand: 'dedupe', pnpmCommand: 'dedupe', type: 'pnpm-direct' },
  { npmCommand: 'prune', pnpmCommand: 'prune', type: 'pnpm-direct' },
  { npmCommand: 'rebuild', pnpmCommand: 'rebuild', type: 'pnpm-direct', aliases: ['rb'] },
  { npmCommand: 'shrinkwrap', pnpmCommand: 'shrinkwrap', type: 'pnpm-direct' },
  { npmCommand: 'completion', pnpmCommand: 'completion', type: 'pnpm-direct' },
  { npmCommand: 'help', pnpmCommand: 'help', type: 'pnpm-direct' },
  { npmCommand: 'explain', pnpmCommand: 'why', type: 'pnpm-direct', aliases: ['why'] },

  // Custom commands
  { npmCommand: 'migrate', pnpmCommand: '', type: 'custom' },
  { npmCommand: 'setup-lavamoat', pnpmCommand: '', type: 'custom' },
  { npmCommand: 'allow-scripts', pnpmCommand: '', type: 'custom' },
];

export function getCommandMapping(command: string): CommandMapping | undefined {
  // First check direct command match
  const directMatch = commandMappings.find((m) => m.npmCommand === command);
  if (directMatch) {
    return directMatch;
  }

  // Then check aliases
  return commandMappings.find((m) => m.aliases?.includes(command));
}

export function getAllCommands(): CommandMapping[] {
  return commandMappings;
}

export function getCommandsByType(type: CommandType): CommandMapping[] {
  return commandMappings.filter((m) => m.type === type);
}
