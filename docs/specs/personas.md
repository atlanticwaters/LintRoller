# User Personas

## 1. Sam -- Design System Lead

| Attribute | Detail |
|-----------|--------|
| **Role** | Design System Lead / Design Ops |
| **Team size** | Maintains tokens for 5-15 product designers |
| **Experience** | 5+ years in design, deep Figma knowledge |
| **Goals** | Ensure token adoption, measure design system health, reduce drift |
| **Frustrations** | No visibility into whether designers actually use the tokens; manual audits don't scale |

### How Sam Uses Lint Roller

- Runs **full-document scans** on key product files weekly
- Reviews the **summary dashboard** to track adoption metrics over time
- Uses **export (CSV/JSON)** to feed data into design system health reports
- Configures **rule severity** to match team maturity (warnings for new teams, errors for mature ones)
- Leverages **token sync** to push updated tokens into Figma variables across collections

### Key Needs

- Aggregate violation counts across scopes
- Export capabilities for reporting
- Rule configuration to match team conventions
- Sync workflow to keep Figma variables aligned with the token source

---

## 2. Priya -- Product Designer

| Attribute | Detail |
|-----------|--------|
| **Role** | Product Designer |
| **Team size** | Works within a squad of 3-5 |
| **Experience** | 2-4 years, comfortable with Figma but not deeply technical |
| **Goals** | Ship clean designs that pass review without rework |
| **Frustrations** | Doesn't always know which token to use; gets flagged in review for hardcoded values |

### How Priya Uses Lint Roller

- Runs **selection-scoped scans** on components as she builds them
- Reviews **suggested tokens** with confidence indicators to learn the correct bindings
- Uses **one-click Fix** to bind the right variable instantly
- Checks the **activity log** to verify what changed before handing off

### Key Needs

- Fast, selection-scoped scanning
- Clear token suggestions with visual previews (color swatches)
- Simple fix actions (Fix, Ignore)
- Non-destructive -- easy to undo or review changes

---

## 3. Kai -- Front-End Developer

| Attribute | Detail |
|-----------|--------|
| **Role** | Front-End Developer working from Figma specs |
| **Team size** | Dev squad paired with designers |
| **Experience** | Strong code skills, moderate Figma familiarity |
| **Goals** | Translate designs to code with confidence that token names in Figma match code variables |
| **Frustrations** | Hardcoded hex values in Figma that don't map to any known token; orphaned variables that reference deleted tokens |

### How Kai Uses Lint Roller

- Runs a **page scan** before starting implementation to identify unbounded values
- Flags **orphaned variables** and **unknown styles** to the design team
- Uses **JSON export** to cross-reference violations with the codebase token set
- Relies on **path matching** to verify Figma variable names align with code token paths

### Key Needs

- Orphaned variable detection
- JSON export for tooling integration
- Path-level detail on token suggestions
- Confidence that a "clean" scan means the file is implementation-ready

---

## 4. Morgan -- Design QA / Reviewer

| Attribute | Detail |
|-----------|--------|
| **Role** | Design QA or senior designer who reviews work |
| **Team size** | Reviews output from 3-8 designers |
| **Experience** | Deep design system knowledge, detail-oriented |
| **Goals** | Catch inconsistencies before handoff; enforce standards without being a bottleneck |
| **Frustrations** | Reviewing pixel-by-pixel is slow; easy to miss a hardcoded radius buried in a nested component |

### How Morgan Uses Lint Roller

- Runs **full-page scans** on files submitted for review
- Groups results **by rule** to systematically address each category
- Uses **severity indicators** to prioritize errors over warnings
- Sends the **summary stats** back to the designer as structured feedback

### Key Needs

- Grouping by rule for systematic review
- Severity-based prioritization
- Summary stats for quick pass/fail assessment
- Ability to scan without modifying the file (read-only review mode)
