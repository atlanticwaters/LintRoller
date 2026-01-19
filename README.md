# Lint Roller

> A Figma plugin that lints design token usage against Tokens Studio DTCG exports

Lint Roller helps design teams maintain consistency by scanning Figma documents for hardcoded values and suggesting the correct design tokens to use instead. It integrates with your existing Tokens Studio workflow by pulling token definitions directly from your GitHub Pages deployment.

---

## Table of Contents

- [Features](#features)
- [How It Works](#how-it-works)
- [Token Source Configuration](#token-source-configuration)
- [Lint Rules](#lint-rules)
- [Auto-Fix Capabilities](#auto-fix-capabilities)
- [Installation](#installation)
- [Development](#development)
- [Architecture](#architecture)

---

## Features

### Core Linting
- **6 Built-in Rules** - Comprehensive coverage for colors, typography, spacing, radii, variables, and styles
- **Smart Token Matching** - Uses Delta E (CIE2000) color distance algorithm for perceptually accurate color suggestions
- **Confidence Indicators** - Shows match quality (Exact, Close, Approximate) so you know how good each suggestion is
- **Alternative Suggestions** - Displays multiple token options when available

### Auto-Fix
- **One-Click Fixes** - Bind hardcoded values to the suggested token with a single click
- **Bulk Fix** - Fix all issues in a group or the entire document at once
- **Rebind Orphans** - Replace orphaned variable bindings with valid tokens
- **Detach Styles** - Remove unknown style bindings while preserving appearance

### User Experience
- **Scan Scopes** - Lint the current selection, current page, or entire document
- **Group by Rule or Node** - View results organized by violation type or by layer
- **Fix Status Bar** - Track progress with Fixed/Fixable/Manual counts
- **Export Results** - Download lint results as JSON or CSV for reporting

---

## How It Works

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  GitHub Pages   │────>│   Lint Roller     │────>│  Figma Document │
│  (Token Source) │     │   (This Plugin)  │     │  (Your Design)  │
└─────────────────┘     └──────────────────┘     └─────────────────┘
        │                        │                        │
        │  1. Fetches DTCG       │  2. Scans nodes        │
        │     token files        │     for violations     │
        │                        │                        │
        │  Tokens are loaded     │  3. Suggests fixes     │
        │  on plugin startup     │     based on tokens    │
        │                        │                        │
        └────────────────────────┴────────────────────────┘
```

### Workflow

1. **Plugin Loads** - On startup, Lint Roller fetches your token files from GitHub Pages
2. **User Scans** - Click "Scan" to analyze selected nodes, the current page, or full document
3. **Results Display** - Violations are grouped and shown with suggested token replacements
4. **Apply Fixes** - Use "Fix", "Rebind", "Unbind", or "Detach" buttons to resolve issues
5. **Re-scan** - After bulk operations, the plugin automatically re-scans to show updated results

---

## Token Source Configuration

### Important: GitHub Pages Integration

**This plugin is specifically configured to pull tokens from our GitHub Pages instance.**

The token source is defined in [`src/plugin/tokens-data.ts`](src/plugin/tokens-data.ts):

```typescript
// ============================================================================
// TOKEN SOURCE CONFIGURATION
// ============================================================================
//
// This plugin fetches design tokens from a GitHub Pages deployment.
// The tokens are expected to be in Tokens Studio DTCG format.
//
// To change the token source, update the BASE_URL below to point to your
// GitHub Pages URL where your exported tokens are hosted.
//
// Expected file structure at the BASE_URL:
//   /tokens/$metadata.json     - Token set ordering metadata
//   /tokens/$themes.json       - Theme configurations
//   /tokens/<SetName>.json     - Individual token set files (e.g., Color/Brand.json)
//
// ============================================================================

const BASE_URL = 'https://your-org.github.io/your-tokens-repo';
```

### Expected Token File Structure

Your GitHub Pages deployment should serve the following files:

```
https://your-org.github.io/your-tokens-repo/
├── tokens/
│   ├── $metadata.json          # Lists token sets in order
│   ├── $themes.json            # Theme configurations with mode mappings
│   ├── Color/
│   │   ├── Brand.json          # Brand color tokens
│   │   ├── Semantic.json       # Semantic color tokens
│   │   └── ...
│   ├── Spacing/
│   │   └── Default.json        # Spacing tokens
│   ├── Typography/
│   │   └── Default.json        # Typography tokens
│   └── ...
```

### Token Format (DTCG)

Tokens should follow the [Design Token Community Group (DTCG)](https://tr.designtokens.org/format/) specification:

```json
{
  "brand": {
    "primary": {
      "$value": "#0066CC",
      "$type": "color",
      "$description": "Primary brand color"
    },
    "secondary": {
      "$value": "{brand.primary}",
      "$type": "color",
      "$description": "References primary (alias)"
    }
  }
}
```

Supported token types:
- `color` - Hex colors (#RRGGBB or #RRGGBBAA)
- `dimension` - Pixel values (e.g., "16px")
- `number` - Numeric values
- `shadow` - Box shadow definitions
- `typography` - Font definitions

---

## Lint Rules

### 1. No Hardcoded Colors
**ID:** `no-hardcoded-colors`
**Default Severity:** Error

Flags fills and strokes using literal color values instead of bound variables.

```
Before: Rectangle with fill #0066CC (hardcoded)
After:  Rectangle with fill bound to "brand/primary" variable
```

**Auto-fix:** Suggests the closest matching color token using Delta E 2000 perceptual color distance.

---

### 2. No Hardcoded Typography
**ID:** `no-hardcoded-typography`
**Default Severity:** Warning

Flags text nodes with unbound font properties (fontSize, lineHeight, letterSpacing, paragraphSpacing).

**Auto-fix:** Limited - only `paragraphSpacing` can be bound to variables via the Figma API. Other properties require text styles.

---

### 3. No Hardcoded Spacing
**ID:** `no-hardcoded-spacing`
**Default Severity:** Warning

Flags auto-layout frames with hardcoded gap and padding values.

Inspected properties:
- `itemSpacing` (gap)
- `counterAxisSpacing` (wrap gap)
- `paddingTop`, `paddingRight`, `paddingBottom`, `paddingLeft`

**Auto-fix:** Binds the property to the closest matching spacing token.

---

### 4. No Hardcoded Radii
**ID:** `no-hardcoded-radii`
**Default Severity:** Warning

Flags nodes with hardcoded corner radius values.

Inspected properties:
- `cornerRadius` (uniform)
- `topLeftRadius`, `topRightRadius`, `bottomLeftRadius`, `bottomRightRadius` (individual)

**Auto-fix:** Binds to the closest matching radius token. For uniform radius, binds all four corners.

---

### 5. No Orphaned Variables
**ID:** `no-orphaned-variables`
**Default Severity:** Error

Flags nodes bound to variables that either:
1. **No longer exist** in the document (deleted variables)
2. **Exist but aren't in the token set** (manually created or renamed)

**Auto-fix options:**
- **Rebind** - Replace with a suggested token based on the current resolved value
- **Unbind** - Remove the variable binding, keeping the current appearance

---

### 6. No Unknown Styles
**ID:** `no-unknown-styles`
**Default Severity:** Warning

Flags nodes using local Figma styles that don't correspond to tokens in the set.

Inspected style types:
- Fill styles
- Stroke styles
- Text styles
- Effect styles

**Auto-fix options:**
- **Fix** - For color styles, suggests and applies the closest matching color token
- **Detach** - Removes the style binding while preserving the visual appearance

---

## Auto-Fix Capabilities

### Fix Actions by Rule

| Rule | Fix | Rebind | Unbind | Detach |
|------|-----|--------|--------|--------|
| Hardcoded Colors | Yes | - | - | - |
| Hardcoded Typography | Partial* | - | - | - |
| Hardcoded Spacing | Yes | - | - | - |
| Hardcoded Radii | Yes | - | - | - |
| Orphaned Variables | - | Yes | Yes | - |
| Unknown Styles | Yes** | - | - | Yes |

*Only `paragraphSpacing` can be bound; other typography properties require text styles
**Only for fill/stroke styles with color suggestions

### Match Confidence Levels

When suggesting tokens, Lint Roller indicates how close the match is:

| Level | Description | Color Delta E |
|-------|-------------|---------------|
| **Exact** | Perfect match | 0 |
| **Close** | Visually identical | < 2 |
| **Approximate** | Noticeable but similar | 2 - 10 |

Values with Delta E > 10 are considered too different and won't be suggested.

---

## Installation

### For Users

1. Open Figma and go to **Plugins > Development > Import plugin from manifest**
2. Select the `manifest.json` file from this repository
3. The plugin will appear in your Development plugins

### For Developers

See [Development](#development) section below.

---

## Development

### Prerequisites

- Node.js 18+
- npm or yarn

### Setup

```bash
# Clone the repository
git clone https://github.com/your-org/Lint Roller.git
cd Lint Roller

# Install dependencies
npm install

# Build the plugin
npm run build

# Watch for changes during development
npm run dev
```

### Scripts

| Command | Description |
|---------|-------------|
| `npm run build` | Build plugin and UI for production |
| `npm run dev` | Watch mode for development |
| `npm run typecheck` | Run TypeScript type checking |
| `npm test` | Run unit tests |

### Project Structure

```
Lint Roller/
├── src/
│   ├── plugin/                 # Figma plugin sandbox code
│   │   ├── main.ts             # Plugin entry point, message handling
│   │   ├── scanner.ts          # Node traversal and gathering
│   │   ├── inspector.ts        # Property inspection (fills, strokes, etc.)
│   │   ├── fixer.ts            # Auto-fix implementations
│   │   ├── variables.ts        # Figma variable utilities
│   │   ├── tokens-data.ts      # GitHub Pages token fetching
│   │   └── rules/              # Lint rule implementations
│   │       ├── base.ts         # Base rule class
│   │       ├── index.ts        # Rule registry
│   │       ├── no-hardcoded-colors.ts
│   │       ├── no-hardcoded-typography.ts
│   │       ├── no-hardcoded-spacing.ts
│   │       ├── no-hardcoded-radii.ts
│   │       ├── no-orphaned-variables.ts
│   │       └── no-unknown-styles.ts
│   │
│   ├── ui/                     # Preact UI code
│   │   ├── App.tsx             # Main application component
│   │   ├── index.tsx           # UI entry point
│   │   ├── components/         # UI components
│   │   │   ├── Header.tsx
│   │   │   ├── Summary.tsx
│   │   │   ├── ProgressBar.tsx
│   │   │   ├── FixStatusBar.tsx
│   │   │   ├── ResultsList.tsx
│   │   │   ├── ResultItem.tsx
│   │   │   └── ConfigPanel.tsx
│   │   └── styles/
│   │       └── main.css        # Light mode styles
│   │
│   └── shared/                 # Shared between plugin and UI
│       ├── types.ts            # TypeScript interfaces
│       ├── messages.ts         # Plugin <-> UI message types
│       ├── token-parser.ts     # DTCG token parsing and resolution
│       ├── color-distance.ts   # Delta E 2000 implementation
│       └── number-matching.ts  # Number token matching
│
├── dist/                       # Build output
├── test/                       # Unit tests
├── manifest.json               # Figma plugin manifest
├── esbuild.config.js           # Build configuration
└── tsconfig.json               # TypeScript configuration
```

---

## Architecture

### Plugin Sandbox vs UI

Figma plugins run in two separate contexts:

1. **Plugin Sandbox** (`src/plugin/`) - Has access to the Figma document API but runs in a restricted JavaScript environment (ES2017, no DOM)

2. **UI Iframe** (`src/ui/`) - Standard browser environment with full DOM access but no direct Figma API access

Communication happens via `postMessage`:

```typescript
// UI -> Plugin
parent.postMessage({ pluginMessage: { type: 'START_SCAN', ... } }, '*');

// Plugin -> UI
figma.ui.postMessage({ type: 'SCAN_COMPLETE', results: ... });
```

### Token Resolution

The token parser handles DTCG alias resolution:

```typescript
// Input token with alias
{ "$value": "{brand.primary}", "$type": "color" }

// Resolved output
{
  path: "semantic.link",
  rawValue: "{brand.primary}",
  resolvedValue: "#0066CC",  // Actual color after following the reference
  type: "color",
  isAlias: true,
  aliasPath: "brand.primary"
}
```

### Color Matching Algorithm

Lint Roller uses the CIE Delta E 2000 formula for perceptually accurate color matching:

1. Convert hex colors to LAB color space
2. Calculate Delta E between target and each token color
3. Sort by Delta E (lower = closer match)
4. Filter out matches with Delta E > 10

This ensures suggestions are visually similar, not just numerically close in RGB space.

---

## License

MIT

---

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## Support

For issues and feature requests, please use the [GitHub Issues](https://github.com/your-org/Lint Roller/issues) page.
