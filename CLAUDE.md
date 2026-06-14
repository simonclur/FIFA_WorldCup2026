# FIFA World Cup 2026 Tracker — Agent Instructions

**See also:** [README.md](README.md) (feature behavior), [STYLE_GUIDELINES.md](STYLE_GUIDELINES.md) (visual/interaction rules)

> This file is the Claude Code counterpart to `.github/copilot-instructions.md`.
> Both files contain the same workflow rules. If you update one, update the other.

## Start here

Before writing any code or making any change, read the project documentation:

- **[README.md](README.md)** — canonical record of all features, modules, refresh behavior, data sources, query parameters, and architecture decisions.
- **[STYLE_GUIDELINES.md](STYLE_GUIDELINES.md)** — visual hierarchy, print rules, density and typography guidelines, and multi-channel semantics rules.

Do not rely on scanning `index.html` to infer project structure. The README is the authoritative source.

## Architecture

This is a **single-file project**. All runtime logic, rendering, styles, and page structure live in `index.html`. Supporting files:

| File/Directory | Purpose |
|---|---|
| `squad-sunburst-data.js` | Pre-aggregated squad club-footprint data, loaded as a script |
| `squad-data.json` | Player-level squad records with tournament stats |
| `tournament-stats-cache.json` | Tracks which matches have been processed (prevents re-processing) |
| `match-details/` | Cached FIFA API live match detail responses (one JSON per match) |
| `parse-squads-v2.py` | Script that produces squad data files from PDF |
| `update-player-stats.py` | Fetches FIFA API match data, updates stats, saves match details |
| `README.md` | Feature and behavior documentation |
| `STYLE_GUIDELINES.md` | Visual and print design rules |

## After every code change

Update `README.md` to reflect what changed. Specifically:

- If a **new feature or behavior** was added, add or expand the relevant section.
- If a **refresh, timer, or data-flow behavior** changed, update the Live/Auto-Refresh section.
- If **page order, special interest cards, or print scope** changed, update the relevant sections in README.md and STYLE_GUIDELINES.md.
- If a **new query parameter** was added, update the Query Parameters table.
- If a **new data source or pipeline step** was introduced, update the Data Sources and/or pipeline sections.
- Live spotlight cards now include a browser-aware Listen Live action for talkSPORT that prefers the HLS stream and falls back to MP3 when HLS playback is unavailable.

Keep updates concise — one or two sentences per change is enough. Do not rewrite sections that are still accurate.

## Key conventions

- Brisbane time (`Australia/Brisbane` / AEST, no DST) is the canonical display timezone.
- The FIFA season ID is `285023`; do not hardcode other IDs.
- Live match polling is 60 s; base polling is 5 min; kickoff-triggered fetch fires at kickoff + 5 s.
- Match status semantics: `MatchStatus` 2–6 = actively played; `ResultType` 1 = completed.
- Odds provider fallback order: OddsPAPI → The Odds API.
- `isActivelyPlayedMatch()` is the single source of truth for live-state detection.
- Multi-channel state semantics: never rely on color alone — pair with label text and border treatment.

## Player Tournament Stats Schema

Each player in `squad-data.json` includes a `tournamentStats` object with stats tracked from FIFA API live events:

```json
{
  "nationalTeam": "Algeria",
  "jersey": 1,
  "playerName": "MASTIL Melvin",
  "club": "FC Stade Nyonnais",
  ...
  "tournamentStats": {
    "goals": 2,
    "yellowCards": 1,
    "redCards": 0
  }
}
```

**Available fields**: 
- `goals` — Goals scored (from goal events)
- `yellowCards` — Yellow cards received (from booking events)
- `redCards` — Red cards received (from booking events)

**Not tracked** (not available from FIFA API):
- Assists — IdAssistPlayer is rarely populated in goal events
- Minutes played — FIFA API provides no granular match timing
- Appearances — Incomplete without full tournament history

Stats are auto-updated by `update-player-stats.py` (GitHub Actions, daily) and manually via `python3 update-player-stats.py` locally. Do not edit `tournamentStats` manually — regenerate from FIFA API via the script.

## Live Match Centre: Player Enrichment

The Live Match Centre loads `squad-data.json` and enriches the live roster with:

- **Sort order**: Goals scored (desc) → Position → Shirt number
- **Display**: Shirt # | Name (C) | Goals (⚽) | Club | Position
- Enhanced player rows styled with `.live-player-row` class
- Graceful fallback if `squad-data.json` is unavailable (shows position only)

Function `renderLivePlayerList(team, teamName)` takes team detail and team name, looks up team code from squad data, enriches players, and renders sorted roster.

## Match Detail Caching

The Live Match Centre loads match details via `fetchLiveDetailByMatchId()` which:
1. Checks in-memory cache first (session)
2. Tries local cache: `match-details/{matchId}.json`
3. Falls back to FIFA API if local cache unavailable

This reduces API load and speeds up subsequent page views. The local cache is populated daily by `update-player-stats.py`.
