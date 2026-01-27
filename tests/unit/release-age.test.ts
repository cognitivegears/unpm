import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  parseDuration,
  formatDuration,
  extractReleaseAgeFlags,
  DEFAULT_MIN_RELEASE_AGE_MINUTES,
} from '../../src/security/release-age.js';
import * as config from '../../src/utils/config.js';

// Mock the config module
vi.mock('../../src/utils/config.js', async () => {
  const actual = await vi.importActual('../../src/utils/config.js');
  return {
    ...actual,
    readPackageJson: vi.fn(),
  };
});

describe('parseDuration', () => {
  it('should parse minutes', () => {
    expect(parseDuration('30m')).toBe(30);
    expect(parseDuration('30min')).toBe(30);
    expect(parseDuration('60m')).toBe(60);
  });

  it('should parse hours', () => {
    expect(parseDuration('1h')).toBe(60);
    expect(parseDuration('2hr')).toBe(120);
    expect(parseDuration('4hours')).toBe(240);
    expect(parseDuration('0.5h')).toBe(30);
  });

  it('should parse days', () => {
    expect(parseDuration('1d')).toBe(1440);
    expect(parseDuration('2days')).toBe(2880);
    expect(parseDuration('0.5d')).toBe(720);
  });

  it('should parse weeks', () => {
    expect(parseDuration('1w')).toBe(10080);
    expect(parseDuration('1week')).toBe(10080);
    expect(parseDuration('2weeks')).toBe(20160);
  });

  it('should parse plain numbers as minutes', () => {
    expect(parseDuration('60')).toBe(60);
    expect(parseDuration('1440')).toBe(1440);
  });

  it('should throw on invalid format', () => {
    expect(() => parseDuration('invalid')).toThrow('Invalid duration format');
    expect(() => parseDuration('abc123')).toThrow('Invalid duration format');
  });
});

describe('formatDuration', () => {
  it('should format minutes', () => {
    expect(formatDuration(30)).toBe('30 minutes');
    expect(formatDuration(1)).toBe('1 minute');
  });

  it('should format hours', () => {
    expect(formatDuration(60)).toBe('1 hour');
    expect(formatDuration(120)).toBe('2 hours');
    expect(formatDuration(90)).toBe('1.5 hours');
  });

  it('should format days', () => {
    expect(formatDuration(1440)).toBe('1 day');
    expect(formatDuration(2880)).toBe('2 days');
    expect(formatDuration(4320)).toBe('3 days');
  });

  it('should format weeks', () => {
    expect(formatDuration(10080)).toBe('1 week');
    expect(formatDuration(20160)).toBe('2 weeks');
  });
});

describe('extractReleaseAgeFlags', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(config.readPackageJson).mockResolvedValue({
      name: 'test-package',
      version: '1.0.0',
    });
  });

  it('should return default flags when no args provided', async () => {
    const result = await extractReleaseAgeFlags([]);

    expect(result.cleanedArgs).toEqual([]);
    expect(result.releaseAgeFlags.disabled).toBe(false);
    expect(result.releaseAgeFlags.minAgeMinutes).toBe(DEFAULT_MIN_RELEASE_AGE_MINUTES);
    expect(result.releaseAgeFlags.flags).toContain(
      `--minimum-release-age=${DEFAULT_MIN_RELEASE_AGE_MINUTES}`
    );
  });

  it('should parse --min-release-age flag with value', async () => {
    const result = await extractReleaseAgeFlags(['--min-release-age=1d', 'lodash']);

    expect(result.cleanedArgs).toEqual(['lodash']);
    expect(result.releaseAgeFlags.minAgeMinutes).toBe(1440);
    expect(result.releaseAgeFlags.flags).toContain('--minimum-release-age=1440');
  });

  it('should parse --min-release-age flag with separate value', async () => {
    const result = await extractReleaseAgeFlags(['--min-release-age', '4h', 'lodash']);

    expect(result.cleanedArgs).toEqual(['lodash']);
    expect(result.releaseAgeFlags.minAgeMinutes).toBe(240);
  });

  it('should parse --no-min-release-age flag', async () => {
    const result = await extractReleaseAgeFlags(['--no-min-release-age', 'lodash']);

    expect(result.cleanedArgs).toEqual(['lodash']);
    expect(result.releaseAgeFlags.disabled).toBe(true);
    expect(result.releaseAgeFlags.minAgeMinutes).toBe(0);
    expect(result.releaseAgeFlags.flags).toEqual([]);
  });

  it('should parse --allow-recent flag with value', async () => {
    const result = await extractReleaseAgeFlags(['--allow-recent=lodash', 'axios']);

    expect(result.cleanedArgs).toEqual(['axios']);
    expect(result.releaseAgeFlags.flags).toContain('--minimum-release-age-exclude=lodash');
  });

  it('should parse --allow-recent flag with separate value', async () => {
    const result = await extractReleaseAgeFlags(['--allow-recent', 'lodash', 'axios']);

    expect(result.cleanedArgs).toEqual(['axios']);
    expect(result.releaseAgeFlags.flags).toContain('--minimum-release-age-exclude=lodash');
  });

  it('should handle multiple --allow-recent flags', async () => {
    const result = await extractReleaseAgeFlags([
      '--allow-recent=lodash',
      '--allow-recent=axios',
      'express',
    ]);

    expect(result.cleanedArgs).toEqual(['express']);
    expect(result.releaseAgeFlags.flags).toContain('--minimum-release-age-exclude=lodash');
    expect(result.releaseAgeFlags.flags).toContain('--minimum-release-age-exclude=axios');
  });

  it('should use config from package.json', async () => {
    vi.mocked(config.readPackageJson).mockResolvedValue({
      name: 'test-package',
      version: '1.0.0',
      unpm: {
        minReleaseAge: '1d',
        minReleaseAgeExclude: ['preconfigured-pkg'],
      },
    });

    const result = await extractReleaseAgeFlags(['lodash']);

    expect(result.cleanedArgs).toEqual(['lodash']);
    expect(result.releaseAgeFlags.minAgeMinutes).toBe(1440);
    expect(result.releaseAgeFlags.flags).toContain('--minimum-release-age=1440');
    expect(result.releaseAgeFlags.flags).toContain(
      '--minimum-release-age-exclude=preconfigured-pkg'
    );
  });

  it('should pass through other flags unchanged', async () => {
    const result = await extractReleaseAgeFlags([
      '--save-dev',
      '--min-release-age=1d',
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
