import { passthroughToNpm } from './passthrough.js';

/**
 * Ping the npm registry.
 * This is a read-only diagnostic command that verifies registry connectivity.
 */
export async function ping(args: string[]): Promise<number> {
  return passthroughToNpm('ping', args, false);
}

/**
 * Run npm doctor to diagnose environment issues.
 * This is a read-only diagnostic command.
 */
export async function doctor(args: string[]): Promise<number> {
  return passthroughToNpm('doctor', args, false);
}

/**
 * Search npm help documentation.
 * This is a read-only help command.
 */
export async function helpSearch(args: string[]): Promise<number> {
  return passthroughToNpm('help-search', args, false);
}
