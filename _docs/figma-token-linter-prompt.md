# Figma Design Token Linter Plugin

## Project Overview

Build a Figma plugin that lints design token usage across a Figma document by comparing applied variables and styles against a Tokens Studio export following the DTCG (Design Token Community Group) specification. The plugin should identify:

1. **Unbound values** — Nodes with hardcoded values not tied to any Figma variable
2. **Orphaned bindings** — Nodes bound to variables/styles that don't exist in our token set
3. **Token coverage gaps** — Variables in the Figma document that have no corresponding token definition

---

## Token Source

Tokens are stored locally in the `tokens` folder following Tokens Studio's DTCG-compliant JSON structure. The tokens may be:

- A single `tokens.json` file
- Multiple files with `$themes.json` and `$metadata.json` for multi-file setups
- Nested token groups using the `$value`, `$type`, and `$description` DTCG properties

---

## Technical Requirements

### 1. Figma Plugin Architecture

Set up the plugin following current best practices:

- Use the **manifest.json v3** format with appropriate permissions (`currentuser`, `activeusers` if needed)
- Implement a **UI thread** (iframe with your interface) and **sandbox thread** (plugin code with Figma API access) separation
- Use `figma.ui.postMessage()` and `figma.ui.onmessage` for communication between threads
- Consider using a build system (esbuild or Vite) for TypeScript compilation and bundling
- Structure the codebase with clear separation:

```
/src
  /plugin      # Sandbox code (Figma API access)
  /ui          # UI code (React, Svelte, or vanilla)
  /shared      # Types and utilities shared between both
/tokens        # Local token files from Tokens Studio
```

### 2. Token Parsing

Create a robust token parser that:

- Reads DTCG-formatted JSON from the `/tokens` folder
- Handles token references/aliases (`{color.primary.500}` syntax)
- Resolves the full token tree including nested groups
- Builds a lookup map of all valid token paths
- Extracts token metadata (`$type`, `$description`, `$extensions`)
- Supports both single-file and multi-file Tokens Studio exports

### 3. Figma Document Scanning

Implement a node traversal system that:

- Recursively walks all nodes in the current page (or full document based on user selection)
- Inspects relevant properties based on node type:
  - **Fills and strokes** — Check `boundVariables` for `fills`, `strokes`
  - **Typography** — Check font family, size, weight, line height, letter spacing bindings
  - **Spacing/sizing** — Check width, height, padding, gap, border radius
  - **Effects** — Check shadows, blurs for variable bindings
- Uses `node.boundVariables` to detect what's bound vs hardcoded
- Handles component instances and their overrides appropriately
- Respects locked layers and hidden layers (configurable)

### 4. Variable Collection Analysis

Query the document's variable collections:

- Use `figma.variables.getLocalVariables()` to get all document variables
- Use `figma.variables.getLocalVariableCollections()` for collection metadata
- Map Figma variable names/paths to token paths for comparison
- Account for mode variations in variable collections

### 5. Linting Rules

Implement these core linting checks:

| Rule | Description |
|------|-------------|
| `no-hardcoded-colors` | Flag any fill or stroke using a solid color not bound to a variable |
| `no-hardcoded-typography` | Flag text nodes with unbound font properties |
| `no-hardcoded-spacing` | Flag auto-layout frames with hardcoded gap, padding values |
| `no-hardcoded-radii` | Flag nodes with hardcoded corner radius values |
| `no-orphaned-variables` | Flag nodes bound to variables that don't exist in the token set |
| `no-unknown-styles` | Flag nodes using local styles that don't correspond to tokens |

Make rules configurable (enable/disable, warning vs error severity).

### 6. Results UI

Build a clear, actionable results interface:

- Group results by rule type or by node (user toggle)
- Show severity indicators (error, warning, info)
- Display the node name, type, and layer path for each issue
- Include a "Select in Figma" action that uses `figma.currentPage.selection = [node]` and `figma.viewport.scrollAndZoomIntoView([node])`
- Show summary statistics (total issues, by category, % coverage)
- Allow exporting results as JSON or CSV for reporting
- Include a "Rescan" action and optional auto-scan on document changes

### 7. Performance Considerations

