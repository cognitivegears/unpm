import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  parseTrustPolicyDuration,
  getTrustPolicyConfig,
  extractTrustPolicyFlags,
  DEFAULT_TRUST_POLICY_IGNORE_AFTER_MINUTES,
} from '../../src/security/trust-policy.js';
import * as config from '../../src/utils/config.js';

// Mock the config module
vi.mock('../../src/utils/config.js', async () => {
  const actual = await vi.importActual('../../src/utils/config.js');
  return {
    ...actual,
    readPackageJson: vi.fn(),
  };
});

describe('parseTrustPolicyDuration', () => {
  it('should parse minutes', () => {
    expect(parseTrustPolicyDuration('30m')).toBe(30);
    expect(parseTrustPolicyDuration('60min')).toBe(60);
  });

  it('should parse hours', () => {
    expect(parseTrustPolicyDuration('1h')).toBe(60);
    expect(parseTrustPolicyDuration('2hr')).toBe(120);
    expect(parseTrustPolicyDuration('4hours')).toBe(240);
  });

  it('should parse days', () => {
    expect(parseTrustPolicyDuration('1d')).toBe(1440);
    expect(parseTrustPolicyDuration('7days')).toBe(10080);
  });

  it('should parse weeks', () => {
    expect(parseTrustPolicyDuration('1w')).toBe(10080);
    expect(parseTrustPolicyDuration('2weeks')).toBe(20160);
  });

  it('should parse years', () => {
    expect(parseTrustPolicyDuration('1y')).toBe(525600);
    expect(parseTrustPolicyDuration('1year')).toBe(525600);
    expect(parseTrustPolicyDuration('2years')).toBe(1051200);
  });

  it('should parse plain numbers as minutes', () => {
    expect(parseTrustPolicyDuration('60')).toBe(60);
    expect(parseTrustPolicyDuration('525600')).toBe(525600);
  });

  it('should accept numeric input', () => {
    expect(parseTrustPolicyDuration(60)).toBe(60);
    expect(parseTrustPolicyDuration(525600)).toBe(525600);
  });

  it('should throw on invalid format', () => {
    expect(() => parseTrustPolicyDuration('invalid')).toThrow(
      'Invalid duration format'
    );
    expect(() => parseTrustPolicyDuration('abc123')).toThrow(
      'Invalid duration format'
    );
  });
});

describe('getTrustPolicyConfig', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('should return default config when no package.json config', async () => {
    vi.mocked(config.readPackageJson).mockResolvedValue({
      name: 'test-package',
      version: '1.0.0',
    });

    const result = await getTrustPolicyConfig();

    expect(result.trustPolicy).toBe('no-downgrade');
    expect(result.ignoreAfterMinutes).toBe(
      DEFAULT_TRUST_POLICY_IGNORE_AFTER_MINUTES
    );
    expect(result.excludePackages).toEqual([]);
  });

  it('should use config from package.json', async () => {
    vi.mocked(config.readPackageJson).mockResolvedValue({
      name: 'test-package',
      version: '1.0.0',
      unpm: {
        trustPolicy: 'none',
        trustPolicyIgnoreAfter: '30d',
        trustPolicyExclude: ['test-pkg'],
      },
    });

    const result = await getTrustPolicyConfig();

    expect(result.trustPolicy).toBe('none');
    expect(result.ignoreAfterMinutes).toBe(43200); // 30 days in minutes
    expect(result.excludePackages).toEqual(['test-pkg']);
  });

  it('should accept numeric trustPolicyIgnoreAfter', async () => {
    vi.mocked(config.readPackageJson).mockResolvedValue({
      name: 'test-package',
      version: '1.0.0',
      unpm: {
        trustPolicyIgnoreAfter: 100000,
      },
    });

    const result = await getTrustPolicyConfig();

    expect(result.ignoreAfterMinutes).toBe(100000);
  });
});

describe('extractTrustPolicyFlags', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(config.readPackageJson).mockResolvedValue({
      name: 'test-package',
      version: '1.0.0',
    });
  });

  it('should return default config when no args provided', async () => {
    const result = await extractTrustPolicyFlags([]);

    expect(result.cleanedArgs).toEqual([]);
    expect(result.trustPolicyFlags.disabled).toBe(false);
    expect(result.trustPolicyFlags.trustPolicy).toBe('no-downgrade');
    expect(result.trustPolicyFlags.flags).toContain(
      '--config.trust-policy=no-downgrade'
    );
  });

  it('should parse --trust-policy flag with value', async () => {
    const result = await extractTrustPolicyFlags([
      '--trust-policy=none',
      'lodash',
    ]);

    expect(result.cleanedArgs).toEqual(['lodash']);
    expect(result.trustPolicyFlags.trustPolicy).toBe('none');
    expect(result.trustPolicyFlags.flags).toEqual([]);
  });

  it('should parse --trust-policy flag with separate value', async () => {
    const result = await extractTrustPolicyFlags([
      '--trust-policy',
      'no-downgrade',
      'lodash',
    ]);

    expect(result.cleanedArgs).toEqual(['lodash']);
    expect(result.trustPolicyFlags.trustPolicy).toBe('no-downgrade');
  });

  it('should parse --no-trust-policy flag', async () => {
    const result = await extractTrustPolicyFlags(['--no-trust-policy', 'lodash']);

    expect(result.cleanedArgs).toEqual(['lodash']);
    expect(result.trustPolicyFlags.disabled).toBe(true);
    expect(result.trustPolicyFlags.trustPolicy).toBe('none');
    expect(result.trustPolicyFlags.flags).toEqual([]);
  });

  it('should parse --trust-policy-ignore-after flag', async () => {
    const result = await extractTrustPolicyFlags([
      '--trust-policy-ignore-after=30d',
      'lodash',
    ]);

    expect(result.cleanedArgs).toEqual(['lodash']);
    expect(result.trustPolicyFlags.ignoreAfterMinutes).toBe(43200); // 30 days in minutes
  });

  it('should parse --trust-policy-exclude flag', async () => {
    const result = await extractTrustPolicyFlags([
      '--trust-policy-exclude=test-pkg',
      'lodash',
    ]);

    expect(result.cleanedArgs).toEqual(['lodash']);
  });

  it('should handle multiple --trust-policy-exclude flags', async () => {
    const result = await extractTrustPolicyFlags([
      '--trust-policy-exclude=pkg1',
      '--trust-policy-exclude=pkg2',
      'lodash',
    ]);

    expect(result.cleanedArgs).toEqual(['lodash']);
  });

  it('should pass through other flags unchanged', async () => {
    const result = await extractTrustPolicyFlags([
      '--save-dev',
      '--trust-policy=no-downgrade',
      'lodash',
      '--registry=https://example.com',
    ]);

    expect(result.cleanedArgs).toEqual([
      '--save-dev',
      'lodash',
      '--registry=https://example.com',
    ]);
  });
});
