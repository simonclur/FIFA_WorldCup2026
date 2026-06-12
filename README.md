# FIFA World Cup 2026 - Brisbane Tracker

Single-file World Cup tracker focused on live operations, print output, and local data visualizations.

## Documentation

- Runtime and feature behavior: [README.md](README.md)
- Styling, hierarchy, print, and accessibility rules: [STYLE_GUIDELINES.md](STYLE_GUIDELINES.md)

## Current Build Summary

The tracker combines live FIFA fixtures with local, project-owned visualizations.

Core pages and modules include:

- Live tournament pages (group stage through finals)
- Completed match archive page
- Live Match Centre with squads/events metadata
- Odds overlays and matchup highlighting
- Special Interest section containing:
  - Guardian Golden Boot atom
  - Squad club-footprint sunburst (PDF-derived)
  - World Cup winners year/champion flow chart
  - Top scorers by tournament chart

## Live/Auto-Refresh Features

### Match refresh

- FIFA match calendar refresh every 5 minutes while active
- Also refreshes when tab visibility resumes
- Re-renders group stage, knockout, completed, and standings pages from latest payload

### Live polling

- 60-second live-only polling when there are active matches (or replay mode)
- Keeps scores and Live Match Centre details up to date during play

### Next-up and completed recategorization

- Match states are recalculated each refresh cycle
- Completed matches are moved to archive page
- Next-up is recalculated by earliest future kickoff

### Alerts and reminders

- Goal-change detection with speech/audio fallback alert
- Calendar actions and reminder checks for upcoming fixtures

### Odds integration

- Provider fallback: OddsPAPI + The Odds API
- Cache-aware refresh and stale fallback behavior
- Top-matchup badge recalculated when contender rankings refresh

## Special Interest: Squad Sunburst Pipeline

The squad footprint module is fully local and does not depend on external chart libraries.

### Source and extraction artifacts

- Raw source PDF: [squad-lists.pdf](squad-lists.pdf)
- Parsed player-level output: [squad-data.json](squad-data.json)
- Sunburst-ready aggregated data: [squad-sunburst-data.js](squad-sunburst-data.js)
- Parser script (current): [parse-squads-v2.py](parse-squads-v2.py)

### Data model

Sunburst hierarchy:

- Inner ring: club country
- Outer ring: club name
- Table: player rows (player, national team, club, club country, position)

### Interactive behavior

- Hover and click highlight on sunburst slices
- Click-to-pin slice behavior
- National-team filter to view one squad distribution at a time
- Searchable table scoped by active slice + current team filter
- Fixed-height panel with internal table scroll
- Render cap of 26 visible table rows to prevent layout jump

## Current Special Interest Order

Inside the Special Interest page, card order is:

1. Guardian atom
2. Squad club footprint sunburst
3. World Cup winners flow
4. Top scorers by tournament

## Screen Page Order

Current screen order:

1. Completed Matches
2. Group Stage
3. Live Match Centre
4. Group Tables
5. Round of 32
6. Round of 16
7. Finals
8. Special Interest

## Print Scope

Printed pages include:

- Group Stage
- Round of 32
- Round of 16
- Finals

Screen-only operational pages (completed archive, live centre, group tables, special interest) remain excluded from print.

## Data Sources

- FIFA API (fixtures, statuses, scores, live detail)
- OddsPAPI
- The Odds API
- The Guardian atom embed (special-interest card)
- Wikipedia-derived local datasets for winners/top-scorers modules

## Query Parameters

Primary runtime parameters:

- oddsProvider = auto | oddspapi | the-odds-api
- oddsForce = 1|true|yes
- oddsApiKey = The Odds API key
- oddspapiKey / oddsPapiKey = OddsPAPI key
- demoMatchId = replay/live focus override
- sbsMatchId = SBS match centre id override

## Local Run Notes

- Running as file:// works for local modules and static data files.
- Browser security may still limit remote API behavior in some environments.
- Use a local HTTP server for full network consistency if needed.
