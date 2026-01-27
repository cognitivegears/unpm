import { describe, it, expect } from 'vitest';
import { execa } from 'execa';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const cliPath = join(__dirname, '../../bin/unpm.js');

describe('CLI Integration', () => {
  it('should show help', async () => {
    const result = await execa('node', [cliPath, '--help'], { reject: false });
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('npm wrapper that delegates to pnpm');
  });

  it('should show version', async () => {
    const result = await execa('node', [cliPath, '--version'], { reject: false });
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toMatch(/\d+\.\d+\.\d+/);
  });

  it('should show help for allow-scripts', async () => {
    const result = await execa('node', [cliPath, 'allow-scripts'], { reject: false });
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('unpm allow-scripts');
    expect(result.stdout).toContain('add');
    expect(result.stdout).toContain('remove');
    expect(result.stdout).toContain('list');
  });

  it('should show help for migrate', async () => {
    const result = await execa('node', [cliPath, 'migrate', '--help'], { reject: false });
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('Migrate from npm to unpm/pnpm');
  });
});
