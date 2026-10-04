---
name: Texta
description: A calm bilingual vocabulary reading workspace.
colors:
  bg: "#f6f7f4"
  panel: "#fcfcfa"
  text: "#222724"
  muted: "#606963"
  line: "#d8ded7"
  primary: "#386548"
  primary-press: "#294e37"
  soft: "#e8f0e7"
  field: "#fcfdfb"
  warning: "#9b3f29"
  white: "#fff"
  overlay: "#19251f66"
  highlight-en: "#dae8d4"
  highlight-zh: "#e3ebdc"
  dark-bg: "#1c221e"
  dark-panel: "#232c25"
  dark-field: "#28312a"
  dark-text: "#e9eee7"
  dark-muted: "#b0bbae"
  dark-line: "#3e4c3f"
  dark-primary: "#a9cda2"
  dark-primary-press: "#c0dcb8"
  dark-soft: "#314334"
  dark-white: "#1c281e"
  dark-warning: "#ffb5a3"
  dark-highlight-en: "#d9ef78"
  dark-vocab-ink: "#202b15"
  dark-highlight-zh: "#e8f7a6"
  highlighter-bg: "#fff"
  highlighter-panel: "#fff"
  highlighter-field: "#fff"
  highlighter-text: "#202020"
  highlighter-muted: "#626262"
  highlighter-line: "#dedede"
  highlighter-primary: "#202020"
  highlighter-primary-press: "#000"
  highlighter-soft: "#f5f5f5"
  highlighter-highlight-en: "#fff200"
  highlighter-overlay: "#0006"
  highlighter-warning: "#202020"
  highlighter-highlight-zh: "#fff200"
  highlighter-vocab-ink: "#202020"
  highlighter-annotation: "#b4232c"
  paper-bg: "#fdfbf6"
  paper-panel: "#fffdf9"
  paper-field: "#fffdf9"
  paper-text: "#352b21"
  paper-muted: "#75624c"
  paper-line: "#e9e2d6"
  paper-primary: "#78522e"
  paper-primary-press: "#5e3d20"
  paper-soft: "#f7f1e6"
  paper-highlight-en: "#f4d79f"
  paper-highlight-zh: "#f1e0bc"
  paper-annotation: "#935022"
  ocean-bg: "#f2f7fa"
  ocean-panel: "#fbfdff"
  ocean-field: "#fbfdff"
  ocean-text: "#1f3340"
  ocean-muted: "#526e7e"
  ocean-line: "#ccdde7"
  ocean-primary: "#235f83"
  ocean-primary-press: "#194969"
  ocean-soft: "#e0eef5"
  ocean-highlight-en: "#c8e8fa"
  ocean-highlight-zh: "#d6edf7"
  ocean-annotation: "#235f83"
  lavender-bg: "#f7f4fa"
  lavender-panel: "#fdfbff"
  lavender-field: "#fdfbff"
  lavender-text: "#33283f"
  lavender-muted: "#71617e"
  lavender-line: "#ded4e7"
  lavender-primary: "#70508d"
  lavender-primary-press: "#56366f"
  lavender-soft: "#ede4f4"
  lavender-highlight-en: "#e0cef3"
  lavender-highlight-zh: "#eadef5"
  lavender-annotation: "#805066"
typography:
  display:
    fontFamily: '"Texta Serif", Georgia, "Songti SC", "SimSun", serif'
    fontSize: "clamp(32px,3.4vw,48px)"
    fontWeight: 700
    lineHeight: 1.18
    letterSpacing: "-.025em"
  wordmark:
    fontFamily: '"Texta Serif", Georgia, "Songti SC", "SimSun", serif'
    fontSize: "38px"
    fontWeight: 700
    lineHeight: 1
    letterSpacing: "-.03em"
  definition-word:
    fontFamily: '"Texta Serif", Georgia, "Songti SC", "SimSun", serif'
    fontSize: "40px"
    fontWeight: 600
    lineHeight: 1.15
  title:
    fontFamily: '"Segoe UI", "PingFang SC", "Microsoft YaHei", system-ui, sans-serif'
    fontSize: "21px"
    fontWeight: 650
    lineHeight: 1.4
  body:
    fontFamily: '"Segoe UI", "PingFang SC", "Microsoft YaHei", system-ui, sans-serif'
    fontSize: "15px"
    fontWeight: 400
    lineHeight: 1.6
  reading:
    fontFamily: 'Georgia, "Times New Roman", "Songti SC", "SimSun", serif'
    fontSize: "22px"
    fontWeight: 400
    lineHeight: 1.5
  translation:
    fontFamily: '"Segoe UI", "PingFang SC", "Microsoft YaHei", system-ui, sans-serif'
    fontSize: "16px"
    fontWeight: 400
    lineHeight: 1.65
  reading-vocabulary:
    fontFamily: 'Georgia, "Times New Roman", "Songti SC", "SimSun", serif'
    fontSize: "inherit"
    fontWeight: 700
    lineHeight: "inherit"
