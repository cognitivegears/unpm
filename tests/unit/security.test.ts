import { describe, it, expect } from 'vitest';
import {
  shouldIgnoreScriptsForInstall,
  getSecurityFlags,
} from '../../src/security/script-policy.js';

describe('shouldIgnoreScriptsForInstall', () => {
  it('should return true if --ignore-scripts is already present', () => {
    expect(shouldIgnoreScriptsForInstall(['--ignore-scripts'], false)).toBe(true);
  });

  it('should return true when installing specific packages', () => {
    expect(shouldIgnoreScriptsForInstall([], true)).toBe(true);
  });

  it('should return false when no packages specified (installing from lockfile)', () => {
    expect(shouldIgnoreScriptsForInstall([], false)).toBe(false);
  });
});

describe('getSecurityFlags', () => {
  it('should return --ignore-scripts', () => {
    const flags = getSecurityFlags();
    expect(flags).toContain('--ignore-scripts');
  });
});
