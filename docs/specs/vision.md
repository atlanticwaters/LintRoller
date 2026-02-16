# Vision Statement

## Lint Roller

**A Figma plugin that checks designs against style guidelines and best practices.**

---

## The Problem

Design teams working at scale struggle to maintain consistency. As design systems grow, hardcoded values creep into files, orphaned variables linger after refactors, and designers unknowingly drift from established tokens. Manual audits are slow, error-prone, and quickly outdated. The gap between a design system's _intent_ and its _actual usage_ widens with every new screen.

## The Vision

Lint Roller bridges the gap between design tokens and real-world Figma usage. It gives designers and design system teams an automated, intelligent linting layer that surfaces every deviation from the token system -- and offers one-click fixes to resolve them.

Lint Roller treats design tokens as the single source of truth. By importing DTCG-compliant token files, scanning Figma documents, and using perceptual color matching (Delta E 2000), it identifies violations with precision and suggests the correct token with measurable confidence.

## Guiding Principles

1. **Zero visual change** -- Auto-fixes bind to tokens that resolve to the exact current value. Designers never see unexpected changes.
2. **Token-first, not style-first** -- Lint Roller validates against the token specification, not Figma-native styles alone.
3. **Progressive trust** -- Start with a single selection, expand to a page, then lint the full document. Confidence grows with each pass.
4. **Actionable results** -- Every violation includes a suggested fix, confidence level, and alternative options. Information without action is noise.
5. **Non-destructive by default** -- Ignore lists, undo support, and activity logs ensure nothing is lost.

## Success Metrics

- Percentage of nodes bound to design tokens (target: >95% in mature files)
- Time to audit a page (target: seconds, not hours)
- Auto-fix acceptance rate (target: >80% of suggestions applied without modification)
- Orphaned variable count trending toward zero across the organization

## Long-Term Direction

Lint Roller aims to become the standard quality gate for design system adoption in Figma -- complementing code linters with an equivalent layer for design. Future opportunities include CI-like scheduled scans, cross-file reporting dashboards, and integration with token pipelines (Tokens Studio, Style Dictionary, GitHub Actions).
