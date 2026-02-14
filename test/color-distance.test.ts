/**
 * Color Distance Tests
 */

import { describe, it, expect } from 'vitest';
import { compositeOnWhite, hexToRgb, hexToLab, deltaE2000 } from '../src/shared/color-distance';

describe('compositeOnWhite', () => {
  it('passes through 6-digit hex unchanged', () => {
    expect(compositeOnWhite('#ff0000')).toBe('#ff0000');
    expect(compositeOnWhite('#000000')).toBe('#000000');
    expect(compositeOnWhite('#ffffff')).toBe('#ffffff');
  });

  it('composites 10% black on white to light gray', () => {
    // #0000001a = black with alpha 26/255 ≈ 10.2%
    // Result: 0 * 0.102 + 255 * 0.898 ≈ 229 → #e5e5e5
    const result = compositeOnWhite('#0000001a');
    expect(result).toBe('#e5e5e5');
  });

  it('composites 50% black on white to medium gray', () => {
    // #00000080 = black with alpha 128/255 ≈ 50.2%
    // Result: 0 * 0.502 + 255 * 0.498 ≈ 127 → #7f7f7f or #808080
    const result = compositeOnWhite('#00000080');
    // 128/255 ≈ 0.50196
    // 255 * (1 - 0.50196) ≈ 126.99.. → round to 127 → "7f"
    expect(result).toBe('#7f7f7f');
  });

  it('composites fully opaque color as itself', () => {
    // #ff0000ff = red with alpha 255/255 = 100%
    const result = compositeOnWhite('#ff0000ff');
    expect(result).toBe('#ff0000');
  });

  it('composites fully transparent color as white', () => {
    // #ff000000 = red with alpha 0/255 = 0%
    const result = compositeOnWhite('#ff000000');
    expect(result).toBe('#ffffff');
  });

  it('composites semi-transparent red on white', () => {
    // #ff000080 = red with alpha 128/255 ≈ 50.2%
    // R: 255 * 0.502 + 255 * 0.498 ≈ 255 → ff
    // G: 0 * 0.502 + 255 * 0.498 ≈ 127 → 7f
    // B: 0 * 0.502 + 255 * 0.498 ≈ 127 → 7f
    const result = compositeOnWhite('#ff000080');
    expect(result).toBe('#ff7f7f');
  });

  it('handles uppercase hex', () => {
    expect(compositeOnWhite('#FF0000')).toBe('#ff0000');
  });

  it('handles 3-digit hex pass-through', () => {
    expect(compositeOnWhite('#f00')).toBe('#f00');
  });
});

describe('hexToRgb', () => {
  it('parses 6-digit hex', () => {
    const result = hexToRgb('#ff0000');
    expect(result).toEqual({ r: 255, g: 0, b: 0 });
  });

  it('strips alpha from 8-digit hex', () => {
    const result = hexToRgb('#ff00001a');
    expect(result).toEqual({ r: 255, g: 0, b: 0 });
  });

  it('returns null for invalid hex', () => {
    expect(hexToRgb('not-a-color')).toBeNull();
  });
});

describe('deltaE2000', () => {
  it('returns 0 for identical colors', () => {
    const lab = hexToLab('#ff0000')!;
    expect(deltaE2000(lab, lab)).toBe(0);
  });

  it('returns small value for similar colors', () => {
    const lab1 = hexToLab('#ff0000')!;
    const lab2 = hexToLab('#ff0505')!;
    expect(deltaE2000(lab1, lab2)).toBeLessThan(5);
  });

  it('returns large value for different colors', () => {
    const lab1 = hexToLab('#ff0000')!;
    const lab2 = hexToLab('#0000ff')!;
    expect(deltaE2000(lab1, lab2)).toBeGreaterThan(30);
  });
});
