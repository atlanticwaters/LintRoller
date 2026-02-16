# Data Models

## Token Models

### TokenType

```
color | number | dimension | text | shadow | typography
```

Defines the category of a design token, mapping to the DTCG `$type` field.

### RawToken

| Field | Type | Description |
|-------|------|-------------|
| `$value` | `string \| number` | The raw token value (may be an alias reference) |
| `$type` | `TokenType` | The token type |
| `$description` | `string?` | Optional human-readable description |
| `$extensions` | `Record<string, unknown>?` | Optional DTCG extensions |

Represents a token as parsed directly from the DTCG JSON file, before alias resolution.

### ResolvedToken

| Field | Type | Description |
|-------|------|-------------|
| `path` | `string` | Dot-delimited token path (e.g., `brand.brand-300`) |
| `rawValue` | `string \| number` | Original value (may be alias like `{brand.brand-300}`) |
| `resolvedValue` | `string \| number` | Final resolved value after alias traversal |
| `type` | `TokenType` | The token type |
| `description` | `string?` | Optional description |
| `isAlias` | `boolean` | Whether the raw value is an alias reference |
| `aliasPath` | `string?` | The path this token aliases, if applicable |
| `sourceFile` | `string` | Which token file this came from |

Represents a fully resolved token with its final computed value.

### TokenCollection

| Field | Type | Description |
|-------|------|-------------|
| `tokens` | `Map<string, ResolvedToken>` | All tokens keyed by path |
| `byType` | `Map<TokenType, ResolvedToken[]>` | Tokens grouped by type |
| `colorValues` | `Map<string, string>` | Hex value to preferred token path |
| `allColorPaths` | `Map<string, string[]>` | Hex value to all matching token paths |
| `numberValues` | `Map<number, string[]>` | Numeric value to all matching token paths |
| `colorLab` | `Map<string, LAB>` | Pre-computed LAB colors for Delta E matching |

Pre-indexed collection for fast lookups during scanning.

---

## Lint Models

### LintRuleId

```
no-hardcoded-colors
no-hardcoded-typography
no-hardcoded-spacing
no-hardcoded-radii
no-hardcoded-stroke-weight
no-hardcoded-sizing
no-orphaned-variables
no-unknown-styles
prefer-semantic-variables
```

Enumeration of all available lint rules.

### Severity

```
error | warning | info
```

### MatchConfidence

```
exact | close | approximate
```

Indicates how closely a suggested token matches the current value.

### LintViolation

| Field | Type | Description |
|-------|------|-------------|
| `id` | `string` | Unique violation identifier |
| `ruleId` | `LintRuleId` | Which rule was violated |
| `severity` | `Severity` | Error, warning, or info |
| `nodeId` | `string` | Figma node ID |
| `nodeName` | `string` | Human-readable node name |
| `nodeType` | `string` | Figma node type (FRAME, TEXT, etc.) |
| `layerPath` | `string` | Full layer hierarchy path |
| `property` | `string` | The property that violates (e.g., `fill`, `cornerRadius`) |
| `currentValue` | `string \| number` | The current hardcoded value |
| `message` | `string` | Human-readable violation description |
| `suggestedToken` | `string?` | Recommended token path |
| `suggestionConfidence` | `MatchConfidence?` | How confident the suggestion is |
| `alternativeTokens` | `TokenSuggestion[]?` | Other possible token matches |
| `canUnbind` | `boolean?` | Whether unbinding is an available action |
| `canDetach` | `boolean?` | Whether style detachment is available |
| `isPathMismatch` | `boolean?` | Value matches but bound path differs |
| `normalizedMatchPath` | `string?` | Expected normalized path |
| `suggestedTextStyle` | `TextStyleSuggestion?` | Suggested Figma text style |
| `canApplyTextStyle` | `boolean?` | Whether text style can be applied |
| `canIgnore` | `boolean?` | Whether ignore is available |
| `currentHexColor` | `string?` | Current color as hex (for color violations) |
| `suggestedHexColor` | `string?` | Suggested token color as hex |

### TokenSuggestion

| Field | Type | Description |
|-------|------|-------------|
| `path` | `string` | Token path |
| `value` | `string \| number` | Resolved token value |
| `confidence` | `MatchConfidence` | Match confidence |
| `distance` | `number?` | Delta E distance (for colors) |

### LintResults

| Field | Type | Description |
|-------|------|-------------|
| `violations` | `LintViolation[]` | All detected violations |
| `summary` | `LintSummary` | Aggregate counts |
| `metadata` | `ScanMetadata` | Scan context info |

### LintSummary

| Field | Type | Description |
|-------|------|-------------|
| `totalViolations` | `number` | Total violation count |
| `errors` | `number` | Error-severity count |
| `warnings` | `number` | Warning-severity count |
| `infos` | `number` | Info-severity count |
| `nodesScanned` | `number` | Number of nodes inspected |

### LintConfig

| Field | Type | Description |
|-------|------|-------------|
| `rules` | `Record<LintRuleId, RuleConfig>` | Per-rule configuration |
| `skipHiddenLayers` | `boolean` | Whether to skip hidden layers |
| `skipLockedLayers` | `boolean` | Whether to skip locked layers |

### RuleConfig

| Field | Type | Description |
|-------|------|-------------|
| `enabled` | `boolean` | Whether the rule is active |
| `severity` | `Severity` | Override severity level |

---

## Sync Models

### ThemeConfig

| Field | Type | Description |
|-------|------|-------------|
| `id` | `string` | Theme identifier |
| `name` | `string` | Display name |
| `group` | `string?` | Optional grouping |
| `selectedTokenSets` | `Record<string, 'enabled' \| 'disabled' \| 'source'>` | Token set participation |
| `figmaVariableReferences` | `Record<string, string>?` | Token path to Figma variable ID mapping |
| `figmaCollectionId` | `string?` | Associated Figma variable collection |
| `figmaModeId` | `string?` | Associated mode within the collection |

---

## Communication Models

### Message Direction

```
UI -> Plugin:  START_SCAN, APPLY_FIX, UNBIND_VARIABLE, DETACH_STYLE, START_SYNC, ...
Plugin -> UI:  SCAN_COMPLETE, FIX_APPLIED, TOKENS_LOADED, SYNC_STATUS, ...
```

All communication between the plugin sandbox and the UI iframe occurs via `postMessage`. Each message includes a `type` discriminator and a typed payload.

### TokenSource

```
local | remote
```

### ScanScope

| Field | Type | Description |
|-------|------|-------------|
| `type` | `'selection' \| 'current_page' \| 'full_document'` | What to scan |
