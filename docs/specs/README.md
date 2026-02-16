# Lint Roller -- Product Spec

> A Figma plugin that checks designs against style guidelines and best practices.

---

## Spec Documents

| Document | Description |
|----------|-------------|
| [Vision Statement](vision.md) | Product vision, guiding principles, and success metrics |
| [User Personas](personas.md) | Target users, their goals, workflows, and key needs |
| [Core Features](features.md) | Complete feature inventory with lint rules, matching, auto-fix, sync, and reporting |
| [Data Models](data-models.md) | Token, lint, sync, and communication data structures |
| [Design Tokens](design-tokens.md) | CSS custom property system used by the plugin UI |
| [Screen Inventory](screens.md) | All views, states, components, and shared UI patterns |

---

## Architecture Overview

```
┌──────────────────────────────────────────────┐
│            FIGMA PLUGIN SANDBOX               │
│  Figma API access | No DOM | ES2017          │
│                                              │
│  Scanner -> Inspector -> Rules -> Fixer      │
│  Token Sync Engine                           │
└──────────────────┬───────────────────────────┘
                   │ postMessage
┌──────────────────┴───────────────────────────┐
│               UI IFRAME                       │
│  Preact | Full DOM | No Figma API            │
│                                              │
│  Sync Tab | Lint Tab | Config Tab            │
│  Token Loader | Activity Log                 │
└──────────────────┬───────────────────────────┘
                   │ imports
┌──────────────────┴───────────────────────────┐
│            SHARED MODULES                     │
│  Types | Messages | Token Parser             │
│  Color Distance | Number Matching | Paths    │
└──────────────────────────────────────────────┘
```

## Key Numbers

- **9** lint rules
- **3** scan scopes (selection, page, document)
- **6** fix actions (fix, rebind, unbind, detach, apply style, ignore)
- **3** confidence levels (exact, close, approximate)
- **2** token sources (local bundled, remote GitHub Pages)
- **3** sync operations (create, update, delete)

---

Generated from the Lint Roller codebase on 2026-02-15.