- Implement chunked processing with `setTimeout` or async iteration to avoid blocking
- Add progress indication for large documents
- Cache token parsing results (only re-parse when token files change)
- Consider limiting scope options (current page, selection only, full document)
- Use `skipInvisibleInstanceChildren` when traversing for performance

---

## Testing Strategy

### Unit Tests

- Token parser handles valid DTCG JSON
- Token parser handles aliases and resolves references
- Token parser handles malformed input gracefully
- Lint rules correctly identify violations
- Lint rules correctly pass valid bindings

### Integration Tests

- Create test Figma files with known violations
- Verify scanner finds all expected issues
- Verify "Select in Figma" navigation works
- Test with large documents (1000+ nodes) for performance

### Manual Testing

- Test in Figma desktop app via Developer > Import plugin from manifest
- Test with your actual Tokens Studio export
- Verify results match expected token coverage

---

## Development Workflow

1. **Start with the token parser** — Get DTCG parsing working standalone with unit tests
2. **Build the Figma scanner** — Create the node traversal and property inspection logic
3. **Implement comparison logic** — Connect parsed tokens to scanned bindings
4. **Create minimal UI** — Start with a simple results list before adding polish
5. **Add configuration** — Rule toggles, scope selection, severity levels
6. **Optimize performance** — Profile with large documents, add chunking
7. **Polish UI** — Better grouping, filtering, export functionality

---

## File Structure to Create

```
figma-token-linter/
├── manifest.json
├── package.json
├── tsconfig.json
├── esbuild.config.js (or vite.config.ts)
├── tokens/                    # Token source files go here
│   └── tokens.json
├── src/
│   ├── plugin/
│   │   ├── main.ts           # Plugin entry point
│   │   ├── scanner.ts        # Node traversal logic
│   │   ├── rules/            # Individual lint rules
│   │   │   ├── index.ts
│   │   │   ├── no-hardcoded-colors.ts
│   │   │   ├── no-hardcoded-typography.ts
│   │   │   └── ...
│   │   └── variables.ts      # Variable collection queries
│   ├── ui/
│   │   ├── index.html
│   │   ├── main.tsx          # UI entry point
│   │   ├── components/
│   │   │   ├── ResultsList.tsx
│   │   │   ├── SummaryCard.tsx
│   │   │   └── RuleConfig.tsx
│   │   └── styles.css
│   └── shared/
│       ├── types.ts          # Shared TypeScript types
│       ├── token-parser.ts   # DTCG token parsing
│       └── messages.ts       # Message types for UI<->Plugin
├── test/
│   ├── token-parser.test.ts
│   ├── rules.test.ts
│   └── fixtures/
│       └── sample-tokens.json
└── README.md
```

---

## Key Figma API References

| API | Purpose |
|-----|---------|
| `figma.variables.getLocalVariables()` | All variables in document |
| `figma.variables.getVariableById(id)` | Get variable by ID |
| `node.boundVariables` | Object containing variable bindings per property |
| `figma.currentPage.selection` | Set to navigate user to nodes |
| `figma.viewport.scrollAndZoomIntoView([nodes])` | Focus viewport |
| `figma.loadFontAsync()` | Required before reading some text properties |

---

## DTCG Token Format Reference

### Basic Token Structure

```json
{
  "color": {
    "primary": {
      "500": {
        "$value": "#6366f1",
        "$type": "color",
        "$description": "Primary brand color"
      }
    }
  },
  "spacing": {
    "sm": {
      "$value": "8px",
      "$type": "dimension"
    }
  }
}
```

### Alias/Reference Syntax

Aliases use curly brace syntax to reference other tokens:

```json
{
  "color": {
    "button": {
      "background": {
        "$value": "{color.primary.500}",
        "$type": "color"
      }
    }
  }
}
```

---

## Success Criteria

- [ ] Plugin correctly parses Tokens Studio DTCG exports
- [ ] Scanner identifies all hardcoded values that should be tokenized
- [ ] Scanner identifies bindings to non-existent tokens
- [ ] UI clearly communicates issues and allows navigation to problem nodes
- [ ] Performance is acceptable for documents with 5000+ nodes
- [ ] Rules are configurable per project needs
