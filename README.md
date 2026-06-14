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

### Kickoff-triggered fetch

- A one-shot `setTimeout` fires at each scheduled match kickoff + 5 s, triggering an immediate `loadMatches` call.
- This ensures scores appear as soon as the match goes live rather than waiting up to 5 minutes for the regular poll cycle.
- The trigger is scheduled (or rescheduled) on every `loadMatches` completion; it cancels any prior pending trigger first.
- If the kickoff has already passed by the time the trigger would be set, it is skipped — the 60 s live-refresh timer takes over.

### Live polling

- 60-second live-only polling when there are active matches (or replay mode)
- Keeps scores and Live Match Centre details up to date during play

### Group Stage live spotlight

- Any actively played First Stage match is moved into a dedicated centered spotlight panel above the Group Stage two-column layout.
- Spotlight cards are rendered at approximately 2x visual size (typography, score, badges, and flags) so live matches stand out immediately.
- Live spotlight matches are removed from the day-grouped fixture cards while they are in-play; non-live fixtures remain in the regular grouped layout.
- Spotlight uses explicit high-contrast text/surface tokens and includes dark-mode overrides via `prefers-color-scheme: dark` so enlarged live cards remain readable.
- Each spotlight card includes a horizontal match-events ticker (latest events first) using the live-detail feed; if detailed events are unavailable it shows an "awaiting feed" placeholder.
- Spotlight match cards now fetch and cache their own live-detail payloads on demand, so the ticker can populate even when the focused live match is different from the spotlighted fixture.
- Spotlight cards also include a running official clock badge sourced from FIFA `MatchTime`; between data pulls it advances locally with a seconds counter from the last pull timestamp, with kickoff-elapsed fallback if `MatchTime` is unavailable.
- In spotlight cards, the live sync/next sync badge cluster is right-justified within the match details row for faster scan.
- During half-time (`MatchStatus` 4), spotlight status shows `HT` and the official clock is frozen at time played (rather than continuing to increment).
- The odds sidebar remains sticky in the right column for non-live fixtures, and now begins below the spotlight panel.
- The live spotlight increases spacing between the team names and the score so the scoreboard reads more cleanly at a glance.
- A dedicated phone breakpoint (`max-width: 430px`) optimizes iPhone-sized screens with safe-area padding, larger tap targets, and rebalanced card/spotlight typography for one-handed readability.
- On the phone breakpoint, match metadata keeps the kickoff time and date in a right-aligned column instead of wrapping under the team names.
- The live spotlight card is given a little extra vertical breathing room on phones so the time/date column stays clear of the team rows.
- On touch devices, match-card hover affordances now support tap-to-focus, second tap to clear, and tap-outside-to-clear so odds hover context works on iPhone.
- The World Cup winners Sankey now supports touch parity: tap year/champion/link to lock highlight, tap again to toggle off, and tap outside the chart to clear.

### Match Events timeline

- Events (goals, bookings, substitutions) are rendered as a centred vertical timeline inside the Live Match Centre.
- Home events sit on the left; away events on the right; the minute badge appears on the centre track between them.
- Goals show a ⚽ icon with bold green player name. Yellow/red cards use CSS-drawn card rectangles (yellow, split yellow/red for second yellow, solid red). Substitutions show ↑↓ arrows and are styled muted grey to reduce visual noise.
- Own-goal scorer names are resolved against the opposing team roster when FIFA goal events reference an opposing player ID.
- Event rows are sorted chronologically by minute.

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
- Embedded odds API keys are no longer hardcoded in client code.
- Odds can run either with explicit browser keys (`oddsApiKey`, `oddspapiKey`) for local testing, or through a proxy (`proxyBase`) so secrets stay server-side.

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

Each key screen page now exposes a sticky page-name label at the top while scrolling (`Completed Matches`, `Group Stage`, `Live Match Centre`, `Group Tables`, `Round of 32`, `Round of 16`, `Finals`, `Special Interest Stats`) so section context remains visible through long content.

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

When `proxyBase` is configured, FIFA and odds calls are routed through that proxy endpoint instead of direct browser-to-provider calls.

## Query Parameters

Primary runtime parameters:

- oddsProvider = auto | oddspapi | the-odds-api
- oddsForce = 1|true|yes
- oddsApiKey = The Odds API key
- oddspapiKey / oddsPapiKey = OddsPAPI key
- proxyBase = base URL for API proxy (example: `https://<your-worker>.workers.dev`)
- demoMatchId = replay/live focus override
- sbsMatchId = SBS match centre id override

## Public Hosting (Mobile Access)

This project can be published as a static website and viewed directly on mobile browsers.

Recommended setup:

1. GitHub Pages serves static assets (`index.html`, `squad-sunburst-data.js`, `squad-data.json`).
2. A proxy service (template included under `proxy/`) holds odds API secrets.
3. The tracker is opened with `?proxyBase=<proxy-url>` so FIFA + odds requests are proxied.

Included deployment assets:

- GitHub Pages workflow: `.github/workflows/deploy-pages.yml`
- Jekyll bypass marker: `.nojekyll`
- Cloudflare Worker proxy template: `proxy/cloudflare-worker.js`
- Wrangler example config: `proxy/wrangler.toml.example`

### Squad Sunburst Dependency

- `squad-sunburst-data.js` is a static script in the repo and works normally on GitHub Pages.
- Keep its filename and relative path unchanged so `index.html` can load it directly.

## Local Run Notes

- Running as file:// works for local modules and static data files.
- Browser security may still limit remote API behavior in some environments.
- Use a local HTTP server for full network consistency if needed.

For a public/mobile deployment, prefer HTTPS hosting plus `proxyBase` so API secrets are not exposed in browser source.
