import { passthroughToNpm } from './passthrough.js';

/**
 * Manage npm teams.
 * This is an npm-only command passed through with security flags.
 */
export async function team(args: string[]): Promise<number> {
  return passthroughToNpm('team', args, true);
}

/**
 * Manage npm organizations.
 * This is an npm-only command passed through with security flags.
 */
export async function org(args: string[]): Promise<number> {
  return passthroughToNpm('org', args, true);
}

/**
 * Manage npm profile settings.
 * This is an npm-only command passed through with security flags.
 */
export async function profile(args: string[]): Promise<number> {
  return passthroughToNpm('profile', args, true);
}

/**
 * Manage npm registry hooks.
 * This is an npm-only command passed through with security flags.
 */
export async function hook(args: string[]): Promise<number> {
  return passthroughToNpm('hook', args, true);
}
