import { spawnPnpm, spawnNpm } from '../utils/exec.js';
import { getSecurityFlags } from '../security/script-policy.js';

export async function passthroughToPnpm(
  command: string,
  args: string[]
): Promise<number> {
  const pnpmArgs = [command, ...args];
  const result = await spawnPnpm(pnpmArgs);
  return result.exitCode ?? 0;
}

export async function passthroughToNpm(
  command: string,
  args: string[],
  addSecurityFlags = true
): Promise<number> {
  let npmArgs = [command, ...args];

  if (addSecurityFlags) {
    const securityFlags = getSecurityFlags();
    // Only add flags that aren't already present
    for (const flag of securityFlags) {
      if (!npmArgs.includes(flag)) {
        npmArgs.push(flag);
      }
    }
  }

  const result = await spawnNpm(npmArgs);
  return result.exitCode ?? 0;
}
