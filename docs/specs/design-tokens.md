# Design Tokens

The Lint Roller plugin UI uses a comprehensive set of CSS custom properties as its internal design token system. These tokens are defined in `src/ui/styles/main.css`.

---

## Color Tokens

### Background

| Token | Value | Usage |
|-------|-------|-------|
| `--figma-color-bg` | `#f5f5f5` | Primary background |
| `--figma-color-bg-secondary` | `#ffffff` | Card and panel backgrounds |
| `--figma-color-bg-success` | `#ecfdf5` | Success state backgrounds |
| `--figma-color-bg-warning` | `#fffbeb` | Warning state backgrounds |
| `--figma-color-bg-danger` | `#fdf2f2` | Error state backgrounds |
| `--figma-color-bg-brand` | `#18a0fb` | Brand accent backgrounds |

### Text

| Token | Value | Usage |
|-------|-------|-------|
| `--figma-color-text` | `#333333` | Primary text |
| `--figma-color-text-secondary` | `#666666` | Secondary/muted text |
| `--figma-color-text-tertiary` | `#999999` | Tertiary/disabled text |
| `--figma-color-text-success` | `#10b981` | Success text |
| `--figma-color-text-warning` | `#f59e0b` | Warning text |
| `--figma-color-text-danger` | `#dc3545` | Error/danger text |

### Border

| Token | Value | Usage |
|-------|-------|-------|
| `--figma-color-border` | `#e5e5e5` | Default borders |

### Icon

| Token | Value | Usage |
|-------|-------|-------|
| `--figma-color-icon` | `#333333` | Default icon color |

### Severity

| Token | Value | Usage |
|-------|-------|-------|
| `--color-error` | `#dc3545` | Error indicators |
| `--color-error-bg` | `#fdf2f2` | Error backgrounds |
| `--color-warning` | `#f59e0b` | Warning indicators |
| `--color-warning-bg` | `#fffbeb` | Warning backgrounds |
| `--color-info` | `#3b82f6` | Info indicators |
| `--color-info-bg` | `#eff6ff` | Info backgrounds |
| `--color-success` | `#10b981` | Success indicators |
| `--color-success-bg` | `#ecfdf5` | Success backgrounds |

---

## Spacing Tokens

| Token | Value | Usage |
|-------|-------|-------|
| `--space-xs` | `4px` | Tight spacing (inline elements, icon gaps) |
| `--space-sm` | `8px` | Small spacing (compact lists, padding) |
| `--space-md` | `12px` | Medium spacing (default padding) |
| `--space-lg` | `16px` | Large spacing (section padding) |
| `--space-xl` | `24px` | Extra large spacing (section gaps) |

---

## Typography Tokens

| Token | Value | Usage |
|-------|-------|-------|
| `--font-size-xs` | `10px` | Micro labels, badges |
| `--font-size-sm` | `11px` | Secondary text, captions |
| `--font-size-md` | `12px` | Body text (default) |
| `--font-size-lg` | `14px` | Headings, emphasis |

---

## Border Radius Tokens

| Token | Value | Usage |
|-------|-------|-------|
| `--radius-sm` | `4px` | Buttons, inputs, small cards |
| `--radius-md` | `6px` | Cards, panels |
| `--radius-lg` | `8px` | Modals, large containers |

---

## Token Architecture Notes

- All tokens follow a **flat namespace** with category prefixes (`--figma-color-*`, `--space-*`, `--font-size-*`, `--radius-*`)
- Severity tokens (`--color-error`, `--color-warning`, etc.) are used consistently across summary cards, result items, and status indicators
- The token system is designed to align with Figma's native plugin UI conventions while supporting the plugin's custom components
- Tokens are defined at the `:root` level and consumed throughout all UI components
