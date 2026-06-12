# FIFA World Cup 2026 Tracker - Style and Print Guidelines

## Purpose

This document defines visual and interaction rules for the tracker, with emphasis on:

- Fast match-day scanability on screen
- Stable, predictable layouts during dynamic updates
- A4 print legibility for core tournament pages
- Clear state semantics beyond color alone

## Design Priorities

1. Match-critical information first
- Team names
- Score and status
- Time and progression state

2. Decision-support information second
- Next-up and top-matchup signals
- Odds and trend context
- Filters and controls with clear labels

3. Supplemental context third
- Metadata and provider health
- Footnotes and attribution
- Secondary visual storytelling cards

## Current Screen Intent

Screen page order:
1. Completed Matches
2. Group Stage
3. Live Match Centre
4. Group Tables
5. Round of 32
6. Round of 16
7. Finals
8. Special Interest

Special Interest card order:
1. Guardian atom
2. Squad club footprint sunburst
3. Winners flow
4. Top scorers

## Highlighting Rules

Use multi-channel semantics for important states:

- Color
- Border/stroke treatment
- Explicit label text
- Optional emphasis motion/weight

Never rely on color alone to communicate state.

Required clarity:

- Next up must be obvious and labeled
- Top matchup must be obvious and labeled
- Live must have a clear status indicator and score prominence
- FT/completed must be explicit

## Typography and Density

- Keep hierarchy obvious: primary match content above metadata
- Preserve readability over aggressive compaction
- Avoid micro-type in frequently scanned elements

Guideline floor for printable content:

- Primary content: 7 pt+
- Secondary content: 6 pt+

## Print Rules

Print scope includes only:

- Group Stage
- Round of 32
- Round of 16
- Finals

Print quality rules:

1. Use high-contrast text and boundaries.
2. Keep semantic meaning intact in grayscale.
3. Do not depend on subtle fills for interpretation.
4. Preserve card/page break integrity.
5. Hide non-paper interactive controls.

## Sunburst Module Style Rules

The squad sunburst and table panel are now a major interactive module and must keep a stable layout.

### Panel behavior

- Right details/table panel uses fixed height to prevent page reflow
- Table area scrolls internally
- Row rendering is capped to 26 visible rows for stability

### Theme behavior

- Dark-mode compatible surfaces are required for chart + table panel
- Center sunburst disk and center labels must maintain high contrast
- Table headers and alternating rows must remain legible in dark palette

### Filter behavior

- National-team filter scopes both chart distribution and table rows
- Table copy and meta chips must reflect current filter scope
- Empty states must clearly explain why no rows are shown

## Accessibility and Clarity

- Use clear status wording (Live, FT, Scheduled, TBD)
- Preserve visual separation between sections/cards
- Ensure table rows are distinguishable without color-only cues
- Keep filter labels explicit and context-aware

## Acceptance Checklist For Style Changes

Before merging style/UI changes, verify:

1. Screen usability
- Live and next-up are obvious
- Key labels remain readable at a glance
- Dynamic cards do not jump/reflow unexpectedly

2. Sunburst module usability
- Chart labels are readable against current theme
- Right panel height is stable
- Table remains scrollable and capped to 26 visible rows
- Team filter and table search both behave predictably

3. Print usability
- Only intended pages print
- Critical meaning survives grayscale

4. Semantic consistency
- Badge/chip conventions are preserved
- State label language remains consistent

## Suggested Next Improvements

1. Add optional pagination controls for table rows beyond the 26-row cap.
2. Add minimum contrast checks for all Special Interest cards.
3. Add a lightweight release checklist for visual regression on dark theme + print preview.
