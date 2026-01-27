import { describe, it, expect } from 'vitest';
import {
  mapNpmFlagsToPnpm,
  mapNpmCiToPnpm,
  extractPackagesFromArgs,
  hasFlag,
  getFlagValue,
  removeFlag,
} from '../../src/mappers/args.js';
import {
  getCommandMapping,
  getCommandsByType,
  getAllCommands,
} from '../../src/mappers/commands.js';

describe('mapNpmFlagsToPnpm', () => {
  it('should remove --save flag (pnpm default)', () => {
    const result = mapNpmFlagsToPnpm(['--save']);
    expect(result).toEqual([]);
  });

  it('should remove -S flag (pnpm default)', () => {
    const result = mapNpmFlagsToPnpm(['-S']);
    expect(result).toEqual([]);
  });

  it('should map --save-dev to -D', () => {
    const result = mapNpmFlagsToPnpm(['--save-dev']);
    expect(result).toEqual(['-D']);
  });

  it('should map --save-optional to -O', () => {
    const result = mapNpmFlagsToPnpm(['--save-optional']);
    expect(result).toEqual(['-O']);
  });

  it('should map --save-exact to -E', () => {
    const result = mapNpmFlagsToPnpm(['--save-exact']);
    expect(result).toEqual(['-E']);
  });

  it('should map --global to -g', () => {
    const result = mapNpmFlagsToPnpm(['--global']);
    expect(result).toEqual(['-g']);
  });

  it('should map --production to --prod', () => {
    const result = mapNpmFlagsToPnpm(['--production']);
    expect(result).toEqual(['--prod']);
  });

  it('should map --no-save to --save=false', () => {
    const result = mapNpmFlagsToPnpm(['--no-save']);
    expect(result).toEqual(['--save=false']);
  });

  it('should pass through unknown flags', () => {
    const result = mapNpmFlagsToPnpm(['--custom-flag', 'value']);
    expect(result).toEqual(['--custom-flag', 'value']);
  });

  it('should handle flags with values', () => {
    const result = mapNpmFlagsToPnpm(['--depth=2']);
    expect(result).toEqual(['--depth=2']);
  });

  it('should handle multiple flags', () => {
    const result = mapNpmFlagsToPnpm(['--save-dev', '--save-exact']);
    expect(result).toEqual(['-D', '-E']);
  });

  it('should map short flags correctly', () => {
    const result = mapNpmFlagsToPnpm(['-D', '-E', '-g']);
    expect(result).toEqual(['-D', '-E', '-g']);
  });

  it('should handle sparse arrays with empty strings', () => {
    const result = mapNpmFlagsToPnpm(['--save-dev', '', '--save-exact']);
    expect(result).toEqual(['-D', '-E']);
  });

  it('should map -f to --force', () => {
    const result = mapNpmFlagsToPnpm(['-f']);
    expect(result).toEqual(['--force']);
  });
});

describe('mapNpmCiToPnpm', () => {
  it('should add --frozen-lockfile', () => {
    const result = mapNpmCiToPnpm([]);
    expect(result).toContain('--frozen-lockfile');
  });

  it('should not duplicate --frozen-lockfile', () => {
    const result = mapNpmCiToPnpm(['--frozen-lockfile']);
    expect(result.filter((f) => f === '--frozen-lockfile')).toHaveLength(1);
  });

  it('should also map other flags', () => {
    const result = mapNpmCiToPnpm(['--production']);
    expect(result).toContain('--prod');
    expect(result).toContain('--frozen-lockfile');
  });
});

