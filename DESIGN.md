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
  dark-highlight-en: "#435c37"
  dark-highlight-zh: "#374f3b"
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
rounded:
  control: "8px"
  panel: "10px"
  floating: "12px"
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
    rounded: "{rounded.highlight}"
    padding: "0 3px"
---

# Design System: Texta

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

Light is the default. Dark and system choices remap the same CSS roles; `dark-*` frontmatter values record the explicit overrides. Dark mode inherits the backdrop and shadow from the base theme. Sources: [light and dark tokens](/D:/wku/雅思/单词/public/workspace.css:5), [theme preference](/D:/wku/雅思/单词/public/app.js:109).

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
- **Supporting text:** controls commonly use 14px; real help/status text uses 13px. These are functional explanations, not decorative eyebrows.

### Named Rules

**The Language Role Rule.** Keep display lettering, English reading and Chinese interface text in their assigned stacks. The interface-language toggle does not rewrite the article.

Reading-size controls supply small and large English prose variants (20px and 26px); mobile medium prose uses 21px. Collocations and article-context sentences use 18px Georgia. Sources: [font faces and stacks](/D:/wku/雅思/单词/public/workspace.css:2), [article hierarchy](/D:/wku/雅思/单词/public/workspace.css:118), [definition hierarchy](/D:/wku/雅思/单词/public/workspace.css:142), [language isolation](/D:/wku/雅思/单词/public/i18n.js).

## Layout

The shared shell uses 90% width with a 1700px maximum. The implemented study surface has full-width top navigation and two aligned horizontal grids: vocabulary entry with generation settings above, then reading with definitions below. Both use `minmax(0,2.15fr) minmax(310px,1fr)` and a 40px gap. This is the chosen C study surface, not a mandatory grid for every auxiliary page.

At 1100px and below the grids become `minmax(0,1.7fr) minmax(290px,1fr)` with a 24px gap. At 860px and below the input stacks, the reading area becomes a block and the mobile learning navigation fixes to the bottom with safe-area padding. At 1600px and above the grid gap becomes 56px. Article and definition panels share the available viewport height, with independently scrolling content and hidden scrollbars. Their toolbars remain outside the scrolling content. Wheel, touch and keyboard navigation stay available; reaching a pane boundary does not scroll the other pane. Focus reading narrows the article to a 920px maximum and hides the input and definition panel.

Use the extracted spacing scale for repeated gaps and padding. Article paragraphs remain open on the page with a 24px bottom separation; notebook entries use an adaptive grid with a 340px target minimum that can shrink to the available width. Auxiliary authentication, payment and administration pages retain their own layouts while sharing the visual roles.

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

### Inputs / Fields

Fields use the paper field color, quiet border, control radius and 44px minimum height. Focus shifts the border to sage while preserving a visible keyboard outline. The vocabulary textarea uses Georgia and remains vertically resizable. Settings selects use sage wash. Validation pairs warning-colored status with the input's invalid state.

### Navigation

Top-level learning tabs use muted text at rest, ink and a sage underline when active, with `aria-current` state. On mobile they wrap below the wordmark/tools and can scroll horizontally. Bottom learning controls identify the active input/article/word view with sage wash. Account options contain the theme selector; the language switch remains directly accessible in the header.

### Linked Vocabulary and Definition

Vocabulary highlights are keyboard-operable controls. Selecting one shows the matching definition, updates the word count/selection and briefly highlights the definition word. Definitions include meanings, collocations and an actual article-context sentence; additional dictionary details live in a disclosure. Mastery pills distinguish selected state with sage fill and `aria-pressed`. The notebook action saves unfamiliar vocabulary for review.

### Motion

Color/border changes use the fast duration; tabs and floating reveals use the normal duration and shared ease-out. Reveals combine opacity with a 6px vertical shift. The definition-word highlight lasts 700ms; a loading spinner rotates at 800ms. Reduced motion removes animations and collapses transitions. Keep motion local to feedback and state changes. Sources: [control states](/D:/wku/雅思/单词/public/workspace.css:30), [motion](/D:/wku/雅思/单词/public/workspace.css:244), [reduced motion](/D:/wku/雅思/单词/public/workspace.css:290), [linked interactions](/D:/wku/雅思/单词/public/workspace.js:46).

## Do's and Don'ts

### Do:

- **Do** preserve the warm neutral, ink and sage roles across themes.
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