rounded:
  control: "10px"
  panel: "14px"
  floating: "14px"
  segmented: "12px"
  auth-card: "16px"
  option: "7px"
  checkbox: "6px"
  switch: "20px"
  progress: "2px"
  chip: "5px"
  highlight: "3px"
  mastery: "24px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "24px"
  xl: "32px"
  2xl: "48px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.white}"
    rounded: "{rounded.control}"
    padding: "8px 18px"
  button-primary-hover:
    backgroundColor: "{colors.primary-press}"
    textColor: "{colors.white}"
  button-secondary:
    backgroundColor: "transparent"
    textColor: "{colors.text}"
    rounded: "{rounded.control}"
    padding: "8px 18px"
  button-text:
    backgroundColor: "transparent"
    textColor: "{colors.primary}"
    rounded: "{rounded.control}"
    padding: "4px 8px"
  input:
    backgroundColor: "{colors.field}"
    textColor: "{colors.text}"
    rounded: "{rounded.control}"
    padding: "10px 14px"
  navigation-tab:
    backgroundColor: "transparent"
    textColor: "{colors.muted}"
    rounded: "0"
    padding: "18px 20px"
  chip:
    backgroundColor: "{colors.soft}"
    textColor: "{colors.primary}"
    rounded: "{rounded.chip}"
    padding: "2px 8px"
  definition-panel:
    backgroundColor: "{colors.soft}"
    textColor: "{colors.text}"
    rounded: "{rounded.panel}"
    padding: "18px 24px 24px"
  mastery-selected:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.white}"
    rounded: "{rounded.mastery}"
    padding: "8px 18px"
  vocabulary-highlight:
    backgroundColor: "{colors.highlight-en}"
    textColor: "{colors.primary}"
    typography: "{typography.reading-vocabulary}"
    rounded: "{rounded.highlight}"
    padding: "0 3px"
---

# Design System: Texta

## Shared control refinement — 2026-10-05

`public/controls.css` is the final shared control layer on all six production pages. It preserves the reading layout, typography and six palettes while updating buttons, native selects, checkbox/switch controls, segmented views, search fields, account/export popovers, notebook cards, authentication forms and asynchronous states. `theme.js` applies the saved theme before paint on account, payment and administration pages as well as the workspace. The payment and administration pages now use the shared styles directly, with their necessary form/chart layouts in `controls.css`; they no longer load the legacy `style.css` that overrode themes and forced nested viewport scrolling.

The control border mixes 72% muted ink with the existing line color for legible field boundaries. Hover mixes 7% primary into the panel surface. Selected buttons retain their foreground and background on hover; a visible check supplements selected theme color. Keyboard outlines use the existing primary role. Primary actions, destructive actions and disabled controls retain distinct states. Cards use 14px corners; the authentication form uses a 16px framed surface. Checkbox and select checkmarks are small control glyphs, not decorative side borders.

Native selects use `appearance: base-select` only behind feature detection: the enhanced picker has padded options, a checkmark and rotating chevron, while unsupported browsers retain their native picker and keyboard interaction. Native checkbox semantics remain intact, with platform controls restored in forced-colors mode. Mobile text fields use at least 16px text to avoid automatic input zoom. Animation respects reduced motion. Busy indicators are driven by explicit `aria-busy`, separately from unavailable/disabled states. Login, registration, generation, PDF export, payment-proof submission and administrator actions expose this state. Account/export menus support Arrow Down, Escape with focus return and closing when focus leaves. Ordinary dictionary disclosures stay open when working elsewhere.