describe('extractPackagesFromArgs', () => {
  it('should separate packages from flags', () => {
    const result = extractPackagesFromArgs(['lodash', '-D', 'axios', '--save-exact']);
    expect(result.packages).toEqual(['lodash', 'axios']);
    expect(result.flags).toEqual(['-D', '--save-exact']);
  });

  it('should handle only packages', () => {
    const result = extractPackagesFromArgs(['lodash', 'axios']);
    expect(result.packages).toEqual(['lodash', 'axios']);
    expect(result.flags).toEqual([]);
  });

  it('should handle only flags', () => {
    const result = extractPackagesFromArgs(['-D', '--save-exact']);
    expect(result.packages).toEqual([]);
    expect(result.flags).toEqual(['-D', '--save-exact']);
  });

  it('should keep flag values with flags', () => {
    const result = extractPackagesFromArgs([
      '--registry',
      'https://registry.npmjs.org',
      'lodash',
    ]);
    expect(result.packages).toEqual(['lodash']);
    expect(result.flags).toEqual(['--registry', 'https://registry.npmjs.org']);
  });

  it('should treat args after -- as packages', () => {
    const result = extractPackagesFromArgs(['--', 'lodash', '--flag']);
    expect(result.packages).toEqual(['lodash', '--flag']);
    expect(result.flags).toEqual([]);
  });

  it('should handle empty array', () => {
    const result = extractPackagesFromArgs([]);
    expect(result.packages).toEqual([]);
    expect(result.flags).toEqual([]);
  });

  it('should handle sparse arrays with empty strings', () => {
    const result = extractPackagesFromArgs(['lodash', '', 'axios']);
    expect(result.packages).toEqual(['lodash', 'axios']);
    expect(result.flags).toEqual([]);
  });

  it('should not consume next arg as value if it starts with dash', () => {
    const result = extractPackagesFromArgs(['--registry', '--verbose', 'lodash']);
    expect(result.packages).toEqual(['lodash']);
    expect(result.flags).toEqual(['--registry', '--verbose']);
  });

  it('should handle flag with = syntax for value flags', () => {
    const result = extractPackagesFromArgs(['--registry=https://example.com', 'lodash']);
    expect(result.packages).toEqual(['lodash']);
    expect(result.flags).toEqual(['--registry=https://example.com']);
  });

  it('should handle value flag at end of args', () => {
    const result = extractPackagesFromArgs(['lodash', '--registry']);
    expect(result.packages).toEqual(['lodash']);
    expect(result.flags).toEqual(['--registry']);
  });

  it('should handle flags before and after --', () => {
    const result = extractPackagesFromArgs(['-D', '--', '--not-a-flag']);
    expect(result.packages).toEqual(['--not-a-flag']);
    expect(result.flags).toEqual(['-D']);
  });

  it('should handle multiple value flags', () => {
    const result = extractPackagesFromArgs([
      '--registry',
      'https://registry.npmjs.org',
      '--scope',
      '@myorg',
      'lodash',
    ]);
    expect(result.packages).toEqual(['lodash']);
    expect(result.flags).toEqual([
      '--registry',
      'https://registry.npmjs.org',
      '--scope',
      '@myorg',
    ]);
  });
});

describe('hasFlag', () => {
  it('should detect exact flag match', () => {
    expect(hasFlag(['--verbose', 'other'], '--verbose')).toBe(true);
  });

  it('should detect flag with = value', () => {
    expect(hasFlag(['--depth=2'], '--depth')).toBe(true);
  });

  it('should return false for missing flag', () => {
    expect(hasFlag(['--other'], '--verbose')).toBe(false);
  });
});

describe('getFlagValue', () => {
  it('should get value after flag', () => {
    expect(getFlagValue(['--depth', '2'], '--depth')).toBe('2');
  });

  it('should get value from = syntax', () => {
    expect(getFlagValue(['--depth=2'], '--depth')).toBe('2');
  });

  it('should return undefined for missing flag', () => {
    expect(getFlagValue(['--other'], '--depth')).toBeUndefined();
  });

  it('should not return next flag as value', () => {
    expect(getFlagValue(['--depth', '--verbose'], '--depth')).toBeUndefined();
  });
});

describe('removeFlag', () => {
  it('should remove flag followed by another flag', () => {
    expect(removeFlag(['--verbose', '--other'], '--verbose')).toEqual(['--other']);
  });

  it('should remove flag with value', () => {
    expect(removeFlag(['--depth', '2', 'other'], '--depth')).toEqual(['other']);
  });

  it('should remove flag with = value', () => {
    expect(removeFlag(['--depth=2', 'other'], '--depth')).toEqual(['other']);
  });
});

describe('getCommandMapping', () => {
  it('should find install command', () => {
    const mapping = getCommandMapping('install');
    expect(mapping).toBeDefined();
    expect(mapping?.pnpmCommand).toBe('install');
  });

  it('should find command by alias', () => {
    const mapping = getCommandMapping('i');
    expect(mapping).toBeDefined();
    expect(mapping?.npmCommand).toBe('install');
  });

  it('should find rm as alias for uninstall', () => {
    const mapping = getCommandMapping('rm');
    expect(mapping).toBeDefined();
    expect(mapping?.npmCommand).toBe('uninstall');
  });

  it('should return undefined for unknown command', () => {
    const mapping = getCommandMapping('unknown-command');
    expect(mapping).toBeUndefined();
  });
});

describe('getCommandsByType', () => {
  it('should return commands by type', () => {
    const pnpmDirect = getCommandsByType('pnpm-direct');
    expect(pnpmDirect.length).toBeGreaterThan(0);
    expect(pnpmDirect.every((c) => c.type === 'pnpm-direct')).toBe(true);
  });

  it('should return npm passthrough commands', () => {
    const npmPassthrough = getCommandsByType('npm-passthrough');
    expect(npmPassthrough.some((c) => c.npmCommand === 'token')).toBe(true);
    expect(npmPassthrough.some((c) => c.npmCommand === 'access')).toBe(true);
  });
});

describe('getAllCommands', () => {
  it('should return all command mappings', () => {
    const commands = getAllCommands();
    expect(commands.length).toBeGreaterThan(0);
    expect(commands.some((c) => c.npmCommand === 'install')).toBe(true);
    expect(commands.some((c) => c.npmCommand === 'run')).toBe(true);
    expect(commands.some((c) => c.npmCommand === 'publish')).toBe(true);
  });
});
