# Core Features

## 1. Design Linting Engine

The heart of Lint Roller. Scans Figma documents and evaluates nodes against a configurable set of lint rules.

### 1.1 Lint Rules

| Rule ID | Severity | Description | Auto-Fix |
|---------|----------|-------------|----------|
| `no-hardcoded-colors` | Error | Flags fills and strokes using literal color values instead of bound variables | Bind to closest matching color token |
| `no-hardcoded-typography` | Warning | Flags text nodes with unbound font properties (fontSize, lineHeight, letterSpacing, paragraphSpacing) | Partial -- paragraphSpacing only; suggests text styles for others |
| `no-hardcoded-spacing` | Warning | Flags auto-layout frames with hardcoded gap and padding values | Bind to closest matching spacing token |
| `no-hardcoded-radii` | Warning | Flags nodes with hardcoded corner radius values | Bind to closest matching radius token |
| `no-hardcoded-stroke-weight` | Warning | Flags nodes with hardcoded border width values | Bind to closest matching stroke weight token |
| `no-hardcoded-sizing` | Warning | Flags nodes with hardcoded width/height values | Bind to closest matching size token |
| `no-orphaned-variables` | Error | Flags nodes bound to deleted or out-of-set variables | Rebind to suggested token OR unbind |
| `no-unknown-styles` | Warning | Flags nodes using local Figma styles that don't correspond to tokens | Suggest closest token OR detach style |
| `prefer-semantic-variables` | Info | Flags nodes bound to core variables when semantic alternatives exist | Suggests semantic alternative |

### 1.2 Scan Scopes

- **Selection** -- Lint only the currently selected nodes
- **Current Page** -- Lint all nodes on the active page
- **Full Document** -- Lint every page in the file

### 1.3 Scan Options

- Skip hidden layers
- Skip locked layers

---

## 2. Intelligent Token Matching

### 2.1 Color Matching (Delta E 2000)

- Converts RGB to LAB color space via XYZ intermediary
- Computes perceptual distance using the CIE Delta E 2000 algorithm
- Returns matches ranked by distance with confidence levels:
  - **Exact** (distance = 0)
  - **Close** (distance < 2)
  - **Approximate** (distance 2-10)

### 2.2 Number Matching

- Exact numeric value comparison for spacing, radii, sizing, and stroke weight tokens
- Falls back to closest-value search when no exact match exists

### 2.3 Path Normalization

- Normalizes token paths for comparison across naming conventions
- Detects path mismatches where the value matches but the bound path differs from the expected token

---

## 3. Auto-Fix System

### 3.1 Value-First Fix Strategy

1. Read the current visual value of the property
2. Find all variables that resolve to the exact same value
3. Pick the best match using context and token path ranking
4. Bind the variable -- guaranteeing zero visual change

### 3.2 Fix Actions

| Action | Description |
|--------|-------------|
| **Fix** | Bind the suggested token variable to the property |
| **Rebind** | Replace an orphaned variable binding with a valid one |
| **Unbind** | Remove a variable binding entirely |
| **Detach** | Detach a Figma style from the node |
| **Apply Style** | Apply a suggested text style |
| **Ignore** | Suppress this violation persistently |

### 3.3 Bulk Operations

- **Fix All** -- Apply fixes to all auto-fixable violations
- **Auto-Fix Path Mismatches** -- Rebind variables where the value matches but the path is wrong

---

## 4. Token Source Management

### 4.1 Local Tokens

- Bundled DTCG-compliant JSON token set embedded in the plugin
- Serves as fallback when remote sources are unavailable

### 4.2 Remote Tokens

- Fetches tokens from a configurable GitHub Pages endpoint
- Displays loading state and token count on successful fetch
- Toggle between local and remote in the UI

### 4.3 Token Parsing

- Full DTCG (Design Token Community Group) format support
- Alias resolution -- follows `{token.path}` references to resolved values
- Pre-computed indexes for fast lookup:
  - Color values (hex to token path)
  - Number values (numeric value to token paths)
  - LAB color space (pre-computed for Delta E matching)

---

## 5. Token-to-Variable Sync

### 5.1 Sync Operations

- **Create** new Figma variables from tokens that don't yet exist
- **Update** existing variables whose values have drifted from the token source
- **Delete** orphaned variables that no longer have a corresponding token

### 5.2 Diff Preview

- Preview all changes before committing the sync
- See counts of creates, updates, and deletes

### 5.3 Collection Management

- Organize tokens into Figma variable collections (core, semantic, component)
- Theme support with multiple modes per collection

### 5.4 Progress Tracking

- Phase-based progress display (analyzing, creating, updating, deleting)
- Real-time status updates during sync

---

## 6. Results & Reporting

### 6.1 Summary Dashboard

- Total issues (with resolved count)
- Error count
- Warning count
- Nodes scanned

### 6.2 Result Grouping

- Group by **Rule** -- see all violations of a specific rule together
- Group by **Node** -- see all violations on a specific node together

### 6.3 Export

- **JSON** -- Machine-readable export for tooling integration
- **CSV** -- Spreadsheet-friendly export for reporting

### 6.4 Activity Log

- Detailed history of every fix action taken
- Before/after values for each fix
- Success/failure status indicators
- Timestamps for audit trail

---

## 7. Configuration

### 7.1 Rule Configuration

- Enable or disable individual rules
- Set severity level per rule (error, warning, info)

### 7.2 Persistent Preferences

- Ignored violations persist across sessions
- Scan scope and configuration preferences saved
- Token source selection remembered
