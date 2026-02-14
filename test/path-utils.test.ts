/**
 * Path Utils Tests
 */

import { describe, it, expect } from 'vitest';
import {
  normalizePath,
  pathsMatch,
  pathEndsWith,
  findMatchingTokenPath,
  scorePathSimilarity,
  findFuzzyMatchingTokenPaths,
} from '../src/shared/path-utils';

describe('normalizePath', () => {
  it('converts dots to slashes', () => {
    expect(normalizePath('brand.colors.primary')).toBe('brand/colors/primary');
  });

  it('lowercases', () => {
    expect(normalizePath('Brand/Colors/Primary')).toBe('brand/colors/primary');
  });

  it('normalizes spaced slashes', () => {
    expect(normalizePath('Brand / Colors / Primary')).toBe('brand/colors/primary');
  });

  it('converts spaces to dashes', () => {
    expect(normalizePath('Spacing 0')).toBe('spacing-0');
  });
});

describe('pathsMatch', () => {
  it('matches dot vs slash notation', () => {
    expect(pathsMatch('brand.colors.primary', 'brand/colors/primary')).toBe(true);
  });

  it('matches case-insensitively', () => {
    expect(pathsMatch('Brand/Colors', 'brand/colors')).toBe(true);
  });
});

describe('pathEndsWith', () => {
  it('matches suffix', () => {
    expect(pathEndsWith('brand/colors/primary', 'primary')).toBe(true);
  });

  it('matches multi-segment suffix', () => {
    expect(pathEndsWith('brand/colors/primary', 'colors/primary')).toBe(true);
  });

  it('does not match non-suffix', () => {
    expect(pathEndsWith('brand/colors/primary', 'brand/colors')).toBe(false);
  });
});

describe('scorePathSimilarity', () => {
  it('returns 1 for identical paths (dot vs slash)', () => {
    const score = scorePathSimilarity(
      'system/background/container-color/transparent-10',
      'system.background.container-color.transparent-10'
    );
    expect(score).toBe(1);
  });

  it('scores high for paths differing only in last segment suffix', () => {
    const score = scorePathSimilarity(
      'system/background/container-color/transparent-10',
      'system.background.container-color.transparent-5'
    );
    // 3/4 exact segments + partial tail match
    expect(score).toBeGreaterThan(0.7);
  });

  it('scores lower for paths sharing only prefix segments', () => {
    const score = scorePathSimilarity(
      'system/background/container-color/transparent-10',
      'system.background.overlay-color.page-scrim'
    );
    // Only 2/4 segments match (system, background), different tail
    expect(score).toBeLessThan(0.5);
  });

  it('prefers name match over wrong-name-same-color match', () => {
    const variable = 'system/background/container-color/transparent-10';

    const nameScore = scorePathSimilarity(
      variable,
      'system.background.container-color.transparent-5'
    );
    const colorScore = scorePathSimilarity(
      variable,
      'system.background.overlay-color.page-scrim'
    );

    // Name-similar token should score MUCH higher than color-similar token
    expect(nameScore).toBeGreaterThan(colorScore);
    expect(nameScore - colorScore).toBeGreaterThan(0.2);
  });

  it('scores 0 for completely unrelated paths', () => {
    expect(scorePathSimilarity('foo/bar/baz', 'alpha/beta/gamma')).toBe(0);
  });

  it('handles single-segment paths', () => {
    expect(scorePathSimilarity('primary', 'primary')).toBe(1);
    expect(scorePathSimilarity('primary', 'secondary')).toBeLessThan(0.3);
  });
});

describe('findFuzzyMatchingTokenPaths', () => {
  const tokenPaths = [
    'system.background.container-color.transparent-5',
    'system.background.container-color.transparent-10',
    'system.background.container-color.default',
    'system.background.overlay-color.page-scrim',
    'system.icon.on-surface-color.inverse',
    'color.neutrals.black',
  ];

  it('finds exact name match first', () => {
    const results = findFuzzyMatchingTokenPaths(
      'system/background/container-color/transparent-10',
      tokenPaths
    );

    expect(results.length).toBeGreaterThan(0);
    expect(results[0].path).toBe('system.background.container-color.transparent-10');
    expect(results[0].score).toBe(1);
  });

  it('ranks similar name tokens above unrelated tokens', () => {
    const results = findFuzzyMatchingTokenPaths(
      'system/background/container-color/transparent-10',
      tokenPaths,
      0.3 // lower threshold to include more results
    );

    // The container-color tokens should all rank above overlay-color
    const containerPaths = results.filter(r => r.path.includes('container-color'));
    const overlayPaths = results.filter(r => r.path.includes('overlay-color'));

    if (containerPaths.length > 0 && overlayPaths.length > 0) {
      expect(containerPaths[0].score).toBeGreaterThan(overlayPaths[0].score);
    }
  });

  it('excludes low-similarity tokens when threshold is high', () => {
    const results = findFuzzyMatchingTokenPaths(
      'system/background/container-color/transparent-10',
      tokenPaths,
      0.6
    );

    // Should NOT include color.neutrals.black (very different name)
    expect(results.find(r => r.path === 'color.neutrals.black')).toBeUndefined();
  });
});
