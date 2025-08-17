import { describe, expect, test } from 'vitest';
import { normalizeMnscWatchPatterns } from './glob';

describe('normalizeMnscWatchPatterns', () => {
  test('keeps explicit files as-is', () => {
    expect(normalizeMnscWatchPatterns(['file.mnsc'])).toEqual(['file.mnsc']);
    expect(normalizeMnscWatchPatterns(['src/*.mnsc'])).toEqual(['src/*.mnsc']);
  });

  test('is idempotent for **/*.mnsc patterns', () => {
    expect(normalizeMnscWatchPatterns(['src/**/*.mnsc'])).toEqual(['src/**/*.mnsc']);
    expect(normalizeMnscWatchPatterns(['stories/**/*.mnsc'])).toEqual(['stories/**/*.mnsc']);
  });

  test('expands directories and broad globs to **/*.mnsc', () => {
    expect(normalizeMnscWatchPatterns(['src'])).toEqual(['src/**/*.mnsc']);
    expect(normalizeMnscWatchPatterns(['src/'])).toEqual(['src/**/*.mnsc']);
    expect(normalizeMnscWatchPatterns(['src/*'])).toEqual(['src/**/*.mnsc']);
    expect(normalizeMnscWatchPatterns(['src/**'])).toEqual(['src/**/*.mnsc']);
  });
});
