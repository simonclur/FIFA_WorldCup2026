# FIFA World Cup 2026 - Brisbane Tracker

Single-file World Cup tracker focused on live operations, print output, and local data visualizations.

## Documentation

- Runtime and feature behavior: [README.md](README.md) (this file)
- Styling, hierarchy, print, and accessibility rules: [STYLE_GUIDELINES.md](STYLE_GUIDELINES.md)
- AI agent workflow directives: [CLAUDE.md](CLAUDE.md) (Claude Code) and [.github/copilot-instructions.md](.github/copilot-instructions.md) (GitHub Copilot)

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
- On first load, the page auto-scrolls to the live match spotlight when a live match is in progress; otherwise it lands on the next-up Group Stage fixture.

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
- The live spotlight now keeps the kickoff time/date smaller while using larger team names and score text, with extra spacing around the live score separator, so the featured match is easier to scan at a glance.
- Live spotlight cards now include the TV-style SBS icon as a direct link to the SBS On Demand live stream page in a new tab.
- Live spotlight cards now include a browser-aware Listen Live action for talkSPORT that prefers the HLS stream and falls back to MP3 when HLS playback is unavailable.
- Live Match Centre substitution events now show explicit directional markers: green up-arrow for players coming on and red down-arrow for players coming off.
- Completed Matches now appears directly after Group Stage and uses an accordion control so the archive can be expanded or collapsed on demand.
- The Completed Matches accordion control now uses higher-contrast button styling and a double-chevron icon to clearly signal expand/collapse affordance.
- Completed match cards now include a small TV-style replay icon that opens the SBS On Demand match page for quick replay access in a new tab.
- A dedicated phone breakpoint (`max-width: 430px`) optimizes iPhone-sized screens with safe-area padding, larger tap targets, and rebalanced card/spotlight typography for one-handed readability.
- On the phone breakpoint, match metadata keeps the kickoff time and date in a right-aligned column instead of wrapping under the team names.
- The live spotlight card is given a little extra vertical breathing room on phones so the time/date column stays clear of the team rows.
- Phone landscape mode now has its own coarse-pointer breakpoint that restores a denser two-column layout while keeping the spotlight card tall enough for the time/date column.
- Section stage labels now use a single viewport-fixed top banner that spans the page width and updates with the incoming section in both scroll directions.
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

- Provider fallback: The Odds API → OddsPAPI
- Session-level caching: Odds fetched once per page load, cached in sessionStorage for 5 minutes to eliminate redundant API calls during refresh cycles
- Cache-aware refresh and stale fallback behavior (localStorage: 60-minute TTL)
- Top-matchup badge recalculated when contender rankings refresh
- Embedded odds API keys are no longer hardcoded in client code.
- Odds can run either with explicit browser keys (`oddsApiKey`, `oddspapiKey`) for local testing, or through a proxy (`proxyBase`) so secrets stay server-side.

## Player Tournament Statistics

Player stats are automatically tracked from live FIFA match event data and stored in `squad-data.json`.

### Stats tracking

- Each player record includes a `tournamentStats` object with tournament performance data
- **Tracked stats**: goals, yellow cards, red cards
- **Data source**: FIFA live event feed (goal events and booking events)
- **Update frequency**: Daily via GitHub Actions (configured in `.github/workflows/update-tournament-stats.yml`)

### What's NOT tracked (FIFA API limitations)

- **Assists**: `IdAssistPlayer` field is rarely populated by FIFA API
- **Minutes played**: No granular match timing data available in live event feed
- **Appearances**: Incomplete without full match history tracking
- **Some goal scorers**: Rarely, a goal scorer may not be in the match roster (data inconsistency on FIFA's side)

### How it works

1. **update-player-stats.py** runs on schedule (daily at 2 AM UTC)
2. Loads processed match cache (`tournament-stats-cache.json`) to identify new matches
3. Fetches all completed World Cup 2026 matches from FIFA API
4. Filters to only new/unprocessed matches (avoids re-processing)
5. For each new match: extracts goal and booking events with player IDs
6. Identifies own goals and excludes them from player stats
7. Joins with squad records by team code + shirt number
8. Accumulates stats (does not reset previous data)
9. Records processed match IDs in cache
10. Commits changes to `squad-data.json` and `tournament-stats-cache.json`
11. Workflow auto-commits with message "Update player tournament statistics from FIFA API"

The cache prevents redundant processing: once a match is processed, it's never re-processed.

### Manual refresh

To run the updater locally:

```bash
python3 update-player-stats.py
```

### Live Match Centre integration

The Live Match Centre now displays enriched player data:

- **Squad roster** shows: shirt # | name (C) | goals scored | club | position
- **Default sort order**: Goals scored (descending) → Position → Shirt number
- Loads `squad-data.json` on page load to enrich live players with tournament stats and club information
- Players with tournament goals display goal count with ⚽ emoji
- Club name pulled from `squad-data.json` and displayed in muted text

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

1. Group Stage
2. Completed Matches
3. Live Match Centre
4. Group Tables
5. Round of 32
6. Round of 16
7. Finals
8. Special Interest

Each key screen page now exposes a sticky page-name banner at the top while scrolling (`Group Stage`, `Completed Matches`, `Live Match Centre`, `Group Tables`, `Round of 32`, `Round of 16`, `Finals`, `Special Interest Stats`) so section context remains visible through long content in either scroll direction.

## Group Tables

The Group Tables page displays standings for each group with the following columns:

- **Team**: Flag and team name
- **P**: Matches played
- **W/D/L**: Wins, draws, losses
- **GF/GA**: Goals for/against
- **GD**: Goal difference
- **🟨/🟥**: Tournament yellow/red cards (aggregated from player stats)
- **Pts**: Points

The card columns are updated automatically from player tournament statistics (`squad-data.json`), providing a comprehensive view of team discipline across the tournament.

## Print Scope

Printed pages include:

- Group Stage
- Round of 32
- Round of 16
- Finals

Screen-only operational pages (completed archive, live centre, group tables, special interest) remain excluded from print.

## Data Sources and Caching

### FIFA Data
- **Matches**: FIFA API (fixtures, statuses, scores)
- **Live details**: `match-details/` cache (local) → FIFA API (fallback)
- **Live events**: Real-time polling for actively played matches

### Match Detail Cache
- Location: `match-details/{matchId}.json`
- Updated: Daily via `update-player-stats.py` during tournament stats processing
- Strategy: Browser checks local cache first, falls back to FIFA API if not found
- Benefits: Faster page loads, reduced API calls, offline access to completed matches

### Other Sources
- OddsPAPI
- The Odds API
- The Guardian atom embed (special-interest card)
- Wikipedia-derived local datasets (winners/top-scorers)

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
- The tracker no longer shows a startup banner for file-origin access; use a local HTTP server only when your browser blocks the remote APIs you need.
- Use a local HTTP server for full network consistency if needed.

For a public/mobile deployment, prefer HTTPS hosting plus `proxyBase` so API secrets are not exposed in browser source.