References consulted: [Uiverse buttons](https://uiverse.io/buttons), [checkboxes](https://uiverse.io/checkboxes) and [loaders](https://uiverse.io/loaders) for control states; [21st.dev](https://21st.dev/) for composed controls; [getdesign.md](https://getdesign.md/) for a consistent documented visual vocabulary. Implementations are authored for Texta rather than copied snippets. Coolors was requested but returned an access error, so the existing palette is retained. No new component library or remote runtime dependency is required.

Verification uses the production HTML/CSS/JavaScript with local API fixtures for account and administration flows. Desktop, tablet and phone layouts, theme variants, keyboard controls, checkbox/switch changes, generation failure recovery, library views and export preview are checked in Playwright. This verifies the interface; live model quality, real payments and production account mutations are not exercised. The Impeccable scan still reports pre-existing legacy-style/token advisories; it is not represented as a clean whole-repository audit.

## Overview

**Creative North Star: "Annotated bilingual reading edition"**

Warm paper, ink text and sage selections give the workspace the character of a readable study edition. The reading content is the visual center; standard controls provide a restrained frame around it. English display lettering and English prose have distinct serif roles, while Chinese interface text and translations use readable system fonts.

The confirmed direction favors open space, clear study actions and visible links between vocabulary in the article and its selected definition. Interface copy names actions or explains actual state. Chinese is the default interface language with a persistent English switch; learning content keeps its own language.

**Key Characteristics:**

- Warm neutral ground with sage action and selection colors.
- Display serif for identity and English titles; Georgia for reading.
- Broad content areas, quiet dividers and restrained controls.
- Functional state changes with short motion and reduced-motion support.

Source: [direction contract](/D:/wku/雅思/单词/.impeccable/direction.md:5), [shared tokens](/D:/wku/雅思/单词/public/workspace.css:5). The frontmatter records implemented primitives; the sidecar carries extensions and preview snippets. Its synthesized tonal strips are preview metadata, not additional application colors. This document describes the code and does not certify composition fidelity or visual approval.

## Colors

The palette pairs warm whites and green-tinted ink with a muted sage accent. Frontmatter values are normative; names below explain their application.

### Primary

- **Study Sage** (`primary`, `primary-press`): generation actions, links, wordmark, active mastery, focus outlines and interactive vocabulary.
- **Sage Wash** (`soft`): definition containers, notebook entries, selected controls and hover states.
- **English and Translation Highlights** (`highlight-en`, `highlight-zh`): vocabulary marks, text selection and vocabulary interaction feedback.

### Neutral

- **Warm Ground** (`bg`): full-page background and top navigation.
- **Paper Surfaces** (`panel`, `field`): floating panels, dialogs and editable fields.
- **Green Ink** (`text`, `muted`): primary text and quieter supporting text; translations use the quieter role.
- **Quiet Rule** (`line`): dividers and control borders.
- **Action Foreground** (`white`): text on filled actions; the dark-theme equivalent is dark ink, despite the historical token name.
- **Backdrop** (`overlay`): modal scrim.
- **Warning Clay** (`warning`): validation, failures and destructive actions. It is a semantic state color rather than a decorative secondary accent.

### Named Rules

**The Study State Rule.** Use sage to identify an action, selected study state or vocabulary relationship; carry meaning with text and state attributes as well as color.

The Forest (森林) palette remains the default (stored as `light`). Dark and system choices remap the same CSS roles; `dark-*` frontmatter values record the explicit overrides. Optional highlighter, paper, ocean and lavender palettes use the same semantic roles, recorded under their frontmatter prefixes. Highlighter (荧光) uses a grayscale interface with yellow supplied-English vocabulary and corresponding Chinese marks in black bold text, plus red annotations. Text selection stays grayscale; theme swatches retain their palette colors in every theme. Forest uses a green circular swatch instead of the sun icon. Paper uses near-white parchment, ocean cool blue and lavender muted violet. The `annotation` alias follows `muted` unless a palette explicitly overrides it; `vocab-ink` follows `primary` except for explicit highlighter and dark ink. Dark vocabulary uses a bright yellow-green fill with dark text for clear contrast. Highlighter also applies annotation color to Chinese paragraphs and sense markers. Paper, ocean and lavender inherit the base action foreground, warning, backdrop and shadow. Highlighter inherits the white action foreground and supplies grayscale warning, backdrop and shadow roles. Theme preference persists locally under `texta_theme_preference`. Sources: [theme tokens](/D:/wku/雅思/单词/public/workspace.css:5), [theme preference](/D:/wku/雅思/单词/public/app.js:111).

## Typography

**Display Font:** Source Serif 4 Display, self-hosted as `Texta Serif`, with Georgia and Chinese serif fallbacks. The source declares regular, semibold and bold faces with `font-display: swap`; the shipped font directory includes the [supplied OFL license](/D:/wku/雅思/单词/public/fonts/LICENSE-source-serif.md).

**Reading Font:** Georgia, with Times New Roman and Chinese serif fallbacks.

**Interface Font:** Segoe UI, PingFang SC, Microsoft YaHei and system sans-serif fallbacks.

**Character:** Serif display lettering gives identity and article titles a reading-edition character. Georgia keeps prose distinct from controls; Chinese translations and UI use the sans stack for clear scanning.

### Hierarchy

- **Display:** article title; uses the normative `display` role with responsive title overrides.
- **Wordmark:** the `wordmark` role, scaled down on mobile.
- **Definition word:** the `definition-word` role, carrying the selected English vocabulary item.
- **Title:** section headings and the vocabulary label use the `title` role.
- **Body:** UI text uses `body`; English article paragraphs use `reading`; Chinese article paragraphs use `translation`.
- **Reading vocabulary:** supplied English vocabulary uses bold weight (700), retaining the paragraph's size and line height in every palette.
- **Supporting text:** controls commonly use 14px; real help/status text uses 13px. These are functional explanations, not decorative eyebrows.

### Named Rules

**The Language Role Rule.** Keep display lettering, English reading and Chinese interface text in their assigned stacks. The interface-language toggle does not rewrite the article.

Reading-size controls supply small and large English prose variants (20px and 26px); mobile medium prose uses 21px. Collocations and article-context sentences use 18px Georgia. Sources: [font faces and stacks](/D:/wku/雅思/单词/public/workspace.css:2), [article hierarchy](/D:/wku/雅思/单词/public/workspace.css:118), [definition hierarchy](/D:/wku/雅思/单词/public/workspace.css:142), [language isolation](/D:/wku/雅思/单词/public/i18n.js).

## Layout

The shared shell uses 90% width with a 1700px maximum. The implemented study surface has full-width top navigation and separate editing and reading states. Vocabulary entry and generation settings share the editing grid; article and definitions share the reading grid. Successful generation and opening a saved article hide the editing grid automatically. The reading toolbar offers “修改词汇” to reopen the editor with existing words and settings, and the editor offers “返回文章” to resume the current article without regeneration. Both use `minmax(0,2.15fr) minmax(310px,1fr)` and a 40px gap. This is the chosen C study surface, not a mandatory grid for every auxiliary page.

At 1100px and below the grids become `minmax(0,1.7fr) minmax(290px,1fr)` with a 24px gap. At 860px and below the input stacks, the reading area becomes a block and the mobile learning navigation fixes to the bottom with safe-area padding. At 1600px and above the grid gap becomes 56px. Article and definition panels share the available viewport height, with independently scrolling content and hidden scrollbars. The article toolbar collapses upward as the article scrolls down and returns only when it reaches the top. The definition toolbar remains outside its scrolling content. Wheel, touch and keyboard navigation stay available; reaching a pane boundary does not scroll the other pane. Focus reading narrows the article to a 920px maximum and hides the input, navigation, reading toolbar and default definition panel. A brief ESC hint announces how to exit; touch layouts also provide an exit button. Selecting highlighted vocabulary opens the definition panel as a fixed, independently scrolling dialog with a persistent close control. Closing it preserves the article position and cannot be undone by a background definition refresh. Notebook content spans the full reading grid, defaults to divided list rows and offers card and calendar views. Library views hide the mobile reading navigation so it cannot cover entries.

Use the extracted spacing scale for repeated gaps and padding. Article paragraphs remain open on the page with a 24px bottom separation; notebook card mode uses an adaptive grid with a 340px target minimum that can shrink to the available width; default list mode uses one column with divided rows. Auxiliary authentication, payment and administration pages retain their own layouts while sharing the visual roles.

Sources: [shell and input grid](/D:/wku/雅思/单词/public/workspace.css:73), [reading grid](/D:/wku/雅思/单词/public/workspace.css:106), [responsive rules](/D:/wku/雅思/单词/public/workspace.css:248).

## Elevation & Depth

The study surface uses tonal layering and thin rules at rest. English and Chinese paragraphs have no card border or shadow. Sage definition and notebook containers provide a quiet secondary plane. A single diffuse ambient shadow belongs to popovers and dialogs; auxiliary payment and administration containers explicitly remove shadows.

### Shadow Vocabulary

- **Floating surface:** `var(--shadow)`, defined as `0 16px 44px #17271c18`; account/export popovers and modal cards.

### Named Rules

**The Reading Plane Rule.** Keep article paragraphs on the page plane. Use tonal containers for study support and ambient elevation for floating controls.

Sources: [shadow token](/D:/wku/雅思/单词/public/workspace.css:9), [popover](/D:/wku/雅思/单词/public/workspace.css:66), [modal](/D:/wku/雅思/单词/public/workspace.css:193).

## Shapes

Controls use gentle corners from `rounded.control`. Definition and notebook containers use `rounded.panel`; floating surfaces use `rounded.floating`. Vocabulary marks and chips use their smaller radius roles. Mastery choices are pills; navigation tabs use square geometry and a thin active underline. Avatar and switch-thumb circles are functional control forms.

Use single quiet borders for editable fields and secondary controls. The article remains open rather than subdivided into boxed paragraphs. Sources: [controls](/D:/wku/雅思/单词/public/workspace.css:30), [marks](/D:/wku/雅思/单词/public/workspace.css:127), [mastery](/D:/wku/雅思/单词/public/workspace.css:153).

## Components

### Buttons

Restrained, readable actions. General buttons have at least 44px height; the primary variant is sage with a contrasting action foreground and semibold text. Secondary buttons use quiet borders; text actions use sage text and a transparent border. Hover changes background/border color; active press translates by 1px. Disabled buttons reduce opacity and use a disabled cursor. Keyboard focus has a 2px sage outline with 4px offset. Generation expands to the settings-column width and uses a 46px minimum height.

### Chips

Small functional vocabulary annotations using sage wash and sage text; invalid chips use the warning role. The current word-chip wrapper is hidden by the shared stylesheet, so chips are a source-backed primitive rather than a prominent study-surface pattern.

### Cards / Containers

Definitions and notebook entries use the sage tonal container with quiet section rules. Floating account/export popovers and dialogs use paper, the floating radius and ambient shadow. Article paragraphs are open containers. Favorites and history use divided rows with a sage hover/focus fill.

Notebook review defaults to full-width divided list rows showing a bold word, meaning and mastery actions. A separate 44px chevron button sits inside `.study-controls` on the same horizontal row as mastery. It uses `aria-expanded` and `aria-controls` to toggle a `hidden` details section without repeated detail text. The list/cards/calendar toggle uses `aria-pressed` and preserves the selection locally under `texta_notebook_view`. Card mode retains the adaptive tonal grid; list rows stack on narrow screens while mastery and disclosure remain together. Expanded details survive rerendering while the entry remains visible. Unfamiliar and mastered categories retain the full entry; mastered words can be restored, and deletion is shown and accepted only for mastered entries.

The source-article action lives in entry details (and remains visible in card mode). It opens the saved article snapshot, brings the matching definition into view and focuses the target word in the article. Each entry retains its `sourceArticle` JSON snapshot in local storage and cloud notebook synchronization; definition hydration preserves that snapshot. Older entries without a snapshot look up a matching article in favorites, then local history; entries with no saved source show an explicit unavailable state.

Both notebook and favorites default to A–Z sorting, with newest/oldest options based on first addition, plus search. The standard calendar initially shows the current month in a seven-column grid. Standard size is centered with a 920px maximum width, 76px day rows and 42px number boxes (25px type); at 760px and below, rows are 64px with 38px number boxes (23px type). The thumbnail (`mini`) variant is a centered twelve-month annual overview with a 1120px maximum width. It uses four month columns, then three at 1100px and below, two at 820px and below, and one at 600px and below. Each month has exactly 42 cells in six week rows, with a month heading and entry count. Desktop date and blank cells are 32px high with 26px number boxes (15px type); at 600px and below the overview has a 336px maximum width, 44px date and blank cells and 28px number boxes (16px type). Thumbnail per-day counts are visually hidden, while each day button's accessible label still includes the count; the footer reports the yearly total. The Standard/Thumbnail choice uses `aria-pressed`, defaults to standard and persists locally under `texta_calendar_size`. Standard navigation moves by month with “本月”; thumbnail navigation moves by year with “今年”. The annual heading shows the year without an eyebrow, while the standard month retains its existing date-basis label. Fluorescent yellow circular marks with black numerals identify days containing entries in the current category and filter. Standard month and annual grid transitions use transform/opacity over 280ms; date circles scale into place over 380ms with short staggered delays. Reduced motion removes grid and marker animations. Selecting a marked day opens that day's list, with explicit return and clear-date controls, and retains its month so switching to standard shows the selected month. Favorites support empty folders, rename, article movement and folder deletion that retains articles as unfiled.

### Inputs / Fields

Fields use the paper field color, quiet border, control radius and 44px minimum height. Focus shifts the border to sage while preserving a visible keyboard outline. The vocabulary textarea uses Georgia and remains vertically resizable. Settings selects use sage wash. Validation pairs warning-colored status with the input's invalid state.

### Navigation

Top-level learning tabs use muted text at rest, ink and a sage underline when active, with `aria-current` state. On mobile they wrap below the wordmark/tools and can scroll horizontally. Bottom learning controls identify the active input/article/word view with sage wash. Account options contain the theme selector; the language switch remains directly accessible in the header.

### Linked Vocabulary and Definition

Vocabulary highlights are keyboard-operable controls. Selecting one shows the matching definition, updates the word count/selection and briefly highlights the definition word. Definitions use ordered meaning lists and bulleted collocation/synonym/antonym lists, plus the selected vocabulary's actual article-context sentence labeled “原文例句” and its single-sentence translation labeled “例句译文”. English sentence boundaries use `Intl.Segmenter` with a punctuation fallback. A saved paragraph translation is reused only when the paragraph contains one English sentence and the translation is valid. Otherwise the selected definition lazily requests a contextual single-sentence translation through authenticated `/api/context/translation`, using the paragraph and existing translation as context. A session request map deduplicates concurrent requests; the result cache retains at most 200 translations. A live status shows loading or unavailable state with a retry action. The selected vocabulary stays bold and highlighted in both context and translation; overlapping Chinese terms are matched once to avoid nested marks. Additional dictionary details live in a disclosure. Mastery pills distinguish selected state with sage fill and `aria-pressed`. The notebook action saves unfamiliar vocabulary for review.

### Motion

Color/border changes use the fast duration; tabs and floating reveals use the normal duration and shared ease-out. Reveals combine opacity with a 6px vertical shift. The definition-word highlight lasts 700ms; a loading spinner rotates at 800ms. Reduced motion removes animations and collapses transitions. Keep motion local to feedback and state changes. Sources: [control states](/D:/wku/雅思/单词/public/workspace.css:30), [motion](/D:/wku/雅思/单词/public/workspace.css:244), [reduced motion](/D:/wku/雅思/单词/public/workspace.css:290), [linked interactions](/D:/wku/雅思/单词/public/workspace.js:46).

## Do's and Don'ts

### Do:

- **Do** preserve warm neutral, ink and sage as the default; optional palettes retain the same semantic roles and readable state cues.
- **Do** use the display, reading and interface font roles for their documented purposes.
- **Do** preserve generous reading space and collapse the study grid for narrow screens.
- **Do** pair selected vocabulary, mastery and navigation colors with readable text and accessible state.
- **Do** use direct functional copy in the current interface language and retain learning-content language.
- **Do** retain visible keyboard focus and respect reduced-motion preferences.

### Don't:

- **Don't** add slogans, decorative microcopy or diagonal arrows.
- **Don't** crowd the chosen study composition with a navigation sidebar or extra ornamental panels.
- **Don't** turn prose paragraphs into a repeated field of raised cards.
- **Don't** claim invented study statistics, testimonials, sentence translations or visual-fidelity approval.

Auxiliary HTML loads legacy styling before the shared override; future changes must inspect that cascade. Generated document exports use their own print styles and are not proof that every export matches these screen tokens. Numeric comparison with the approved composition remains a separate calibration issue and is not canonized as a design token or a successful fidelity gate.

Exports use a dedicated `.export-document` layout from `EXPORT_DOCUMENT_STYLES` in `public/app.js`, shared by the preview, PDF capture and Word file. Article exports contain one title, continuous bilingual paragraphs and a compact vocabulary table. PDF output is a single long image on one custom-height page; its canvas scale is bounded for mobile memory. PDF capture uses a separate 816px-wide document with explicit zero crop offsets, then places the full canvas on one page. Pinned html2canvas and jsPDF distributions load on demand from the application host. Notebook exports snapshot the current filtered list and contain only English vocabulary, part of speech and Chinese meanings. Mobile export popovers anchor to the reading toolbar width and retain visible PDF/Word labels. Opening a history article returns to the article view and reveals its reading toolbar when outside the viewport, respecting reduced motion. Switching mobile reading tabs preserves each pane's scroll position; opening a different article starts at the top.

The export preview uses a flex column with a fixed visible header and footer. Only its middle content scrolls, so Close and Confirm Export remain reachable on narrow and short screens. Routine success and article-open status copy is hidden; errors and active generation progress remain visible.
