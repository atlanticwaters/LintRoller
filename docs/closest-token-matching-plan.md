# Closest Token Matching - Implementation Plan

## Problem Statement

Currently, the linter only suggests tokens when there's an **exact match** between a hardcoded value and a token's resolved value:
- Colors: Must match hex value exactly (e.g., `#f96300` only matches token with `#f96300`)
- Numbers: Must match value exactly (e.g., `16` only matches tokens with value `16`)

This means designers using `#f96302` (off by 2 in red) get no suggestion, even though `brand.brand-300 (#f96300)` is visually identical and the intended token.

## Proposed Solution

Implement a **"closest match"** algorithm that finds tokens with values most similar to the hardcoded value, even when not exact. This will:
1. Help designers identify the correct token when they've approximated a value
2. Catch "close but not quite" values that indicate a token should have been used
3. Provide actionable suggestions for fixing violations

---

## Implementation Details

### 1. Color Matching Algorithm

**Approach: Delta E (CIE2000) Color Difference**

Delta E is the industry-standard metric for perceptual color difference:
- ΔE < 1.0: Not perceptible by human eyes
- ΔE 1-2: Perceptible through close observation
- ΔE 2-10: Perceptible at a glance
- ΔE > 10: Colors are clearly different

**Implementation Steps:**

1. **Convert hex to LAB color space** (required for Delta E)
   - Hex → RGB → XYZ → LAB

2. **Calculate Delta E (CIE2000)** between hardcoded color and all color tokens

3. **Return best matches** with ΔE below threshold (suggest ΔE < 5.0)

**New file: `src/shared/color-distance.ts`**

```typescript
interface LAB {
  L: number;  // Lightness (0-100)
  a: number;  // Green-Red (-128 to 127)
  b: number;  // Blue-Yellow (-128 to 127)
}

interface ColorMatch {
  tokenPath: string;
  tokenHex: string;
  deltaE: number;
  isExact: boolean;
}

// Convert hex to LAB
function hexToLab(hex: string): LAB

// Calculate Delta E (CIE2000)
function deltaE2000(lab1: LAB, lab2: LAB): number

// Find closest color tokens
function findClosestColors(
  targetHex: string,
  colorValues: Map<string, string>,
  maxResults?: number,
  maxDeltaE?: number
): ColorMatch[]
```

### 2. Number Matching Algorithm

**Approach: Percentage Tolerance + Absolute Difference**

For spacing, radii, and typography values:

1. **Find tokens within tolerance**
   - Within 10% of the value, OR
   - Within 2px absolute difference (for small values)

2. **Rank by closeness**
   - Prefer exact matches
   - Then smallest absolute difference
   - Then prefer contextually appropriate tokens (spacing tokens for spacing properties)

**Enhanced `findMatchingSpacingToken` / `findMatchingRadiusToken`:**

```typescript
interface NumberMatch {
  tokenPath: string;
  tokenValue: number;
  difference: number;
  percentDifference: number;
  isExact: boolean;
}

function findClosestNumberTokens(
  targetValue: number,
  numberValues: Map<number, string[]>,
  preferredKeywords: string[],
  maxResults?: number
): NumberMatch[]
```

### 3. Enhanced Token Collection

Update `TokenCollection` interface to support efficient closest-match lookups:

```typescript
interface TokenCollection {
  // Existing
  tokens: Map<string, ResolvedToken>;
  byType: Map<TokenType, ResolvedToken[]>;
  colorValues: Map<string, string>;
  numberValues: Map<number, string[]>;

  // New: Pre-computed LAB values for colors
  colorLab: Map<string, LAB>;  // hex -> LAB

  // New: Sorted number values for binary search
  sortedNumberValues: Array<{ value: number; paths: string[] }>;
}
```

### 4. Updated Lint Violation

Enhance the suggestion system to include confidence and alternatives:

```typescript
interface LintViolation {
  // Existing fields...

  // Enhanced suggestion
  suggestedToken?: string;
  suggestionConfidence?: 'exact' | 'close' | 'approximate';
  alternativeTokens?: Array<{
    path: string;
    value: string | number;
    distance: number;  // ΔE for colors, px difference for numbers
  }>;
}
```

### 5. UI Enhancements

Update the violation display to show:
- **Exact match**: "Use `brand.brand-300`" (green checkmark)
- **Close match**: "Closest token: `brand.brand-300` (ΔE: 2.1)" (yellow indicator)
- **Multiple options**: Expandable list of alternative tokens

---

## Files to Create/Modify

| File | Action | Description |
|------|--------|-------------|
| `src/shared/color-distance.ts` | Create | LAB conversion and Delta E calculation |
| `src/shared/number-matching.ts` | Create | Number proximity matching utilities |
| `src/shared/types.ts` | Modify | Add LAB, ColorMatch, NumberMatch types |
| `src/shared/token-parser.ts` | Modify | Pre-compute LAB values during parsing |
| `src/plugin/rules/no-hardcoded-colors.ts` | Modify | Use closest color matching |
| `src/plugin/rules/no-hardcoded-spacing.ts` | Modify | Use closest number matching |
| `src/plugin/rules/no-hardcoded-radii.ts` | Modify | Use closest number matching |
| `src/ui/components/ResultItem.tsx` | Modify | Display confidence and alternatives |
| `src/ui/styles/main.css` | Modify | Styles for confidence indicators |
| `test/color-distance.test.ts` | Create | Unit tests for color matching |
| `test/number-matching.test.ts` | Create | Unit tests for number matching |

---

## Configuration Options

Add new lint config options:

```typescript
interface LintConfig {
  rules: Record<LintRuleId, RuleConfig>;
  skipHiddenLayers: boolean;
  skipLockedLayers: boolean;

  // New options
  closestMatch: {
    enabled: boolean;
    colorThreshold: number;   // Max ΔE (default: 5.0)
    numberTolerance: number;  // Percentage (default: 0.1 = 10%)
    maxAlternatives: number;  // Max suggestions to show (default: 3)
  };
}
```

---

## Implementation Order

1. **Phase 1: Color Distance Utilities**
   - Create `color-distance.ts` with hex→LAB conversion
   - Implement Delta E (CIE2000) calculation
   - Write unit tests

2. **Phase 2: Number Matching Utilities**
   - Create `number-matching.ts`
   - Implement tolerance-based matching
   - Write unit tests

3. **Phase 3: Token Parser Enhancement**
   - Pre-compute LAB values during token parsing
   - Add sorted number index for efficient lookup

4. **Phase 4: Rule Updates**
   - Update `no-hardcoded-colors` to use closest matching
   - Update `no-hardcoded-spacing` and `no-hardcoded-radii`
   - Add confidence levels to violations

5. **Phase 5: UI Updates**
   - Display match confidence
   - Show alternative token suggestions
   - Add visual indicators (exact/close/approximate)

---

## Example Output

### Before (Exact Match Only)
```
❌ Hardcoded color #f96302 - should use a design token
   (No suggestion - no exact match found)
```

### After (Closest Match)
```
❌ Hardcoded color #f96302 - should use a design token
   Closest match: brand.brand-300 (#f96300) - ΔE: 0.8 (visually identical)
   Alternatives:
   - brand.brand-400 (#e85a00) - ΔE: 12.3
```

---

## Performance Considerations

1. **Pre-compute LAB values** during token loading (one-time cost)
2. **Binary search** for number matching on sorted values
3. **Limit comparisons** - only compare against tokens of the same type
4. **Cache results** - memoize Delta E calculations for repeated colors

Estimated performance impact: Minimal (<50ms for typical token sets of 100-500 colors)
