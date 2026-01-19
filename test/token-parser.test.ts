/**
 * Token Parser Tests
 */

import { describe, it, expect } from 'vitest';
import { TokenParser, parseMetadata } from '../src/shared/token-parser';
import type { TokenFileInput, TokenSetMetadata } from '../src/shared/types';

describe('TokenParser', () => {
  describe('parseTokenFiles', () => {
    it('parses flat tokens at root level', () => {
      const parser = new TokenParser();
      const files: TokenFileInput[] = [
        {
          path: 'Spacing/Mode 1',
          content: {
            'Spacing 0': { $type: 'number', $value: 0 },
            'Spacing 1': { $type: 'number', $value: 4 },
            'Spacing 2': { $type: 'number', $value: 8 },
          },
        },
      ];

      const result = parser.parseTokenFiles(files);

      expect(result.tokens.get('Spacing 0')?.resolvedValue).toBe(0);
      expect(result.tokens.get('Spacing 1')?.resolvedValue).toBe(4);
      expect(result.tokens.get('Spacing 2')?.resolvedValue).toBe(8);
    });

    it('parses nested token groups', () => {
      const parser = new TokenParser();
      const files: TokenFileInput[] = [
        {
          path: 'Color/Default',
          content: {
            brand: {
              'brand-300': { $type: 'color', $value: '#f96302' },
              'brand-400': { $type: 'color', $value: '#e95c02' },
            },
          },
        },
      ];

      const result = parser.parseTokenFiles(files);

      expect(result.tokens.get('brand.brand-300')?.resolvedValue).toBe('#f96302');
      expect(result.tokens.get('brand.brand-400')?.resolvedValue).toBe('#e95c02');
    });

    it('resolves alias references', () => {
      const parser = new TokenParser();
      const files: TokenFileInput[] = [
        {
          path: 'Color/Default',
          content: {
            brand: {
              'brand-300': { $type: 'color', $value: '#f96302' },
            },
          },
        },
        {
          path: 'Semantic/Light',
          content: {
            'primary-color': { $type: 'color', $value: '{brand.brand-300}' },
          },
        },
      ];

      const result = parser.parseTokenFiles(files);

      const token = result.tokens.get('primary-color');
      expect(token?.isAlias).toBe(true);
      expect(token?.aliasPath).toBe('brand.brand-300');
      expect(token?.resolvedValue).toBe('#f96302');
    });

    it('resolves chained aliases', () => {
      const parser = new TokenParser();
      const files: TokenFileInput[] = [
        {
          path: 'primitives',
          content: {
            'base-color': { $type: 'color', $value: '#ff0000' },
          },
        },
        {
          path: 'semantic',
          content: {
            'primary': { $type: 'color', $value: '{base-color}' },
            'button-bg': { $type: 'color', $value: '{primary}' },
          },
        },
      ];

      const result = parser.parseTokenFiles(files);

      expect(result.tokens.get('button-bg')?.resolvedValue).toBe('#ff0000');
      expect(result.tokens.get('button-bg')?.isAlias).toBe(true);
    });

    it('detects circular references', () => {
      const parser = new TokenParser();
      const files: TokenFileInput[] = [
        {
          path: 'test',
          content: {
            'token-a': { $type: 'color', $value: '{token-b}' },
            'token-b': { $type: 'color', $value: '{token-a}' },
          },
        },
      ];

      expect(() => parser.parseTokenFiles(files)).toThrow(/circular reference/i);
    });

    it('handles missing alias references gracefully', () => {
      const parser = new TokenParser();
      const files: TokenFileInput[] = [
        {
          path: 'test',
          content: {
            'broken-ref': { $type: 'color', $value: '{nonexistent.token}' },
          },
        },
      ];

      // Should not throw - marks as unresolved
      const result = parser.parseTokenFiles(files);
      const token = result.tokens.get('broken-ref');

      expect(token?.isAlias).toBe(true);
      expect(token?.rawValue).toBe('{nonexistent.token}');
    });

    it('normalizes color values to lowercase', () => {
      const parser = new TokenParser();
      const files: TokenFileInput[] = [
        {
          path: 'colors',
          content: {
            'upper': { $type: 'color', $value: '#FFFFFF' },
            'mixed': { $type: 'color', $value: '#FfFfFf' },
          },
        },
      ];

      const result = parser.parseTokenFiles(files);

      expect(result.tokens.get('upper')?.resolvedValue).toBe('#ffffff');
      expect(result.tokens.get('mixed')?.resolvedValue).toBe('#ffffff');
    });

    it('builds color value index', () => {
      const parser = new TokenParser();
      const files: TokenFileInput[] = [
        {
          path: 'colors',
          content: {
            'red': { $type: 'color', $value: '#ff0000' },
            'green': { $type: 'color', $value: '#00ff00' },
          },
        },
      ];

      const result = parser.parseTokenFiles(files);

      expect(result.colorValues.get('#ff0000')).toBe('red');
      expect(result.colorValues.get('#00ff00')).toBe('green');
    });

    it('builds number value index', () => {
      const parser = new TokenParser();
      const files: TokenFileInput[] = [
        {
          path: 'spacing',
          content: {
            'sm': { $type: 'number', $value: 8 },
            'md': { $type: 'number', $value: 16 },
            'lg': { $type: 'number', $value: 24 },
          },
        },
      ];

      const result = parser.parseTokenFiles(files);

      expect(result.numberValues.get(8)).toContain('sm');
      expect(result.numberValues.get(16)).toContain('md');
      expect(result.numberValues.get(24)).toContain('lg');
    });

    it('respects token set order from metadata', () => {
      const parser = new TokenParser();
      const metadata: TokenSetMetadata = {
        tokenSetOrder: ['base', 'semantic'],
      };

      const files: TokenFileInput[] = [
        {
          path: 'semantic',
          content: {
            'color': { $type: 'color', $value: '{base-color}' },
          },
        },
        {
          path: 'base',
          content: {
            'base-color': { $type: 'color', $value: '#123456' },
          },
        },
      ];

      // Files are provided out of order, but metadata defines correct order
      const result = parser.parseTokenFiles(files, metadata);

      expect(result.tokens.get('color')?.resolvedValue).toBe('#123456');
    });

    it('groups tokens by type', () => {
      const parser = new TokenParser();
      const files: TokenFileInput[] = [
        {
          path: 'tokens',
          content: {
            'red': { $type: 'color', $value: '#ff0000' },
            'blue': { $type: 'color', $value: '#0000ff' },
            'sm': { $type: 'number', $value: 8 },
          },
        },
      ];

      const result = parser.parseTokenFiles(files);

      expect(result.byType.get('color')?.length).toBe(2);
      expect(result.byType.get('number')?.length).toBe(1);
    });

    it('skips metadata keys starting with $', () => {
      const parser = new TokenParser();
      const files: TokenFileInput[] = [
        {
          path: 'tokens',
          content: {
            $themes: [{ id: '1', name: 'light' }],
            'real-token': { $type: 'color', $value: '#fff' },
          },
        },
      ];

      const result = parser.parseTokenFiles(files);

      expect(result.tokens.has('$themes')).toBe(false);
      expect(result.tokens.has('real-token')).toBe(true);
    });
  });

  describe('parseMetadata', () => {
    it('parses valid metadata', () => {
      const content = {
        tokenSetOrder: ['Color/Default', 'Spacing/Mode 1'],
      };

      const result = parseMetadata(content);

      expect(result?.tokenSetOrder).toEqual(['Color/Default', 'Spacing/Mode 1']);
    });

    it('returns undefined for invalid metadata', () => {
      expect(parseMetadata(null)).toBeUndefined();
      expect(parseMetadata({})).toBeUndefined();
      expect(parseMetadata({ tokenSetOrder: 'not-an-array' })).toBeUndefined();
    });
  });
});
