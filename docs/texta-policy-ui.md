# Texta policy interface extension verification

Date: 2026-10-05. Scope: ordinary extension of the incumbent Texta interface.

This evidence note does not refresh the design system or certify the legal accuracy of the policies. `PRODUCT.md`, `DESIGN.md` and `.impeccable/design.json` remain unchanged.

## Authority and evidence

Read the Impeccable `reference/document.md`, existing product/design documents and sidecar, then compared `public/terms.html`, `privacy.html`, `refund.html`, `legal.css`, `legal.js` and policy entries in `index.html`, `pay.html`, `app.html` and `i18n.js` with `workspace.css` and `controls.css`.

The confirmed surface contract is a plain policy reading layout using the existing Texta off-white/sage roles, Texta Serif display role and system interface font. The public identity is Texta, individually operated in China, with support at `1963372275@qq.com`; the confirmed voluntary refund statement is seven days with unused paid benefits. These surface facts are not promoted into new visual tokens.

## Ordinary-extension outcome

The reading surface satisfies the contract at source level:

- `legal.css` introduces no color primitives, font families, palette overrides, shadows or decorative panels. Background, ink, muted copy, links, table headers and rules inherit the existing semantic variables from `workspace.css`.
- Policy headings use `var(--font-display)` at 600 weight. Body text inherits the system interface stack, with policy copy at 16px/1.85. Metadata, tables, footer links and registration/payment disclosures use 15px ancillary text.
- The shell has a 1080px maximum, with a 200px desktop contents column and an open reading column. At 720px and below the layout becomes one column and the contents links wrap. The contents sidebar is specific to long policies; it does not alter the study composition or its sidebar guardrail.
- Policy text stays on the page plane with quiet divider rules. Tables scroll locally when needed. The inherited focus outline and skip link retain keyboard navigation; the language button uses native button semantics.
- All three policies retain the Texta wordmark and existing theme bootstrap. Chinese and English content use separate language blocks; `legal.js` selects the requested or stored language, persists the existing `texta_language` preference and carries it across policy links. Existing pages add policy entry points using shared link styling, with translated labels in `i18n.js`.
- Public brand, support email and seven-day unused-benefit wording are present in the policies and entry points checked.

The new policy pages load `workspace.css` and `legal.css` without `controls.css`, so the language button uses the existing base workspace 8px radius and control hover treatment. The main reviewer accepted this inheritance within the reading contract; it is not an unresolved extension gate and does not create a new palette or reading world. No application files were changed by this documentation pass.

The ordinary reading-extension contract passes. This documentation pass checks source evidence. Rendered layout, responsiveness and interaction verification belong to the main review and are not claimed here.

## Preexisting documentation drift preserved

The sidecar predates the October 5 shared-control refinement. Its definition-panel preview has a literal 10px corner while the current design document specifies 14px panels. Several preview controls keep an 8px radius fallback and the older line/hover vocabulary. Its input preview describes the previous resizable textarea, while the design document additionally records the later unified vocabulary composer. These are inherited documentation/preview differences, not new policy tokens.

The existing design document also carries a noncanonical shared-control update section before the canonical Overview and records known legacy/token advisories. This extension did not reorder or repair it, regenerate the sidecar, or reinterpret the study-specific grid as a universal auxiliary-page requirement.
