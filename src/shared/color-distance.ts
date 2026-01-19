/**
 * Color Distance Utilities
 *
 * Provides color space conversions and Delta E (CIE2000) calculation
 * for finding closest matching color tokens.
 */

/**
 * LAB color space representation
 */
export interface LAB {
  L: number; // Lightness (0-100)
  a: number; // Green-Red axis (-128 to 127)
  b: number; // Blue-Yellow axis (-128 to 127)
}

/**
 * RGB color representation (0-255 range)
 */
interface RGB255 {
  r: number;
  g: number;
  b: number;
}

/**
 * XYZ color space (intermediate for RGB->LAB)
 */
interface XYZ {
  x: number;
  y: number;
  z: number;
}

/**
 * Color match result
 */
export interface ColorMatch {
  tokenPath: string;
  tokenHex: string;
  deltaE: number;
  isExact: boolean;
}

/**
 * Parse hex color string to RGB
 */
export function hexToRgb(hex: string): RGB255 | null {
  // Remove # if present
  const cleaned = hex.replace(/^#/, '');

  // Handle 3-digit hex
  let fullHex = cleaned;
  if (cleaned.length === 3) {
    fullHex = cleaned
      .split('')
      .map(c => c + c)
      .join('');
  }

  // Handle 8-digit hex (with alpha) - strip alpha
  if (fullHex.length === 8) {
    fullHex = fullHex.slice(0, 6);
  }

  if (fullHex.length !== 6) {
    return null;
  }

  const r = parseInt(fullHex.slice(0, 2), 16);
  const g = parseInt(fullHex.slice(2, 4), 16);
  const b = parseInt(fullHex.slice(4, 6), 16);

  if (isNaN(r) || isNaN(g) || isNaN(b)) {
    return null;
  }

  return { r, g, b };
}

/**
 * Convert RGB to XYZ color space
 * Using sRGB color space with D65 illuminant
 */
function rgbToXyz(rgb: RGB255): XYZ {
  // Normalize to 0-1 range
  let r = rgb.r / 255;
  let g = rgb.g / 255;
  let b = rgb.b / 255;

  // Apply gamma correction (sRGB companding)
  r = r > 0.04045 ? Math.pow((r + 0.055) / 1.055, 2.4) : r / 12.92;
  g = g > 0.04045 ? Math.pow((g + 0.055) / 1.055, 2.4) : g / 12.92;
  b = b > 0.04045 ? Math.pow((b + 0.055) / 1.055, 2.4) : b / 12.92;

  // Scale to 0-100
  r *= 100;
  g *= 100;
  b *= 100;

  // Convert to XYZ using sRGB matrix (D65 illuminant)
  return {
    x: r * 0.4124564 + g * 0.3575761 + b * 0.1804375,
    y: r * 0.2126729 + g * 0.7151522 + b * 0.072175,
    z: r * 0.0193339 + g * 0.119192 + b * 0.9503041,
  };
}

/**
 * Convert XYZ to LAB color space
 * Using D65 illuminant reference white
 */
function xyzToLab(xyz: XYZ): LAB {
  // D65 illuminant reference white
  const refX = 95.047;
  const refY = 100.0;
  const refZ = 108.883;

  let x = xyz.x / refX;
  let y = xyz.y / refY;
  let z = xyz.z / refZ;

  // Apply f(t) function
  const epsilon = 0.008856; // (6/29)^3
  const kappa = 903.3; // (29/3)^3

  x = x > epsilon ? Math.pow(x, 1 / 3) : (kappa * x + 16) / 116;
  y = y > epsilon ? Math.pow(y, 1 / 3) : (kappa * y + 16) / 116;
  z = z > epsilon ? Math.pow(z, 1 / 3) : (kappa * z + 16) / 116;

  return {
    L: 116 * y - 16,
    a: 500 * (x - y),
    b: 200 * (y - z),
  };
}

/**
 * Convert hex color to LAB color space
 */
export function hexToLab(hex: string): LAB | null {
  const rgb = hexToRgb(hex);
  if (!rgb) return null;

  const xyz = rgbToXyz(rgb);
  return xyzToLab(xyz);
}

/**
 * Calculate Delta E (CIE2000) between two LAB colors
 *
 * This is the industry-standard metric for perceptual color difference:
 * - ΔE < 1.0: Not perceptible by human eyes
 * - ΔE 1-2: Perceptible through close observation
 * - ΔE 2-10: Perceptible at a glance
 * - ΔE > 10: Colors are clearly different
 */
export function deltaE2000(lab1: LAB, lab2: LAB): number {
  const L1 = lab1.L;
  const a1 = lab1.a;
  const b1 = lab1.b;
  const L2 = lab2.L;
  const a2 = lab2.a;
  const b2 = lab2.b;

  // Weighting factors (standard values)
  const kL = 1;
  const kC = 1;
  const kH = 1;

  // Calculate C' and h'
  const C1 = Math.sqrt(a1 * a1 + b1 * b1);
  const C2 = Math.sqrt(a2 * a2 + b2 * b2);
  const Cab = (C1 + C2) / 2;

  const G = 0.5 * (1 - Math.sqrt(Math.pow(Cab, 7) / (Math.pow(Cab, 7) + Math.pow(25, 7))));

  const a1Prime = a1 * (1 + G);
  const a2Prime = a2 * (1 + G);

  const C1Prime = Math.sqrt(a1Prime * a1Prime + b1 * b1);
  const C2Prime = Math.sqrt(a2Prime * a2Prime + b2 * b2);

  const h1Prime = calculateHPrime(a1Prime, b1);
  const h2Prime = calculateHPrime(a2Prime, b2);

  // Calculate deltas
  const deltaLPrime = L2 - L1;
  const deltaCPrime = C2Prime - C1Prime;
  const deltaHPrime = calculateDeltaHPrime(C1Prime, C2Prime, h1Prime, h2Prime);

  // Calculate CIEDE2000 components
  const LPrimeAvg = (L1 + L2) / 2;
  const CPrimeAvg = (C1Prime + C2Prime) / 2;
  const hPrimeAvg = calculateHPrimeAvg(C1Prime, C2Prime, h1Prime, h2Prime);

  const T =
    1 -
    0.17 * Math.cos(degToRad(hPrimeAvg - 30)) +
    0.24 * Math.cos(degToRad(2 * hPrimeAvg)) +
    0.32 * Math.cos(degToRad(3 * hPrimeAvg + 6)) -
    0.2 * Math.cos(degToRad(4 * hPrimeAvg - 63));

  const deltaTheta = 30 * Math.exp(-Math.pow((hPrimeAvg - 275) / 25, 2));

  const RC = 2 * Math.sqrt(Math.pow(CPrimeAvg, 7) / (Math.pow(CPrimeAvg, 7) + Math.pow(25, 7)));

  const SL = 1 + (0.015 * Math.pow(LPrimeAvg - 50, 2)) / Math.sqrt(20 + Math.pow(LPrimeAvg - 50, 2));
  const SC = 1 + 0.045 * CPrimeAvg;
  const SH = 1 + 0.015 * CPrimeAvg * T;

  const RT = -Math.sin(degToRad(2 * deltaTheta)) * RC;

  // Calculate final Delta E
  const deltaE = Math.sqrt(
    Math.pow(deltaLPrime / (kL * SL), 2) +
      Math.pow(deltaCPrime / (kC * SC), 2) +
      Math.pow(deltaHPrime / (kH * SH), 2) +
      RT * (deltaCPrime / (kC * SC)) * (deltaHPrime / (kH * SH))
  );

  return deltaE;
}

/**
 * Calculate h' (hue angle in degrees)
 */
function calculateHPrime(aPrime: number, b: number): number {
  if (aPrime === 0 && b === 0) {
    return 0;
  }
  let h = radToDeg(Math.atan2(b, aPrime));
  if (h < 0) {
    h += 360;
  }
  return h;
}

/**
 * Calculate delta h'
 */
function calculateDeltaHPrime(C1Prime: number, C2Prime: number, h1Prime: number, h2Prime: number): number {
  if (C1Prime * C2Prime === 0) {
    return 0;
  }

  let deltaH = h2Prime - h1Prime;

  if (Math.abs(deltaH) > 180) {
    if (h2Prime <= h1Prime) {
      deltaH += 360;
    } else {
      deltaH -= 360;
    }
  }

  return 2 * Math.sqrt(C1Prime * C2Prime) * Math.sin(degToRad(deltaH / 2));
}

/**
 * Calculate average h'
 */
function calculateHPrimeAvg(C1Prime: number, C2Prime: number, h1Prime: number, h2Prime: number): number {
  if (C1Prime * C2Prime === 0) {
    return h1Prime + h2Prime;
  }

  if (Math.abs(h1Prime - h2Prime) <= 180) {
    return (h1Prime + h2Prime) / 2;
  }

  if (h1Prime + h2Prime < 360) {
    return (h1Prime + h2Prime + 360) / 2;
  }

  return (h1Prime + h2Prime - 360) / 2;
}

/**
 * Convert degrees to radians
 */
function degToRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

/**
 * Convert radians to degrees
 */
function radToDeg(rad: number): number {
  return (rad * 180) / Math.PI;
}

/**
 * Find closest matching color tokens for a given hex color
 *
 * @param targetHex - The hex color to match
 * @param colorTokens - Map of hex values to token paths
 * @param colorLab - Pre-computed LAB values for tokens (optional for performance)
 * @param maxResults - Maximum number of results to return (default: 5)
 * @param maxDeltaE - Maximum Delta E threshold for suggestions (default: 10)
 */
export function findClosestColors(
  targetHex: string,
  colorTokens: Map<string, string>,
  colorLab?: Map<string, LAB>,
  maxResults: number = 5,
  maxDeltaE: number = 10
): ColorMatch[] {
  const targetLabResult = hexToLab(targetHex);
  if (!targetLabResult) {
    return [];
  }

  const targetLab = targetLabResult;
  const normalizedTarget = targetHex.toLowerCase();
  const matches: ColorMatch[] = [];

  for (const [hex, tokenPath] of colorTokens.entries()) {
    // Check for exact match first
    const normalizedHex = hex.toLowerCase();
    if (normalizedHex === normalizedTarget || normalizedHex === normalizedTarget.slice(0, 7)) {
      matches.push({
        tokenPath,
        tokenHex: hex,
        deltaE: 0,
        isExact: true,
      });
      continue;
    }

    // Get LAB value (from cache or compute)
    let tokenLabValue: LAB | null = null;
    if (colorLab) {
      const cached = colorLab.get(hex);
      if (cached) {
        tokenLabValue = cached;
      }
    }

    if (!tokenLabValue) {
      tokenLabValue = hexToLab(hex);
    }

    if (!tokenLabValue) continue;

    const deltaE = deltaE2000(targetLab, tokenLabValue);

    if (deltaE <= maxDeltaE) {
      matches.push({
        tokenPath,
        tokenHex: hex,
        deltaE,
        isExact: false,
      });
    }
  }

  // Sort by deltaE (exact matches first, then by distance)
  matches.sort((a, b) => {
    if (a.isExact && !b.isExact) return -1;
    if (!a.isExact && b.isExact) return 1;
    return a.deltaE - b.deltaE;
  });

  return matches.slice(0, maxResults);
}

/**
 * Get a human-readable description of Delta E value
 */
export function getDeltaEDescription(deltaE: number): string {
  if (deltaE === 0) {
    return 'exact match';
  } else if (deltaE < 1) {
    return 'visually identical';
  } else if (deltaE < 2) {
    return 'barely perceptible difference';
  } else if (deltaE < 5) {
    return 'slight difference';
  } else if (deltaE < 10) {
    return 'noticeable difference';
  } else {
    return 'significant difference';
  }
}
