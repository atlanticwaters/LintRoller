# Screen Inventory

## Application Shell

The plugin UI is organized as a single-window application with three tab views. The shell provides persistent navigation across all screens.

### Header Bar
- Plugin title ("Lint Roller")
- Tab navigation: **Sync** | **Lint** | **Config**
- Contextual controls (scope selector, scan button, export menu) visible on the Lint tab

---

## Screen 1: Sync Tab

**Purpose:** Synchronize DTCG token files into Figma variables.

### States

| State | Description |
|-------|-------------|
| **Idle** | Displays current sync status (token count, variable count, collections, modes) |
| **Diffing** | Shows preview of changes to be applied (creates, updates, deletes) |
| **Syncing** | Progress bar with phase indicators (analyzing, creating, updating, deleting) |
| **Complete** | Summary of sync results |

### Components

- **Sync Status Dashboard** -- Token count, variable count, collection count, mode count
- **Sync Options** -- Checkboxes for create new, update existing, delete orphans
- **Diff Analyzer** -- Table of pending changes with before/after values
- **Progress Tracker** -- Phase-based progress bar with real-time updates
- **Collection Manager** -- Organize tokens into core/semantic/component collections

---

## Screen 2: Lint Tab

**Purpose:** Scan designs and surface violations with fix actions.

### Sub-Views

#### 2a. Pre-Scan (Empty State)

- Token source selector (local / remote toggle)
- Token count display
- Scope selector dropdown (Selection, Current Page, Full Document)
- Scan button (primary CTA)
- Prompt text encouraging the user to start a scan

#### 2b. Scanning (Progress State)

- Progress bar with node count
- Real-time status text

#### 2c. Results (Post-Scan)

**Summary Cards Row:**
- Total issues (with resolved count)
- Errors count
- Warnings count
- Nodes scanned

**Fix Status Bar:**
- Fixed / Fixable / Manual segment bar
- Path mismatch count
- "Fix All" button
- "Auto-Fix Path Mismatches" button
- Activity log toggle

**Results List:**
- Group-by toggle: Rule | Node
- Collapsible rule/node groups with counts
- Individual violation cards (see Result Item below)

**Result Item Card:**
- Severity badge (color-coded: red/amber/blue)
- Node name and type
- Layer path breadcrumb
- Violation message
- Current value display (with color swatch for colors)
- Suggested token path with confidence badge (Exact / Close / Approximate)
- Suggested value display (with color swatch for colors)
- Alternative suggestions (expandable)
- Action buttons: Fix | Rebind | Unbind | Detach | Apply Style | Ignore
- Status badge: Fixed | Ignored | Path Mismatch

#### 2d. Activity Log (Overlay Panel)

- Slides in from the right
- Chronological list of fix actions
- Each entry shows: action type, node name, before value, after value, timestamp, status (success/failed)
- Scrollable with auto-scroll to latest entry

---

## Screen 3: Config Tab

**Purpose:** Configure lint rules and scan behavior.

### Sections

#### Rule Configuration

For each of the 9 rules:
- Rule name and description
- Enable/disable toggle
- Severity selector (Error / Warning / Info dropdown)

#### Scan Options

- Skip hidden layers (toggle)
- Skip locked layers (toggle)

---

## Shared UI Patterns

### Token Source Selector
- Appears on the Lint tab header
- Toggle between "Local" (bundled) and "Remote" (GitHub Pages)
- Shows token count badge
- Loading spinner during fetch

### Scope Selector
- Dropdown with three options: Selection, Current Page, Full Document
- Visible in the Lint tab header

### Export Menu
- Dropdown triggered from header
- Options: Export JSON, Export CSV
- Exports current scan results

### Color Swatch
- Small square preview of a hex color
- Used inline in violation cards to show current and suggested colors
- Includes hex label

### Confidence Badge
- Pill-shaped label: "Exact" (green), "Close" (blue), "Approximate" (amber)
- Displayed next to suggested token paths

### Severity Indicator
- Color-coded dot or badge
- Error = red, Warning = amber, Info = blue
- Used in result items and summary cards

---

## Responsive Behavior

The plugin runs in a Figma iframe with a fixed width (~340px) and variable height. All screens are designed as single-column layouts that scroll vertically. No breakpoint-based responsive behavior is needed.
