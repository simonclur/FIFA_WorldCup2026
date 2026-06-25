          <script>
            (function () {
              var s = document.createElement('script');
              s.src = 'https://interactive.guim.co.uk/atoms/2026/06/golden-boot-all-years/world-cup-2026/v/1781102474/app.js';
              s.async = true;
              document.body.appendChild(s);
            })();
          </script>
  <script>
    // Load squad-data.json for Live Match Centre enrichment and Group Tables
    let squadDataMap = null;
    fetch('./squad-data.json')
      .then(r => r.json())
      .then(squads => {
        squadDataMap = new Map();
        for (const player of squads) {
          const key = `${player.nationalTeamCode}|${player.jersey}`;
          squadDataMap.set(key, player);
        }
        // Store full array in state for Group Tables card aggregation
        state.squadData = squads;
        // Re-render Group Tables now that squad data is available (if already rendered)
        const groupTablesGrid = document.getElementById('group-tables-grid');
        if (groupTablesGrid && groupTablesGrid.innerHTML !== '') {
          renderGroupTablesPage();
          renderThirdPlacedTeamsPage();
        }
      })
      .catch(err => console.warn('Failed to load squad-data.json for player enrichment:', err));
  </script>
  <script>
    const timezone = 'Australia/Brisbane';
    const seasonId = '285023';
    const apiBase = 'https://api.fifa.com/api/v3';
    const refreshIntervalMs = 5 * 60 * 1000;
    const liveRefreshIntervalMs = 60 * 1000;

    const stageLabels = new Map([
      ['289273', 'First Stage'],
      ['289287', 'Round of 32'],
      ['289288', 'Round of 16'],
      ['289289', 'Quarter-final'],
      ['289290', 'Semi-final'],
      ['289291', 'Play-off for third place'],
      ['289292', 'Final'],
    ]);

    const knockoutStages = ['Round of 32', 'Round of 16'];
    const finalsStages = ['Quarter-final', 'Semi-final', 'Play-off for third place', 'Final'];

    const state = {
      matches: [],
      updatedAt: null,
      nextDataRefreshAt: null,
      refreshCadenceMs: refreshIntervalMs,
      lastFifaPullAt: null,
      lastFifaPullMatchCount: 0,
      lastFifaPullActiveCount: 0,
      lastFifaPullStatus: 'idle',
      lastFifaPullErrorMessage: '',
      nextUpKickoffTs: null,
      shouldAutoScrollNextUp: true,
      contenderTeams: new Set(),
      winnerOdds: [],
      matchOddsByKey: new Map(),
      providerLastSuccess: {
        oddspapi: null,
        'the-odds-api': null,
      },
      providerQuota: {
        oddspapi: null,
        'the-odds-api': null,
      },
      replayMatchId: null,
      replaySelectionSource: null,
      hoveredTeams: new Map(),
      hoveredMatchKey: null,
      oddsUpdatedAt: null,
      oddsSource: 'fallback',
      oddsBaselineRanks: new Map(),
      oddsBaselinePrices: new Map(),
      liveDetail: null,
      liveDetailUpdatedAt: null,
      liveDetailByMatchId: new Map(),
      pendingLiveDetailFetches: new Map(),
      liveTimer: null,
      scoreByMatchId: new Map(),
      hasPrimedScores: false,
      matchReminders: new Set(),
      preferredTeams: new Set(),
      preferredTeamLabels: new Map(),
      touchHoverLockedKey: null,
      suppressNextMatchClick: false,
      winnersSankeyTouchLock: null,
      winnersSankeyOutsidePointerHandler: null,
      topScorersFilters: {
        year: 'all',
        team: 'all',
        sortBy: 'year',
      },
      timer: null,
      kickoffTriggerTimer: null,
      squadData: [],
    };

    const worldCupTopScorers = [
      { year: 1930, tournament: 'Uruguay 1930', player: 'Guillermo Stábile', team: 'Argentina', goals: 8, matches: 4 },
      { year: 1934, tournament: 'Italy 1934', player: 'Oldřich Nejedlý', team: 'Czechoslovakia', goals: 5, matches: 4 },
      { year: 1938, tournament: 'France 1938', player: 'Leônidas', team: 'Brazil', goals: 7, matches: 4 },
      { year: 1950, tournament: 'Brazil 1950', player: 'Ademir', team: 'Brazil', goals: 9, matches: 6 },
      { year: 1954, tournament: 'Switzerland 1954', player: 'Sándor Kocsis', team: 'Hungary', goals: 11, matches: 5 },
      { year: 1958, tournament: 'Sweden 1958', player: 'Just Fontaine', team: 'France', goals: 13, matches: 6 },
      { year: 1962, tournament: 'Chile 1962', player: 'Garrincha', team: 'Brazil', goals: 4, matches: 6 },
      { year: 1966, tournament: 'England 1966', player: 'Eusébio', team: 'Portugal', goals: 9, matches: 6 },
      { year: 1970, tournament: 'Mexico 1970', player: 'Gerd Müller', team: 'West Germany', goals: 10, matches: 6 },
      { year: 1974, tournament: 'West Germany 1974', player: 'Grzegorz Lato', team: 'Poland', goals: 7, matches: 7 },
      { year: 1978, tournament: 'Argentina 1978', player: 'Mario Kempes', team: 'Argentina', goals: 6, matches: 7 },
      { year: 1982, tournament: 'Spain 1982', player: 'Paolo Rossi', team: 'Italy', goals: 6, matches: 7 },
      { year: 1986, tournament: 'Mexico 1986', player: 'Gary Lineker', team: 'England', goals: 6, matches: 5 },
      { year: 1990, tournament: 'Italy 1990', player: 'Salvatore Schillaci', team: 'Italy', goals: 6, matches: 7 },
      { year: 1994, tournament: 'United States 1994', player: 'Hristo Stoichkov', team: 'Bulgaria', goals: 6, matches: 7 },
      { year: 1998, tournament: 'France 1998', player: 'Davor Šuker', team: 'Croatia', goals: 6, matches: 7 },
      { year: 2002, tournament: 'South Korea & Japan 2002', player: 'Ronaldo', team: 'Brazil', goals: 8, matches: 7 },
      { year: 2006, tournament: 'Germany 2006', player: 'Miroslav Klose', team: 'Germany', goals: 5, matches: 7 },
      { year: 2010, tournament: 'South Africa 2010', player: 'Thomas Müller', team: 'Germany', goals: 5, matches: 6 },
      { year: 2014, tournament: 'Brazil 2014', player: 'James Rodríguez', team: 'Colombia', goals: 6, matches: 5 },
      { year: 2018, tournament: 'Russia 2018', player: 'Harry Kane', team: 'England', goals: 6, matches: 6 },
      { year: 2022, tournament: 'Qatar 2022', player: 'Kylian Mbappé', team: 'France', goals: 8, matches: 7 },
    ];

    const worldCupTopScorerYears = ['all', ...worldCupTopScorers.map((entry) => String(entry.year))];
    const worldCupTopScorerTeams = ['all', ...new Set(worldCupTopScorers.map((entry) => entry.team))].sort((left, right) => left.localeCompare(right));
    const worldCupTopScorerSortOptions = [
      { value: 'year', label: 'Year (newest first)' },
      { value: 'goals', label: 'Goals (#) first' },
    ];

    const worldCupChampionByYear = [
      { year: 1930, champion: 'Uruguay' },
      { year: 1934, champion: 'Italy' },
      { year: 1938, champion: 'Italy' },
      { year: 1950, champion: 'Uruguay' },
      { year: 1954, champion: 'West Germany' },
      { year: 1958, champion: 'Brazil' },
      { year: 1962, champion: 'Brazil' },
      { year: 1966, champion: 'England' },
      { year: 1970, champion: 'Brazil' },
      { year: 1974, champion: 'West Germany' },
      { year: 1978, champion: 'Argentina' },
      { year: 1982, champion: 'Italy' },
      { year: 1986, champion: 'Argentina' },
      { year: 1990, champion: 'West Germany' },
      { year: 1994, champion: 'Brazil' },
      { year: 1998, champion: 'France' },
      { year: 2002, champion: 'Brazil' },
      { year: 2006, champion: 'Italy' },
      { year: 2010, champion: 'Spain' },
      { year: 2014, champion: 'Germany' },
      { year: 2018, champion: 'France' },
      { year: 2022, champion: 'Argentina' },
    ];

    const positionLabels = {
      GK: 'Goalkeeper',
      DF: 'Defender',
      MF: 'Midfielder',
      FW: 'Forward',
    };

    const fallbackContenderTeams = new Set([
      'Argentina',
      'Brazil',
      'Colombia',
      'Croatia',
      'Denmark',
      'England',
      'Germany',
      'France',
      'Netherlands',
      'Morocco',
      'Mexico',
      'Portugal',
      'Switzerland',
      'Spain',
      'USA',
      'Uruguay',
      'Belgium',
      'Italy',
      'Japan',
      'South Korea',
      'Canada',
    ]);

    const defaultPreferredTeamNames = ['Australia'];
    const preferredTeamsStorageKey = 'fifa2026_preferred_teams_v1';
    const oddsMovementBaselineStorageKey = 'fifa2026_odds_movement_baseline_v1';

    const queryParams = new URLSearchParams(window.location.search);
    const configuredProxyBase = String(queryParams.get('proxyBase') || '').trim().replace(/\/+$/, '');
    const useApiProxy = Boolean(configuredProxyBase);
    const sbsMatchCentreBaseUrl = 'https://www.sbs.com.au/sport/fifa-world-cup-2026/match-centre';
    const configuredSbsMatchId = String(queryParams.get('sbsMatchId') || '4tcpns1nwyc0jtpucgzj9dp90').trim();
    const configuredDemoMatchId = String(queryParams.get('demoMatchId') || '').trim();
    state.replayMatchId = configuredDemoMatchId || null;
    state.replaySelectionSource = configuredDemoMatchId ? 'query' : null;
    const oddsApiKeysStorageKey = 'fifa2026_odds_api_keys_v1';

    function loadStoredOddsApiKeys() {
      try {
        const raw = localStorage.getItem(oddsApiKeysStorageKey);
        if (!raw) {
          return { theOddsApi: '', oddsPapi: '' };
        }

        const parsed = JSON.parse(raw);
        return {
          theOddsApi: String(parsed?.theOddsApi || '').trim(),
          oddsPapi: String(parsed?.oddsPapi || '').trim(),
        };
      } catch {
        return { theOddsApi: '', oddsPapi: '' };
      }
    }

    function saveStoredOddsApiKeys(keys) {
      try {
        localStorage.setItem(oddsApiKeysStorageKey, JSON.stringify({
          theOddsApi: String(keys?.theOddsApi || '').trim(),
          oddsPapi: String(keys?.oddsPapi || '').trim(),
        }));
      } catch {
        // Ignore storage failures.
      }
    }

    const storedOddsApiKeys = loadStoredOddsApiKeys();
    const resolvedOddsApiKey = (queryParams.get('oddsApiKey') || storedOddsApiKeys.theOddsApi || '').trim();
    const resolvedOddsPapiKey = (queryParams.get('oddspapiKey') || queryParams.get('oddsPapiKey') || storedOddsApiKeys.oddsPapi || '').trim();

    if (resolvedOddsApiKey || resolvedOddsPapiKey) {
      saveStoredOddsApiKeys({
        theOddsApi: resolvedOddsApiKey,
        oddsPapi: resolvedOddsPapiKey,
      });
    }

    const oddsConfig = {
      forceRefresh: ['1', 'true', 'yes'].includes((queryParams.get('oddsForce') || '').toLowerCase()),
      provider: (queryParams.get('oddsProvider') || 'auto').toLowerCase(),
      proxyBase: configuredProxyBase,
      useProxy: useApiProxy,
      topTeamsCount: 32,
      refreshMs: 60 * 60 * 60 * 1000,
      highlightWindowDays: 7,
      cacheKeyBase: 'fifa2026_odds_contenders_v4',
      providerStatusKey: 'fifa2026_odds_provider_status_v1',
      lastSnapshotKey: 'fifa2026_odds_last_snapshot_v1',
      theOddsApi: {
        apiKey: resolvedOddsApiKey,
        sportKey: 'soccer_fifa_world_cup_winner',
        regions: 'uk,eu',
        markets: 'outrights',
        oddsFormat: 'decimal',
      },
      oddsPapi: {
        apiKey: resolvedOddsPapiKey,
        sportId: 10,
        bookmakers: 'pinnacle',
        language: 'en',
        verbosity: 3,
        oddsFormat: 'decimal',
      },
    };

    const buildUrlWithParams = (baseUrl, params = {}) => {
      const url = new URL(baseUrl);
      Object.entries(params || {}).forEach(([key, value]) => {
        if (value === null || value === undefined || value === '') {
          return;
        }
        url.searchParams.set(key, String(value));
      });
      return url.toString();
    };

    const buildFifaApiUrl = (path, params = {}) => {
      const safePath = String(path || '').startsWith('/') ? String(path) : `/${String(path || '')}`;
      const base = oddsConfig.useProxy
        ? `${oddsConfig.proxyBase}/fifa${safePath}`
        : `${apiBase}${safePath}`;
      return buildUrlWithParams(base, params);
    };

    const buildOddsApiUrl = (provider, path, params = {}) => {
      const safePath = String(path || '').startsWith('/') ? String(path) : `/${String(path || '')}`;
      if (oddsConfig.useProxy) {
        return buildUrlWithParams(`${oddsConfig.proxyBase}/odds/${provider}${safePath}`, params);
      }

      const directBaseByProvider = {
        oddspapi: 'https://api.oddspapi.io',
        'the-odds-api': 'https://api.the-odds-api.com',
      };
      const directBase = directBaseByProvider[String(provider || '').toLowerCase()];
      if (!directBase) {
        throw new Error(`Unsupported odds provider URL builder: ${provider}`);
      }

      return buildUrlWithParams(`${directBase}${safePath}`, params);
    };

    const dateFormatter = new Intl.DateTimeFormat('en-AU', {
      timeZone: timezone,
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });

    const updateFormatter = new Intl.DateTimeFormat('en-AU', {
      timeZone: timezone,
      dateStyle: 'medium',
      timeStyle: 'short',
    });

    const scoreFormatter = (match) => {
      const homeScore = Number.isFinite(match.HomeTeamScore) ? match.HomeTeamScore : match?.Home?.Score;
      const awayScore = Number.isFinite(match.AwayTeamScore) ? match.AwayTeamScore : match?.Away?.Score;

      if (!Number.isFinite(homeScore) || !Number.isFinite(awayScore)) {
        return 'vs';
      }

      return `${homeScore}-${awayScore}`;
    };

    const flagUrl = (side) => {
      const country = side?.IdCountry || side?.Abbreviation;
      return country ? `https://api.fifa.com/api/v3/picture/flags-sq-1/${country}` : '';
    };

    const teamName = (side) => {
      const description = side?.TeamName?.find((entry) => entry.Locale === 'en-GB')?.Description;
      return description || side?.ShortClubName || side?.Abbreviation || 'TBD';
    };

    const canonicalTeamName = (name) => {
      const normalized = String(name || '')
        .toLowerCase()
        .normalize('NFKD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9 ]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

      const aliases = {
        usa: 'united states',
        'united states of america': 'united states',
        'u s a': 'united states',
        'korea republic': 'south korea',
        'republic of korea': 'south korea',
        'korea rep': 'south korea',
        czechia: 'czech republic',
        'ivory coast': 'cote d ivoire',
        "cote d'ivoire": 'cote d ivoire',
        'cote divoire': 'cote d ivoire',
        'cote d ivoire': 'cote d ivoire',
        'ir iran': 'iran',
        'islamic republic of iran': 'iran',
        'cape verde': 'cabo verde',
        'congo dr': 'dr congo',
        'dr congo': 'dr congo',
        'democratic republic of congo': 'dr congo',
        'north macedonia': 'macedonia',
        bosnia: 'bosnia and herzegovina',
        'bosnia and herzegovina': 'bosnia and herzegovina',
        'bosnia herzegovina': 'bosnia and herzegovina',
        'bosnia & herzegovina': 'bosnia and herzegovina',
      };

      return aliases[normalized] || normalized;
    };

    const displayTeamName = (name) => {
      const value = String(name || '').trim();
      if (!value) {
        return 'TBD';
      }

      const canonical = canonicalTeamName(value);
      if (canonical === 'bosnia and herzegovina') {
        return 'Bosnia';
      }

      return value;
    };

    const loadStoredPreferredTeams = () => {
      try {
        const raw = localStorage.getItem(preferredTeamsStorageKey);
        if (!raw) {
          return defaultPreferredTeamNames.map(canonicalTeamName).filter(Boolean);
        }

        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed)) {
          return defaultPreferredTeamNames.map(canonicalTeamName).filter(Boolean);
        }

        const normalized = parsed
          .map((value) => canonicalTeamName(value))
          .filter(Boolean);

        return normalized.length
          ? [...new Set(normalized)]
          : defaultPreferredTeamNames.map(canonicalTeamName).filter(Boolean);
      } catch {
        return defaultPreferredTeamNames.map(canonicalTeamName).filter(Boolean);
      }
    };

    const saveStoredPreferredTeams = (teams) => {
      try {
        localStorage.setItem(preferredTeamsStorageKey, JSON.stringify(
          [...new Set((teams || []).map((team) => canonicalTeamName(team)).filter(Boolean))],
        ));
      } catch {
        // Ignore storage failures.
      }
    };

    const collectTeamLabels = (matches) => {
      const labels = new Map();

      for (const match of matches || []) {
        const homeRaw = teamName(match.Home);
        const awayRaw = teamName(match.Away);
        const home = displayTeamName(homeRaw);
        const away = displayTeamName(awayRaw);
        const homeCanonical = canonicalTeamName(homeRaw);
        const awayCanonical = canonicalTeamName(awayRaw);

        if (homeCanonical && home && home !== 'TBD' && !labels.has(homeCanonical)) {
          labels.set(homeCanonical, home);
        }

        if (awayCanonical && away && away !== 'TBD' && !labels.has(awayCanonical)) {
          labels.set(awayCanonical, away);
        }
      }

      for (const name of fallbackContenderTeams) {
        const canonical = canonicalTeamName(name);
        if (canonical && !labels.has(canonical)) {
          labels.set(canonical, displayTeamName(name));
        }
      }

      return labels;
    };

    const applyPreferredTeamSelection = (teams, options = {}) => {
      const normalized = [...new Set((teams || [])
        .map((team) => canonicalTeamName(team))
        .filter(Boolean))];

      state.preferredTeams = new Set(normalized);

      if (options.persist !== false) {
        saveStoredPreferredTeams(normalized);
      }
    };

    const getPreferredTeamsForMatch = (match) => {
      const labels = [];
      const seen = new Set();

      const homeRaw = teamName(match.Home);
      const awayRaw = teamName(match.Away);
      const home = displayTeamName(homeRaw);
      const away = displayTeamName(awayRaw);
      const homeCanonical = canonicalTeamName(homeRaw);
      const awayCanonical = canonicalTeamName(awayRaw);

      if (homeCanonical && state.preferredTeams.has(homeCanonical) && !seen.has(homeCanonical)) {
        labels.push(state.preferredTeamLabels.get(homeCanonical) || home || 'Preferred');
        seen.add(homeCanonical);
      }

      if (awayCanonical && state.preferredTeams.has(awayCanonical) && !seen.has(awayCanonical)) {
        labels.push(state.preferredTeamLabels.get(awayCanonical) || away || 'Preferred');
        seen.add(awayCanonical);
      }

      return labels;
    };

    const isPreferredTeamMatch = (match) => getPreferredTeamsForMatch(match).length > 0;

    const togglePreferredTeam = (canonicalTeam) => {
      const canonical = canonicalTeamName(canonicalTeam);
      if (!canonical) {
        return;
      }

      const next = new Set(state.preferredTeams);
      if (next.has(canonical)) {
        next.delete(canonical);
      } else {
        next.add(canonical);
      }

      applyPreferredTeamSelection([...next], { persist: true });
      renderPreferredTeamSelector();
      rerenderMatchPages();
    };

    const renderPreferredTeamSelector = () => {
      const chipsNode = document.getElementById('preferred-team-chips');
      const hintNode = document.getElementById('preferred-team-hint');
      if (!chipsNode || !hintNode) {
        return;
      }

      const teamLabels = collectTeamLabels(state.matches || []);
      state.preferredTeamLabels = teamLabels;

      const options = [...teamLabels.entries()]
        .map(([canonical, label]) => ({ canonical, label }))
        .sort((left, right) => left.label.localeCompare(right.label));

      const selected = new Set([...state.preferredTeams].filter((team) => teamLabels.has(team)));
      state.preferredTeams = selected;

      chipsNode.innerHTML = options
        .map((entry) => `<button type="button" class="team-chip${selected.has(entry.canonical) ? ' is-selected' : ''}" data-team="${escapeHtml(entry.canonical)}" aria-pressed="${selected.has(entry.canonical) ? 'true' : 'false'}">${escapeHtml(entry.label)}</button>`)
        .join('');

      const selectedLabels = [...selected]
        .map((canonical) => teamLabels.get(canonical) || canonical)
        .sort((left, right) => left.localeCompare(right));

      hintNode.textContent = selectedLabels.length
        ? `Highlighting matches for: ${selectedLabels.join(', ')}`
        : 'No preferred teams selected. Choose one or more teams to highlight their matches.';
    };

    const rerenderMatchPages = () => {
      renderGroupStage();
      renderKnockoutPage('round32-grid', knockoutStages.slice(0, 1), 'round32-rendered-at', 'Round of 32');
      renderKnockoutPage('round16-grid', knockoutStages.slice(1, 2), 'round16-rendered-at', 'Round of 16');
      renderKnockoutPage('finals-grid', finalsStages, 'finals-rendered-at', 'Finals');
      renderThirdPlacedTeamsPage();
      renderPredictedBracketPage();
      renderCompletedPage();
    };

    const toMatchDayKey = (dateLike) => {
      if (!dateLike) {
        return 'unknown';
      }

      const date = new Date(dateLike);
      if (Number.isNaN(date.getTime())) {
        return 'unknown';
      }

      return new Intl.DateTimeFormat('en-CA', {
        timeZone: timezone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).format(date);
    };

    const toMatchOddsKey = (homeTeamName, awayTeamName, kickoffDate) => {
      const homeCanonical = canonicalTeamName(homeTeamName);
      const awayCanonical = canonicalTeamName(awayTeamName);
      const day = toMatchDayKey(kickoffDate);
      return `${day}|${homeCanonical}|${awayCanonical}`;
    };

    const formatOdd = (value) => {
      if (!Number.isFinite(value) || value <= 1) {
        return '-';
      }

      return value >= 10 ? value.toFixed(1) : value.toFixed(2);
    };

    const loadOddsProviderStatus = () => {
      try {
        const raw = localStorage.getItem(oddsConfig.providerStatusKey);
        if (!raw) {
          return;
        }

        const parsed = JSON.parse(raw);

        const lastSuccessSource = parsed && typeof parsed === 'object' && parsed.lastSuccess
          ? parsed.lastSuccess
          : parsed;

        for (const provider of ['oddspapi', 'the-odds-api']) {
          const timestamp = Number(lastSuccessSource?.[provider]);
          state.providerLastSuccess[provider] = Number.isFinite(timestamp) && timestamp > 0 ? timestamp : null;

          const quota = parsed?.quota?.[provider];
          if (quota && typeof quota === 'object') {
            state.providerQuota[provider] = {
              remaining: Number.isFinite(Number(quota.remaining)) ? Number(quota.remaining) : null,
              used: Number.isFinite(Number(quota.used)) ? Number(quota.used) : null,
              lastCost: Number.isFinite(Number(quota.lastCost)) ? Number(quota.lastCost) : null,
              limit: Number.isFinite(Number(quota.limit)) ? Number(quota.limit) : null,
              resetAt: String(quota.resetAt || '').trim() || null,
              updatedAt: Number.isFinite(Number(quota.updatedAt)) ? Number(quota.updatedAt) : null,
            };
          }
        }
      } catch {
        // Ignore status read failures.
      }
    };

    const saveOddsProviderStatus = () => {
      try {
        localStorage.setItem(oddsConfig.providerStatusKey, JSON.stringify({
          lastSuccess: state.providerLastSuccess,
          quota: state.providerQuota,
        }));
      } catch {
        // Ignore status write failures.
      }
    };

    const getHeaderNumber = (headers, names) => {
      for (const name of names) {
        const raw = headers.get(name);
        if (raw === null || String(raw).trim() === '') {
          continue;
        }

        const value = Number(raw);
        if (Number.isFinite(value)) {
          return value;
        }
      }

      return null;
    };

    const getHeaderText = (headers, names) => {
      for (const name of names) {
        const value = String(headers.get(name) || '').trim();
        if (value) {
          return value;
        }
      }

      return null;
    };

    const updateOddsProviderQuota = (provider, headers) => {
      if (!provider || !headers || typeof headers.get !== 'function') {
        return;
      }

      let remaining = null;
      let used = null;
      let lastCost = null;
      let limit = null;
      let resetAt = null;

      if (provider === 'the-odds-api') {
        remaining = getHeaderNumber(headers, ['x-requests-remaining']);
        used = getHeaderNumber(headers, ['x-requests-used']);
        lastCost = getHeaderNumber(headers, ['x-requests-last']);
        limit = getHeaderNumber(headers, ['x-requests-limit']);
      } else if (provider === 'oddspapi') {
        remaining = getHeaderNumber(headers, ['x-ratelimit-remaining', 'ratelimit-remaining', 'x-requests-remaining']);
        used = getHeaderNumber(headers, ['x-ratelimit-used', 'ratelimit-used', 'x-requests-used']);
        limit = getHeaderNumber(headers, ['x-ratelimit-limit', 'ratelimit-limit', 'x-requests-limit']);
        resetAt = getHeaderText(headers, ['x-ratelimit-reset', 'ratelimit-reset']);
      }

      if (
        remaining === null
        && used === null
        && lastCost === null
        && limit === null
        && !resetAt
      ) {
        return;
      }

      const previous = state.providerQuota[provider] || {};
      state.providerQuota[provider] = {
        remaining: remaining ?? (Number.isFinite(Number(previous.remaining)) ? Number(previous.remaining) : null),
        used: used ?? (Number.isFinite(Number(previous.used)) ? Number(previous.used) : null),
        lastCost: lastCost ?? (Number.isFinite(Number(previous.lastCost)) ? Number(previous.lastCost) : null),
        limit: limit ?? (Number.isFinite(Number(previous.limit)) ? Number(previous.limit) : null),
        resetAt: resetAt || previous.resetAt || null,
        updatedAt: Date.now(),
      };

      saveOddsProviderStatus();
    };

    const markOddsProviderSuccess = (provider) => {
      if (!provider) {
        return;
      }

      state.providerLastSuccess[provider] = Date.now();
      saveOddsProviderStatus();
    };

    const formatProviderSuccess = (provider) => {
      const timestamp = state.providerLastSuccess[provider];
      if (!timestamp) {
        return 'never';
      }

      return updateFormatter.format(new Date(timestamp));
    };

    const formatProviderQuota = (provider) => {
      const quota = state.providerQuota[provider];
      if (!quota) {
        return 'quota n/a';
      }

      const remaining = Number.isFinite(Number(quota.remaining)) ? Number(quota.remaining) : null;
      const used = Number.isFinite(Number(quota.used)) ? Number(quota.used) : null;
      const lastCost = Number.isFinite(Number(quota.lastCost)) ? Number(quota.lastCost) : null;
      const limit = Number.isFinite(Number(quota.limit)) ? Number(quota.limit) : null;

      const parts = [];
      if (remaining !== null) {
        parts.push(`remaining ${remaining}`);
      }

      if (used !== null) {
        parts.push(`used ${used}`);
      }

      if (limit !== null) {
        parts.push(`limit ${limit}`);
      }

      if (lastCost !== null) {
        parts.push(`last ${lastCost}`);
      }

      return parts.length ? parts.join(' | ') : 'quota n/a';
    };

    const providerFreshness = (provider) => {
      const timestamp = state.providerLastSuccess[provider];
      if (!timestamp) {
        return { className: 'never', label: 'Never' };
      }

      const ageMs = Date.now() - timestamp;
      if (ageMs <= oddsConfig.refreshMs) {
        return { className: 'fresh', label: 'Fresh' };
      }

      if (ageMs <= oddsConfig.refreshMs * 2) {
        return { className: 'stale', label: 'Stale' };
      }

      return { className: 'old', label: 'Old' };
    };

    const loadOddsMovementBaseline = () => {
      try {
        const raw = localStorage.getItem(oddsMovementBaselineStorageKey);
        if (!raw) {
          return { ranks: new Map(), prices: new Map() };
        }

        const parsed = JSON.parse(raw);
        if (!parsed || typeof parsed !== 'object') {
          return { ranks: new Map(), prices: new Map() };
        }

        const ranks = new Map();
        const prices = new Map();
        for (const [canonical, payload] of Object.entries(parsed)) {
          const normalized = canonicalTeamName(canonical);
          const numericRank = Number(payload?.rank ?? payload);
          const numericPrice = Number(payload?.price);
          if (!normalized || !Number.isFinite(numericRank) || numericRank <= 0) {
            continue;
          }

          ranks.set(normalized, numericRank);
          if (Number.isFinite(numericPrice) && numericPrice > 1) {
            prices.set(normalized, numericPrice);
          }
        }

        return { ranks, prices };
      } catch {
        return { ranks: new Map(), prices: new Map() };
      }
    };

    const saveOddsMovementBaseline = () => {
      try {
        const snapshot = Object.fromEntries([...state.oddsBaselineRanks.entries()]
          .filter(([, rank]) => Number.isFinite(Number(rank)) && Number(rank) > 0)
          .map(([canonical, rank]) => {
            const price = Number(state.oddsBaselinePrices.get(canonical));
            return [canonical, {
              rank: Number(rank),
              price: Number.isFinite(price) && price > 1 ? price : null,
            }];
          }));
        localStorage.setItem(oddsMovementBaselineStorageKey, JSON.stringify(snapshot));
      } catch {
        // Ignore storage failures.
      }
    };

    const buildWinnerSnapshotMap = (winnerOdds) => {
      const snapshotMap = new Map();
      const rows = Array.isArray(winnerOdds) ? winnerOdds : [];

      rows.forEach((entry, index) => {
        const canonical = canonicalTeamName(entry?.canonical || entry?.team || '');
        const price = Number(entry?.price);
        if (!canonical || snapshotMap.has(canonical)) {
          return;
        }

        snapshotMap.set(canonical, {
          rank: index + 1,
          price: Number.isFinite(price) && price > 1 ? price : Number.NaN,
        });
      });

      return snapshotMap;
    };

    const syncOddsMovementBaseline = (winnerOdds) => {
      if (!(state.oddsBaselineRanks instanceof Map)) {
        state.oddsBaselineRanks = new Map();
      }

      if (!(state.oddsBaselinePrices instanceof Map)) {
        state.oddsBaselinePrices = new Map();
      }

      if (!state.oddsBaselineRanks.size) {
        const baseline = loadOddsMovementBaseline();
        state.oddsBaselineRanks = baseline.ranks;
        state.oddsBaselinePrices = baseline.prices;
      }

      const currentSnapshot = buildWinnerSnapshotMap(winnerOdds);
      let changed = false;

      for (const [canonical, payload] of currentSnapshot.entries()) {
        const rank = Number(payload?.rank);
        const price = Number(payload?.price);
        if (!state.oddsBaselineRanks.has(canonical)) {
          state.oddsBaselineRanks.set(canonical, rank);
          changed = true;
        }

        if (!state.oddsBaselinePrices.has(canonical) && Number.isFinite(price) && price > 1) {
          state.oddsBaselinePrices.set(canonical, price);
          changed = true;
        }
      }

      if (changed) {
        saveOddsMovementBaseline();
      }

      return currentSnapshot;
    };

    const renderProviderStatusLine = () => {
      const oddspapi = providerFreshness('oddspapi');
      const theOdds = providerFreshness('the-odds-api');

      return `
        <div class="odds-status-row">
          <span class="odds-status-pill ${oddspapi.className}">OddsPAPI: ${oddspapi.label} (${escapeHtml(formatProviderSuccess('oddspapi'))}) | ${escapeHtml(formatProviderQuota('oddspapi'))}</span>
          <span class="odds-status-pill ${theOdds.className}">The Odds API: ${theOdds.label} (${escapeHtml(formatProviderSuccess('the-odds-api'))}) | ${escapeHtml(formatProviderQuota('the-odds-api'))}</span>
        </div>
      `;
    };

    const isContenderMatch = (match) => {
      const homeTeam = canonicalTeamName(teamName(match.Home));
      const awayTeam = canonicalTeamName(teamName(match.Away));
      return state.contenderTeams.has(homeTeam) && state.contenderTeams.has(awayTeam);
    };

    const isNextUpMatch = (match) => {
      if (!match?.Date || !Number.isFinite(state.nextUpKickoffTs)) {
        return false;
      }

      const kickoff = new Date(match.Date);
      if (Number.isNaN(kickoff.getTime())) {
        return false;
      }

      return kickoff.getTime() === state.nextUpKickoffTs;
    };

    const computeNextUpKickoffTs = (matches) => {
      const now = Date.now();
      let nextUp = null;

      for (const match of matches || []) {
        const kickoff = new Date(match?.Date || 0).getTime();
        if (!Number.isFinite(kickoff) || kickoff < now) {
          continue;
        }

        if (nextUp === null || kickoff < nextUp) {
          nextUp = kickoff;
        }
      }

      return nextUp;
    };

    const getNextUpTeams = () => {
      if (!Number.isFinite(state.nextUpKickoffTs)) {
        return new Map();
      }

      const teams = new Map();
      for (const match of state.matches || []) {
        const kickoff = new Date(match?.Date || 0).getTime();
        if (!Number.isFinite(kickoff) || kickoff !== state.nextUpKickoffTs) {
          continue;
        }

        const homeName = teamName(match.Home);
        const awayName = teamName(match.Away);
        const homeCanonical = canonicalTeamName(homeName);
        const awayCanonical = canonicalTeamName(awayName);

        if (homeCanonical && !teams.has(homeCanonical)) {
          teams.set(homeCanonical, homeName);
        }

        if (awayCanonical && !teams.has(awayCanonical)) {
          teams.set(awayCanonical, awayName);
        }
      }

      return teams;
    };

    const getHoveredTeams = () => {
      if (!(state.hoveredTeams instanceof Map)) {
        return new Map();
      }

      return state.hoveredTeams;
    };

    const isWithinHighlightWindow = (match) => {
      if (!match?.Date) {
        return false;
      }

      const kickoff = new Date(match.Date);
      if (Number.isNaN(kickoff.getTime())) {
        return false;
      }

      const now = new Date();
      const windowEnd = new Date(now.getTime() + oddsConfig.highlightWindowDays * 24 * 60 * 60 * 1000);
      return kickoff >= now && kickoff <= windowEnd;
    };

    const getOddsProviderContext = () => {
      const hasProxy = oddsConfig.useProxy;
      const hasTheOddsApi = Boolean(oddsConfig.theOddsApi.apiKey);
      const hasOddsPapi = Boolean(oddsConfig.oddsPapi.apiKey);

      if (oddsConfig.provider === 'oddspapi') {
        if (hasOddsPapi) {
          return { provider: 'oddspapi', apiKey: oddsConfig.oddsPapi.apiKey };
        }

        return hasProxy ? { provider: 'oddspapi', apiKey: 'proxy' } : { provider: 'none', apiKey: '' };
      }

      if (oddsConfig.provider === 'the-odds-api') {
        if (hasTheOddsApi) {
          return { provider: 'the-odds-api', apiKey: oddsConfig.theOddsApi.apiKey };
        }

        return hasProxy ? { provider: 'the-odds-api', apiKey: 'proxy' } : { provider: 'none', apiKey: '' };
      }

      if (hasTheOddsApi) {
        return { provider: 'the-odds-api', apiKey: oddsConfig.theOddsApi.apiKey };
      }

      if (hasProxy) {
        return { provider: 'the-odds-api', apiKey: 'proxy' };
      }

      if (hasOddsPapi) {
        return { provider: 'oddspapi', apiKey: oddsConfig.oddsPapi.apiKey };
      }

      return { provider: 'none', apiKey: '' };
    };

    const getOddsCacheKey = (provider, apiKey) => {
      const keySuffix = String(apiKey || 'nokey').slice(0, 12);
      return `${oddsConfig.cacheKeyBase}_${provider}_${keySuffix}`;
    };

    const getSessionOddsCacheKey = (provider, apiKey) => {
      const keySuffix = String(apiKey || 'nokey').slice(0, 12);
      return `fifa2026_odds_session_${provider}_${keySuffix}`;
    };

    const getCachedOddsFromSession = (provider, apiKey) => {
      try {
        const key = getSessionOddsCacheKey(provider, apiKey);
        const raw = sessionStorage.getItem(key);
        if (!raw) return null;

        const parsed = JSON.parse(raw);
        if (!parsed || typeof parsed.updatedAt !== 'number') return null;

        const age = Date.now() - parsed.updatedAt;
        if (age > 5 * 60 * 1000) return null;

        return parsed;
      } catch {
        return null;
      }
    };

    const setCachedOddsInSession = (provider, apiKey) => {
      try {
        const key = getSessionOddsCacheKey(provider, apiKey);
        const snapshot = {
          teams: [...state.contenderTeams],
          winnerOdds: state.winnerOdds,
          matchOdds: [...state.matchOddsByKey.entries()],
          updatedAt: Date.now(),
        };
        sessionStorage.setItem(key, JSON.stringify(snapshot));
      } catch {
        // Ignore storage failures.
      }
    };

    const getCachedOddsContenders = (provider, apiKey, options = {}) => {
      try {
        const ignoreForce = Boolean(options.ignoreForce);
        const ignoreAge = Boolean(options.ignoreAge);
        const raw = localStorage.getItem(getOddsCacheKey(provider, apiKey));
        if (!raw) {
          return null;
        }

        const parsed = JSON.parse(raw);
        if (!parsed || !Array.isArray(parsed.teams) || typeof parsed.updatedAt !== 'number') {
          return null;
        }

        if (!ignoreForce && oddsConfig.forceRefresh) {
          return null;
        }

        if (!ignoreAge && (Date.now() - parsed.updatedAt) > oddsConfig.refreshMs) {
          return null;
        }

        return parsed;
      } catch {
        return null;
      }
    };

    const setCachedOddsContenders = (provider, apiKey, teams) => {
      try {
        const snapshot = {
          teams,
          winnerOdds: state.winnerOdds,
          matchOdds: [...state.matchOddsByKey.entries()],
          updatedAt: Date.now(),
        };
        localStorage.setItem(getOddsCacheKey(provider, apiKey), JSON.stringify(snapshot));
        localStorage.setItem(oddsConfig.lastSnapshotKey, JSON.stringify({
          ...snapshot,
          provider,
        }));
      } catch {
        // Ignore storage failures.
      }
    };

    const getLastOddsSnapshot = () => {
      try {
        const raw = localStorage.getItem(oddsConfig.lastSnapshotKey);
        if (!raw) {
          return null;
        }

        const parsed = JSON.parse(raw);
        if (!parsed || !Array.isArray(parsed.teams) || typeof parsed.updatedAt !== 'number') {
          return null;
        }

        return parsed;
      } catch {
        return null;
      }
    };

    const extractTopTeamsFromOutrights = (payload) => {
      if (!Array.isArray(payload)) {
        return [];
      }

      const bestPriceByTeam = new Map();

      for (const event of payload) {
        for (const bookmaker of (event.bookmakers || [])) {
          for (const market of (bookmaker.markets || [])) {
            if (market.key !== 'outrights') {
              continue;
            }

            for (const outcome of (market.outcomes || [])) {
              const canonical = canonicalTeamName(outcome.name);
              const price = Number(outcome.price);
              if (!canonical || !Number.isFinite(price) || price <= 0) {
                continue;
              }

              const existing = bestPriceByTeam.get(canonical);
              if (!existing || price < existing.price) {
                bestPriceByTeam.set(canonical, {
                  canonical,
                  sourceName: outcome.name,
                  price,
                });
              }
            }
          }
        }
      }

      return [...bestPriceByTeam.values()]
        .sort((a, b) => a.price - b.price)
        .slice(0, oddsConfig.topTeamsCount)
        .map((entry) => entry.canonical);
    };

    const extractWinnerOddsFromTheOddsApi = (payload) => {
      if (!Array.isArray(payload)) {
        return [];
      }

      const bestPriceByTeam = new Map();

      for (const event of payload) {
        for (const bookmaker of (event.bookmakers || [])) {
          for (const market of (bookmaker.markets || [])) {
            if (market.key !== 'outrights') {
              continue;
            }

            for (const outcome of (market.outcomes || [])) {
              const team = String(outcome.name || '').trim();
              const canonical = canonicalTeamName(team);
              const price = Number(outcome.price);
              if (!canonical || !team || !Number.isFinite(price) || price <= 1) {
                continue;
              }

              const existing = bestPriceByTeam.get(canonical);
              if (!existing || price < existing.price) {
                bestPriceByTeam.set(canonical, { team, canonical, price });
              }
            }
          }
        }
      }

      return [...bestPriceByTeam.values()]
        .sort((a, b) => a.price - b.price)
        .map((entry) => ({ team: entry.team, canonical: entry.canonical, price: entry.price }));
    };

    const normalizeOddsPapiFixtures = (payload) => {
      if (Array.isArray(payload)) {
        return payload;
      }

      if (Array.isArray(payload?.fixtures)) {
        return payload.fixtures;
      }

      if (Array.isArray(payload?.results)) {
        return payload.results;
      }

      if (payload?.fixtureId) {
        return [payload];
      }

      if (payload && typeof payload === 'object') {
        return Object.values(payload).filter((item) => item && typeof item === 'object' && item.fixtureId);
      }

      return [];
    };

    const updateBestPrice = (bestPriceByTeam, teamNameValue, price) => {
      const canonical = canonicalTeamName(teamNameValue);
      if (!canonical || !Number.isFinite(price) || price <= 0) {
        return;
      }

      const existing = bestPriceByTeam.get(canonical);
      if (!existing || price < existing.price) {
        bestPriceByTeam.set(canonical, { canonical, price });
      }
    };

    const extractTopTeamsFromOddsPapi = (payload) => {
      const fixtures = normalizeOddsPapiFixtures(payload);
      const bestPriceByTeam = new Map();

      for (const fixture of fixtures) {
        const homeTeam = fixture?.participant1Name || fixture?.participant1ShortName || fixture?.participant1Abbr;
        const awayTeam = fixture?.participant2Name || fixture?.participant2ShortName || fixture?.participant2Abbr;

        if (!homeTeam || !awayTeam) {
          continue;
        }

        for (const bookmaker of Object.values(fixture?.bookmakerOdds || {})) {
          for (const [outcomeId, outcome] of Object.entries(bookmaker?.markets || {}).flatMap(([, market]) => Object.entries(market?.outcomes || {}))) {
            for (const player of Object.values(outcome?.players || {})) {
              const price = Number(player?.price);
              const outcomeCode = String(outcomeId || '').toLowerCase();
              const bookmakerOutcomeId = String(player?.bookmakerOutcomeId || '').toLowerCase();

              const isHome = outcomeCode === '101' || bookmakerOutcomeId === 'home' || bookmakerOutcomeId.endsWith('/home');
              const isAway = outcomeCode === '103' || bookmakerOutcomeId === 'away' || bookmakerOutcomeId.endsWith('/away');

              if (isHome) {
                updateBestPrice(bestPriceByTeam, homeTeam, price);
              }

              if (isAway) {
                updateBestPrice(bestPriceByTeam, awayTeam, price);
              }
            }
          }
        }
      }

      return [...bestPriceByTeam.values()]
        .sort((a, b) => a.price - b.price)
        .slice(0, oddsConfig.topTeamsCount)
        .map((entry) => entry.canonical);
    };

    const extractWinnerOddsFromOddsPapi = (payload) => {
      const fixtures = normalizeOddsPapiFixtures(payload);
      const bestPriceByTeam = new Map();

      for (const fixture of fixtures) {
        for (const bookmaker of Object.values(fixture?.bookmakerOdds || {})) {
          for (const market of Object.values(bookmaker?.markets || {})) {
            for (const outcome of Object.values(market?.outcomes || {})) {
              for (const player of Object.values(outcome?.players || {})) {
                const name = String(player?.playerName || '').trim();
                const price = Number(player?.price);
                const canonical = canonicalTeamName(name);
                if (!name || !canonical || !Number.isFinite(price) || price <= 1) {
                  continue;
                }

                const existing = bestPriceByTeam.get(canonical);
                if (!existing || price < existing.price) {
                  bestPriceByTeam.set(canonical, { team: name, canonical, price });
                }
              }
            }
          }
        }
      }

      return [...bestPriceByTeam.values()].sort((a, b) => a.price - b.price);
    };

    const extractMatchOddsFromOddsPapi = (payload) => {
      const fixtures = normalizeOddsPapiFixtures(payload);
      const bestByMatch = new Map();

      for (const fixture of fixtures) {
        const homeTeam = fixture?.participant1Name || fixture?.participant1ShortName || fixture?.participant1Abbr;
        const awayTeam = fixture?.participant2Name || fixture?.participant2ShortName || fixture?.participant2Abbr;
        if (!homeTeam || !awayTeam || !fixture?.startTime) {
          continue;
        }

        const matchKey = toMatchOddsKey(homeTeam, awayTeam, fixture.startTime);
        const current = bestByMatch.get(matchKey) || {
          home: Number.POSITIVE_INFINITY,
          draw: Number.POSITIVE_INFINITY,
          away: Number.POSITIVE_INFINITY,
        };

        for (const bookmaker of Object.values(fixture?.bookmakerOdds || {})) {
          for (const [outcomeId, outcome] of Object.entries(bookmaker?.markets || {}).flatMap(([, market]) => Object.entries(market?.outcomes || {}))) {
            for (const player of Object.values(outcome?.players || {})) {
              const price = Number(player?.price);
              if (!Number.isFinite(price) || price <= 1) {
                continue;
              }

              const outcomeCode = String(outcomeId || '').toLowerCase();
              const bookmakerOutcomeId = String(player?.bookmakerOutcomeId || '').toLowerCase();

              const isHome = outcomeCode === '101' || bookmakerOutcomeId === 'home' || bookmakerOutcomeId.endsWith('/home');
              const isAway = outcomeCode === '103' || bookmakerOutcomeId === 'away' || bookmakerOutcomeId.endsWith('/away');
              const isDraw = outcomeCode === '102' || bookmakerOutcomeId === 'draw' || bookmakerOutcomeId === 'x' || bookmakerOutcomeId.endsWith('/draw');

              if (isHome && price < current.home) {
                current.home = price;
              }

              if (isDraw && price < current.draw) {
                current.draw = price;
              }

              if (isAway && price < current.away) {
                current.away = price;
              }
            }
          }
        }

        bestByMatch.set(matchKey, current);
      }

      return bestByMatch;
    };

    const getOddsPapiWorldCupTournamentIds = async () => {
      const url = buildOddsApiUrl('oddspapi', '/v4/tournaments', {
        sportId: oddsConfig.oddsPapi.sportId,
        language: oddsConfig.oddsPapi.language,
        apiKey: oddsConfig.useProxy ? '' : oddsConfig.oddsPapi.apiKey,
      });
      const payload = await fetchJson(url, { quotaProvider: 'oddspapi' });
      const tournaments = Array.isArray(payload) ? payload : [];

      const worldCupTournaments = tournaments
        .filter((tournament) => {
          const name = String(tournament?.tournamentName || '').toLowerCase();
          const slug = String(tournament?.tournamentSlug || '').toLowerCase();
          return name.includes('world cup') || slug.includes('world-cup') || slug.includes('fifa-world-cup');
        })
        .map((tournament) => tournament.tournamentId)
        .filter((id) => Number.isFinite(Number(id)));

      return [...new Set(worldCupTournaments)].slice(0, 5);
    };

    const loadTheOddsApiContenders = async () => {
      const cfg = oddsConfig.theOddsApi;
      const url = buildOddsApiUrl('the-odds-api', `/v4/sports/${cfg.sportKey}/odds/`, {
        apiKey: oddsConfig.useProxy ? '' : cfg.apiKey,
        regions: cfg.regions,
        markets: cfg.markets,
        oddsFormat: cfg.oddsFormat,
      });
      const payload = await fetchJson(url, { quotaProvider: 'the-odds-api' });
      markOddsProviderSuccess('the-odds-api');
      return {
        teams: extractTopTeamsFromOutrights(payload),
        winnerOdds: extractWinnerOddsFromTheOddsApi(payload),
        matchOddsByKey: new Map(),
      };
    };

    const loadOddsPapiContenders = async () => {
      const tournamentIds = await getOddsPapiWorldCupTournamentIds();
      if (!tournamentIds.length) {
        return [];
      }

      const cfg = oddsConfig.oddsPapi;
      const url = buildOddsApiUrl('oddspapi', '/v4/odds-by-tournaments', {
        tournamentIds: tournamentIds.join(','),
        bookmakers: cfg.bookmakers,
        language: cfg.language,
        verbosity: cfg.verbosity,
        oddsFormat: cfg.oddsFormat,
        apiKey: oddsConfig.useProxy ? '' : cfg.apiKey,
      });
      const payload = await fetchJson(url, { quotaProvider: 'oddspapi' });
      markOddsProviderSuccess('oddspapi');
      return {
        teams: extractTopTeamsFromOddsPapi(payload),
        winnerOdds: extractWinnerOddsFromOddsPapi(payload),
        matchOddsByKey: extractMatchOddsFromOddsPapi(payload),
      };
    };

    const applyFallbackContenders = () => {
      state.contenderTeams = new Set([...fallbackContenderTeams].map(canonicalTeamName));
      state.winnerOdds = [];
      state.matchOddsByKey = new Map();
      state.oddsSource = 'fallback';
    };

    const getContendersFromWinnerOdds = (winnerOdds) => {
      const list = Array.isArray(winnerOdds)
        ? winnerOdds
            .slice(0, oddsConfig.topTeamsCount)
            .map((entry) => canonicalTeamName(entry?.team || entry?.canonical || ''))
            .filter(Boolean)
        : [];

      return [...new Set(list)];
    };

    const applyCachedOdds = (cached, source) => {
      state.winnerOdds = Array.isArray(cached.winnerOdds) ? cached.winnerOdds : [];
      const contendersFromWinners = getContendersFromWinnerOdds(state.winnerOdds);
      const contenders = contendersFromWinners.length >= 4
        ? contendersFromWinners
        : (Array.isArray(cached.teams) ? cached.teams : []);
      state.contenderTeams = new Set(contenders);
      state.matchOddsByKey = new Map(Array.isArray(cached.matchOdds) ? cached.matchOdds : []);
      state.oddsUpdatedAt = new Date(cached.updatedAt);
      state.oddsSource = source;
    };

    const preserveExistingOddsAsStale = () => {
      if (!state.contenderTeams.size) {
        return false;
      }

      state.oddsSource = `${state.oddsSource || 'odds'}-stale`;
      return true;
    };

    const getMatchOdds = (match) => {
      const home = teamName(match.Home);
      const away = teamName(match.Away);
      const direct = state.matchOddsByKey.get(toMatchOddsKey(home, away, match.Date));
      if (direct) {
        return direct;
      }

      const reverse = state.matchOddsByKey.get(toMatchOddsKey(away, home, match.Date));
      if (reverse) {
        return {
          home: reverse.away,
          draw: reverse.draw,
          away: reverse.home,
        };
      }

      return null;
    };

    const renderMatchOddsInline = (match) => {
      const odds = getMatchOdds(match);
      if (!odds) {
        return '<div class="odds-inline empty">Odds: unavailable</div>';
      }

      const parts = [
        `H ${formatOdd(odds.home)}`,
        `D ${formatOdd(odds.draw)}`,
        `A ${formatOdd(odds.away)}`,
      ];

      return `<div class="odds-inline">Odds ${escapeHtml(parts.join('  '))}</div>`;
    };

    const renderWinnerOddsPanel = () => {
      const badgeNode = document.getElementById('winner-odds-badge');
      const contentNode = document.getElementById('winner-odds-content');
      const statusNode = document.getElementById('odds-provider-status');
      if (!badgeNode || !contentNode || !statusNode) {
        return;
      }

      const sourceLabel = state.oddsSource || 'fallback';
      badgeNode.textContent = sourceLabel;

      if (!state.winnerOdds.length) {
        contentNode.className = 'empty';
        contentNode.textContent = 'No explicit winner market available from the current provider. Match odds are still shown on fixtures.';
        statusNode.innerHTML = renderProviderStatusLine();
        return;
      }

      const currentRanks = syncOddsMovementBaseline(state.winnerOdds);

      contentNode.className = '';
      const nextUpTeams = getNextUpTeams();
      const hoveredTeams = getHoveredTeams();
      const winnerRows = state.winnerOdds
        .slice(0, oddsConfig.topTeamsCount)
        .map((entry) => ({ ...entry, fromWinnerOdds: true }));

      for (const [canonical, name] of nextUpTeams.entries()) {
        const alreadyListed = winnerRows.some((entry) => canonicalTeamName(entry?.canonical || entry?.team || '') === canonical);
        if (!alreadyListed) {
          winnerRows.push({
            team: name,
            canonical,
            price: Number.NaN,
            fromWinnerOdds: false,
          });
        }
      }

      for (const [canonical, name] of hoveredTeams.entries()) {
        const alreadyListed = winnerRows.some((entry) => canonicalTeamName(entry?.canonical || entry?.team || '') === canonical);
        if (!alreadyListed) {
          winnerRows.push({
            team: name,
            canonical,
            price: Number.NaN,
            fromWinnerOdds: false,
          });
        }
      }

      const rows = winnerRows
        .map((entry, index) => {
          const canonical = canonicalTeamName(entry?.canonical || entry?.team || '');
          const teamLabel = displayTeamName(entry?.team || entry?.canonical || 'Team');
          const isNextUpTeam = nextUpTeams.has(canonical);
          const isHoverTeam = hoveredTeams.has(canonical);
          const snapshot = currentRanks.get(canonical);
          const currentRank = entry.fromWinnerOdds
            ? (index + 1)
            : (Number.isFinite(Number(snapshot?.rank)) ? Number(snapshot.rank) : Number.NaN);
          const rank = Number.isFinite(currentRank) ? String(currentRank) : '–';
          const startRank = Number(state.oddsBaselineRanks.get(canonical));
          const rawPrice = Number(entry?.price);
          const snapshotPrice = Number(snapshot?.price);
          const currentPrice = Number.isFinite(rawPrice) && rawPrice > 1
            ? rawPrice
            : (Number.isFinite(snapshotPrice) && snapshotPrice > 1 ? snapshotPrice : Number.NaN);
          const movementDelta = Number.isFinite(startRank) && Number.isFinite(currentRank)
            ? (startRank - currentRank)
            : Number.NaN;
          const movementClass = Number.isFinite(movementDelta)
            ? (movementDelta > 0 ? 'up' : movementDelta < 0 ? 'down' : 'flat')
            : 'flat';
          const movementText = Number.isFinite(movementDelta)
            ? (movementDelta > 0 ? `▲${movementDelta}` : movementDelta < 0 ? `▼${Math.abs(movementDelta)}` : '–')
            : '–';
          const rowClass = [isNextUpTeam ? 'next-up-team' : '', isHoverTeam ? 'hover-team' : ''].filter(Boolean).join(' ');
          return `
          <tr${rowClass ? ` class="${rowClass}"` : ''}>
            <td>${rank}</td>
            <td class="odds-team">${escapeHtml(teamLabel)}${isNextUpTeam ? '<span class="odds-next-tag">Next up</span>' : ''}${isHoverTeam ? '<span class="odds-hover-tag">Hover</span>' : ''}</td>
            <td>${escapeHtml(formatOdd(currentPrice))}</td>
            <td>${Number.isFinite(startRank) ? escapeHtml(String(startRank)) : '–'}</td>
            <td class="odds-move-cell ${movementClass}">${movementText}</td>
          </tr>
        `;
        })
        .join('');

      const tickerRows = state.winnerOdds
        .slice(0, oddsConfig.topTeamsCount)
        .map((entry, index) => {
          const canonical = canonicalTeamName(entry?.canonical || entry?.team || '');
          const teamLabel = displayTeamName(entry?.team || entry?.canonical || 'Team');
          const startRank = Number(state.oddsBaselineRanks.get(canonical));
          const startPrice = Number(state.oddsBaselinePrices.get(canonical));
          const currentPrice = Number(entry?.price);
          const currentRank = index + 1;
          const hasOddsChange = Number.isFinite(startPrice)
            && Number.isFinite(currentPrice)
            && startPrice > 1
            && currentPrice > 1
            && Math.abs(currentPrice - startPrice) > 0.00001;
          const oddsDelta = hasOddsChange ? (currentPrice - startPrice) : 0;
          // Lower outright odds imply stronger market expectation.
          const movementClass = hasOddsChange
            ? (oddsDelta < 0 ? 'up' : 'down')
            : 'flat';
          return {
            canonical,
            teamLabel,
            currentRank,
            startRank: Number.isFinite(startRank) ? startRank : currentRank,
            startPrice: Number.isFinite(startPrice) && startPrice > 1 ? startPrice : Number.NaN,
            currentPrice: Number.isFinite(currentPrice) && currentPrice > 1 ? currentPrice : Number.NaN,
            hasOddsChange,
            oddsDelta,
            movementClass,
          };
        })
        .filter((row) => row.hasOddsChange)
        .sort((left, right) => Math.abs(right.oddsDelta) - Math.abs(left.oddsDelta) || left.currentRank - right.currentRank)
        .slice(0, 12);

      const tickerItems = tickerRows.length
        ? tickerRows.map((row) => `
            <span class="odds-ticker-item ${row.movementClass}">${escapeHtml(row.teamLabel)} O${escapeHtml(formatOdd(row.startPrice))}→${escapeHtml(formatOdd(row.currentPrice))}</span>
          `).join('')
        : '<span class="odds-ticker-item flat">No odds changes yet</span>';

      contentNode.innerHTML = `
        <div class="odds-movement-ticker">
          <div class="odds-ticker-track">${tickerItems}${tickerItems}</div>
        </div>
        <table class="odds-table">
          <tr>
            <th>#</th>
            <th>Team</th>
            <th>Winner Odds</th>
            <th>Start</th>
            <th>Move</th>
          </tr>
          ${rows}
        </table>
      `;

      statusNode.innerHTML = renderProviderStatusLine();
    };

    const loadOddsContenders = async () => {
      const providerContext = getOddsProviderContext();
      if (providerContext.provider === 'none') {
        const lastSnapshot = getLastOddsSnapshot();
        if (lastSnapshot) {
          applyCachedOdds(lastSnapshot, `${lastSnapshot.provider || 'odds'}-last-snapshot`);
          return;
        }

        if (!preserveExistingOddsAsStale()) {
          applyFallbackContenders();
        }
        return;
      }

      const sessionCached = getCachedOddsFromSession(providerContext.provider, providerContext.apiKey);
      if (sessionCached) {
        const source = providerContext.provider === 'oddspapi' ? 'oddspapi-session' : 'odds-api-session';
        state.contenderTeams = new Set(sessionCached.teams);
        state.winnerOdds = Array.isArray(sessionCached.winnerOdds) ? sessionCached.winnerOdds : [];
        state.matchOddsByKey = new Map(Array.isArray(sessionCached.matchOdds) ? sessionCached.matchOdds : []);
        state.oddsUpdatedAt = new Date(sessionCached.updatedAt);
        state.oddsSource = source;
        return;
      }

      const cached = getCachedOddsContenders(providerContext.provider, providerContext.apiKey);
      if (cached) {
        applyCachedOdds(cached, providerContext.provider === 'oddspapi' ? 'oddspapi-cache' : 'odds-api-cache');
        setCachedOddsInSession(providerContext.provider, providerContext.apiKey);
        return;
      }

      let oddsData;
      try {
        oddsData = providerContext.provider === 'oddspapi'
          ? await loadOddsPapiContenders()
          : await loadTheOddsApiContenders();
      } catch {
        const staleCached = getCachedOddsContenders(providerContext.provider, providerContext.apiKey, {
          ignoreForce: true,
          ignoreAge: true,
        });

        if (staleCached) {
          applyCachedOdds(staleCached, providerContext.provider === 'oddspapi' ? 'oddspapi-stale-cache' : 'odds-api-stale-cache');
          return;
        }

        if (preserveExistingOddsAsStale()) {
          return;
        }

        const lastSnapshot = getLastOddsSnapshot();
        if (lastSnapshot) {
          applyCachedOdds(lastSnapshot, `${lastSnapshot.provider || 'odds'}-last-snapshot`);
          return;
        }

        throw new Error('No successful odds data available to keep as fallback.');
      }
      const teams = Array.isArray(oddsData?.teams) ? oddsData.teams : [];
      let winnerOdds = Array.isArray(oddsData?.winnerOdds) ? oddsData.winnerOdds : [];
      const matchOddsByKey = oddsData?.matchOddsByKey instanceof Map ? oddsData.matchOddsByKey : new Map();

      if (!winnerOdds.length && oddsConfig.theOddsApi.apiKey) {
        try {
          const theOddsApiData = await loadTheOddsApiContenders();
          if (Array.isArray(theOddsApiData?.winnerOdds) && theOddsApiData.winnerOdds.length) {
            winnerOdds = theOddsApiData.winnerOdds;
          }
        } catch {
          // Keep current winner odds when The Odds API fallback is unavailable.
        }
      }

      const contendersFromWinners = getContendersFromWinnerOdds(winnerOdds);
      const contenders = contendersFromWinners.length >= 4 ? contendersFromWinners : teams;

      if (contenders.length >= 4) {
        state.contenderTeams = new Set(contenders);
        state.winnerOdds = winnerOdds;
        state.matchOddsByKey = matchOddsByKey;
        state.oddsUpdatedAt = new Date();
        state.oddsSource = providerContext.provider;
        setCachedOddsContenders(providerContext.provider, providerContext.apiKey, contenders);
        setCachedOddsInSession(providerContext.provider, providerContext.apiKey);
      } else {
        const staleCached = getCachedOddsContenders(providerContext.provider, providerContext.apiKey, {
          ignoreForce: true,
          ignoreAge: true,
        });

        if (staleCached) {
          applyCachedOdds(staleCached, providerContext.provider === 'oddspapi' ? 'oddspapi-stale-cache' : 'odds-api-stale-cache');
          return;
        }

        if (!preserveExistingOddsAsStale()) {
          const lastSnapshot = getLastOddsSnapshot();
          if (lastSnapshot) {
            applyCachedOdds(lastSnapshot, `${lastSnapshot.provider || 'odds'}-last-snapshot`);
            return;
          }

          applyFallbackContenders();
        }
      }
    };

    const stageName = (match) => {
      const fromStage = stageLabels.get(String(match.IdStage));
      if (fromStage) {
        return fromStage;
      }

      const groupName = match.GroupName?.find((entry) => entry.Locale === 'en-GB')?.Description;
      if (groupName) {
        return groupName;
      }

      return match.StageName?.find((entry) => entry.Locale === 'en-GB')?.Description || 'Unknown stage';
    };

    const stageSlot = (match) => {
      if (match.GroupName?.length) {
        return match.GroupName[0].Description;
      }

      return stageName(match);
    };

    const matchNumberLabel = (match) => {
      const number = Number(match?.MatchNumber);
      if (!Number.isFinite(number) || number <= 0) {
        return '';
      }

      return `Match #${number}`;
    };

    const formatKickoff = (match) => {
      if (!match?.Date) {
        return 'TBD';
      }

      return dateFormatter.format(new Date(match.Date));
    };

    const formatStatus = (match) => {
      if (!Number.isFinite(match.HomeTeamScore) || !Number.isFinite(match.AwayTeamScore)) {
        return match.TimeDefined ? 'Scheduled' : 'TBD';
      }

      if (match.ResultType === 1 || isCompletedMatch(match)) {
        return 'FT';
      }

      if (isHalftimeMatch(match)) {
        return 'HT';
      }

      return isActivelyPlayedMatch(match) ? 'Live' : 'Score';
    };

    const statusClass = (match) => {
      if (!Number.isFinite(match.HomeTeamScore) || !Number.isFinite(match.AwayTeamScore)) {
        return match.TimeDefined ? 'status scheduled' : 'status tbd';
      }

      if (match.ResultType === 1 || isCompletedMatch(match)) {
        return 'status ft';
      }

      if (isHalftimeMatch(match)) {
        return 'status ht';
      }

      return isActivelyPlayedMatch(match) ? 'status live' : 'status';
    };

    const getMatchStatusClass = (match) => {
      if (!Number.isFinite(match.HomeTeamScore) || !Number.isFinite(match.AwayTeamScore)) {
        return 'status';
      }

      return 'score';
    };

    const getScoreKey = (match) => {
      const home = Number(match?.HomeTeamScore);
      const away = Number(match?.AwayTeamScore);
      if (!Number.isFinite(home) || !Number.isFinite(away)) {
        return null;
      }

      return `${home}:${away}`;
    };

    const buildScoreMap = (matches) => {
      const map = new Map();
      for (const match of matches || []) {
        const id = String(match?.IdMatch || '').trim();
        if (!id) {
          continue;
        }

        map.set(id, getScoreKey(match));
      }

      return map;
    };

    const isActivelyPlayedMatch = (match) => {
      const kickoff = new Date(match?.Date || 0).getTime();
      if (!Number.isFinite(kickoff)) {
        return false;
      }

      const now = Date.now();
      const status = Number(match?.MatchStatus);
      const resultType = Number(match?.ResultType);
      const hasScore = Number.isFinite(Number(match?.HomeTeamScore)) && Number.isFinite(Number(match?.AwayTeamScore));

      if ([2, 3, 4, 5, 6].includes(status)) {
        return true;
      }

      if (resultType === 1) {
        return false;
      }

      const inLiveWindow = kickoff <= now && (now - kickoff) <= (4 * 60 * 60 * 1000);
      if (!inLiveWindow) {
        return false;
      }

      if (status === 1 && !hasScore) {
        return false;
      }

      return true;
    };

    const isHalftimeMatch = (match) => Number(match?.MatchStatus) === 4;

    const isCompletedMatch = (match) => {
      const status = Number(match?.MatchStatus);
      const resultType = Number(match?.ResultType);
      return resultType === 1 || status === 0;
    };

    const isReplayModeActive = (matches = state.matches) => {
      const replayId = String(state.replayMatchId || '').trim();
      if (!replayId) {
        return false;
      }

      if (state.replaySelectionSource === 'user') {
        return true;
      }

      const list = Array.isArray(matches) ? matches : [];
      return !list.some(isActivelyPlayedMatch);
    };

    const hasActiveLiveRefreshMode = () => {
      if (isReplayModeActive()) {
        return true;
      }

      return (state.matches || []).some(isActivelyPlayedMatch);
    };

    const resolveRefreshCadenceMs = () => (hasActiveLiveRefreshMode() ? liveRefreshIntervalMs : refreshIntervalMs);

    // Schedule a one-shot fetch exactly when the next match is due to kick off, so scores
    // appear promptly rather than waiting up to 5 minutes for the regular polling interval.
    const scheduleKickoffTrigger = () => {
      if (state.kickoffTriggerTimer !== null) {
        clearTimeout(state.kickoffTriggerTimer);
        state.kickoffTriggerTimer = null;
      }

      const kickoffTs = state.nextUpKickoffTs;
      if (!Number.isFinite(kickoffTs)) {
        return;
      }

      // Fire 5 seconds after the scheduled kickoff to give the API a moment to reflect the live state.
      const delayMs = kickoffTs - Date.now() + 5000;
      if (delayMs <= 0) {
        return; // kickoff is already past or imminent — the regular live-refresh timer covers it
      }

      state.kickoffTriggerTimer = setTimeout(() => {
        state.kickoffTriggerTimer = null;
        loadMatches({ autoScrollNextUp: false });
      }, delayMs);
    };

    const formatCountdownClock = (remainingMs) => {
      const safeSeconds = Math.max(0, Math.ceil(Number(remainingMs) / 1000));
      const hours = Math.floor(safeSeconds / 3600);
      const minutes = Math.floor((safeSeconds % 3600) / 60);
      const seconds = safeSeconds % 60;

      if (hours > 0) {
        return `${hours}h ${String(minutes).padStart(2, '0')}m ${String(seconds).padStart(2, '0')}s`;
      }

      return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    };

    const syncRefreshSchedule = () => {
      const cadenceMs = resolveRefreshCadenceMs();
      state.refreshCadenceMs = cadenceMs;

      if (state.updatedAt instanceof Date && Number.isFinite(state.updatedAt.getTime())) {
        state.nextDataRefreshAt = state.updatedAt.getTime() + cadenceMs;
        return;
      }

      state.nextDataRefreshAt = null;
    };

    const getCadenceLabel = () => (state.refreshCadenceMs === liveRefreshIntervalMs ? '60s cadence' : '5m cadence');

    const getNextUpdateCountdownLabel = () => {
      const nextTs = Number(state.nextDataRefreshAt);
      if (!Number.isFinite(nextTs)) {
        return 'waiting for first data pull';
      }

      const remainingMs = nextTs - Date.now();
      if (remainingMs <= 0) {
        return 'refreshing now';
      }

      return `in ${formatCountdownClock(remainingMs)}`;
    };

    const getLiveMatchSyncBadgeText = () => {
      const nextTs = Number(state.nextDataRefreshAt);
      if (!Number.isFinite(nextTs)) {
        return 'Sync pending';
      }

      const remainingMs = nextTs - Date.now();
      if (remainingMs <= 0) {
        return 'Syncing now';
      }

      return `Next sync ${formatCountdownClock(remainingMs)}`;
    };

    const formatAgeLabel = (timestampMs) => {
      const ts = Number(timestampMs);
      if (!Number.isFinite(ts) || ts <= 0) {
        return 'unknown age';
      }

      const diffSeconds = Math.max(0, Math.floor((Date.now() - ts) / 1000));
      if (diffSeconds < 60) {
        return `${diffSeconds}s ago`;
      }

      const mins = Math.floor(diffSeconds / 60);
      if (mins < 60) {
        return `${mins}m ago`;
      }

      const hours = Math.floor(mins / 60);
      const remMins = mins % 60;
      if (hours < 24) {
        return remMins > 0 ? `${hours}h ${remMins}m ago` : `${hours}h ago`;
      }

      const days = Math.floor(hours / 24);
      const remHours = hours % 24;
      return remHours > 0 ? `${days}d ${remHours}h ago` : `${days}d ago`;
    };

    const getLastSuccessfulPullLabel = () => {
      if (!(state.lastFifaPullAt instanceof Date) || !Number.isFinite(state.lastFifaPullAt.getTime())) {
        return 'waiting for first successful pull';
      }

      const at = updateFormatter.format(state.lastFifaPullAt);
      const age = formatAgeLabel(state.lastFifaPullAt.getTime());
      const matches = Number.isFinite(Number(state.lastFifaPullMatchCount)) ? Number(state.lastFifaPullMatchCount) : 0;
      const active = Number.isFinite(Number(state.lastFifaPullActiveCount)) ? Number(state.lastFifaPullActiveCount) : 0;
      return `${at} (${age}) · ${matches} matches · ${active} live`;
    };

    const getLastPullHealthLabel = () => {
      if (state.lastFifaPullStatus === 'error') {
        const hasGoodSnapshot = state.lastFifaPullAt instanceof Date && Number.isFinite(state.lastFifaPullAt.getTime());
        return hasGoodSnapshot ? 'Latest attempt failed, showing last successful FIFA snapshot' : 'Latest FIFA attempt failed, waiting for first successful pull';
      }

      if (state.lastFifaPullStatus === 'ok') {
        return 'Latest FIFA attempt successful';
      }

      return 'Waiting for FIFA response';
    };

    const getEstimatedGameTimeRemainingLabel = (match, detail = null) => {
      if (!match) {
        return 'Unavailable';
      }

      const effectiveMatch = getEffectiveMatchState(match, detail);

      if (isCompletedMatch(effectiveMatch)) {
        return '00:00 (full-time)';
      }

      const regulationMinutes = 90;
      const firstHydrationBreakMinute = 22;
      const secondHydrationBreakMinute = 67;
      const hydrationBreakSeconds = 3 * 60;
      const halftimeBreakSeconds = 15 * 60;
      const isHalftime = isHalftimeMatch(effectiveMatch);
      const officialMinute = resolveOfficialClockMinute(effectiveMatch, detail, { preferFrozenMinute: isHalftime });

      if (Number.isFinite(officialMinute)) {
        let remainingSeconds = 0;
        let phase = '2nd half';

        if (isHalftime) {
          phase = 'half-time';
          remainingSeconds = halftimeBreakSeconds + (45 * 60) + hydrationBreakSeconds;
        } else if (officialMinute < firstHydrationBreakMinute) {
          phase = '1st half';
          remainingSeconds = Math.max(0,
            Math.floor((firstHydrationBreakMinute - officialMinute) * 60)
            + hydrationBreakSeconds
            + Math.floor((45 - firstHydrationBreakMinute) * 60)
            + halftimeBreakSeconds
            + Math.floor((secondHydrationBreakMinute - 45) * 60)
            + hydrationBreakSeconds
            + Math.floor((regulationMinutes - secondHydrationBreakMinute) * 60),
          );
        } else if (officialMinute < 45) {
          phase = '1st half';
          remainingSeconds = Math.max(0,
            Math.floor((45 - officialMinute) * 60)
            + halftimeBreakSeconds
            + Math.floor((secondHydrationBreakMinute - 45) * 60)
            + hydrationBreakSeconds
            + Math.floor((regulationMinutes - secondHydrationBreakMinute) * 60),
          );
        } else if (officialMinute < secondHydrationBreakMinute) {
          phase = '2nd half';
          remainingSeconds = Math.max(0,
            Math.floor((secondHydrationBreakMinute - officialMinute) * 60)
            + hydrationBreakSeconds
            + Math.floor((regulationMinutes - secondHydrationBreakMinute) * 60),
          );
        } else if (officialMinute < regulationMinutes) {
          phase = '2nd half';
          remainingSeconds = Math.max(0, Math.floor((regulationMinutes - officialMinute) * 60));
        } else {
          return '00:00 (expected FT)';
        }

        const minutes = Math.floor(remainingSeconds / 60);
        const seconds = remainingSeconds % 60;
        return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')} (${phase})`;
      }

      const kickoffTs = new Date(match.Date || 0).getTime();
      if (!Number.isFinite(kickoffTs)) {
        return 'Unavailable';
      }

      const nowTs = Date.now();
      const elapsedSeconds = Math.floor((nowTs - kickoffTs) / 1000);
      if (elapsedSeconds < 0) {
        return 'Pre-kickoff';
      }

      const firstHalfSeconds = 45 * 60;
      const firstHydrationPlaySeconds = 22 * 60;
      const secondHydrationPlaySeconds = 22 * 60;
      const halftimeSeconds = 15 * 60;
      const secondHalfSeconds = 45 * 60;
      const expectedDurationSeconds = firstHalfSeconds + halftimeSeconds + secondHalfSeconds + hydrationBreakSeconds + hydrationBreakSeconds;

      if (elapsedSeconds >= expectedDurationSeconds) {
        return '00:00 (expected FT)';
      }

      let phase = '2nd half';
      let remainingSeconds = Math.max(0, expectedDurationSeconds - elapsedSeconds);

      const firstHydrationStart = firstHydrationPlaySeconds;
      const firstHydrationEnd = firstHydrationStart + hydrationBreakSeconds;
      const firstHalfEnd = firstHalfSeconds + hydrationBreakSeconds;
      const halftimeEnd = firstHalfEnd + halftimeSeconds;
      const secondHydrationStart = halftimeEnd + secondHydrationPlaySeconds;
      const secondHydrationEnd = secondHydrationStart + hydrationBreakSeconds;

      if (elapsedSeconds < firstHydrationStart) {
        phase = '1st half';
        remainingSeconds = expectedDurationSeconds - elapsedSeconds;
      } else if (elapsedSeconds < firstHydrationEnd) {
        phase = 'hydration break';
        remainingSeconds = expectedDurationSeconds - elapsedSeconds;
      } else if (elapsedSeconds < firstHalfEnd) {
        phase = '1st half';
        remainingSeconds = expectedDurationSeconds - elapsedSeconds;
      } else if (elapsedSeconds < halftimeEnd) {
        phase = 'half-time';
        remainingSeconds = expectedDurationSeconds - elapsedSeconds;
      } else if (elapsedSeconds < secondHydrationStart) {
        phase = '2nd half';
        remainingSeconds = expectedDurationSeconds - elapsedSeconds;
      } else if (elapsedSeconds < secondHydrationEnd) {
        phase = 'hydration break';
        remainingSeconds = expectedDurationSeconds - elapsedSeconds;
      }

      const minutes = Math.floor(remainingSeconds / 60);
      const seconds = remainingSeconds % 60;
      return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')} (${phase})`;
    };

    const MAX_PLAUSIBLE_MATCH_MINUTE = 150;

    const parseLiveMinuteValue = (value) => {
      if (typeof value === 'number') {
        return Number.isFinite(value) && value >= 0 && value <= MAX_PLAUSIBLE_MATCH_MINUTE
          ? value
          : Number.NaN;
      }

      const rawValue = String(value || '').trim();
      if (!rawValue) {
        return Number.NaN;
      }

      const stoppageMatch = rawValue.match(/^(\d{1,3})\s*\+\s*(\d{1,2})\s*'?$/);
      if (stoppageMatch) {
        const baseMinute = Number(stoppageMatch[1]);
        const addedMinute = Number(stoppageMatch[2]);
        const totalMinute = baseMinute + addedMinute;
        return totalMinute <= MAX_PLAUSIBLE_MATCH_MINUTE ? totalMinute : Number.NaN;
      }

      const minuteSecondMatch = rawValue.match(/^(\d{1,3})\s*:\s*(\d{1,2})\s*'?$/);
      if (minuteSecondMatch) {
        const minutes = Number(minuteSecondMatch[1]);
        const seconds = Number(minuteSecondMatch[2]);
        if (seconds >= 60) {
          return Number.NaN;
        }
        const totalMinute = minutes + (seconds / 60);
        return totalMinute <= MAX_PLAUSIBLE_MATCH_MINUTE ? totalMinute : Number.NaN;
      }

      const normalized = rawValue.replace(/'+$/g, '');
      if (!/^\d{1,3}(?:\.\d+)?$/.test(normalized)) {
        return Number.NaN;
      }

      const minute = Number(normalized);
      if (!Number.isFinite(minute) || minute < 0 || minute > MAX_PLAUSIBLE_MATCH_MINUTE) {
        return Number.NaN;
      }

      return minute;
    };

    const getEffectiveMatchState = (match, detail) => {
      if (!match) {
        return match;
      }

      const detailStatus = Number(detail?.MatchStatus);
      const detailResultType = Number(detail?.ResultType);

      if (!Number.isFinite(detailStatus) && !Number.isFinite(detailResultType)) {
        return match;
      }

      return {
        ...match,
        ...(Number.isFinite(detailStatus) ? { MatchStatus: detailStatus } : {}),
        ...(Number.isFinite(detailResultType) ? { ResultType: detailResultType } : {}),
      };
    };

    const formatRunningClockLabel = (totalSecondsValue) => {
      const totalSeconds = Math.max(0, Math.floor(Number(totalSecondsValue)));
      if (!Number.isFinite(totalSeconds)) {
        return 'Live';
      }

      const minutes = Math.floor(totalSeconds / 60);
      const seconds = totalSeconds % 60;
      return `${minutes}:${String(seconds).padStart(2, '0')}'`;
    };

    const getSpotlightLiveClockLabel = (baseMinuteValue, pullTs, kickoffTs, isFrozen = false, frozenFallbackLabel = 'Live') => {
      const baseMinute = parseLiveMinuteValue(baseMinuteValue);
      const nowTs = Date.now();
      const pullTimeTs = Number(pullTs);

      // If frozen (HT or FT), show the base minute without advancing
      if (isFrozen) {
        if (Number.isFinite(baseMinute)) {
          return formatRunningClockLabel(Math.floor(baseMinute * 60));
        }
        return String(frozenFallbackLabel || 'Live');
      }

      // Use only API MatchTime - no fallback calculation from kickoff time
      // This ensures we show accurate time directly from FIFA API
      if (Number.isFinite(baseMinute) && Number.isFinite(pullTimeTs) && pullTimeTs > 0) {
        const elapsedSincePullSeconds = Math.max(0, Math.floor((nowTs - pullTimeTs) / 1000));
        const baseSeconds = Math.floor(baseMinute * 60);

        // Only interpolate a small amount between API updates (max 60 seconds)
        // This assumes API refreshes every 60 seconds during live play
        const interpolatedSeconds = Math.min(elapsedSincePullSeconds, 60);
        return formatRunningClockLabel(baseSeconds + interpolatedSeconds);
      }

      // No fallback - if we don't have a valid MatchTime from API, show "Live"
      // This is preferable to showing an incorrect calculated time
      if (Number.isFinite(baseMinute)) {
        return formatRunningClockLabel(Math.floor(baseMinute * 60));
      }

      return 'Live';
    };

    const updateSpotlightLiveClockDataAttributes = () => {
      // Update spotlight clock data attributes with freshest available MatchTime
      const spotlightNode = document.getElementById('group-live-spotlight');
      if (!spotlightNode || spotlightNode.hidden) {
        return;
      }

      const liveMatches = (state.matches || []).filter(isActivelyPlayedMatch);
      if (liveMatches.length === 0) {
        return;
      }

      const match = liveMatches[0];
      const matchId = String(match?.IdMatch || '').trim();
      const detail = getCachedLiveDetail(matchId);
      const effectiveMatch = getEffectiveMatchState(match, detail);

      // Get the freshest MatchTime available
      const isMatchCompleted = isCompletedMatch(effectiveMatch);
      const isHalftime = isHalftimeMatch(effectiveMatch);
      const isFrozen = isHalftime || isMatchCompleted;
      const freshMatchTime = resolveOfficialClockMinute(effectiveMatch, detail, { preferFrozenMinute: isFrozen });
      const frozenFallbackLabel = isMatchCompleted ? 'FT' : isHalftime ? 'HT' : 'Live';

      // Update the clock element with fresh data
      const clockNode = spotlightNode.querySelector('.live-spotlight-clock[data-live-clock-base-minute]');

      if (clockNode) {
        const pullTs = state.lastFifaPullAt instanceof Date ? state.lastFifaPullAt.getTime() : Number.NaN;

        clockNode.setAttribute('data-live-clock-base-minute', Number.isFinite(freshMatchTime) ? String(freshMatchTime) : '');
        clockNode.setAttribute('data-live-clock-pull-ts', String(pullTs));
        clockNode.setAttribute('data-live-clock-freeze', isFrozen ? '1' : '0');
        clockNode.setAttribute('data-live-clock-fallback-label', frozenFallbackLabel);

        // Update label if frozen
        if (isFrozen) {
          const labelNode = spotlightNode.querySelector('.live-spotlight-clock-label');
          if (labelNode) {
            labelNode.textContent = isMatchCompleted ? 'Official clock (FT)' : 'Official clock (HT)';
          }
        }
      }
    };

    const updateSpotlightLiveClockViews = () => {
      document.querySelectorAll('.live-spotlight-clock[data-live-clock-base-minute]').forEach((node) => {
        const baseMinute = node.getAttribute('data-live-clock-base-minute');
        const pullTs = Number(node.getAttribute('data-live-clock-pull-ts') || Number.NaN);
        const kickoffTs = Number(node.getAttribute('data-live-clock-kickoff-ts') || Number.NaN);
        const isFrozen = node.getAttribute('data-live-clock-freeze') === '1';
        const frozenFallbackLabel = node.getAttribute('data-live-clock-fallback-label') || 'Live';
        node.textContent = getSpotlightLiveClockLabel(baseMinute, pullTs, kickoffTs, isFrozen, frozenFallbackLabel);
      });
    };

    const updateLiveEstimatedTimeRemainingView = () => {
      const node = document.getElementById('live-match-time-remaining');
      if (!node) {
        return;
      }

      const focusedMatch = resolveLiveFocusMatch(state.matches);
      const focusedMatchId = String(focusedMatch?.IdMatch || '').trim();
      const detail = focusedMatchId ? getCachedLiveDetail(focusedMatchId) : null;
      node.textContent = getEstimatedGameTimeRemainingLabel(focusedMatch, detail);
    };

    const renderLiveMatchStampText = () => {
      const basePrefix = isReplayModeActive() ? 'Demo match updated' : 'Live match updated';
      const updatedAt = state.liveDetailUpdatedAt ? updateFormatter.format(state.liveDetailUpdatedAt) : (state.updatedAt ? updateFormatter.format(state.updatedAt) : 'waiting for data');
      return `${basePrefix} ${updatedAt} - next FIFA data update ${getNextUpdateCountdownLabel()} (${getCadenceLabel()}) - ${getLastPullHealthLabel()}`;
    };

    const updateRefreshCountdownViews = () => {
      const countdown = `${getNextUpdateCountdownLabel()} (${getCadenceLabel()})`;

      const groupChipNode = document.getElementById('group-stage-next-refresh');
      if (groupChipNode) {
        groupChipNode.textContent = countdown;
      }

      const groupSuccessNode = document.getElementById('group-stage-last-success');
      if (groupSuccessNode) {
        groupSuccessNode.textContent = getLastSuccessfulPullLabel();
      }

      const liveChipNode = document.getElementById('live-centre-next-refresh');
      if (liveChipNode) {
        liveChipNode.textContent = countdown;
      }

      const liveSuccessNode = document.getElementById('live-centre-last-success');
      if (liveSuccessNode) {
        liveSuccessNode.textContent = getLastSuccessfulPullLabel();
      }

      document.querySelectorAll('.match-badge.data-refresh[data-live-refresh-badge="1"]').forEach((node) => {
        node.textContent = getLiveMatchSyncBadgeText();
      });

      const liveStampNode = document.getElementById('live-match-rendered-at');
      if (liveStampNode) {
        liveStampNode.textContent = renderLiveMatchStampText();
      }

      updateLiveEstimatedTimeRemainingView();
      updateSpotlightLiveClockViews();
    };

    const syncReplayMatchInUrl = (matchId) => {
      try {
        const nextUrl = new URL(window.location.href);
        if (matchId) {
          nextUrl.searchParams.set('demoMatchId', String(matchId));
        } else {
          nextUrl.searchParams.delete('demoMatchId');
        }

        window.history.replaceState({}, '', nextUrl.toString());
      } catch {
        // Ignore history API failures.
      }
    };

    const playGoalAlert = () => {
      try {
        if ('speechSynthesis' in window) {
          const utterance = new SpeechSynthesisUtterance('Gooooaaallll!');
          utterance.rate = 0.9;
          utterance.pitch = 1.1;
          window.speechSynthesis.cancel();
          window.speechSynthesis.speak(utterance);
        }
      } catch {
        // Ignore speech synthesis failures.
      }

      try {
        const AudioContextCtor = window.AudioContext || window.webkitAudioContext;
        if (!AudioContextCtor) {
          return;
        }

        const context = new AudioContextCtor();
        const envelope = (oscillator, gainNode, start, duration, frequency) => {
          oscillator.type = 'sawtooth';
          oscillator.frequency.setValueAtTime(frequency, start);
          gainNode.gain.setValueAtTime(0.0001, start);
          gainNode.gain.exponentialRampToValueAtTime(0.12, start + 0.02);
          gainNode.gain.exponentialRampToValueAtTime(0.0001, start + duration);
          oscillator.start(start);
          oscillator.stop(start + duration + 0.03);
        };

        const now = context.currentTime;
        const notes = [392, 523.25, 659.25];
        notes.forEach((freq, index) => {
          const osc = context.createOscillator();
          const gain = context.createGain();
          osc.connect(gain);
          gain.connect(context.destination);
          envelope(osc, gain, now + (index * 0.16), 0.22, freq);
        });
      } catch {
        // Ignore audio playback failures.
      }
    };

    const detectGoalChanges = (matches) => {
      const previous = state.scoreByMatchId;
      const next = buildScoreMap(matches);

      if (!state.hasPrimedScores) {
        state.scoreByMatchId = next;
        state.hasPrimedScores = true;
        return 0;
      }

      let goalsDetected = 0;
      for (const match of matches || []) {
        if (!isActivelyPlayedMatch(match)) {
          continue;
        }

        const id = String(match?.IdMatch || '').trim();
        if (!id) {
          continue;
        }

        const before = previous.get(id);
        const after = next.get(id);
        if (!before || !after || before === after) {
          continue;
        }

        const [beforeHome, beforeAway] = before.split(':').map(Number);
        const [afterHome, afterAway] = after.split(':').map(Number);
        if (!Number.isFinite(beforeHome) || !Number.isFinite(beforeAway) || !Number.isFinite(afterHome) || !Number.isFinite(afterAway)) {
          continue;
        }

        const beforeTotal = beforeHome + beforeAway;
        const afterTotal = afterHome + afterAway;
        if (afterTotal > beforeTotal) {
          goalsDetected += 1;
        }
      }

      state.scoreByMatchId = next;
      return goalsDetected;
    };

    const pickEnglishDescription = (entries) => {
      if (!Array.isArray(entries)) {
        return '';
      }

      return entries.find((entry) => entry.Locale === 'en-GB')?.Description
        || entries.find((entry) => entry.Locale === 'en-gb')?.Description
        || entries[0]?.Description
        || '';
    };

    const liveTeamName = (team, fallback) => displayTeamName(pickEnglishDescription(team?.TeamName) || fallback || 'TBD');

    const minuteSortValue = (minute) => {
      const raw = String(minute || '').trim();
      const values = raw.match(/\d+/g)?.map(Number) || [];
      if (!values.length) {
        return Number.POSITIVE_INFINITY;
      }

      if (raw.includes('+') && values.length >= 2) {
        return values[0] + values[1];
      }

      return values[0];
    };

    const cardTypeLabel = (card) => {
      if (Number(card) === 1) {
        return 'Yellow';
      }

      if (Number(card) === 2) {
        return 'Second Yellow';
      }

      if (Number(card) === 3) {
        return 'Red';
      }

      return 'Card';
    };

    const positionLabel = (position) => {
      const map = {
        0: 'GK',
        1: 'DF',
        2: 'MF',
        3: 'FW',
      };

      return map[Number(position)] || 'UNK';
    };

    const findTeamCodeFromSquadData = (teamName) => {
      if (!squadDataMap || !teamName) return null;
      for (const [key] of squadDataMap) {
        const player = squadDataMap.get(key);
        if (player && player.nationalTeam && player.nationalTeam.toLowerCase() === teamName.toLowerCase()) {
          return player.nationalTeamCode;
        }
      }
      return null;
    };

    const enrichPlayerFromSquadData = (livePlayer, teamCode) => {
      if (!squadDataMap || !teamCode) return null;
      const shirt = Number(livePlayer.ShirtNumber);
      const key = `${teamCode}|${shirt}`;
      return squadDataMap.get(key) || null;
    };

    const buildLivePlayerEventStatsMap = (team) => {
      const stats = new Map();
      const ensure = (playerId) => {
        const id = String(playerId || '').trim();
        if (!id) {
          return null;
        }

        if (!stats.has(id)) {
          stats.set(id, {
            goals: 0,
            yellow: 0,
            red: 0,
            subOn: false,
            subOff: false,
            subOnMinute: null,
            subOffMinute: null,
          });
        }

        return stats.get(id);
      };

      for (const goal of (Array.isArray(team?.Goals) ? team.Goals : [])) {
        const entry = ensure(goal?.IdPlayer);
        if (entry) {
          entry.goals += 1;
        }
      }

      for (const booking of (Array.isArray(team?.Bookings) ? team.Bookings : [])) {
        const entry = ensure(booking?.IdPlayer);
        if (!entry) {
          continue;
        }

        const card = Number(booking?.Card);
        if (card === 1) {
          entry.yellow += 1;
        } else if (card === 2) {
          entry.yellow += 1;
          entry.red += 1;
        } else if (card === 3) {
          entry.red += 1;
        }
      }

      for (const sub of (Array.isArray(team?.Substitutions) ? team.Substitutions : [])) {
        const onEntry = ensure(sub?.IdPlayerOn);
        if (onEntry) {
          onEntry.subOn = true;
          if (onEntry.subOnMinute === null || onEntry.subOnMinute === undefined) {
            onEntry.subOnMinute = sub?.Minute ?? null;
          }
        }

        const offEntry = ensure(sub?.IdPlayerOff);
        if (offEntry) {
          offEntry.subOff = true;
          if (offEntry.subOffMinute === null || offEntry.subOffMinute === undefined) {
            offEntry.subOffMinute = sub?.Minute ?? null;
          }
        }
      }

      return stats;
    };

    const formatSubMinuteForChip = (minute) => {
      const raw = String(minute || '').trim();
      if (!raw || raw === '-') {
        return '';
      }

      if (/[A-Za-z]/.test(raw) || raw.endsWith("'")) {
        return raw;
      }

      return `${raw}'`;
    };

    const renderLivePlayerList = (team, teamName = '', { applyLiveDeltas = false } = {}) => {
      const players = Array.isArray(team?.Players) ? [...team.Players] : [];
      if (!players.length) {
        return '<div class="empty">Player list unavailable from the current live feed.</div>';
      }

      const hasLineupCoordinates = players.some((player) => (
        player?.LineupX !== null
        && player?.LineupX !== undefined
        && player?.LineupY !== null
        && player?.LineupY !== undefined
      ));

      const teamCode = findTeamCodeFromSquadData(teamName);
      const liveEventStatsByPlayerId = buildLivePlayerEventStatsMap(team);
      const enrichedPlayers = players.map((player, lineupIndex) => {
        const squadData = teamCode ? enrichPlayerFromSquadData(player, teamCode) : null;
        const shirt = Number(player.ShirtNumber);
        const playerId = String(player.IdPlayer || '').trim();
        const liveEventStats = playerId ? (liveEventStatsByPlayerId.get(playerId) || null) : null;
        const lineupX = Number(player.LineupX);
        const lineupY = Number(player.LineupY);
        const hasLineupPoint = (
          player?.LineupX !== null
          && player?.LineupX !== undefined
          && player?.LineupY !== null
          && player?.LineupY !== undefined
          && Number.isFinite(lineupX)
          && Number.isFinite(lineupY)
        );
        return {
          livePlayer: player,
          squadData,
          shirt,
          tournamentGoals: squadData?.tournamentStats?.goals || 0,
          liveEventStats,
          position: Number(player.Position || 99),
          captain: Boolean(player.Captain),
          isStarter: Number(player.Status) === 1,
          lineupIndex,
          hasLineupPoint,
          lineupX,
          lineupY,
        };
      });

      enrichedPlayers.sort((a, b) => {
        if (a.isStarter !== b.isStarter) return a.isStarter ? -1 : 1;

        if (hasLineupCoordinates && a.hasLineupPoint && b.hasLineupPoint) {
          if (a.lineupY !== b.lineupY) return a.lineupY - b.lineupY;
          if (a.lineupX !== b.lineupX) return a.lineupX - b.lineupX;
        }

        // Preserve FIFA-provided lineup sequence as the primary fallback.
        if (a.lineupIndex !== b.lineupIndex) return a.lineupIndex - b.lineupIndex;
        if (a.position !== b.position) return a.position - b.position;
        return a.shirt - b.shirt;
      });

      const rows = enrichedPlayers.map((p, i) => {
        const name = pickEnglishDescription(p.livePlayer.PlayerName) || pickEnglishDescription(p.livePlayer.ShortName) || 'Player';
        const shirt = Number.isFinite(p.shirt) ? String(p.shirt) : '-';
        const pos = positionLabel(p.livePlayer.Position);
        const cap = p.captain ? ' (C)' : '';

        // Career stats from squad-data
        const intlCaps = p.squadData?.caps || '-';
        const careerGoals = p.squadData?.goals || '-';
        const height = p.squadData?.height || '-';
        const club = p.squadData?.club || '-';

        // Tournament stats (tracked from FIFA API)
        const tournamentGoals = p.squadData?.tournamentStats?.goals || 0;
        const tournamentYellow = p.squadData?.tournamentStats?.yellowCards || 0;
        const tournamentRed = p.squadData?.tournamentStats?.redCards || 0;

        const liveGoals = Number(p.liveEventStats?.goals || 0);
        const liveYellow = Number(p.liveEventStats?.yellow || 0);
        const liveRed = Number(p.liveEventStats?.red || 0);
        const liveSubOn = Boolean(p.liveEventStats?.subOn);
        const liveSubOff = Boolean(p.liveEventStats?.subOff);
        const liveSubOnMinute = p.liveEventStats?.subOnMinute ?? null;
        const liveSubOffMinute = p.liveEventStats?.subOffMinute ?? null;
        const effectiveTournamentGoals = applyLiveDeltas ? (tournamentGoals + liveGoals) : tournamentGoals;
        const effectiveTournamentYellow = applyLiveDeltas ? (tournamentYellow + liveYellow) : tournamentYellow;
        const effectiveTournamentRed = applyLiveDeltas ? (tournamentRed + liveRed) : tournamentRed;

        // Data attributes for sorting
        const dataShirt = p.shirt;
        const dataCaps = intlCaps === '-' ? -1 : intlCaps;
        const dataGoals = careerGoals === '-' ? -1 : careerGoals;
        const dataTournamentGoals = effectiveTournamentGoals;
        const dataTournamentYellow = effectiveTournamentYellow;
        const dataTournamentRed = effectiveTournamentRed;
        const dataPos = p.position;
        const dataName = name.toLowerCase();

        const tournamentGoalsDisplay = effectiveTournamentGoals > 0 ? String(effectiveTournamentGoals) : '';
        const tournamentYellowDisplay = effectiveTournamentYellow > 0 ? String(effectiveTournamentYellow) : '';
        const tournamentRedDisplay = effectiveTournamentRed > 0 ? String(effectiveTournamentRed) : '';
        const liveEventChips = [];

        if (liveGoals > 0) {
          liveEventChips.push(`<span class="live-player-live-chip goal" title="Live goals">⚽ +${escapeHtml(String(liveGoals))}</span>`);
        }
        if (liveYellow > 0) {
          liveEventChips.push(`<span class="live-player-live-chip card" title="Live yellow cards"><span class="chip-icon" aria-hidden="true">🟨</span> +${escapeHtml(String(liveYellow))}</span>`);
        }
        if (liveRed > 0) {
          liveEventChips.push(`<span class="live-player-live-chip red" title="Live red cards"><span class="chip-icon" aria-hidden="true">🟥</span> +${escapeHtml(String(liveRed))}</span>`);
        }
        if (liveSubOn || liveSubOff) {
          const subParts = [];
          if (liveSubOn) {
            const onMinute = formatSubMinuteForChip(liveSubOnMinute);
            subParts.push(`<span class="sub-on" aria-hidden="true">↑</span>${onMinute ? `<span class="sub-minute">${escapeHtml(onMinute)}</span>` : ''}`);
          }
          if (liveSubOn && liveSubOff) {
            subParts.push('<span class="sub-sep" aria-hidden="true">•</span>');
          }
          if (liveSubOff) {
            const offMinute = formatSubMinuteForChip(liveSubOffMinute);
            subParts.push(`<span class="sub-off" aria-hidden="true">↓</span>${offMinute ? `<span class="sub-minute">${escapeHtml(offMinute)}</span>` : ''}`);
          }
          liveEventChips.push(`<span class="live-player-live-chip sub" title="Live substitutions">${subParts.join('')}</span>`);
        }

        const liveEventsMarkup = liveEventChips.length
          ? `<div class="live-player-live-events">${liveEventChips.join('')}</div>`
          : '';

        const alternatingClass = i % 2 === 0 ? 'live-player-row-odd' : 'live-player-row-even';
        return `<tr class="live-player-row ${alternatingClass}" data-shirt="${dataShirt}" data-caps="${dataCaps}" data-goals="${dataGoals}" data-tournament-goals="${dataTournamentGoals}" data-tournament-yellow="${dataTournamentYellow}" data-tournament-red="${dataTournamentRed}" data-pos="${dataPos}" data-name="${dataName}"><td class="live-player-shirt">${escapeHtml(shirt)}</td><td class="live-player-name">${escapeHtml(name)}${escapeHtml(cap)}${liveEventsMarkup}</td><td class="live-player-pos">${escapeHtml(pos)}</td><td class="live-player-height">${escapeHtml(String(height))}</td><td class="live-player-club">${escapeHtml(club)}</td><td class="live-player-caps">${escapeHtml(String(intlCaps))}</td><td class="live-player-goals">${escapeHtml(String(careerGoals))}</td><td class="live-player-tournament-goals">${escapeHtml(tournamentGoalsDisplay)}</td><td class="live-player-tournament-yellow">${escapeHtml(tournamentYellowDisplay)}</td><td class="live-player-tournament-red">${escapeHtml(tournamentRedDisplay)}</td></tr>`;
      }).join('');

      return `
        <table class="live-player-table">
          <thead class="live-player-header">
            <tr>
              <th>#</th>
              <th>Name</th>
              <th>Pos</th>
              <th>Height</th>
              <th>Club</th>
              <th>Caps</th>
              <th>Goals</th>
              <th>⚽</th>
              <th>🟨</th>
              <th>🟥</th>
            </tr>
          </thead>
          <tbody>
            ${rows}
          </tbody>
        </table>
      `;
    };

    const initializePlayerTableSorting = () => {
      document.querySelectorAll('.live-player-table').forEach((table) => {
        const headers = table.querySelectorAll('.live-player-header th');
        headers.forEach((th, idx) => {
          const columnMap = ['shirt', 'name', 'pos', 'height', 'club', 'caps', 'goals', 'tournamentGoals', 'tournamentYellow', 'tournamentRed'];
          const column = columnMap[idx];
          if (!column) return;

        th.addEventListener('click', () => {
          const table = th.closest('.live-player-table');
          const tbody = table.querySelector('tbody');
          const rows = Array.from(tbody.querySelectorAll('tr.live-player-row'));

          const isSorted = th.classList.contains('sorted-asc') || th.classList.contains('sorted-desc');
          const isAsc = th.classList.contains('sorted-asc');

          rows.sort((a, b) => {
            let aVal = a.dataset[column] || '';
            let bVal = b.dataset[column] || '';

            // Convert to numbers for numeric columns
            if (column === 'shirt' || column === 'caps' || column === 'goals' || column === 'tournamentGoals' || column === 'pos') {
              aVal = Number(aVal) || 0;
              bVal = Number(bVal) || 0;
              return isAsc ? bVal - aVal : aVal - bVal;
            }

            // String comparison for name/club/etc
            aVal = String(aVal).toLowerCase();
            bVal = String(bVal).toLowerCase();
            return isAsc ? bVal.localeCompare(aVal) : aVal.localeCompare(bVal);
          });

          // Update header classes
          table.querySelectorAll('.live-player-header th').forEach(h => {
            h.classList.remove('sorted-asc', 'sorted-desc');
          });
          th.classList.add(isSorted ? 'sorted-desc' : 'sorted-asc');

          // Re-render rows
          tbody.innerHTML = '';
          rows.forEach(row => tbody.appendChild(row));
        });
        });
      });
    };

    const createLiveEventRows = (team, sideLabel, sideKey, opposingTeam = null, opposingLabel = '') => {
      const players = new Map((Array.isArray(team?.Players) ? team.Players : []).map((player) => [String(player.IdPlayer || ''), pickEnglishDescription(player.PlayerName) || pickEnglishDescription(player.ShortName) || 'Player']));
      const opposingPlayers = new Map((Array.isArray(opposingTeam?.Players) ? opposingTeam.Players : []).map((player) => [String(player.IdPlayer || ''), pickEnglishDescription(player.PlayerName) || pickEnglishDescription(player.ShortName) || 'Player']));
      const rows = [];

      for (const goal of (Array.isArray(team?.Goals) ? team.Goals : [])) {
        const goalType = Number(goal.Type);
        const scorerId = String(goal.IdPlayer || '');
        const ownTeamScorer = players.get(scorerId);
        const opposingTeamScorer = opposingPlayers.get(scorerId);
        const isLikelyOwnGoal = goalType === 3 || (!ownTeamScorer && !!opposingTeamScorer);
        const scorer = ownTeamScorer || opposingTeamScorer || 'Unknown scorer';
        const assist = players.get(String(goal.IdAssistPlayer || ''));
        rows.push({
          minute: String(goal.Minute || '-'),
          order: minuteSortValue(goal.Minute),
          side: sideLabel,
          sideKey: sideKey || 'home',
          type: 'goal',
          player: isLikelyOwnGoal ? `${scorer} (own goal)` : scorer,
          detail: isLikelyOwnGoal && opposingTeamScorer && opposingLabel
            ? `from ${opposingLabel}`
            : (assist ? `assist: ${assist}` : null),
        });
      }

      for (const booking of (Array.isArray(team?.Bookings) ? team.Bookings : [])) {
        const player = players.get(String(booking.IdPlayer || '')) || 'Unknown player';
        const cardNum = Number(booking.Card);
        const type = cardNum === 1 ? 'yellow' : cardNum === 2 ? 'second-yellow' : 'red';
        rows.push({
          minute: String(booking.Minute || '-'),
          order: minuteSortValue(booking.Minute),
          side: sideLabel,
          sideKey: sideKey || 'home',
          type,
          player,
          detail: null,
        });
      }

      for (const sub of (Array.isArray(team?.Substitutions) ? team.Substitutions : [])) {
        const onName = pickEnglishDescription(sub.PlayerOnName) || 'Sub on';
        const offName = pickEnglishDescription(sub.PlayerOffName) || 'Sub off';
        // FIFA omits Minute for half-time subs (Period 4); fall back to a period label
        const rawMinute = String(sub.Minute || '').trim();
        const period = Number(sub.Period);
        const minuteLabel = rawMinute
          ? rawMinute
          : period === 4 ? 'HT'
          : period === 6 ? 'ET1'
          : period === 7 ? 'ET2'
          : '-';
        rows.push({
          minute: minuteLabel,
          order: minuteSortValue(rawMinute || (period === 4 ? '45' : period === 6 ? '90' : period === 7 ? '105' : '-')),
          side: sideLabel,
          sideKey: sideKey || 'home',
          type: 'sub',
          player: onName,
          detail: `off: ${offName}`,
        });
      }

      return rows;
    };

    const getDetailDerivedClockMinute = (detail) => {
      const directCandidates = [
        parseLiveMinuteValue(detail?.SecondHalfTime),
        parseLiveMinuteValue(detail?.FirstHalfTime),
        parseLiveMinuteValue(detail?.MatchTime),
      ].filter((minute) => Number.isFinite(minute) && minute > 0);

      if (directCandidates.length) {
        return Math.max(...directCandidates);
      }

      const allEvents = [
        ...createLiveEventRows(detail?.HomeTeam, '', 'home', detail?.AwayTeam, ''),
        ...createLiveEventRows(detail?.AwayTeam, '', 'away', detail?.HomeTeam, ''),
      ];
      const eventMinutes = allEvents
        .map((event) => Number(event.order))
        .filter((minute) => Number.isFinite(minute) && minute >= 0 && minute <= MAX_PLAUSIBLE_MATCH_MINUTE);

      return eventMinutes.length ? Math.max(...eventMinutes) : Number.NaN;
    };

    const resolveOfficialClockMinute = (match, detail, { preferFrozenMinute = false } = {}) => {
      const matchMinute = parseLiveMinuteValue(match?.MatchTime);
      const detailMinute = parseLiveMinuteValue(detail?.MatchTime);

      if (preferFrozenMinute) {
        const frozenCandidate = [matchMinute, detailMinute].find((minute) => Number.isFinite(minute) && minute > 0);
        if (Number.isFinite(frozenCandidate)) {
          return frozenCandidate;
        }

        return getDetailDerivedClockMinute(detail);
      }

      if (Number.isFinite(matchMinute)) {
        return matchMinute;
      }

      if (Number.isFinite(detailMinute)) {
        return detailMinute;
      }

      return getDetailDerivedClockMinute(detail);
    };

    const renderEventIcon = (type) => {
      if (type === 'goal') return '<span class="et-icon" aria-hidden="true">⚽</span>';
      if (type === 'yellow') return '<span class="et-card et-card-yellow" title="Yellow card"></span>';
      if (type === 'second-yellow') return '<span class="et-card et-card-second-yellow" title="Second yellow / Red"></span>';
      if (type === 'red') return '<span class="et-card et-card-red" title="Red card"></span>';
      if (type === 'sub') return '';
      return '';
    };

    const formatEventMinute = (minute) => {
      const raw = String(minute || '').trim();
      if (!raw || raw === '-') return '?';
      // Already a labelled string (HT, ET1, ET2) or already has the prime symbol — return as-is
      if (/[A-Za-z]/.test(raw) || raw.endsWith("'")) return raw;
      return `${raw}'`;
    };

    const renderEventsTimeline = (events, homeName, awayName) => {
      if (!events.length) {
        return '<div class="empty">Detailed events are not yet available for this active match.</div>';
      }

      const labelRow = [
        `<div class="et-label-home">${escapeHtml(homeName)}</div>`,
        `<div class="et-label-mid"></div>`,
        `<div class="et-label-away">${escapeHtml(awayName)}</div>`,
      ].join('');

      const rows = events.map((event) => {
        const icon = renderEventIcon(event.type);
        const player = `<span class="et-player">${escapeHtml(event.player)}</span>`;
        const detail = event.detail ? `<span class="et-sub-detail">${escapeHtml(event.detail)}</span>` : '';
        const badgeCell = `<div class="et-node et-${escapeHtml(event.type)}"><span class="et-badge">${escapeHtml(formatEventMinute(event.minute))}</span></div>`;

        if (event.type === 'sub') {
          const offName = String(event.detail || '').replace(/^off:\s*/i, '').trim() || 'Unknown player';
          const subStack = [
            `<div class="et-sub-stack">`,
            `<span class="et-sub-line et-sub-line-on"><span class="et-sub-on" aria-hidden="true">↑</span><span class="et-sub-name">${escapeHtml(event.player)}</span></span>`,
            `<span class="et-sub-line et-sub-line-off"><span class="et-sub-off" aria-hidden="true">↓</span><span class="et-sub-name">${escapeHtml(offName)}</span></span>`,
            `</div>`,
          ].join('');

          if (event.sideKey === 'home') {
            return [
              `<div class="et-home et-sub">${subStack}</div>`,
              badgeCell,
              `<div class="et-away"></div>`,
            ].join('');
          }

          return [
            `<div class="et-home"></div>`,
            badgeCell,
            `<div class="et-away et-sub">${subStack}</div>`,
          ].join('');
        }

        if (event.sideKey === 'home') {
          return [
            `<div class="et-home et-${escapeHtml(event.type)}">${detail}${player}${icon}</div>`,
            badgeCell,
            `<div class="et-away"></div>`,
          ].join('');
        } else {
          return [
            `<div class="et-home"></div>`,
            badgeCell,
            `<div class="et-away et-${escapeHtml(event.type)}">${icon}${player}${detail}</div>`,
          ].join('');
        }
      }).join('');

      return `<div class="events-timeline">${labelRow}${rows}</div>`;
    };

    const slugifyForUrl = (value) => String(value || '')
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/&/g, ' and ')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');

    const buildSbsOnDemandMatchUrl = (home, away, contextLabel) => {
      const homeSlug = slugifyForUrl(home) || 'home';
      const awaySlug = slugifyForUrl(away) || 'away';
      const contextSlug = slugifyForUrl(contextLabel) || 'match';
      return `https://www.sbs.com.au/ondemand/fifa-world-cup-2026-${homeSlug}-v-${awaySlug}-${contextSlug}`;
    };

    const resolveStreamContextSlug = (groupLabel, stageLabel) => {
      const groupValue = String(groupLabel || '').trim();
      const groupMatch = groupValue.match(/^group\s+([a-z0-9]+)$/i);
      if (groupMatch?.[1]) {
        return `group-${slugifyForUrl(groupMatch[1]) || 'stage'}`;
      }

      const stageValue = String(stageLabel || '').trim();
      return slugifyForUrl(stageValue) || 'match';
    };

    const buildSbsOnDemandLiveStreamUrl = (home, away, groupLabel, stageLabel) => {
      const homeSlug = slugifyForUrl(home) || 'home';
      const awaySlug = slugifyForUrl(away) || 'away';
      const contextSlug = resolveStreamContextSlug(groupLabel, stageLabel);
      return `https://www.sbs.com.au/ondemand/sports-program/fifa-world-cup-2026-${homeSlug}-v-${awaySlug}-${contextSlug}-live-stream`;
    };

    const knownHighlightsByMatchId = new Map([
      ['400021443', 'https://www.youtube.com/watch?v=iaqc6YD6Ge8'],
    ]);

    const sbsSportYouTubeChannelUrl = 'https://www.youtube.com/@SBSSportau';
    const sbsSportYouTubeChannelSearchBase = 'https://www.youtube.com/@SBSSportau/search';
    const novaTalkSportHlsStreamUrl = 'https://playerservices.streamtheworld.com/api/livestream-redirect/NOVA_TALKSPORT_1AAC.m3u8';
    const novaTalkSportMp3StreamUrl = 'https://playerservices.streamtheworld.com/api/livestream-redirect/NOVA_TALKSPORT_1.mp3';

    const getNovaTalkSportLiveStreamUrl = () => {
      const audio = typeof document !== 'undefined' ? document.createElement('audio') : null;
      const canPlayHls = audio && (
        audio.canPlayType('application/vnd.apple.mpegurl') ||
        audio.canPlayType('application/x-mpegURL') ||
        audio.canPlayType('audio/mpegurl')
      );
      return canPlayHls ? novaTalkSportHlsStreamUrl : novaTalkSportMp3StreamUrl;
    };

    const buildSbsSportYouTubeSearchUrl = (home, away, stageLabel = '') => {
      // Title pattern confirmed: "{Home} v {Away} Highlights: FIFA World Cup 2026 {Group/Stage}"
      const query = `${home} v ${away} Highlights FIFA World Cup 2026${stageLabel ? ' ' + stageLabel : ''}`;
      return `${sbsSportYouTubeChannelSearchBase}?query=${encodeURIComponent(query)}`;
    };

    const getHighlightsUrlForMatch = (match) => {
      const id = String(match?.IdMatch || '').trim();
      if (id && knownHighlightsByMatchId.has(id)) {
        return knownHighlightsByMatchId.get(id);
      }

      const home = teamName(match?.Home);
      const away = teamName(match?.Away);
      const stage = stageName(match);
      return buildSbsSportYouTubeSearchUrl(home, away, stage);
    };

    const getSbsOnDemandMatchPageUrlForMatch = (match) => {
      const home = teamName(match?.Home);
      const away = teamName(match?.Away);
      const context = groupNameFromMatch(match) || stageName(match) || 'match';
      return buildSbsOnDemandMatchUrl(home, away, context);
    };

    const getSbsOnDemandLiveStreamUrlForMatch = (match) => {
      if (isActivelyPlayedMatch(match)) {
        return 'https://www.sbs.com.au/ondemand';
      }

      const home = teamName(match?.Home);
      const away = teamName(match?.Away);
      const group = groupNameFromMatch(match);
      const stage = stageName(match);
      return buildSbsOnDemandLiveStreamUrl(home, away, group, stage);
    };

    const isKnownHighlightsMatch = (match) => {
      const id = String(match?.IdMatch || '').trim();
      return Boolean(id && knownHighlightsByMatchId.has(id));
    };

    const matchRemindersKey = 'fifa2026_match_reminders_v1';

    const loadMatchReminders = () => {
      try {
        const raw = localStorage.getItem(matchRemindersKey);
        if (!raw) { return; }
        const ids = JSON.parse(raw);
        if (Array.isArray(ids)) {
          state.matchReminders = new Set(ids.filter(Boolean));
        }
      } catch {
        // Ignore.
      }
    };

    const saveMatchReminders = () => {
      try {
        localStorage.setItem(matchRemindersKey, JSON.stringify([...state.matchReminders]));
      } catch {
        // Ignore.
      }
    };

    const formatIcalDateTime = (date) =>
      date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');

    const buildMatchTitle = (match) => {
      const home = displayTeamName(teamName(match.Home));
      const away = displayTeamName(teamName(match.Away));
      const stage = stageName(match);
      return `${home} vs ${away} \u2013 FIFA World Cup 2026 (${stage})`;
    };

    const buildGoogleCalendarUrl = (match) => {
      if (!match?.Date) { return '#'; }
      const start = new Date(match.Date);
      const end = new Date(start.getTime() + 2 * 60 * 60 * 1000);
      const title = buildMatchTitle(match);
      const venueDesc = match.Stadium?.Name?.[0]?.Description || '';
      const params = new URLSearchParams({
        action: 'TEMPLATE',
        text: title,
        dates: `${formatIcalDateTime(start)}/${formatIcalDateTime(end)}`,
        details: `FIFA World Cup 2026 \u2013 ${stageName(match)}. Watch on SBS.`,
        location: venueDesc,
      });
      return `https://calendar.google.com/calendar/render?${params.toString()}`;
    };

    const generateIcsContent = (match) => {
      if (!match?.Date) { return null; }
      const start = new Date(match.Date);
      const end = new Date(start.getTime() + 2 * 60 * 60 * 1000);
      const uid = `${String(match.IdMatch || Date.now())}@fifa2026tracker`;
      const title = buildMatchTitle(match);
      const stage = stageName(match);
      return [
        'BEGIN:VCALENDAR',
        'VERSION:2.0',
        'PRODID:-//FIFA World Cup 2026 Brisbane Tracker//EN',
        'CALSCALE:GREGORIAN',
        'METHOD:PUBLISH',
        'BEGIN:VEVENT',
        `DTSTART:${formatIcalDateTime(start)}`,
        `DTEND:${formatIcalDateTime(end)}`,
        `SUMMARY:${title}`,
        `UID:${uid}`,
        `DESCRIPTION:FIFA World Cup 2026 \u2013 ${stage}. Watch on SBS On Demand.`,
        'END:VEVENT',
        'END:VCALENDAR',
      ].join('\r\n');
    };

    const downloadIcsFile = (matchId) => {
      const match = (state.matches || []).find((m) => String(m?.IdMatch || '') === matchId);
      if (!match) { return; }
      const content = generateIcsContent(match);
      if (!content) { return; }
      const blob = new Blob([content], { type: 'text/calendar;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `wc2026-${matchId}.ics`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    };

    const updateBellButtons = (matchId) => {
      const isSet = state.matchReminders.has(matchId);
      document.querySelectorAll(`.btn-bell[data-match-id="${CSS.escape(matchId)}"]`).forEach((btn) => {
        btn.classList.toggle('active', isSet);
        btn.title = isSet ? 'Reminder set \u2013 click to cancel' : 'Remind me 15 min before kickoff';
      });
    };

    const toggleMatchReminder = async (matchId) => {
      if (state.matchReminders.has(matchId)) {
        state.matchReminders.delete(matchId);
        saveMatchReminders();
        updateBellButtons(matchId);
        return;
      }

      if ('Notification' in window && Notification.permission === 'default') {
        await Notification.requestPermission();
      }

      state.matchReminders.add(matchId);
      saveMatchReminders();
      updateBellButtons(matchId);
    };

    const checkMatchReminders = () => {
      if (!('Notification' in window) || Notification.permission !== 'granted') { return; }
      const now = Date.now();
      for (const matchId of [...state.matchReminders]) {
        const match = (state.matches || []).find((m) => String(m?.IdMatch || '') === matchId);
        if (!match?.Date) { continue; }
        const kickoff = new Date(match.Date).getTime();
        const minsUntil = (kickoff - now) / 60000;
        if (minsUntil > 14 && minsUntil <= 15) {
          const home = teamName(match.Home);
          const away = teamName(match.Away);
          const homeCountry = match.Home?.IdCountry || '';
          new Notification('\u26bd Kickoff in 15 minutes!', {
            body: `${home} vs ${away} \u2013 FIFA World Cup 2026`,
            icon: homeCountry ? `https://api.fifa.com/api/v3/picture/flags-sq-1/${homeCountry}` : undefined,
            tag: `match-reminder-${matchId}`,
          });
        }
      }
    };

    window.downloadMatchIcs = downloadIcsFile;
    window.toggleMatchReminder = (matchId) => { void toggleMatchReminder(matchId); };

    const formatKickoffTimeOnly = (match) => {
      if (!match?.Date) { return 'TBD'; }
      return new Intl.DateTimeFormat('en-AU', {
        timeZone: timezone,
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      }).format(new Date(match.Date));
    };

    const formatKickoffDateOnly = (match) => {
      if (!match?.Date) { return ''; }
      return new Intl.DateTimeFormat('en-AU', {
        timeZone: timezone,
        weekday: 'short',
        day: 'numeric',
        month: 'short',
      }).format(new Date(match.Date));
    };

    const buildSbsBoxScoreUrl = () => {
      if (configuredSbsMatchId) {
        return `${sbsMatchCentreBaseUrl}?matchId=${encodeURIComponent(configuredSbsMatchId)}`;
      }

      return sbsMatchCentreBaseUrl;
    };

    const getCurrentActiveLiveMatch = (matches = state.matches) => {
      const list = Array.isArray(matches) ? matches : [];
      return [...list].filter(isActivelyPlayedMatch).sort(sortByDate)[0] || null;
    };

    const resolveLiveFocusMatch = (matches) => {
      const list = Array.isArray(matches) ? matches : [];
      if (isReplayModeActive(list)) {
        return list.find((match) => String(match?.IdMatch || '').trim() === String(state.replayMatchId)) || null;
      }

      return getCurrentActiveLiveMatch(list);
    };

    const renderLiveMatchPage = () => {
      const contentNode = document.getElementById('live-match-content');
      const stampNode = document.getElementById('live-match-rendered-at');
      const headingHighlightsLinkNode = document.getElementById('live-match-highlights-link');
      if (!contentNode || !stampNode) {
        return;
      }

      const focusedMatch = resolveLiveFocusMatch(state.matches);
      if (!focusedMatch) {
        if (headingHighlightsLinkNode) {
          headingHighlightsLinkNode.hidden = true;
          headingHighlightsLinkNode.setAttribute('href', '#');
        }
        contentNode.innerHTML = '<div class="empty">No active match right now. This page will auto-populate when kickoff is live.</div>';
        stampNode.textContent = renderLiveMatchStampText();
        return;
      }

      const active = focusedMatch;
      const activeId = String(active?.IdMatch || '');
      const detail = String(state.liveDetail?.IdMatch || '') === activeId ? state.liveDetail : null;
      const effectiveActive = getEffectiveMatchState(active, detail);
      const homeName = liveTeamName(detail?.HomeTeam, teamName(active.Home));
      const awayName = liveTeamName(detail?.AwayTeam, teamName(active.Away));
      const homeScore = Number.isFinite(Number(detail?.HomeTeam?.Score)) ? Number(detail.HomeTeam.Score) : (Number.isFinite(Number(active.HomeTeamScore)) ? Number(active.HomeTeamScore) : null);
      const awayScore = Number.isFinite(Number(detail?.AwayTeam?.Score)) ? Number(detail.AwayTeam.Score) : (Number.isFinite(Number(active.AwayTeamScore)) ? Number(active.AwayTeamScore) : null);
      const stage = pickEnglishDescription(detail?.StageName) || stageName(active);
      const group = pickEnglishDescription(detail?.GroupName) || groupNameFromMatch(active);
      const stadium = pickEnglishDescription(detail?.Stadium?.Name) || 'Venue unavailable';
      const city = pickEnglishDescription(detail?.Stadium?.CityName) || '';
      const referee = pickEnglishDescription((detail?.Officials || []).find((official) => Number(official.OfficialType) === 1)?.Name) || 'Not listed';
      const tacticsHome = String(detail?.HomeTeam?.Tactics || '').trim();
      const tacticsAway = String(detail?.AwayTeam?.Tactics || '').trim();
      const isFrozenOfficialClock = isHalftimeMatch(effectiveActive) || isCompletedMatch(effectiveActive);
      const resolvedMatchTime = resolveOfficialClockMinute(effectiveActive, detail, { preferFrozenMinute: isFrozenOfficialClock });
      const matchClock = Number.isFinite(resolvedMatchTime)
        ? `${Math.floor(resolvedMatchTime)}:${String(Math.floor((resolvedMatchTime % 1) * 60)).padStart(2, '0')}'`
        : (isCompletedMatch(effectiveActive) ? 'FT' : isHalftimeMatch(effectiveActive) ? 'HT' : 'Live');

      const events = [
        ...createLiveEventRows(detail?.HomeTeam, homeName, 'home', detail?.AwayTeam, awayName),
        ...createLiveEventRows(detail?.AwayTeam, awayName, 'away', detail?.HomeTeam, homeName),
      ].sort((a, b) => a.order - b.order || a.side.localeCompare(b.side));

      const currentHighlightsUrl = getSbsOnDemandMatchPageUrlForMatch(active);
      const playedMatches = [...(state.matches || [])]
        .filter(isCompletedMatch)
        .sort(sortByDate);

      const highlightsRows = playedMatches.map((match) => {
        const home = displayTeamName(teamName(match.Home));
        const away = displayTeamName(teamName(match.Away));
        const kickoff = formatKickoff(match);
        const score = scoreFormatter(match);
        const stage = stageName(match);
        const highlightsUrl = getHighlightsUrlForMatch(match);
        const linkLabel = isKnownHighlightsMatch(match) ? 'Watch highlights' : 'Find on SBS Sport AU';
        return `
          <div class="live-highlight-row">
            <div>${escapeHtml(kickoff)} · ${escapeHtml(home)} ${escapeHtml(score)} ${escapeHtml(away)}</div>
            <a href="${escapeHtml(highlightsUrl)}" target="_blank" rel="noreferrer noopener">${escapeHtml(linkLabel)}</a>
          </div>
        `;
      }).join('');

      const replayModeActive = isReplayModeActive(state.matches);
      const isLiveActiveMatch = isActivelyPlayedMatch(effectiveActive) && !replayModeActive;
      const activeLiveMatch = getCurrentActiveLiveMatch(state.matches);
      const showSwitchToLiveBadge = Boolean(
        replayModeActive
        && activeLiveMatch
        && String(activeLiveMatch?.IdMatch || '').trim() !== String(active?.IdMatch || '').trim()
      );
      const switchToLiveBadge = showSwitchToLiveBadge
        ? '<button type="button" id="live-centre-switch-to-live" class="chip live-switch-chip">Switch to Live Game</button>'
        : '';
      if (headingHighlightsLinkNode) {
        headingHighlightsLinkNode.hidden = false;
        headingHighlightsLinkNode.setAttribute('href', currentHighlightsUrl);
      }
      const shouldApplyLiveDeltas = Boolean(detail && (isLiveActiveMatch || replayModeActive));
      const sbsOnDemandLiveStreamUrl = isLiveActiveMatch ? 'https://www.sbs.com.au/ondemand' : buildSbsOnDemandLiveStreamUrl(homeName, awayName, group, stage);
      const sbsOnDemandMatchUrl = getSbsOnDemandMatchPageUrlForMatch(active);
      const sbsPrimaryUrl = isLiveActiveMatch ? sbsOnDemandLiveStreamUrl : sbsOnDemandMatchUrl;
      const sbsPrimaryHeading = isLiveActiveMatch ? 'SBS On Demand Live Stream:' : 'SBS On Demand Match Page:';
      const sbsPrimaryLinkText = isLiveActiveMatch ? 'Open live stream page in new tab' : 'Open match page in new tab';
      contentNode.innerHTML = `
        <div class="live-match-shell">
          <div class="live-scoreboard">
            <div class="live-team">${renderFlag(active.Home)}<span>${escapeHtml(homeName)}</span></div>
            <div class="live-score">${escapeHtml(homeScore ?? '-')} - ${escapeHtml(awayScore ?? '-')}</div>
            <div class="live-team right"><span>${escapeHtml(awayName)}</span>${renderFlag(active.Away)}</div>
          </div>

          <div class="live-meta">
            ${replayModeActive ? '<span class="chip"><strong>Mode</strong> Demo replay</span>' : ''}
            ${switchToLiveBadge}
            <span class="chip"><strong>Official clock</strong> ${escapeHtml(matchClock)}</span>
            <span class="chip"><strong>Est. time left*</strong> <span id="live-match-time-remaining">${escapeHtml(getEstimatedGameTimeRemainingLabel(active, detail))}</span></span>
            <span class="chip"><strong>Status</strong> ${escapeHtml(formatStatus(effectiveActive))}</span>
            <span class="chip"><strong>Stage</strong> ${escapeHtml(stage)}</span>
            <span class="chip"><strong>Group</strong> ${escapeHtml(group)}</span>
            <span class="chip"><strong>Venue</strong> ${escapeHtml(stadium)}${city ? `, ${escapeHtml(city)}` : ''}</span>
            <span class="chip"><strong>Referee</strong> ${escapeHtml(referee)}</span>
            <span class="chip"><strong>Tactics</strong> ${escapeHtml(tacticsHome || '-')} vs ${escapeHtml(tacticsAway || '-')}</span>
          </div>

          <div class="live-columns">
            <section class="live-column">
              <h4>${escapeHtml(homeName)} Squad</h4>
              <div class="live-list">${renderLivePlayerList(detail?.HomeTeam, homeName, { applyLiveDeltas: shouldApplyLiveDeltas })}</div>
            </section>
            <section class="live-column">
              <h4>${escapeHtml(awayName)} Squad</h4>
              <div class="live-list">${renderLivePlayerList(detail?.AwayTeam, awayName, { applyLiveDeltas: shouldApplyLiveDeltas })}</div>
            </section>
          </div>

          <section class="live-events">
            <h4>Match Events</h4>
            ${renderEventsTimeline(events, homeName, awayName)}
          </section>

          <section class="live-stream">
            <div><strong>${escapeHtml(sbsPrimaryHeading)}</strong> <a href="${escapeHtml(sbsPrimaryUrl)}" target="_blank" rel="noreferrer noopener">${escapeHtml(sbsPrimaryLinkText)}</a></div>
            <div class="muted">* Official clock comes from FIFA MatchTime. Estimated time left uses official match time when available, with a 45m + 15m + 45m baseline plus two mandatory 3-minute hydration breaks (stoppage time excluded).</div>
          </section>
        </div>
      `;

      stampNode.textContent = renderLiveMatchStampText();

      // Initialize sorting for player tables
      setTimeout(() => initializePlayerTableSorting(), 0);
    };

    const isUpcomingMatch = (match) => {
      const status = Number(match?.MatchStatus);
      const resultType = Number(match?.ResultType);
      return resultType !== 1 && status === 1;
    };

    const nextUpBadgeText = (kickoffTs) => {
      const diff = kickoffTs - Date.now();
      if (!Number.isFinite(diff)) {
        return 'Next up';
      }

      if (diff <= 0) {
        return 'Kicking off';
      }

      const totalMinutes = Math.ceil(diff / 60000);
      const hours = Math.floor(totalMinutes / 60);
      const minutes = totalMinutes % 60;
      return hours > 0 ? `Next up · ${hours}h ${minutes}m` : `Next up · ${minutes}m`;
    };

    const updateNextUpCountdowns = () => {
      document.querySelectorAll('.match-badge.next[data-kickoff-ts]').forEach((node) => {
        const kickoffTs = Number(node.dataset.kickoffTs);
        if (Number.isFinite(kickoffTs)) {
          node.textContent = nextUpBadgeText(kickoffTs);
        }
      });
    };

    const renderMatch = (match, options = null) => {
      const extraClass = options && typeof options === 'object' && typeof options.extraClass === 'string'
        ? options.extraClass.trim()
        : '';
      const statusOverride = options && typeof options === 'object' && Number.isFinite(Number(options.statusOverride))
        ? Number(options.statusOverride)
        : Number.NaN;
      const displayMatch = Number.isFinite(statusOverride)
        ? { ...match, MatchStatus: statusOverride }
        : match;
      const homeRaw = teamName(match.Home);
      const awayRaw = teamName(match.Away);
      const home = displayTeamName(homeRaw);
      const away = displayTeamName(awayRaw);
      const homeCanonical = canonicalTeamName(homeRaw);
      const awayCanonical = canonicalTeamName(awayRaw);
      const kickoffKey = match?.Date ? new Date(match.Date).toISOString() : 'unknown';
      const kickoffTs = match?.Date ? new Date(match.Date).getTime() : NaN;
      const hoverKey = `${homeCanonical}|${awayCanonical}|${kickoffKey}`;
      const matchId = String(match?.IdMatch || '').trim();
      const replayable = isCompletedMatch(displayMatch) && !!matchId;

      const isUpcoming = isUpcomingMatch(displayMatch);
      const isLive = isActivelyPlayedMatch(displayMatch);
      const isFinished = isCompletedMatch(displayMatch);
      const gcalUrl = isUpcoming ? buildGoogleCalendarUrl(match) : null;
      const isReminderSet = isUpcoming && state.matchReminders.has(matchId);
      const oddsInline = renderMatchOddsInline(match);
      const liveSyncBadge = isLive ? `<span class="match-badge data-refresh" data-live-refresh-badge="1">${escapeHtml(getLiveMatchSyncBadgeText())}</span>` : '';
      const statusText = formatStatus(displayMatch);
      const matchNumberTag = matchNumberLabel(match);
      const topMatchupBadge = isContenderMatch(match) ? `<span class="match-header-badge top-matchup-header">Top matchup</span>` : '';
      const preferredTeamLabels = getPreferredTeamsForMatch(match);
      const preferredTeamBadge = preferredTeamLabels.length
        ? `<span class="match-header-badge preferred-team-header" title="${escapeHtml(preferredTeamLabels.join(', '))}">${escapeHtml(preferredTeamLabels.join(' & '))}</span>`
        : '';
      const scoreText = extraClass.includes('live-spotlight-match')
        ? scoreFormatter(match).replace(/-/g, ' - ')
        : scoreFormatter(match);
      const timeBlock = isUpcoming
        ? `<div class="time time-upcoming">${escapeHtml(formatKickoffTimeOnly(match))}</div>
           <div class="time-date-sub">${escapeHtml(formatKickoffDateOnly(match))}</div>`
        : `<div class="time">${escapeHtml(formatKickoff(match))}</div>`;
      const actionButtons = isUpcoming
        ? `
        <div class="match-actions">
          ${matchId ? `<a class="btn-action" href="${escapeHtml(gcalUrl)}" target="_blank" rel="noreferrer noopener" title="Add to Google Calendar" aria-label="Add to Google Calendar">📅</a>` : ''}
          ${matchId ? `<button type="button" class="btn-action btn-bell${isReminderSet ? ' active' : ''}" data-match-id="${escapeHtml(matchId)}" title="${isReminderSet ? 'Reminder set – click to cancel' : 'Remind me 15 min before kickoff'}">🔔</button>` : ''}
        </div>`
        : '';
      const showSpotlightLiveStreamButton = isLive && extraClass.includes('live-spotlight-match');
      const showSpotlightListenLiveButton = isLive && extraClass.includes('live-spotlight-match');
      const spotlightListenLiveActionButton = showSpotlightListenLiveButton
        ? `<a class="btn-action btn-listen-link" href="${escapeHtml(getNovaTalkSportLiveStreamUrl())}" target="_blank" rel="noreferrer noopener" title="Listen to talkSPORT live (HLS with MP3 fallback)" aria-label="Listen to talkSPORT live (HLS with MP3 fallback)"><svg class="btn-action-icon listen-live-icon" viewBox="0 0 20 20" aria-hidden="true" focusable="false"><path d="M7 5.5 14 10 7 14.5Z" fill="currentColor"/><circle cx="5" cy="10" r="1.1" fill="currentColor"/><path d="M3.2 7.1a5.5 5.5 0 0 0 0 5.8" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/><path d="M16.8 7.1a5.5 5.5 0 0 1 0 5.8" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/></svg></a>`
        : '';
      const spotlightLiveStreamActionButton = showSpotlightLiveStreamButton
        ? `<a class="btn-action btn-stream-link" href="${escapeHtml(getSbsOnDemandLiveStreamUrlForMatch(match))}" target="_blank" rel="noreferrer noopener" title="Open SBS On Demand live stream page" aria-label="Open SBS On Demand live stream page"><svg class="btn-action-icon replay-tv-icon" viewBox="0 0 20 20" aria-hidden="true" focusable="false"><rect x="2.25" y="2.5" width="15.5" height="10.25" rx="1.75" ry="1.75" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M8.3 6.15 12.4 8.95 8.3 11.75Z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><path d="M6 16.15h8" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg></a>`
        : '';
      const statusMarkup = statusText === 'Scheduled'
        ? ''
        : `<div class="${statusClass(displayMatch)}">${escapeHtml(statusText)}</div>`;
      const statusClusterMarkup = statusMarkup && (spotlightListenLiveActionButton || spotlightLiveStreamActionButton)
        ? `<div class="status-link-cluster">${statusMarkup}${spotlightListenLiveActionButton}${spotlightLiveStreamActionButton}</div>`
        : `${statusMarkup}${spotlightListenLiveActionButton}${spotlightLiveStreamActionButton}`;
      const replayActionButton = replayable
        ? `<a class="btn-action btn-replay-link" href="${escapeHtml(getSbsOnDemandMatchPageUrlForMatch(match))}" target="_blank" rel="noreferrer noopener" title="Open SBS On Demand match page" aria-label="Open SBS On Demand match page"><svg class="btn-action-icon replay-tv-icon" viewBox="0 0 20 20" aria-hidden="true" focusable="false"><rect x="2.25" y="2.5" width="15.5" height="10.25" rx="1.75" ry="1.75" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M8.3 6.15 12.4 8.95 8.3 11.75Z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><path d="M6 16.15h8" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg></a>`
        : '';
      const badges = `
        <span class="teams-badges">
          ${replayable ? '<span class="match-badge secondary">Replay</span>' : ''}
          ${isNextUpMatch(displayMatch) ? `<span class="match-badge next"${Number.isFinite(kickoffTs) ? ` data-kickoff-ts="${kickoffTs}"` : ''}>${escapeHtml(nextUpBadgeText(kickoffTs))}</span>` : ''}
          ${liveSyncBadge}
        </span>
      `;

      return `
      <article class="match${isNextUpMatch(displayMatch) ? ' next-up' : ''}${isContenderMatch(match) ? ' featured' : ''}${isPreferredTeamMatch(match) ? ' preferred-team' : ''}${replayable ? ' replayable' : ''}${extraClass ? ` ${escapeHtml(extraClass)}` : ''}" data-match-id="${escapeHtml(matchId)}" data-replayable="${replayable ? '1' : '0'}" data-hover-key="${escapeHtml(hoverKey)}" data-home-team="${escapeHtml(home)}" data-away-team="${escapeHtml(away)}" data-home-canonical="${escapeHtml(homeCanonical)}" data-away-canonical="${escapeHtml(awayCanonical)}">
        <div class="match-main">
          <div class="teams">
            ${renderFlag(match.Home)}
            <span class="team-name">${escapeHtml(home)}</span>
            <span class="score-inline${isLive ? ' live' : ''}${isFinished ? ' final' : ''}">${escapeHtml(scoreText)}</span>
            ${renderFlag(match.Away)}
            <span class="team-name">${escapeHtml(away)}</span>
          </div>
          <div class="meta-main">
            ${timeBlock}
            ${statusClusterMarkup}
            ${topMatchupBadge}
            ${preferredTeamBadge}
          </div>
        </div>

        <div class="match-details">
          <span class="slot">${escapeHtml(stageSlot(match))}</span>
          ${matchNumberTag ? `<span class="slot">${escapeHtml(matchNumberTag)}</span>` : ''}
          ${oddsInline}
          ${replayActionButton}
          ${actionButtons}
          ${badges}
        </div>
      </article>
    `;
    };

    const renderGroupStageLiveSpotlight = (liveMatches) => {
      const spotlightNode = document.getElementById('group-live-spotlight');
      if (!spotlightNode) {
        return;
      }

      if (!Array.isArray(liveMatches) || !liveMatches.length) {
        spotlightNode.innerHTML = '';
        spotlightNode.hidden = true;
        return;
      }

      spotlightNode.hidden = false;

      const renderSpotlightTicker = (match) => {
        const matchId = String(match?.IdMatch || '').trim();
        const detail = getCachedLiveDetail(matchId);
        const effectiveMatch = getEffectiveMatchState(match, detail);
        const home = displayTeamName(teamName(match?.Home));
        const away = displayTeamName(teamName(match?.Away));
        const pullTs = state.lastFifaPullAt instanceof Date ? state.lastFifaPullAt.getTime() : Number.NaN;
        const kickoffTs = new Date(match?.Date || 0).getTime();
        const isHalftime = isHalftimeMatch(effectiveMatch);
        const isMatchCompleted = isCompletedMatch(effectiveMatch);
        const isFrozenClock = isHalftime || isMatchCompleted;
        const baseMinute = resolveOfficialClockMinute(effectiveMatch, detail, { preferFrozenMinute: isFrozenClock });
        const frozenFallbackLabel = isMatchCompleted ? 'FT' : isHalftime ? 'HT' : 'Live';
        const clockLabel = getSpotlightLiveClockLabel(baseMinute, pullTs, kickoffTs, isFrozenClock, frozenFallbackLabel);
        const clockHeading = isMatchCompleted ? 'Official clock (FT)' : isHalftime ? 'Official clock (HT)' : 'Official clock';
        const freezeAttr = isFrozenClock ? '1' : '0';

        const allEvents = detail
          ? [
            ...createLiveEventRows(detail?.HomeTeam, home, 'home', detail?.AwayTeam, away),
            ...createLiveEventRows(detail?.AwayTeam, away, 'away', detail?.HomeTeam, home),
          ].sort((a, b) => a.order - b.order || a.side.localeCompare(b.side))
          : [];

        const primaryEvents = allEvents.filter((e) => e.type !== 'sub');
        const subEvents     = allEvents.filter((e) => e.type === 'sub');

        const clockHtml = `<div class="live-spotlight-clock-row"><span class="live-spotlight-clock-label">${escapeHtml(clockHeading)}</span><span class="live-spotlight-clock" data-live-clock-base-minute="${Number.isFinite(baseMinute) ? escapeHtml(baseMinute) : ''}" data-live-clock-pull-ts="${escapeHtml(pullTs)}" data-live-clock-kickoff-ts="${escapeHtml(kickoffTs)}" data-live-clock-freeze="${escapeHtml(freezeAttr)}" data-live-clock-fallback-label="${escapeHtml(frozenFallbackLabel)}">${escapeHtml(clockLabel)}</span></div>`;

        if (!detail && matchId) {
          fetchLiveDetailByMatchId(matchId).then(() => {
            renderGroupStage();
            if (String(state.liveDetail?.IdMatch || '').trim() === matchId) {
              renderLiveMatchPage();
            }
          }).catch(() => {});
        }

        if (!allEvents.length) {
          const emptyMessage = detail
            ? 'No goals, cards, or substitutions reported yet for this match.'
            : 'Awaiting detailed live events feed.';
          return `<div class="live-spotlight-ticker">${clockHtml}<div class="live-spotlight-ticker-label">Match events</div><div class="live-spotlight-ticker-empty">${emptyMessage}</div></div>`;
        }

        const renderEventChip = (event) => {
          const icon  = renderEventIcon(event.type);
          const min   = escapeHtml(formatEventMinute(event.minute));
          const side  = escapeHtml(event.sideKey === 'home' ? 'H' : 'A');
          const player = escapeHtml(event.player || 'Player');
          return `<span class="live-spotlight-ticker-event et-${escapeHtml(event.type)}"><span class="ticker-minute">${min}</span>${icon}<span class="ticker-team">${side}</span><span>${player}</span></span>`;
        };

        const renderSubChip = (event) => {
          const min    = escapeHtml(formatEventMinute(event.minute));
          const side   = escapeHtml(event.sideKey === 'home' ? 'H' : 'A');
          const onName  = escapeHtml(event.player || 'Sub on');
          // detail field is 'off: Player' — strip prefix
          const offName = escapeHtml((event.detail || '').replace(/^off:\s*/i, '') || 'Sub off');
          return `<span class="live-spotlight-ticker-event et-sub"><span class="ticker-minute">${min}</span><span class="ticker-team">${side}</span><span class="et-sub-on" aria-label="on">↑</span><span>${onName}</span><span class="et-sub-off" aria-label="off">↓</span><span>${offName}</span></span>`;
        };

        const separator = `<span class="live-spotlight-ticker-sep" aria-hidden="true">·</span>`;

        const buildTrack = (chips) => {
          const html = chips.join('');
          // Separator between the two halves marks the loop boundary visually
          return html + separator + html + separator;
        };

        const primaryHtml = primaryEvents.length
          ? `<div class="live-spotlight-ticker-label">Goals &amp; Cards</div><div class="live-spotlight-ticker-viewport"><div class="live-spotlight-ticker-track">${buildTrack(primaryEvents.map(renderEventChip))}</div></div>`
          : `<div class="live-spotlight-ticker-label">Goals &amp; Cards</div><div class="live-spotlight-ticker-empty">No goals or cards yet.</div>`;

        const subsHtml = subEvents.length
          ? `<div class="live-spotlight-ticker-label sub-label">Substitutions</div><div class="live-spotlight-ticker-viewport subs-viewport"><div class="live-spotlight-ticker-track">${buildTrack(subEvents.map(renderSubChip))}</div></div>`
          : '';

        return `<div class="live-spotlight-ticker">${clockHtml}${primaryHtml}${subsHtml}</div>`;
      };

      spotlightNode.innerHTML = `
        <section class="card group-live-spotlight-card">
          <h3 class="group-live-spotlight-head">
            <span>Live Match Spotlight</span>
            <span class="badge">Live now</span>
          </h3>
          <div class="group-live-spotlight-list">
            ${liveMatches.map((match) => {
              const detail = getCachedLiveDetail(String(match?.IdMatch || '').trim());
              const liveDetailStatus = Number(detail?.MatchStatus);
              return `<div class="group-live-spotlight-item">${renderMatch(match, { extraClass: 'live-spotlight-match', statusOverride: liveDetailStatus })}${renderSpotlightTicker(match)}</div>`;
            }).join('')}
          </div>
        </section>
      `;
    };

    const renderLiveGroupTableSpotlight = (liveMatches) => {
      const spotlightNode = document.getElementById('group-live-table-spotlight');
      if (!spotlightNode) {
        return;
      }

      const list = Array.isArray(liveMatches) ? liveMatches : [];
      if (!list.length) {
        spotlightNode.innerHTML = '';
        spotlightNode.hidden = true;
        return;
      }

      const primaryLiveMatch = [...list].sort(sortByDate)[0] || null;
      if (!primaryLiveMatch) {
        spotlightNode.innerHTML = '';
        spotlightNode.hidden = true;
        return;
      }

      const groupStageMatches = (state.matches || [])
        .filter((match) => stageName(match) === 'First Stage' && match.GroupName?.length)
        .sort(sortByDate);
      const groups = buildGroupTables(groupStageMatches);
      const liveGroupName = groupNameFromMatch(primaryLiveMatch);
      const group = groups.find((entry) => entry.name === liveGroupName);
      if (!group || !Array.isArray(group.rows) || !group.rows.length) {
        spotlightNode.innerHTML = '';
        spotlightNode.hidden = true;
        return;
      }

      const liveTeams = new Set([
        canonicalTeamName(teamName(primaryLiveMatch.Home)),
        canonicalTeamName(teamName(primaryLiveMatch.Away)),
      ].filter(Boolean));
      const rows = group.rows
        .map((row) => {
          const isLiveTeam = liveTeams.has(canonicalTeamName(row.name));
          return `
            <tr class="${isLiveTeam ? 'group-live-team-row' : ''}">
              <td class="team-col">
                <span class="team-cell">
                  ${row.flag ? `<img class="flag" src="${escapeHtml(row.flag)}" alt="${escapeHtml(row.name)} flag">` : ''}
                  <span>${escapeHtml(row.name)}</span>
                </span>
              </td>
              <td>${row.p}</td>
              <td>${row.w}</td>
              <td>${row.d}</td>
              <td>${row.l}</td>
              <td>${row.gf}</td>
              <td>${row.ga}</td>
              <td>${row.gd}</td>
              <td class="pts-col">${row.pts}</td>
            </tr>
          `;
        }).join('');

      if (!rows) {
        spotlightNode.innerHTML = '';
        spotlightNode.hidden = true;
        return;
      }

      const home = displayTeamName(teamName(primaryLiveMatch.Home));
      const away = displayTeamName(teamName(primaryLiveMatch.Away));
      const score = scoreFormatter(primaryLiveMatch).replace(/-/g, ' - ');
      spotlightNode.hidden = false;
      spotlightNode.innerHTML = `
        <section class="card table-card group-live-table-spotlight-card">
          <div class="group-live-table-spotlight-head">
            <div>
              <h3 class="group-live-table-spotlight-title">Live Group Table Snapshot</h3>
              <p class="group-live-table-spotlight-sub">${escapeHtml(liveGroupName)} · ${escapeHtml(home)} ${escapeHtml(score)} ${escapeHtml(away)}</p>
            </div>
            <span class="badge">Live group game</span>
          </div>
          <div class="table-wrap">
            <table class="group-table">
              <tr>
                <th class="team-col">Team</th>
                <th>P</th>
                <th>W</th>
                <th>D</th>
                <th>L</th>
                <th>GF</th>
                <th>GA</th>
                <th>GD</th>
                <th class="pts-col">Pts</th>
              </tr>
              ${rows}
            </table>
          </div>
        </section>
      `;
    };

    const attachMatchHoverHandlers = () => {
      const setHoveredFromMatch = (matchNode) => {
        const key = String(matchNode?.dataset?.hoverKey || '').trim();
        if (!key || state.hoveredMatchKey === key) {
          return;
        }

        const homeCanonical = canonicalTeamName(String(matchNode?.dataset?.homeCanonical || ''));
        const awayCanonical = canonicalTeamName(String(matchNode?.dataset?.awayCanonical || ''));
        const homeTeam = String(matchNode?.dataset?.homeTeam || '').trim();
        const awayTeam = String(matchNode?.dataset?.awayTeam || '').trim();

        const teams = new Map();
        if (homeCanonical) {
          teams.set(homeCanonical, homeTeam || homeCanonical);
        }

        if (awayCanonical) {
          teams.set(awayCanonical, awayTeam || awayCanonical);
        }

        document.querySelectorAll('.match.hover-focus').forEach((node) => node.classList.remove('hover-focus'));
        matchNode.classList.add('hover-focus');
        state.hoveredMatchKey = key;
        state.hoveredTeams = teams;
        renderWinnerOddsPanel();
      };

      const clearHover = () => {
        if (!state.hoveredMatchKey && !(state.hoveredTeams instanceof Map && state.hoveredTeams.size)) {
          return;
        }

        document.querySelectorAll('.match.hover-focus').forEach((node) => node.classList.remove('hover-focus'));
        state.hoveredMatchKey = null;
        state.touchHoverLockedKey = null;
        state.hoveredTeams = new Map();
        renderWinnerOddsPanel();
      };

      document.addEventListener('mouseover', (event) => {
        const matchNode = event.target?.closest?.('.match');
        if (!matchNode) {
          return;
        }

        if (matchNode.contains(event.relatedTarget)) {
          return;
        }

        setHoveredFromMatch(matchNode);
      });

      document.addEventListener('mouseout', (event) => {
        if (state.touchHoverLockedKey) {
          return;
        }

        const matchNode = event.target?.closest?.('.match');
        if (!matchNode) {
          return;
        }

        const related = event.relatedTarget;
        if (related && matchNode.contains(related)) {
          return;
        }

        const nextMatch = related?.closest?.('.match');
        if (nextMatch) {
          setHoveredFromMatch(nextMatch);
          return;
        }

        clearHover();
      });

      document.addEventListener('pointerdown', (event) => {
        if (event.pointerType !== 'touch') {
          return;
        }

        if (event.target?.closest?.('.btn-bell')) {
          state.suppressNextMatchClick = true;
          return;
        }

        const touchedMatch = event.target?.closest?.('.match');
        if (touchedMatch) {
          const key = String(touchedMatch?.dataset?.hoverKey || '').trim();
          state.suppressNextMatchClick = true;
          if (!key) {
            return;
          }

          if (state.touchHoverLockedKey === key) {
            clearHover();
            return;
          }

          setHoveredFromMatch(touchedMatch);
          state.touchHoverLockedKey = key;
          return;
        }

        if (state.touchHoverLockedKey) {
          clearHover();
        }
      });

      document.addEventListener('click', async (event) => {
        if (event.target?.closest?.('#live-centre-switch-to-live')) {
          event.stopPropagation();
          const activeLiveMatch = getCurrentActiveLiveMatch(state.matches);
          if (!activeLiveMatch) {
            return;
          }

          state.replayMatchId = null;
          state.replaySelectionSource = null;
          syncReplayMatchInUrl(null);
          syncRefreshSchedule();
          updateRefreshCountdownViews();

          await loadLiveMatchDetails(activeLiveMatch, { refresh: true });
          renderLiveMatchPage();
          renderGroupStage();
          return;
        }

        const matchNode = event.target?.closest?.('.match');
        if (!matchNode) {
          return;
        }

        if (state.suppressNextMatchClick) {
          state.suppressNextMatchClick = false;
          return;
        }

        if (event.target?.closest?.('.btn-bell')) {
          const btn = event.target.closest('.btn-bell');
          const bellMatchId = String(btn.getAttribute('data-match-id') || '').trim();
          if (bellMatchId) {
            event.stopPropagation();
            await toggleMatchReminder(bellMatchId);
            return;
          }
        }

        if (event.target?.closest?.('.btn-replay-link, .btn-stream-link, .btn-listen-link')) {
          event.stopPropagation();
          return;
        }

        const replayable = String(matchNode.getAttribute('data-replayable') || '') === '1';
        const matchId = String(matchNode.getAttribute('data-match-id') || '').trim();
        if (!replayable || !matchId) {
          return;
        }

        state.replayMatchId = matchId;
        state.replaySelectionSource = 'user';
        syncReplayMatchInUrl(matchId);
        syncRefreshSchedule();
        updateRefreshCountdownViews();

        const focused = (state.matches || []).find((match) => String(match?.IdMatch || '').trim() === matchId) || null;
        await loadLiveMatchDetails(focused);
        renderLiveMatchPage();

        document.querySelector('[data-page="live-match"]')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    };

    const renderFlag = (side) => {
      const url = flagUrl(side);
      const alt = side?.TeamName?.find((entry) => entry.Locale === 'en-GB')?.Description || side?.ShortClubName || side?.Abbreviation || 'Team';

      return url ? `<img class="flag" src="${escapeHtml(url)}" alt="${escapeHtml(alt)} flag">` : '';
    };

    const renderMatchListCard = (title, items, badgeText) => `
      <section class="card">
        <h3><span>${escapeHtml(title)}</span><span class="badge">${escapeHtml(badgeText)}</span></h3>
        <div class="match-list">
          ${items.length ? items.map(renderMatch).join('') : '<div class="empty">No matches available yet.</div>'}
        </div>
      </section>
    `;

    const groupByDay = (matches, sortComparator = sortByDate) => {
      const days = [];

      for (const match of [...matches].sort(sortComparator)) {
        const key = dayKey(match);
        const last = days[days.length - 1];

        if (!last || last.key !== key) {
          days.push({ key, matches: [match] });
        } else {
          last.matches.push(match);
        }
      }

      return days;
    };

    const renderDateGroupedCards = (gridId, matches, label, options = {}) => {
      const sortComparator = typeof options.sortComparator === 'function' ? options.sortComparator : sortByDate;
      const emptyMessage = String(options.emptyMessage || 'No matches available yet.');
      const days = groupByDay(matches, sortComparator);

      if (!days.length) {
        document.getElementById(gridId).innerHTML = `<div class="empty">${escapeHtml(emptyMessage)}</div>`;
        return `${label} updated ${state.updatedAt ? updateFormatter.format(state.updatedAt) : 'waiting for data'}`;
      }

      document.getElementById(gridId).innerHTML = days.map((day) => {
        const firstMatch = day.matches[0];
        return `
          <section class="card day-card">
            <h3>
              <span class="day-label">${escapeHtml(formatDayLabel(firstMatch))}</span>
              <span class="day-meta">${escapeHtml(day.matches.length)} matches</span>
            </h3>
            <div class="day-list">
              ${day.matches.map(renderMatch).join('')}
            </div>
          </section>
        `;
      }).join('');

      return `${label} updated ${state.updatedAt ? updateFormatter.format(state.updatedAt) : 'waiting for data'}`;
    };

    const groupNameFromMatch = (match) => {
      const localized = match.GroupName?.find((entry) => entry.Locale === 'en-GB')?.Description;
      if (localized) {
        return localized;
      }

      return match.GroupName?.[0]?.Description || 'Unknown group';
    };

    const hasFinalScore = (match) => Number.isFinite(match.HomeTeamScore) && Number.isFinite(match.AwayTeamScore);

    const buildGroupTables = (matches) => {
      const groups = new Map();

      const ensureTeam = (group, side) => {
        const canonical = canonicalTeamName(teamName(side));
        if (!canonical) {
          return null;
        }

        if (!group.teams.has(canonical)) {
          group.teams.set(canonical, {
            canonical,
            name: teamName(side),
            flag: flagUrl(side),
            p: 0,
            w: 0,
            d: 0,
            l: 0,
            gf: 0,
            ga: 0,
            gd: 0,
            pts: 0,
            yc: 0,
            rc: 0,
          });
        }

        return group.teams.get(canonical);
      };

      for (const match of matches) {
        const groupName = groupNameFromMatch(match);
        if (!groups.has(groupName)) {
          groups.set(groupName, {
            name: groupName,
            teams: new Map(),
            totalMatches: 0,
            playedMatches: 0,
          });
        }

        const group = groups.get(groupName);
        group.totalMatches += 1;

        const home = ensureTeam(group, match.Home);
        const away = ensureTeam(group, match.Away);
        if (!home || !away) {
          continue;
        }

        if (!hasFinalScore(match)) {
          continue;
        }

        group.playedMatches += 1;
        const hs = Number(match.HomeTeamScore);
        const as = Number(match.AwayTeamScore);

        home.p += 1;
        away.p += 1;
        home.gf += hs;
        home.ga += as;
        away.gf += as;
        away.ga += hs;

        if (hs > as) {
          home.w += 1;
          home.pts += 3;
          away.l += 1;
        } else if (hs < as) {
          away.w += 1;
          away.pts += 3;
          home.l += 1;
        } else {
          home.d += 1;
          away.d += 1;
          home.pts += 1;
          away.pts += 1;
        }
      }

      // Aggregate tournament cards from player stats
      if (state.squadData && Array.isArray(state.squadData)) {
        for (const player of state.squadData) {
          const teamName = player.nationalTeam;
          const canonical = canonicalTeamName(teamName);
          if (!canonical) {
            continue;
          }

          const tournamentStats = player.tournamentStats || {};
          const yc = Number(tournamentStats.yellowCards || 0);
          const rc = Number(tournamentStats.redCards || 0);

          // Find team in groups and add cards
          for (const group of groups.values()) {
            const team = group.teams.get(canonical);
            if (team) {
              team.yc += yc;
              team.rc += rc;
              break;
            }
          }
        }
      }

      const sortedGroups = [...groups.values()]
        .map((group) => {
          const rows = [...group.teams.values()]
            .map((row) => ({ ...row, gd: row.gf - row.ga }))
            .sort((a, b) => {
              if (b.pts !== a.pts) {
                return b.pts - a.pts;
              }

              if (b.gd !== a.gd) {
                return b.gd - a.gd;
              }

              if (b.gf !== a.gf) {
                return b.gf - a.gf;
              }

              return a.name.localeCompare(b.name);
            });

          return {
            ...group,
            rows,
          };
        })
        .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));

      return sortedGroups;
    };

    const renderGroupTablesPage = () => {
      const groupStageMatches = state.matches
        .filter((match) => stageName(match) === 'First Stage' && match.GroupName?.length && isCompletedMatch(match))
        .sort(sortByDate);

      const groups = buildGroupTables(groupStageMatches);
      const gridNode = document.getElementById('group-tables-grid');
      const stampNode = document.getElementById('group-tables-rendered-at');

      if (!groups.length) {
        gridNode.innerHTML = '<div class="empty">Group tables will appear as group-stage fixtures become available.</div>';
        stampNode.textContent = 'Group tables updated waiting for data';
        return;
      }

      gridNode.innerHTML = groups.map((group) => {
        const rows = group.rows.map((row) => `
          <tr>
            <td class="team-col">
              <span class="team-cell">
                ${row.flag ? `<img class="flag" src="${escapeHtml(row.flag)}" alt="${escapeHtml(row.name)} flag">` : ''}
                <span>${escapeHtml(row.name)}</span>
              </span>
            </td>
            <td>${row.p}</td>
            <td>${row.w}</td>
            <td>${row.d}</td>
            <td>${row.l}</td>
            <td>${row.gf}</td>
            <td>${row.ga}</td>
            <td>${row.gd}</td>
            <td>${row.yc}</td>
            <td>${row.rc}</td>
            <td class="pts-col">${row.pts}</td>
          </tr>
        `).join('');

        return `
          <section class="card table-card">
            <h3><span>${escapeHtml(group.name)}</span><span class="badge">${group.playedMatches}/${group.totalMatches} played</span></h3>
            <div class="table-wrap">
              <table class="group-table">
                <tr>
                  <th class="team-col">Team</th>
                  <th>P</th>
                  <th>W</th>
                  <th>D</th>
                  <th>L</th>
                  <th>GF</th>
                  <th>GA</th>
                  <th>GD</th>
                  <th title="Yellow Cards">🟨</th>
                  <th title="Red Cards">🟥</th>
                  <th class="pts-col">Pts</th>
                </tr>
                ${rows}
              </table>
            </div>
          </section>
        `;
      }).join('');

      stampNode.textContent = `Group tables updated ${state.updatedAt ? updateFormatter.format(state.updatedAt) : 'waiting for data'}`;
    };

    const renderThirdPlacedTeamsPage = () => {
      const groupStageMatches = state.matches
        .filter((match) => stageName(match) === 'First Stage' && match.GroupName?.length && isCompletedMatch(match))
        .sort(sortByDate);

      const groups = buildGroupTables(groupStageMatches);
      const gridNode = document.getElementById('lucky8-grid');
      const stampNode = document.getElementById('lucky8-rendered-at');

      if (!groups.length) {
        gridNode.innerHTML = '<div class="empty">Third-placed teams tracking will appear as group-stage fixtures become available.</div>';
        stampNode.textContent = 'Updated waiting for data';
        return;
      }

      // Extract 3rd placed teams
      const thirdPlacedTeams = [];
      for (const group of groups) {
        if (group.rows.length >= 3) {
          const team = group.rows[2];
          thirdPlacedTeams.push({
            groupName: group.name,
            ...team
          });
        }
      }

      // If we don't have enough 3rd placed teams yet
      if (!thirdPlacedTeams.length) {
        gridNode.innerHTML = '<div class="empty">Third-placed teams will populate once group tables have sufficient matches.</div>';
        stampNode.textContent = 'Updated waiting for data';
        return;
      }

      // Sort according to tie-breakers
      thirdPlacedTeams.sort((a, b) => {
        if (b.pts !== a.pts) return b.pts - a.pts;
        if (b.gd !== a.gd) return b.gd - a.gd;
        if (b.gf !== a.gf) return b.gf - a.gf;
        return a.name.localeCompare(b.name);
      });

      const rowsHTML = thirdPlacedTeams.map((row, index) => {
        const isQualified = index < 8; // Top 8 third-placed advance
        // We'll use a style class for qualified
        const rowClass = isQualified ? 'lucky8-qualified' : 'lucky8-eliminated';
        const rankIndicator = isQualified ? '✅ ' : '❌ ';

        return `
          <tr class="${rowClass}">
            <td>${index + 1}</td>
            <td class="team-col">
              <span class="team-cell">
                ${row.flag ? `<img class="flag" src="${escapeHtml(row.flag)}" alt="${escapeHtml(row.name)} flag">` : ''}
                <span>${escapeHtml(row.name)} <small>(${escapeHtml(row.groupName)})</small></span>
              </span>
            </td>
            <td>${row.p}</td>
            <td>${row.w}</td>
            <td>${row.d}</td>
            <td>${row.l}</td>
            <td>${row.gf}</td>
            <td>${row.gd}</td>
            <td class="pts-col">${row.pts}</td>
          </tr>
        `;
      }).join('');

      gridNode.innerHTML = `
        <section class="card table-card" style="grid-column: 1 / -1;">
          <h3><span>Current "Lucky 8" Ranking</span></h3>
          <div class="table-wrap">
            <table class="group-table">
              <tr>
                <th>Rk</th>
                <th class="team-col">Team</th>
                <th>P</th>
                <th>W</th>
                <th>D</th>
                <th>L</th>
                <th>GF</th>
                <th>GD</th>
                <th class="pts-col">Pts</th>
              </tr>
              ${rowsHTML}
            </table>
          </div>
        </section>
      `;

      stampNode.textContent = `Third-placed teams updated ${state.updatedAt ? updateFormatter.format(state.updatedAt) : 'waiting for data'}`;
    };

    const renderGroupStage = () => {
      const matches = state.matches
        .filter((match) => stageName(match) === 'First Stage' && !isCompletedMatch(match));

      const liveMatches = matches.filter(isActivelyPlayedMatch);
      const nonLiveMatches = matches.filter((match) => !isActivelyPlayedMatch(match));

      renderWinnerOddsPanel();
      updateLiveMatchCentrePresentation();
      renderLiveGroupTableSpotlight(liveMatches);
      renderGroupStageLiveSpotlight(liveMatches);
      renderDateGroupedCards('groups-grid', nonLiveMatches, 'Group stage', {
        emptyMessage: liveMatches.length
          ? 'No additional non-live group-stage fixtures right now.'
          : 'No active group-stage fixtures right now. See Completed Matches for finished games.',
      });
      document.getElementById('group-rendered-at').textContent = renderStamp();
    };

    const scrollToNextUpMatch = (behavior = 'smooth') => {
      const nextUpNode = document.querySelector('.match.next-up');
      if (!nextUpNode) {
        return false;
      }

      nextUpNode.scrollIntoView({ behavior, block: 'center', inline: 'nearest' });
      return true;
    };

    const scrollToLiveMatchFocus = (behavior = 'smooth') => {
      const liveSpotlightNode = document.querySelector('.group-live-spotlight:not([hidden])');
      if (liveSpotlightNode) {
        liveSpotlightNode.scrollIntoView({ behavior, block: 'start', inline: 'nearest' });
        return true;
      }

      const liveMatchPageNode = document.querySelector('[data-page="live-match"]');
      if (liveMatchPageNode) {
        liveMatchPageNode.scrollIntoView({ behavior, block: 'start', inline: 'nearest' });
        return true;
      }

      return false;
    };

    const updateLiveMatchCentrePresentation = () => {
      const spreadNode = document.querySelector('.spread');
      const liveCoveragePageNode = document.getElementById('live-coverage-page');
      const liveMatchPageNode = document.querySelector('[data-page="live-match"]');
      const groupLiveSpotlightNode = document.getElementById('group-live-spotlight');
      if (!spreadNode || !liveMatchPageNode) {
        return;
      }

      const liveMatchTitleNode = liveMatchPageNode.querySelector('.page-title');
      const livePageChipValueNode = liveMatchPageNode.querySelector('.chip-cluster .chip:first-child');
      const hasActiveLiveMatch = (state.matches || []).some(isActivelyPlayedMatch);

      if (hasActiveLiveMatch) {
        if (liveCoveragePageNode) {
          liveCoveragePageNode.hidden = false;
        }
        if (groupLiveSpotlightNode) {
          groupLiveSpotlightNode.insertAdjacentElement('afterend', liveMatchPageNode);
        } else if (liveCoveragePageNode) {
          liveCoveragePageNode.append(liveMatchPageNode);
        } else {
          spreadNode.append(liveMatchPageNode);
        }
        liveMatchPageNode.setAttribute('data-sticky-name', 'Live Match Centre');
        if (liveMatchTitleNode) {
          liveMatchTitleNode.textContent = 'Live Match Centre';
        }
        if (livePageChipValueNode) {
          livePageChipValueNode.innerHTML = '<strong>Page</strong> Live match';
        }
      } else {
        if (liveCoveragePageNode) {
          liveCoveragePageNode.hidden = true;
        }
        spreadNode.append(liveMatchPageNode);
        liveMatchPageNode.setAttribute('data-sticky-name', 'Match Centre');
        if (liveMatchTitleNode) {
          liveMatchTitleNode.textContent = 'Match Centre';
        }
        if (livePageChipValueNode) {
          livePageChipValueNode.innerHTML = '<strong>Page</strong> Match centre';
        }
      }

      fitSingleLineTitles();

      applySectionVisibilityAndOrder();
    };

    const isStageComplete = (stageNames) => {
      const names = Array.isArray(stageNames) ? stageNames : [stageNames];
      const stageMatches = (state.matches || []).filter((match) => names.includes(stageName(match)));
      if (!stageMatches.length) {
        return false;
      }
      return stageMatches.every((match) => isCompletedMatch(match));
    };

    const appendVisibleSection = (containerNode, pageNode) => {
      if (!containerNode || !pageNode || pageNode.hidden) {
        return;
      }
      containerNode.append(pageNode);
    };

    const fitSingleLineTitles = () => {
      const titleNodes = [
        ...document.querySelectorAll('[data-fit-single-line="1"]'),
        ...document.querySelectorAll('.page-title, .section-title'),
      ];
      const uniqueNodes = [...new Set(titleNodes)];

      uniqueNodes.forEach((node) => {
        node.classList.add('fit-responsive-heading');
        if (!node.dataset.fitBasePx) {
          node.dataset.fitBasePx = String(parseFloat(window.getComputedStyle(node).fontSize) || 16);
        }

        const maxSize = Number(node.dataset.fitMaxPx || node.dataset.fitBasePx || 33);
        const minSize = Number(node.dataset.fitMinPx || (node.classList.contains('section-title') ? 12 : 16));
        let nextSize = maxSize;
        node.style.fontSize = `${nextSize}px`;
        while (node.scrollWidth > node.clientWidth && nextSize > minSize) {
          nextSize -= 0.5;
          node.style.fontSize = `${nextSize}px`;
        }
      });
    };

    const setupHeaderInfoToggles = () => {
      const toggleNodes = [...document.querySelectorAll('[data-info-toggle="1"]')];
      if (!toggleNodes.length) {
        return;
      }

      const hideAllPanels = () => {
        toggleNodes.forEach((toggleNode) => {
          const panelId = String(toggleNode.getAttribute('aria-controls') || '').trim();
          const panelNode = panelId ? document.getElementById(panelId) : null;
          toggleNode.setAttribute('aria-expanded', 'false');
          if (panelNode) {
            panelNode.hidden = true;
          }
        });
      };

      toggleNodes.forEach((toggleNode) => {
        const panelId = String(toggleNode.getAttribute('aria-controls') || '').trim();
        const panelNode = panelId ? document.getElementById(panelId) : null;
        if (!panelNode) {
          return;
        }

        toggleNode.addEventListener('click', (event) => {
          event.stopPropagation();
          const currentlyExpanded = toggleNode.getAttribute('aria-expanded') === 'true';
          hideAllPanels();
          toggleNode.setAttribute('aria-expanded', String(!currentlyExpanded));
          panelNode.hidden = currentlyExpanded;
        });

        panelNode.addEventListener('click', (event) => {
          event.stopPropagation();
        });
      });

      document.addEventListener('click', hideAllPanels);
      document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') {
          hideAllPanels();
        }
      });
    };

    const getStickyMarkerOffset = () => {
      const markerNode = document.getElementById('page-sticky-marker');
      const markerHeight = markerNode ? markerNode.getBoundingClientRect().height : 0;
      return Math.max(markerHeight + 8, 12);
    };

    const getBottomNavOffset = () => {
      const navNode = document.querySelector('.bottom-section-nav');
      return navNode ? navNode.getBoundingClientRect().height : 0;
    };

    const scrollNodeBelowStickyMarker = (node, behavior = 'smooth') => {
      if (!node) {
        return false;
      }
      const top = window.scrollY + node.getBoundingClientRect().top - getStickyMarkerOffset();
      window.scrollTo({ top: Math.max(0, top), behavior });
      return true;
    };

    const scrollNodeAboveBottomNav = (node, behavior = 'smooth') => {
      if (!node) {
        return false;
      }
      const rect = node.getBoundingClientRect();
      const targetBottom = window.innerHeight - getBottomNavOffset() - 8;
      const top = window.scrollY + rect.bottom - targetBottom;
      window.scrollTo({ top: Math.max(0, top), behavior });
      return true;
    };

    const updateBottomSectionNavState = () => {
      const groupsLabelNode = document.getElementById('bottom-tab-groups-label');
      if (!groupsLabelNode) {
        return;
      }

      const groupStageComplete = isStageComplete('First Stage');
      groupsLabelNode.textContent = groupStageComplete ? 'RoundOf32' : 'Groups';
    };

    const applySectionVisibilityAndOrder = () => {
      const spreadNode = document.querySelector('.spread');
      if (!spreadNode) {
        return;
      }

      const trackerHeaderPageNode = document.querySelector('[data-page="tracker-header"]');
      const preferredTeamsPageNode = document.querySelector('[data-page="preferred-teams"]');
      const completedPageNode = document.querySelector('[data-page="completed-matches"]');
      const liveCoveragePageNode = document.getElementById('live-coverage-page');
      const liveMatchPageNode = document.querySelector('[data-page="live-match"]');
      const groupStagePageNode = document.querySelector('[data-page="group-stage"]');
      const groupTablesPageNode = document.querySelector('[data-page="group-tables"]');
      const lucky8PageNode = document.querySelector('[data-page="lucky-8"]');
      const round32PageNode = document.querySelector('[data-page="round-of-32"]');
      const round16PageNode = document.querySelector('[data-page="round-of-16"]');
      const finalsPageNode = document.querySelector('[data-page="finals"]');
      const bracketPageNode = document.querySelector('[data-page="predicted-bracket"]');
      const lucky8PageNode = document.querySelector('[data-page="lucky-8"]');
      const specialInterestPageNode = document.querySelector('[data-page="special-interest-stats"]');

      const hasActiveLiveMatch = (state.matches || []).some(isActivelyPlayedMatch);
      const groupStageComplete = isStageComplete('First Stage');
      const round32Complete = isStageComplete(knockoutStages.slice(0, 1));
      const round16Complete = isStageComplete(knockoutStages.slice(1, 2));

      if (groupStagePageNode) {
        groupStagePageNode.hidden = groupStageComplete;
      }
      if (lucky8PageNode) {
        lucky8PageNode.hidden = round32Complete; // Hide lucky 8 once the Round of 32 is finished
      }
      if (lucky8PageNode) {
        lucky8PageNode.hidden = round32Complete; // Hide lucky 8 once the Round of 32 is finished
      }
      if (round32PageNode) {
        round32PageNode.hidden = round32Complete;
      }
      if (round16PageNode) {
        round16PageNode.hidden = round16Complete;
      }
      if (liveCoveragePageNode) {
        liveCoveragePageNode.hidden = !hasActiveLiveMatch;
      }

      if (hasActiveLiveMatch) {
        appendVisibleSection(spreadNode, trackerHeaderPageNode);
        appendVisibleSection(spreadNode, preferredTeamsPageNode);
        appendVisibleSection(spreadNode, completedPageNode);
        appendVisibleSection(spreadNode, liveCoveragePageNode);
        appendVisibleSection(spreadNode, groupStagePageNode);
        appendVisibleSection(spreadNode, groupTablesPageNode);
        appendVisibleSection(spreadNode, lucky8PageNode);
        appendVisibleSection(spreadNode, round32PageNode);
        appendVisibleSection(spreadNode, round16PageNode);
        appendVisibleSection(spreadNode, finalsPageNode);
        appendVisibleSection(spreadNode, bracketPageNode);
        appendVisibleSection(spreadNode, specialInterestPageNode);
        return;
      }

      if (groupStageComplete) {
        appendVisibleSection(spreadNode, trackerHeaderPageNode);
        appendVisibleSection(spreadNode, preferredTeamsPageNode);
        appendVisibleSection(spreadNode, groupTablesPageNode);
        appendVisibleSection(spreadNode, lucky8PageNode);
        appendVisibleSection(spreadNode, liveMatchPageNode);
        appendVisibleSection(spreadNode, completedPageNode);
        appendVisibleSection(spreadNode, round32PageNode);
        appendVisibleSection(spreadNode, round16PageNode);
        appendVisibleSection(spreadNode, finalsPageNode);
        appendVisibleSection(spreadNode, bracketPageNode);
        appendVisibleSection(spreadNode, specialInterestPageNode);
        return;
      }

      appendVisibleSection(spreadNode, trackerHeaderPageNode);
      appendVisibleSection(spreadNode, preferredTeamsPageNode);
      appendVisibleSection(spreadNode, completedPageNode);
      appendVisibleSection(spreadNode, liveMatchPageNode);
      appendVisibleSection(spreadNode, groupStagePageNode);
      appendVisibleSection(spreadNode, groupTablesPageNode);
      appendVisibleSection(spreadNode, lucky8PageNode);
      appendVisibleSection(spreadNode, round32PageNode);
      appendVisibleSection(spreadNode, round16PageNode);
      appendVisibleSection(spreadNode, finalsPageNode);
      appendVisibleSection(spreadNode, specialInterestPageNode);

      updateBottomSectionNavState();
    };

    const setupBottomSectionNav = () => {
      const completedTabNode = document.getElementById('bottom-tab-completed');
      const liveNextTabNode = document.getElementById('bottom-tab-live-next');
      const groupsTabNode = document.getElementById('bottom-tab-groups');
      if (!completedTabNode || !liveNextTabNode || !groupsTabNode) {
        return;
      }

      completedTabNode.addEventListener('click', () => {
        applyCompletedAccordionExpanded(true);
        window.requestAnimationFrame(() => {
          const completedMatches = [...document.querySelectorAll('#completed-grid .match')];
          const lastPlayedNode = completedMatches[completedMatches.length - 1];
          if (scrollNodeAboveBottomNav(lastPlayedNode, 'smooth')) {
            return;
          }
          const completedPageNode = document.querySelector('[data-page="completed-matches"]');
          if (completedPageNode) {
            scrollNodeBelowStickyMarker(completedPageNode, 'smooth');
          }
        });
      });

      liveNextTabNode.addEventListener('click', () => {
        const hasActiveLiveMatch = (state.matches || []).some(isActivelyPlayedMatch);
        if (hasActiveLiveMatch) {
          const liveSnapshotCardNode = document.querySelector('.group-live-table-spotlight-card');
          if (scrollNodeBelowStickyMarker(liveSnapshotCardNode, 'smooth')) {
            return;
          }
        }

        const nextUpNode = document.querySelector('.match.next-up');
        if (scrollNodeBelowStickyMarker(nextUpNode, 'smooth')) {
          return;
        }

        const matchCentreNode = document.querySelector('[data-page="live-match"]');
        if (matchCentreNode) {
          scrollNodeBelowStickyMarker(matchCentreNode, 'smooth');
        }
      });

      groupsTabNode.addEventListener('click', () => {
        const groupStageComplete = isStageComplete('First Stage');
        if (!groupStageComplete) {
          const firstGroupTableCardNode = document.querySelector('#group-tables-grid .table-card');
          if (scrollNodeBelowStickyMarker(firstGroupTableCardNode, 'smooth')) {
          }
          return;
        }

        const round32Node = document.querySelector('#round32-grid .match, [data-page="round-of-32"]');
        const round16Node = document.querySelector('[data-page="round-of-16"]');
        const finalsNode = document.querySelector('[data-page="finals"]');
        const fallbackNode = [round32Node, round16Node, finalsNode].find((node) => node && !node.hidden);
        if (fallbackNode) {
          scrollNodeBelowStickyMarker(fallbackNode, 'smooth');
        }
      });

      updateBottomSectionNavState();
    };

    const updateStickyPageMarker = () => {
      const markerNode = document.getElementById('page-sticky-marker');
      if (!markerNode) {
        return;
      }

      const pages = [...document.querySelectorAll('.page[data-sticky-name]')];
      if (!pages.length) {
        markerNode.textContent = '';
        markerNode.setAttribute('data-visible', 'false');
        return;
      }

      const markerHeight = markerNode.getBoundingClientRect().height || 0;
      const anchorY = Math.max(markerHeight + 110, 180);
      const pageRects = pages
        .map((page) => ({ page, rect: page.getBoundingClientRect() }))
        .sort((left, right) => left.rect.top - right.rect.top);

      let activePage = pageRects
        .filter(({ rect }) => rect.top <= anchorY)
        .sort((left, right) => right.rect.top - left.rect.top)[0]?.page || null;

      if (!activePage) {
        activePage = pageRects.find(({ rect }) => rect.bottom > anchorY)?.page || pageRects[pageRects.length - 1]?.page || null;
      }

      const label = String(activePage?.getAttribute('data-sticky-name') || '').trim();
      if (!label) {
        markerNode.textContent = '';
        markerNode.setAttribute('data-visible', 'false');
        return;
      }

      markerNode.textContent = label;
      markerNode.setAttribute('data-visible', 'true');
    };

    const renderKnockoutPage = (gridId, stageNames, stampId, label) => {
      const matches = state.matches
        .filter((match) => stageNames.includes(stageName(match)) && !isCompletedMatch(match));

      const stampText = renderDateGroupedCards(gridId, matches, label, {
        emptyMessage: `No active ${label.toLowerCase()} fixtures right now. See Completed Matches for finished games.`,
      });
      document.getElementById(stampId).textContent = stampText;
    };

    const renderThirdPlacedTeamsPage = () => {
      const groupStageMatches = state.matches
        .filter((match) => stageName(match) === 'First Stage' && match.GroupName?.length && isCompletedMatch(match))
        .sort(sortByDate);

      const groups = buildGroupTables(groupStageMatches);
      const gridNode = document.getElementById('lucky8-grid');
      const stampNode = document.getElementById('lucky8-rendered-at');

      if (!gridNode || !stampNode) return;

      if (!groups.length) {
        gridNode.innerHTML = '<div class="empty">Third-placed teams tracking will appear as group-stage fixtures become available.</div>';
        stampNode.textContent = 'Updated waiting for data';
        return;
      }

      // Extract 3rd placed teams
      const thirdPlacedTeams = [];
      for (const group of groups) {
        if (group.rows.length >= 3) {
          const team = group.rows[2];
          thirdPlacedTeams.push({
            groupName: group.name,
            ...team
          });
        }
      }

      // If we don't have enough 3rd placed teams yet
      if (!thirdPlacedTeams.length) {
        gridNode.innerHTML = '<div class="empty">Third-placed teams will populate once group tables have sufficient matches.</div>';
        stampNode.textContent = 'Updated waiting for data';
        return;
      }

      // Sort according to tie-breakers
      thirdPlacedTeams.sort((a, b) => {
        if (b.pts !== a.pts) return b.pts - a.pts;
        if (b.gd !== a.gd) return b.gd - a.gd;
        if (b.gf !== a.gf) return b.gf - a.gf;
        return a.name.localeCompare(b.name);
      });

      const rowsHTML = thirdPlacedTeams.map((row, index) => {
        const isQualified = index < 8; // Top 8 third-placed advance
        const rowClass = isQualified ? 'lucky8-qualified' : 'lucky8-eliminated';
        
        return `
          <tr class="${rowClass}">
            <td>${index + 1}</td>
            <td class="team-col">
              <span class="team-cell">
                ${row.flag ? `<img class="flag" src="${escapeHtml(row.flag)}" alt="${escapeHtml(row.name)} flag">` : ''}
                <span>${escapeHtml(row.name)} <small>(${escapeHtml(row.groupName)})</small></span>
              </span>
            </td>
            <td>${row.p}</td>
            <td>${row.w}</td>
            <td>${row.d}</td>
            <td>${row.l}</td>
            <td>${row.gf}</td>
            <td>${row.gd}</td>
            <td class="pts-col">${row.pts}</td>
          </tr>
        `;
      }).join('');

      gridNode.innerHTML = `
        <section class="card table-card" style="grid-column: 1 / -1;">
          <h3><span>Current "Lucky 8" Ranking</span></h3>
          <div class="table-wrap">
            <table class="group-table">
              <tr>
                <th>Rk</th>
                <th class="team-col">Team</th>
                <th>P</th>
                <th>W</th>
                <th>D</th>
                <th>L</th>
                <th>GF</th>
                <th>GD</th>
                <th class="pts-col">Pts</th>
              </tr>
              ${rowsHTML}
            </table>
          </div>
        </section>
      `;

      stampNode.textContent = `Third-placed teams updated ${state.updatedAt ? updateFormatter.format(state.updatedAt) : 'waiting for data'}`;
    };

    const renderPredictedBracketPage = () => {
      const gridNode = document.getElementById('bracket-container');
      const stampNode = document.getElementById('bracket-rendered-at');
      if (!gridNode || !stampNode) return;

      const groupStageMatches = state.matches.filter((m) => stageName(m) === 'First Stage' && m.GroupName?.length);
      const allGroups = buildGroupTables(groupStageMatches);
      
      const teamStrength = new Map(state.winnerOdds ? state.winnerOdds.map((o, idx) => [o.canonical, o.price || 1000 + idx]) : []);
      const getStrength = (name) => teamStrength.get(canonicalTeamName(name)) || 2000;
      
      const predictedGroups = allGroups.map(g => {
        const sortedRows = [...g.rows].sort((a, b) => {
           if (b.pts !== a.pts) return b.pts - a.pts;
           if (b.gd !== a.gd) return b.gd - a.gd;
           if (b.gf !== a.gf) return b.gf - a.gf;
           return getStrength(a.name) - getStrength(b.name);
        });
        return { ...g, predictedRows: sortedRows };
      });
      
      const pMap = new Map();
      predictedGroups.forEach(g => {
          const letter = g.name.replace('Group ', '');
          if(g.predictedRows[0]) pMap.set(`1${letter}`, g.predictedRows[0].name);
          if(g.predictedRows[1]) pMap.set(`2${letter}`, g.predictedRows[1].name);
      });
      
      const thirds = predictedGroups.map(g => g.predictedRows[2]).filter(Boolean).sort((a, b) => {
         if (b.pts !== a.pts) return b.pts - a.pts;
         if (b.gd !== a.gd) return b.gd - a.gd;
         if (b.gf !== a.gf) return b.gf - a.gf;
         return getStrength(a.name) - getStrength(b.name);
      });
      const top8Thirds = thirds.slice(0, 8);
      
      const resolvePlaceholder = (ph) => {
         if (!ph) return null;
         if (pMap.has(ph)) return pMap.get(ph);
         if (ph.startsWith('3')) {
            const allowed = ph.replace('3', '').split('');
            for (let i = 0; i < top8Thirds.length; i++) {
                const t = top8Thirds[i];
                let groupLetter = '';
                predictedGroups.forEach(g => {
                    if (g.predictedRows.some(r => r.name === t.name)) groupLetter = g.name.replace('Group ', '');
                });
                if (allowed.includes(groupLetter)) {
                    top8Thirds.splice(i, 1);
                    return t.name;
                }
            }
            return top8Thirds.shift()?.name || null;
         }
         return null;
      };
      
      const flagMap = new Map();
      state.matches.forEach(m => {
          if (m.Home?.TeamName?.[0]?.Description && m.Home.PictureUrl) {
             flagMap.set(canonicalTeamName(m.Home.TeamName[0].Description), m.Home.PictureUrl.replace('{format}', 'sq').replace('{size}', '2'));
          }
          if (m.Away?.TeamName?.[0]?.Description && m.Away.PictureUrl) {
             flagMap.set(canonicalTeamName(m.Away.TeamName[0].Description), m.Away.PictureUrl.replace('{format}', 'sq').replace('{size}', '2'));
          }
      });
      const getFlag = (team) => flagMap.get(canonicalTeamName(team)) || '';

      const bracketMatches = new Map();
      const matches73to104 = state.matches.filter(m => m.MatchNumber >= 73 && m.MatchNumber <= 104).sort((a,b) => a.MatchNumber - b.MatchNumber);
      
      matches73to104.forEach(m => {
         const num = m.MatchNumber;
         let home = m.Home?.TeamName?.[0]?.Description;
         let homePred = false;
         let away = m.Away?.TeamName?.[0]?.Description;
         let awayPred = false;
         
         if (!home && m.PlaceHolderA) {
             if (m.PlaceHolderA.startsWith('W')) {
                 const p = bracketMatches.get(Number(m.PlaceHolderA.replace('W','')));
                 home = p?.w; homePred = true;
             } else if (m.PlaceHolderA.startsWith('RU')) {
                 const p = bracketMatches.get(Number(m.PlaceHolderA.replace('RU','')));
                 home = p?.l; homePred = true;
             } else {
                 home = resolvePlaceholder(m.PlaceHolderA); homePred = true;
             }
         }
         if (!away && m.PlaceHolderB) {
             if (m.PlaceHolderB.startsWith('W')) {
                 const p = bracketMatches.get(Number(m.PlaceHolderB.replace('W','')));
                 away = p?.w; awayPred = true;
             } else if (m.PlaceHolderB.startsWith('RU')) {
                 const p = bracketMatches.get(Number(m.PlaceHolderB.replace('RU','')));
                 away = p?.l; awayPred = true;
             } else {
                 away = resolvePlaceholder(m.PlaceHolderB); awayPred = true;
             }
         }
         
         let w = null; let l = null; let wP = false;
         if (isCompletedMatch(m)) {
             const hs = Number(m.HomeTeamScore); const as = Number(m.AwayTeamScore);
             if (hs > as) { w = home; l = away; }
             else if (as > hs) { w = away; l = home; }
             else {
                 if (Number(m.HomeTeamPenaltyScore) > Number(m.AwayTeamPenaltyScore)) { w = home; l = away; }
                 else { w = away; l = home; }
             }
         } else if (home && away) {
             const hs = getStrength(home); const as = getStrength(away);
             if (hs <= as) { w = home; l = away; } else { w = away; l = home; }
             wP = true;
         }
         
         bracketMatches.set(num, { m, home, away, homePred, awayPred, w, wP, l });
      });

      const getBracketOrder = () => {
         const order = [[], [], [], [], []];
         
         // 104 is Final, 103 is Third Place
         // We construct the tree from the bottom up.
         Object.entries({
            4: [104], // Final
            // The match logic above has a weird bug where 103 places PlaceHolderA=RU101, but the tree assumes we can traverse.
         }).forEach(() => {});

         const traverse = (matchNum, level) => {
            const match = state.matches.find(m => m.MatchNumber === matchNum);
            if (!match) return;
            
            // FIFA's tree might be slightly disconnected for 3rd place, let's trace winners mainly.
            [match.PlaceHolderA, match.PlaceHolderB].forEach(ph => {
               if (ph && ph.startsWith('W')) {
                  const prevNum = Number(ph.replace('W', ''));
                  traverse(prevNum, level - 1);
               }
            });
            order[level].push(matchNum);
         };
         
         // Fix order initialization. Start with final.
         traverse(104, 4);
         
         return order;
      };
      
      const orderedRounds = getBracketOrder(); 
      const roundNames = ['Round of 32', 'Round of 16', 'Quarter-finals', 'Semi-finals', 'Final/3rd Place'];

      // Add third place manually to the 4th level if it exists so we don't recurse through losers. 
      // 103 is the MatchNumber for the Third Place match. 
      if (!orderedRounds[4].includes(103) && state.matches.some(m => m.MatchNumber === 103)) {
         orderedRounds[4].unshift(103); // add 3rd place before final
      }

      const renderTeam = (teamName, isPred, isWinner) => {
         const cleanName = teamName ? escapeHtml(teamName) : 'TBD';
         const flag = teamName ? getFlag(teamName) : '';
         const flagImg = flag ? `<img src="${escapeHtml(flag)}" class="flag" />` : `<span class="flag"></span>`;
         const classes = `bracket-team ${isPred ? 'predicted' : ''} ${isWinner ? 'winner' : ''}`;
         return `<div class="${classes}">${flagImg}<span class="bracket-team-name">${cleanName}</span></div>`;
      };
      
      const colsHTML = orderedRounds.map((nums, idx) => {
          if (!nums.length) return '';
          
          // Sort match numbers numerically for safety
          nums.sort((a,b) => a - b);
          
          const matchesHTML = nums.map(n => {
              const b = bracketMatches.get(n);
              if (!b) return '';
              const hw = !!b.w && b.w === b.home;
              const aw = !!b.w && b.w === b.away;
              return `
                <div class="bracket-match">
                   ${renderTeam(b.home, b.homePred, hw)}
                   ${renderTeam(b.away, b.awayPred, aw)}
                </div>
              `;
          }).join('');
          return `
            <div class="bracket-col">
              <div class="bracket-col-title">${escapeHtml(roundNames[idx])}</div>
              ${matchesHTML}
            </div>
          `;
      }).join('');
      
      gridNode.innerHTML = colsHTML || '<div class="empty">Knockout bracket dynamically populating from group stages.</div>';
      stampNode.textContent = `Predicted using market odds ${state.updatedAt ? updateFormatter.format(state.updatedAt) : 'waiting for data'}`;
    };

    const renderCompletedPage = () => {
      const completedMatches = state.matches
        .filter((match) => isCompletedMatch(match));

      const stampText = renderDateGroupedCards('completed-grid', completedMatches, 'Completed matches', {
        emptyMessage: 'No completed matches yet.',
      });

      document.getElementById('completed-rendered-at').textContent = stampText;
    };

    const renderStamp = () => `Rendered ${state.updatedAt ? updateFormatter.format(state.updatedAt) : 'waiting for data'} Brisbane time`;

    const dayKey = (match) => {
      const date = match?.Date ? new Date(match.Date) : null;
      if (!date || Number.isNaN(date.getTime())) {
        return 'unknown';
      }

      return new Intl.DateTimeFormat('en-CA', {
        timeZone: timezone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).format(date);
    };

    const formatDayLabel = (match) => {
      if (!match?.Date) {
        return 'TBD';
      }

      return new Intl.DateTimeFormat('en-AU', {
        timeZone: timezone,
        weekday: 'short',
        day: 'numeric',
        month: 'short',
      }).format(new Date(match.Date));
    };

    const sortByMatchNumber = (left, right) => {
      const leftNumber = Number(left.MatchNumber || 0);
      const rightNumber = Number(right.MatchNumber || 0);
      if (leftNumber !== rightNumber) {
        return leftNumber - rightNumber;
      }

      return String(left.IdMatch || '').localeCompare(String(right.IdMatch || ''));
    };

    const sortByDate = (left, right) => new Date(left.Date || 0) - new Date(right.Date || 0) || sortByMatchNumber(left, right);

    const escapeHtml = (value) => String(value)
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#39;');

    const renderTopScorersVisualization = () => {
      const yearNode = document.getElementById('top-scorers-year');
      const teamNode = document.getElementById('top-scorers-team');
      const sortNode = document.getElementById('top-scorers-sort');
      const summaryNode = document.getElementById('top-scorers-summary');
      const chartNode = document.getElementById('top-scorers-chart');
      const resetNode = document.getElementById('top-scorers-reset');

      if (!yearNode || !teamNode || !sortNode || !summaryNode || !chartNode || !resetNode) {
        return;
      }

      if (!yearNode.dataset.initialized) {
        yearNode.innerHTML = worldCupTopScorerYears.map((year) => {
          const label = year === 'all' ? 'All years' : year;
          return `<option value="${escapeHtml(year)}">${escapeHtml(label)}</option>`;
        }).join('');
        teamNode.innerHTML = ['all', ...worldCupTopScorerTeams.filter((team) => team !== 'all')].map((team) => {
          const label = team === 'all' ? 'All teams' : team;
          return `<option value="${escapeHtml(team)}">${escapeHtml(label)}</option>`;
        }).join('');
        sortNode.innerHTML = worldCupTopScorerSortOptions.map((entry) => `<option value="${escapeHtml(entry.value)}">${escapeHtml(entry.label)}</option>`).join('');
        yearNode.dataset.initialized = '1';
      }

      if (!yearNode.value) {
        yearNode.value = state.topScorersFilters.year;
      }

      if (!teamNode.value) {
        teamNode.value = state.topScorersFilters.team;
      }

      if (!sortNode.value) {
        sortNode.value = state.topScorersFilters.sortBy;
      }

      const selectedYear = String(yearNode.value || 'all');
      const selectedTeam = String(teamNode.value || 'all');
      const selectedSort = String(sortNode.value || 'year');
      state.topScorersFilters = { year: selectedYear, team: selectedTeam, sortBy: selectedSort };

      const filtered = worldCupTopScorers.filter((entry) => {
        const yearMatch = selectedYear === 'all' || String(entry.year) === selectedYear;
        const teamMatch = selectedTeam === 'all' || entry.team === selectedTeam;
        return yearMatch && teamMatch;
      }).sort((left, right) => {
        if (selectedSort === 'goals') {
          return right.goals - left.goals || right.year - left.year || left.player.localeCompare(right.player);
        }

        return right.year - left.year || right.goals - left.goals || left.player.localeCompare(right.player);
      });

      const maxGoals = filtered.reduce((maximum, entry) => Math.max(maximum, entry.goals), 1);
      const minGoals = filtered.reduce((minimum, entry) => Math.min(minimum, entry.goals), maxGoals);
      const visibleCount = filtered.length;
      const selectedYearLabel = selectedYear === 'all' ? 'all years' : selectedYear;
      const selectedTeamLabel = selectedTeam === 'all' ? 'all teams' : selectedTeam;
      const selectedSortLabel = selectedSort === 'goals' ? 'goals' : 'year';

      const goalsToHeatColor = (goals) => {
        const min = Number(minGoals);
        const max = Number(maxGoals);
        if (max <= min) {
          return 'rgb(128, 74, 218)';
        }

        const ratio = Math.max(0, Math.min(1, (Number(goals) - min) / (max - min)));
        const blue = [56, 138, 255];
        const purple = [128, 74, 218];
        const pink = [241, 76, 158];

        const lerp = (a, b, t) => Math.round(a + ((b - a) * t));
        if (ratio <= 0.5) {
          const t = ratio / 0.5;
          const r = lerp(blue[0], purple[0], t);
          const g = lerp(blue[1], purple[1], t);
          const b = lerp(blue[2], purple[2], t);
          return `rgb(${r}, ${g}, ${b})`;
        }

        const t = (ratio - 0.5) / 0.5;
        const r = lerp(purple[0], pink[0], t);
        const g = lerp(purple[1], pink[1], t);
        const b = lerp(purple[2], pink[2], t);
        return `rgb(${r}, ${g}, ${b})`;
      };

      summaryNode.innerHTML = [
        `<span class="chip"><strong>Visible</strong> ${visibleCount}/${worldCupTopScorers.length}</span>`,
        `<span class="chip"><strong>Year</strong> ${escapeHtml(selectedYearLabel)}</span>`,
        `<span class="chip"><strong>Team</strong> ${escapeHtml(selectedTeamLabel)}</span>`,
        `<span class="chip"><strong>Sort</strong> ${escapeHtml(selectedSortLabel)}</span>`,
      ].join('');

      chartNode.innerHTML = filtered.length ? filtered.map((entry) => {
        const barWidth = Math.max(8, Math.round((entry.goals / maxGoals) * 100));
        const barColor = goalsToHeatColor(entry.goals);
        return `
          <article class="top-scorers-row">
            <div class="top-scorers-year">${escapeHtml(entry.year)}</div>
            <div>
              <div class="top-scorers-name">${escapeHtml(entry.player)}</div>
              <div class="top-scorers-meta">${escapeHtml(entry.team)} · ${escapeHtml(entry.tournament)} · ${escapeHtml(entry.matches)} matches</div>
            </div>
            <div class="top-scorers-scoreline">
              <div class="top-scorers-bar-track">
                <div class="top-scorers-bar" style="width: ${barWidth}%; --bar-color: ${escapeHtml(barColor)};"></div>
              </div>
              <div class="top-scorers-goals">${escapeHtml(entry.goals)}</div>
            </div>
          </article>
        `;
      }).join('') : '<div class="top-scorers-empty">No World Cup top-scorer rows match this filter combination.</div>';

      resetNode.dataset.ready = '1';
    };

    const renderWorldCupWinnersSankey = () => {
      const chartNode = document.getElementById('world-cup-winners-sankey');
      const metaNode = document.getElementById('winners-sankey-meta');
      if (!chartNode || !metaNode) {
        return;
      }

      const width = Math.max(680, Math.floor(chartNode.clientWidth || 0));
      const sankeyScale = Math.min(1.65, Math.max(1, width / 900));
      const labelFontSize = Math.max(10.5, Math.min(15.8, width * 0.0152));
      const baseLinkStroke = Math.max(3.4, Math.min(6.2, width * 0.0056));
      const activeLinkStroke = Math.max(6.2, Math.min(10.5, width * 0.0092));
      const years = [...worldCupChampionByYear].sort((left, right) => left.year - right.year);
      const championCounts = years.reduce((acc, entry) => {
        acc.set(entry.champion, (acc.get(entry.champion) || 0) + 1);
        return acc;
      }, new Map());
      const championEntries = [...championCounts.entries()]
        .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
        .map(([name, wins]) => ({ name, wins }));
      const champions = championEntries.map((entry) => entry.name);

      const rowHeight = Math.round(12 * sankeyScale);
      const margin = {
        top: Math.round(12 * sankeyScale),
        right: Math.round(78 * sankeyScale),
        bottom: Math.round(14 * sankeyScale),
        left: Math.round(152 * sankeyScale),
      };
      const nodeWidth = Math.round(12 * sankeyScale);
      const linkBand = Math.round(4 * sankeyScale);
      const championGap = Math.round(4 * sankeyScale);
      const championNodePadding = Math.max(1, Math.round(1 * sankeyScale));
      const leftHeight = championEntries.reduce((total, entry, index) => {
        const nodeHeight = (entry.wins * linkBand) + (championNodePadding * 2);
        return total + nodeHeight + (index === championEntries.length - 1 ? 0 : championGap);
      }, 0);
      const rightHeight = years.length * rowHeight;
      const minChampionLaneHeight = championEntries.length * Math.round(24 * sankeyScale);
      const contentHeight = Math.max(leftHeight, rightHeight, minChampionLaneHeight);
      const height = margin.top + contentHeight + margin.bottom;
      const championLayout = new Map();
      const championSpacing = contentHeight / Math.max(championEntries.length, 1);
      championEntries.forEach((entry, index) => {
        const nodeHeight = (entry.wins * linkBand) + (championNodePadding * 2);
        const centerY = margin.top + (championSpacing * (index + 0.5));
        const nodeY = centerY - (nodeHeight / 2);
        championLayout.set(entry.name, {
          y: nodeY,
          height: nodeHeight,
          wins: entry.wins,
        });
      });
      const yearY = new Map();
      years.forEach((entry, index) => {
        yearY.set(String(entry.year), margin.top + (index * rowHeight) + (rowHeight / 2));
      });

      const leftX = margin.left;
      const rightX = width - margin.right;
      const curveX1 = leftX + ((rightX - leftX) * 0.35);
      const curveX2 = leftX + ((rightX - leftX) * 0.65);
      const colorByChampion = new Map();
      champions.forEach((name, index) => {
        const hue = Math.round((index * 360) / Math.max(champions.length, 1));
        colorByChampion.set(name, `hsl(${hue} 76% 58%)`);
      });
      const championLinkSlot = new Map();

      const linksSvg = years.map((entry) => {
        const layout = championLayout.get(entry.champion);
        const slot = championLinkSlot.get(entry.champion) || 0;
        championLinkSlot.set(entry.champion, slot + 1);
        const y1 = layout
          ? layout.y + championNodePadding + (slot * linkBand) + (linkBand / 2)
          : margin.top;
        const y2 = yearY.get(String(entry.year)) || y1;
        const color = colorByChampion.get(entry.champion) || '#0d6b72';
        return `<path class="winners-sankey-link" data-year="${escapeHtml(entry.year)}" data-champion="${escapeHtml(entry.champion)}" d="M ${leftX + nodeWidth} ${y1} C ${curveX1} ${y1}, ${curveX2} ${y2}, ${rightX} ${y2}" stroke="${escapeHtml(color)}" style="stroke-width:${baseLinkStroke.toFixed(2)}" />`;
      }).join('');

      const leftNodesSvg = championEntries.map((entry) => {
        const name = entry.name;
        const wins = entry.wins;
        const layout = championLayout.get(name) || { y: margin.top, height: rowHeight - 2 };
        const y = layout.y;
        const nodeHeight = layout.height;
        const fill = colorByChampion.get(name) || '#0d6b72';
        return `
          <g class="winners-sankey-champion" data-champion="${escapeHtml(name)}">
            <rect class="winners-sankey-node" x="${leftX}" y="${y}" width="${nodeWidth}" height="${nodeHeight}" fill="${escapeHtml(fill)}" />
            <text class="winners-sankey-label" x="${leftX - Math.max(6, Math.round(8 * sankeyScale))}" y="${y + (nodeHeight / 2)}" text-anchor="end" style="font-size:${labelFontSize.toFixed(2)}px">${escapeHtml(name)} (${escapeHtml(wins)})</text>
          </g>
        `;
      }).join('');

      const rightNodesSvg = years.map((entry, index) => {
        const y = margin.top + (index * rowHeight);
        const fill = colorByChampion.get(entry.champion) || '#0d6b72';
        return `
          <g class="winners-sankey-year" data-year="${escapeHtml(entry.year)}">
            <rect class="winners-sankey-node" x="${rightX}" y="${y}" width="${nodeWidth}" height="${rowHeight - 2}" fill="${escapeHtml(fill)}" />
            <text class="winners-sankey-label" x="${rightX + nodeWidth + Math.max(6, Math.round(8 * sankeyScale))}" y="${y + ((rowHeight - 2) / 2)}" text-anchor="start" style="font-size:${labelFontSize.toFixed(2)}px">${escapeHtml(entry.year)}</text>
          </g>
        `;
      }).join('');

      chartNode.innerHTML = `
        <svg viewBox="0 0 ${width} ${height}" role="img" aria-label="Sankey diagram of FIFA World Cup champion to year">
          ${linksSvg}
          ${leftNodesSvg}
          ${rightNodesSvg}
        </svg>
      `;

      const svgNode = chartNode.querySelector('svg');
      const linkNodes = [...chartNode.querySelectorAll('.winners-sankey-link')];
      const yearNodes = [...chartNode.querySelectorAll('.winners-sankey-year')];
      const championNodes = [...chartNode.querySelectorAll('.winners-sankey-champion')];
      const applyNodeState = (node, state) => {
        if (!node) {
          return;
        }

        const rect = node.querySelector('.winners-sankey-node');
        const label = node.querySelector('.winners-sankey-label');
        if (rect) {
          rect.classList.toggle('is-active', state === 'active');
          rect.classList.toggle('is-dim', state === 'dim');
          rect.style.opacity = state === 'dim' ? '0.24' : '1';
        }
        if (label) {
          label.classList.toggle('is-active', state === 'active');
          label.classList.toggle('is-dim', state === 'dim');
          label.style.opacity = state === 'dim' ? '0.24' : '1';
        }
      };

      const clearHighlight = () => {
        linkNodes.forEach((link) => {
          link.classList.remove('is-active');
          link.classList.remove('is-dim');
          link.style.strokeOpacity = '0.84';
          link.style.strokeWidth = `${baseLinkStroke.toFixed(2)}`;
        });
        yearNodes.forEach((node) => applyNodeState(node, 'normal'));
        championNodes.forEach((node) => applyNodeState(node, 'normal'));
      };

      const setHighlight = ({ year, champion }) => {
        const activeLinks = linkNodes.filter((link) => {
          const linkYear = String(link.getAttribute('data-year') || '');
          const linkChampion = String(link.getAttribute('data-champion') || '');
          if (year && champion) {
            return linkYear === year && linkChampion === champion;
          }
          if (year) {
            return linkYear === year;
          }
          if (champion) {
            return linkChampion === champion;
          }
          return false;
        });

        const activeYears = new Set(activeLinks.map((link) => String(link.getAttribute('data-year') || '')));
        const activeChampions = new Set(activeLinks.map((link) => String(link.getAttribute('data-champion') || '')));

        linkNodes.forEach((link) => {
          const isActive = activeLinks.includes(link);
          link.classList.toggle('is-active', isActive);
          link.classList.toggle('is-dim', !isActive);
          link.style.strokeOpacity = isActive ? '1' : '0.1';
          link.style.strokeWidth = isActive ? `${activeLinkStroke.toFixed(2)}` : `${baseLinkStroke.toFixed(2)}`;
        });

        yearNodes.forEach((node) => {
          const key = String(node.getAttribute('data-year') || '');
          applyNodeState(node, activeYears.has(key) ? 'active' : 'dim');
        });

        championNodes.forEach((node) => {
          const key = String(node.getAttribute('data-champion') || '');
          applyNodeState(node, activeChampions.has(key) ? 'active' : 'dim');
        });
      };

      const lockSankeyHighlight = ({ year = '', champion = '' } = {}) => {
        state.winnersSankeyTouchLock = {
          year: String(year || ''),
          champion: String(champion || ''),
        };

        if (!state.winnersSankeyTouchLock.year && !state.winnersSankeyTouchLock.champion) {
          state.winnersSankeyTouchLock = null;
          clearHighlight();
          return;
        }

        setHighlight(state.winnersSankeyTouchLock);
      };

      yearNodes.forEach((node) => {
        node.addEventListener('pointerenter', () => {
          if (state.winnersSankeyTouchLock) {
            return;
          }

          const year = String(node.getAttribute('data-year') || '');
          if (year) {
            setHighlight({ year });
          }
        });

        node.addEventListener('pointerdown', (event) => {
          if (event.pointerType !== 'touch') {
            return;
          }

          const year = String(node.getAttribute('data-year') || '');
          const active = state.winnersSankeyTouchLock;
          if (active && active.year === year && !active.champion) {
            lockSankeyHighlight({});
            return;
          }

          lockSankeyHighlight({ year });
        });
      });

      championNodes.forEach((node) => {
        node.addEventListener('pointerenter', () => {
          if (state.winnersSankeyTouchLock) {
            return;
          }

          const champion = String(node.getAttribute('data-champion') || '');
          if (champion) {
            setHighlight({ champion });
          }
        });

        node.addEventListener('pointerdown', (event) => {
          if (event.pointerType !== 'touch') {
            return;
          }

          const champion = String(node.getAttribute('data-champion') || '');
          const active = state.winnersSankeyTouchLock;
          if (active && active.champion === champion && !active.year) {
            lockSankeyHighlight({});
            return;
          }

          lockSankeyHighlight({ champion });
        });
      });

      linkNodes.forEach((link) => {
        link.addEventListener('pointerenter', () => {
          if (state.winnersSankeyTouchLock) {
            return;
          }

          const year = String(link.getAttribute('data-year') || '');
          const champion = String(link.getAttribute('data-champion') || '');
          setHighlight({ year, champion });
        });

        link.addEventListener('pointerdown', (event) => {
          if (event.pointerType !== 'touch') {
            return;
          }

          const year = String(link.getAttribute('data-year') || '');
          const champion = String(link.getAttribute('data-champion') || '');
          const active = state.winnersSankeyTouchLock;
          if (active && active.year === year && active.champion === champion) {
            lockSankeyHighlight({});
            return;
          }

          lockSankeyHighlight({ year, champion });
        });
      });

      if (svgNode) {
        svgNode.addEventListener('pointerleave', () => {
          if (state.winnersSankeyTouchLock) {
            return;
          }
          clearHighlight();
        });
      }

      if (state.winnersSankeyOutsidePointerHandler) {
        document.removeEventListener('pointerdown', state.winnersSankeyOutsidePointerHandler, true);
      }

      state.winnersSankeyOutsidePointerHandler = (event) => {
        if (event.pointerType !== 'touch') {
          return;
        }

        if (!state.winnersSankeyTouchLock) {
          return;
        }

        if (chartNode.contains(event.target)) {
          return;
        }

        lockSankeyHighlight({});
      };

      document.addEventListener('pointerdown', state.winnersSankeyOutsidePointerHandler, true);

      if (state.winnersSankeyTouchLock) {
        setHighlight(state.winnersSankeyTouchLock);
      }

      metaNode.innerHTML = [
        `<span class="chip"><strong>Tournaments</strong> ${years.length}</span>`,
        `<span class="chip"><strong>Champions</strong> ${champions.length}</span>`,
      ].join('');
    };

    const renderSquadClubSunburst = () => {
      const chartNode = document.getElementById('squad-sunburst-chart');
      const metaNode = document.getElementById('squad-sunburst-meta');
      const detailsNode = document.getElementById('squad-sunburst-details');
      const teamFilterNode = document.getElementById('squad-sunburst-team-filter');
      const sourceData = typeof worldCupSquadSunburstData !== 'undefined' && Array.isArray(worldCupSquadSunburstData)
        ? worldCupSquadSunburstData
        : [];
      if (!chartNode || !metaNode || !detailsNode || !teamFilterNode) {
        return;
      }

      if (!sourceData.length) {
        chartNode.innerHTML = '<div class="squad-sunburst-empty">Sunburst data is unavailable.</div>';
        detailsNode.innerHTML = '<div class="squad-sunburst-empty">No squad PDF-derived club data loaded.</div>';
        metaNode.innerHTML = '';
        return;
      }

      const allNationalTeams = new Set();
      sourceData.forEach((country) => {
        (country.clubs || []).forEach((club) => {
          (club.players || []).forEach((player) => {
            if (player.team) {
              allNationalTeams.add(player.team);
            }
          });
        });
      });
      const nationalTeamOptions = ['all', ...[...allNationalTeams].sort((left, right) => left.localeCompare(right))];
      if (!teamFilterNode.dataset.initialized) {
        teamFilterNode.innerHTML = nationalTeamOptions.map((team) => {
          const label = team === 'all' ? 'All national teams' : team;
          return `<option value="${escapeHtml(team)}">${escapeHtml(label)}</option>`;
        }).join('');
        teamFilterNode.dataset.initialized = '1';
        teamFilterNode.addEventListener('change', () => {
          chartNode.dataset.pinnedKey = '';
          renderSquadClubSunburst();
        });
      }
      if (!teamFilterNode.value) {
        teamFilterNode.value = 'all';
      }

      const selectedTeam = String(teamFilterNode.value || 'all');
      const filteredData = sourceData.map((country) => {
        const filteredClubs = (country.clubs || []).map((club) => {
          const filteredPlayers = (club.players || []).filter((player) => selectedTeam === 'all' || String(player.team || '') === selectedTeam);
          return {
            ...club,
            players: filteredPlayers,
            count: filteredPlayers.length,
          };
        }).filter((club) => club.count > 0);

        return {
          ...country,
          clubs: filteredClubs,
          count: filteredClubs.reduce((sum, club) => sum + Number(club.count || 0), 0),
        };
      }).filter((country) => country.count > 0);

      const totalPlayers = filteredData.reduce((sum, country) => sum + Number(country.count || 0), 0);
      const totalCountries = filteredData.length;
      const totalClubs = filteredData.reduce((sum, country) => sum + (Array.isArray(country.clubs) ? country.clubs.length : 0), 0);
      const nationalTeams = new Set();
      const tableRows = [];
      filteredData.forEach((country) => {
        (country.clubs || []).forEach((club) => {
          (club.players || []).forEach((player) => {
            if (player.team) {
              nationalTeams.add(player.team);
            }
            tableRows.push({
              playerName: String(player.name || ''),
              nationalTeam: String(player.team || ''),
              clubCountry: String(country.country || ''),
              club: String(club.name || ''),
              position: String(player.position || ''),
            });
          });
        });
      });
      if (!filteredData.length || !tableRows.length) {
        chartNode.innerHTML = '<div class="squad-sunburst-empty">No squad rows match this national-team filter.</div>';
        detailsNode.innerHTML = '<div class="squad-sunburst-empty">Choose another national team to inspect its club-country footprint.</div>';
        metaNode.innerHTML = `<span class="chip"><strong>Filter</strong> ${escapeHtml(selectedTeam === 'all' ? 'All national teams' : selectedTeam)}</span>`;
        return;
      }
      const sortedTableRows = [...tableRows].sort((left, right) => left.playerName.localeCompare(right.playerName) || left.nationalTeam.localeCompare(right.nationalTeam));

      const width = Math.max(700, Math.floor(chartNode.clientWidth || 0));
      const height = 520;
      const centerX = Math.round(width * 0.48);
      const centerY = 258;
      const innerCountryRadius = 74;
      const outerCountryRadius = 152;
      const innerClubRadius = 160;
      const outerClubRadius = 246;
      const fullCircle = Math.PI * 2;
      let pinnedKey = chartNode.dataset.pinnedKey || '';

      const paletteForIndex = (index, count, lightness) => {
        const hue = Math.round((index * 360) / Math.max(count, 1));
        return `hsl(${hue} 72% ${lightness}%)`;
      };

      const polar = (radius, angle) => ({
        x: centerX + (radius * Math.cos(angle)),
        y: centerY + (radius * Math.sin(angle)),
      });

      const arcPath = (startAngle, endAngle, innerRadius, outerRadius) => {
        const epsilon = 0.00001;
        const safeEnd = endAngle - epsilon;
        const p1 = polar(outerRadius, startAngle);
        const p2 = polar(outerRadius, safeEnd);
        const p3 = polar(innerRadius, safeEnd);
        const p4 = polar(innerRadius, startAngle);
        const largeArc = (safeEnd - startAngle) > Math.PI ? 1 : 0;
        return [
          `M ${p1.x} ${p1.y}`,
          `A ${outerRadius} ${outerRadius} 0 ${largeArc} 1 ${p2.x} ${p2.y}`,
          `L ${p3.x} ${p3.y}`,
          `A ${innerRadius} ${innerRadius} 0 ${largeArc} 0 ${p4.x} ${p4.y}`,
          'Z',
        ].join(' ');
      };

      const labelAnchor = (angle) => {
        const cos = Math.cos(angle);
        if (cos > 0.28) {
          return 'start';
        }
        if (cos < -0.28) {
          return 'end';
        }
        return 'middle';
      };

      const countrySegments = [];
      const clubSegments = [];
      let cursor = -Math.PI / 2;
      filteredData.forEach((country, countryIndex) => {
        const countryCount = Number(country.count || 0);
        const countryAngle = (countryCount / totalPlayers) * fullCircle;
        const countryStart = cursor;
        const countryEnd = cursor + countryAngle;
        const countryColor = paletteForIndex(countryIndex, totalCountries, 54);
        const countryKey = `country:${country.country}`;
        countrySegments.push({
          key: countryKey,
          type: 'country',
          country: country.country,
          count: countryCount,
          startAngle: countryStart,
          endAngle: countryEnd,
          color: countryColor,
          clubs: country.clubs || [],
        });

        let clubCursor = countryStart;
        (country.clubs || []).forEach((club, clubIndex) => {
          const clubCount = Number(club.count || (club.players || []).length || 0);
          const clubAngle = (clubCount / totalPlayers) * fullCircle;
          const clubStart = clubCursor;
          const clubEnd = clubCursor + clubAngle;
          const clubLightness = 38 + Math.round((clubIndex / Math.max((country.clubs || []).length - 1, 1)) * 18);
          clubSegments.push({
            key: `club:${country.country}:${club.name}`,
            parentKey: countryKey,
            type: 'club',
            country: country.country,
            club: club.name,
            count: clubCount,
            players: club.players || [],
            startAngle: clubStart,
            endAngle: clubEnd,
            color: paletteForIndex(countryIndex, totalCountries, clubLightness),
          });
          clubCursor = clubEnd;
        });

        cursor = countryEnd;
      });

      detailsNode.innerHTML = `
        <div>
          <div class="squad-sunburst-kicker">Squad table</div>
          <h4 class="squad-sunburst-title" id="squad-sunburst-table-title">${escapeHtml(selectedTeam === 'all' ? 'All squad players' : `${selectedTeam} squad players`)}</h4>
          <p class="squad-sunburst-subtitle" id="squad-sunburst-table-subtitle">Hover a country or club slice to scope the table. Click a slice to pin it. Search matches player, national team, club, club country, or position.</p>
        </div>
        <input id="squad-sunburst-search" class="squad-sunburst-search" type="search" placeholder="Search players, teams, clubs, countries, positions" value="${escapeHtml(detailsNode.dataset.searchQuery || '')}">
        <div class="squad-sunburst-table-meta">
          <span id="squad-sunburst-table-scope">${escapeHtml(selectedTeam === 'all' ? 'Showing all squads' : `Showing national team: ${selectedTeam}`)}</span>
          <span id="squad-sunburst-table-count">${totalPlayers} rows</span>
        </div>
        <div class="squad-sunburst-table-wrap">
          <table class="squad-sunburst-table">
            <thead>
              <tr>
                <th>Player</th>
                <th>National team</th>
                <th>Club</th>
                <th>Country</th>
                <th>Pos</th>
              </tr>
            </thead>
            <tbody id="squad-sunburst-table-body"></tbody>
          </table>
        </div>
      `;

      const tableTitleNode = document.getElementById('squad-sunburst-table-title');
      const tableSubtitleNode = document.getElementById('squad-sunburst-table-subtitle');
      const tableScopeNode = document.getElementById('squad-sunburst-table-scope');
      const tableCountNode = document.getElementById('squad-sunburst-table-count');
      const tableBodyNode = document.getElementById('squad-sunburst-table-body');
      const searchNode = document.getElementById('squad-sunburst-search');

      const rowsForKey = (key) => {
        if (!key) {
          return sortedTableRows;
        }
        if (key.startsWith('country:')) {
          const country = key.slice('country:'.length);
          return sortedTableRows.filter((row) => row.clubCountry === country);
        }
        if (key.startsWith('club:')) {
          const clubSegment = clubSegments.find((segment) => segment.key === key);
          if (!clubSegment) {
            return [];
          }
          return sortedTableRows.filter((row) => row.clubCountry === clubSegment.country && row.club === clubSegment.club);
        }
        return sortedTableRows;
      };

      const tableCopyForKey = (key, scopedRows) => {
        if (!key) {
          return {
            title: selectedTeam === 'all' ? 'All squad players' : `${selectedTeam} squad players`,
            subtitle: selectedTeam === 'all'
              ? `Search across all ${totalPlayers} extracted player rows from the FIFA 2026 squad PDF.`
              : `Search across ${totalPlayers} extracted player rows for ${selectedTeam}.`,
            scope: selectedTeam === 'all' ? 'Showing all squads' : `Showing national team: ${selectedTeam}`,
            rowLabel: `${scopedRows.length} rows`,
          };
        }
        const countrySegment = countrySegments.find((segment) => segment.key === key);
        if (countrySegment) {
          return {
            title: `${countrySegment.country} clubs`,
            subtitle: `${countrySegment.count} squad players across ${countrySegment.clubs.length} clubs in ${countrySegment.country}.`,
            scope: `Scoped to club country: ${countrySegment.country}`,
            rowLabel: `${scopedRows.length} rows`,
          };
        }
        const clubSegment = clubSegments.find((segment) => segment.key === key);
        if (clubSegment) {
          return {
            title: clubSegment.club,
            subtitle: `${clubSegment.count} squad players belong to this club in ${clubSegment.country}.`,
            scope: `Scoped to club: ${clubSegment.club}`,
            rowLabel: `${scopedRows.length} rows`,
          };
        }
        return {
          title: selectedTeam === 'all' ? 'All squad players' : `${selectedTeam} squad players`,
          subtitle: selectedTeam === 'all'
            ? `Search across all ${totalPlayers} extracted player rows from the FIFA 2026 squad PDF.`
            : `Search across ${totalPlayers} extracted player rows for ${selectedTeam}.`,
          scope: selectedTeam === 'all' ? 'Showing all squads' : `Showing national team: ${selectedTeam}`,
          rowLabel: `${scopedRows.length} rows`,
        };
      };

      const renderTablePanel = (key) => {
        const maxVisibleRows = 26;
        const scopedRows = rowsForKey(key);
        const query = String(searchNode?.value || '').trim().toLowerCase();
        detailsNode.dataset.searchQuery = String(searchNode?.value || '');
        const filteredRows = query
          ? scopedRows.filter((row) => [
            row.playerName,
            row.nationalTeam,
            row.club,
            row.clubCountry,
            positionLabels[row.position] || row.position,
            row.position,
          ].join(' ').toLowerCase().includes(query))
          : scopedRows;
        const visibleRows = filteredRows.slice(0, maxVisibleRows);
        const copy = tableCopyForKey(key, scopedRows);

        if (tableTitleNode) {
          tableTitleNode.textContent = copy.title;
        }
        if (tableSubtitleNode) {
          tableSubtitleNode.textContent = copy.subtitle;
        }
        if (tableScopeNode) {
          tableScopeNode.textContent = copy.scope;
        }
        if (tableCountNode) {
          tableCountNode.textContent = filteredRows.length > maxVisibleRows
            ? `${visibleRows.length}/${filteredRows.length} rows`
            : (query ? `${filteredRows.length}/${scopedRows.length} rows` : copy.rowLabel);
        }
        if (tableBodyNode) {
          tableBodyNode.innerHTML = visibleRows.length
            ? visibleRows.map((row) => `
              <tr>
                <td><span class="squad-sunburst-table-player">${escapeHtml(row.playerName)}</span></td>
                <td>${escapeHtml(row.nationalTeam)}</td>
                <td>${escapeHtml(row.club)}</td>
                <td>${escapeHtml(row.clubCountry)}</td>
                <td><span class="squad-sunburst-table-subtle">${escapeHtml(positionLabels[row.position] || row.position || '')}</span></td>
              </tr>
            `).join('')
            : '<tr><td colspan="5"><div class="squad-sunburst-empty">No squad rows match the current slice and search query.</div></td></tr>';
        }
      };

      if (searchNode) {
        searchNode.addEventListener('input', () => {
          renderTablePanel(detailsNode.dataset.activeKey || '');
        });
      }

      const activeCountryForKey = (key) => {
        if (!key) {
          return '';
        }
        if (key.startsWith('country:')) {
          return key.slice('country:'.length);
        }
        if (key.startsWith('club:')) {
          return key.split(':')[1] || '';
        }
        return '';
      };

      const centerCopyForKey = (key) => {
        if (!key) {
          return {
            title: selectedTeam === 'all' ? 'Club country footprint' : selectedTeam,
            subtitle: `${totalPlayers} players · ${totalCountries} club countries`,
          };
        }
        const countrySegment = countrySegments.find((segment) => segment.key === key);
        if (countrySegment) {
          return {
            title: countrySegment.country,
            subtitle: `${countrySegment.count} players · ${countrySegment.clubs.length} clubs`,
          };
        }
        const clubSegment = clubSegments.find((segment) => segment.key === key);
        if (clubSegment) {
          return {
            title: clubSegment.club,
            subtitle: `${clubSegment.count} players · ${clubSegment.country}`,
          };
        }
        return {
          title: selectedTeam === 'all' ? 'Club country footprint' : selectedTeam,
          subtitle: `${totalPlayers} players · ${totalCountries} club countries`,
        };
      };

      const visibleCountryLabels = countrySegments.filter((segment) => ((segment.endAngle - segment.startAngle) / fullCircle) >= 0.022);
      const visibleClubLabels = clubSegments.filter((segment) => segment.count >= 7);

      const renderSvg = (activeKey) => {
        const activeCountry = activeCountryForKey(activeKey);
        const centerCopy = centerCopyForKey(activeKey);
        const countryPaths = countrySegments.map((segment) => {
          const isActive = activeKey && segment.key === activeKey;
          const isCountryMatch = activeCountry && segment.country === activeCountry;
          const isDim = activeKey ? !(isActive || isCountryMatch) : false;
          return `<path class="squad-sunburst-segment ${isActive ? 'is-active' : ''} ${isDim ? 'is-dim' : ''}" data-key="${escapeHtml(segment.key)}" d="${arcPath(segment.startAngle, segment.endAngle, innerCountryRadius, outerCountryRadius)}" fill="${escapeHtml(segment.color)}"></path>`;
        }).join('');
        const clubPaths = clubSegments.map((segment) => {
          const isActive = activeKey && segment.key === activeKey;
          const isCountryMatch = activeCountry && segment.country === activeCountry;
          const isDim = activeKey ? !(isActive || isCountryMatch || segment.parentKey === activeKey) : false;
          return `<path class="squad-sunburst-segment ${isActive ? 'is-active' : ''} ${isDim ? 'is-dim' : ''}" data-key="${escapeHtml(segment.key)}" d="${arcPath(segment.startAngle, segment.endAngle, innerClubRadius, outerClubRadius)}" fill="${escapeHtml(segment.color)}"></path>`;
        }).join('');
        const countryLabels = visibleCountryLabels.map((segment) => {
          const angle = (segment.startAngle + segment.endAngle) / 2;
          const point = polar(164, angle);
          return `<text class="squad-sunburst-label" x="${point.x}" y="${point.y}" text-anchor="${labelAnchor(angle)}">${escapeHtml(segment.country)}</text>`;
        }).join('');
        const clubLabels = visibleClubLabels.map((segment) => {
          const angle = (segment.startAngle + segment.endAngle) / 2;
          const point = polar(258, angle);
          return `<text class="squad-sunburst-label" x="${point.x}" y="${point.y}" text-anchor="${labelAnchor(angle)}">${escapeHtml(segment.club)}</text>`;
        }).join('');

        chartNode.innerHTML = `
          <svg viewBox="0 0 ${width} ${height}" role="img" aria-label="Sunburst chart of FIFA World Cup 2026 squad players by club country and club">
            ${countryPaths}
            ${clubPaths}
            <circle cx="${centerX}" cy="${centerY}" r="64" fill="rgba(12, 21, 37, 0.96)" stroke="rgba(173, 201, 236, 0.18)"></circle>
            <text class="squad-sunburst-center-label" x="${centerX}" y="${centerY - 4}">${escapeHtml(centerCopy.title)}</text>
            <text class="squad-sunburst-center-copy" x="${centerX}" y="${centerY + 15}">${escapeHtml(centerCopy.subtitle)}</text>
            ${countryLabels}
            ${clubLabels}
          </svg>
        `;

        const pathNodes = [...chartNode.querySelectorAll('.squad-sunburst-segment')];
        detailsNode.dataset.activeKey = activeKey;
        renderTablePanel(activeKey);

        pathNodes.forEach((node) => {
          node.addEventListener('pointerenter', () => {
            if (pinnedKey) {
              return;
            }
            renderSvg(String(node.getAttribute('data-key') || ''));
          });
          node.addEventListener('click', () => {
            const clickedKey = String(node.getAttribute('data-key') || '');
            pinnedKey = pinnedKey === clickedKey ? '' : clickedKey;
            chartNode.dataset.pinnedKey = pinnedKey;
            renderSvg(pinnedKey || clickedKey);
          });
        });

        const svgNode = chartNode.querySelector('svg');
        if (svgNode) {
          svgNode.addEventListener('pointerleave', () => {
            if (pinnedKey) {
              renderSvg(pinnedKey);
              return;
            }
            renderSvg('');
          });
        }
      };

      metaNode.innerHTML = [
        `<span class="chip"><strong>Players</strong> ${totalPlayers}</span>`,
        `<span class="chip"><strong>National teams</strong> ${nationalTeams.size}</span>`,
        `<span class="chip"><strong>Filter</strong> ${escapeHtml(selectedTeam === 'all' ? 'All national teams' : selectedTeam)}</span>`,
        `<span class="chip"><strong>Club countries</strong> ${totalCountries}</span>`,
        `<span class="chip"><strong>Clubs</strong> ${totalClubs}</span>`,
      ].join('');

      renderSvg(pinnedKey);
    };

    async function fetchJson(url, options = {}) {
      const response = await fetch(url, { cache: 'no-store' });

      const quotaProvider = String(options?.quotaProvider || '').trim();
      if (quotaProvider) {
        updateOddsProviderQuota(quotaProvider, response.headers);
      }

      if (!response.ok) {
        throw new Error(`${url} returned ${response.status}`);
      }

      return response.json();
    }

    const getCachedLiveDetail = (matchId) => {
      const id = String(matchId || '').trim();
      if (!id) {
        return null;
      }

      if (String(state.liveDetail?.IdMatch || '').trim() === id) {
        return state.liveDetail;
      }

      return state.liveDetailByMatchId instanceof Map ? state.liveDetailByMatchId.get(id) || null : null;
    };

    const storeLiveDetail = (matchId, detail, { promoteToCurrent = false } = {}) => {
      const id = String(matchId || '').trim();
      if (!id) {
        return;
      }

      if (!(state.liveDetailByMatchId instanceof Map)) {
        state.liveDetailByMatchId = new Map();
      }

      state.liveDetailByMatchId.set(id, detail || null);
      if (promoteToCurrent) {
        state.liveDetail = detail || null;
        state.liveDetailUpdatedAt = new Date();
      }
    };

    const fetchLiveDetailByMatchId = async (matchId, { promoteToCurrent = false, refresh = false } = {}) => {
      const id = String(matchId || '').trim();
      if (!id) {
        return null;
      }

      if (!refresh) {
        const cached = getCachedLiveDetail(id);
        if (cached) {
          if (promoteToCurrent) {
            state.liveDetail = cached;
            state.liveDetailUpdatedAt = new Date();
          }
          return cached;
        }
      }

      if (!(state.pendingLiveDetailFetches instanceof Map)) {
        state.pendingLiveDetailFetches = new Map();
      }

      if (state.pendingLiveDetailFetches.has(id)) {
        const pendingDetail = await state.pendingLiveDetailFetches.get(id);
        if (promoteToCurrent && pendingDetail) {
          state.liveDetail = pendingDetail;
          state.liveDetailUpdatedAt = new Date();
        }
        return pendingDetail;
      }

      const pendingRequest = (async () => {
      try {
        // Try loading from local cache first (match-details/{id}.json) when refresh is not forced.
        let detail = null;
        if (!refresh) {
          try {
            detail = await fetchJson(`match-details/${encodeURIComponent(id)}.json`);
          } catch (e) {
            // Local cache not available, fall through to FIFA API
          }
        }

        // If not in local cache, fetch from FIFA API
        if (!detail) {
          detail = await fetchJson(buildFifaApiUrl(`/live/football/${encodeURIComponent(id)}`, { language: 'en' }));
        }

        storeLiveDetail(id, detail, { promoteToCurrent });
        return detail;
      } catch {
        storeLiveDetail(id, null, { promoteToCurrent: false });
        return null;
      }
      })();

      state.pendingLiveDetailFetches.set(id, pendingRequest);
      try {
        return await pendingRequest;
      } finally {
        state.pendingLiveDetailFetches.delete(id);
      }
    };

    async function loadLiveMatchDetails(activeMatch, { refresh = false } = {}) {
      if (!activeMatch?.IdMatch) {
        state.liveDetail = null;
        state.liveDetailUpdatedAt = new Date();
        return;
      }

      const id = String(activeMatch.IdMatch).trim();
      if (!id) {
        state.liveDetail = null;
        state.liveDetailUpdatedAt = new Date();
        return;
      }

      const detail = await fetchLiveDetailByMatchId(id, { promoteToCurrent: true, refresh });
      if (!detail) {
        state.liveDetail = null;
        state.liveDetailUpdatedAt = new Date();
      }
    }

    async function loadMatches(options = {}) {
      const shouldAutoScroll = Boolean(options.autoScrollNextUp);
      const url = buildFifaApiUrl('/calendar/matches', {
        language: 'en',
        count: 500,
        idSeason: seasonId,
      });
      const payload = await fetchJson(url);
      const matches = Array.isArray(payload.Results) ? payload.Results : [];

      const goalsDetected = detectGoalChanges(matches);
      state.matches = matches;
      state.updatedAt = new Date();
      state.lastFifaPullAt = new Date();
      state.lastFifaPullMatchCount = matches.length;
      state.lastFifaPullActiveCount = matches.filter(isActivelyPlayedMatch).length;
      state.lastFifaPullStatus = 'ok';
      state.lastFifaPullErrorMessage = '';
      syncRefreshSchedule();
      state.nextUpKickoffTs = computeNextUpKickoffTs(matches);
      scheduleKickoffTrigger();
      renderPreferredTeamSelector();

      const focusedMatch = resolveLiveFocusMatch(matches);
      const focusedMatchIsLive = Boolean(focusedMatch && isActivelyPlayedMatch(focusedMatch));
      await loadLiveMatchDetails(focusedMatch || null, { refresh: focusedMatchIsLive });

      const activeLiveMatchIds = [...new Set((matches || [])
        .filter(isActivelyPlayedMatch)
        .map((match) => String(match?.IdMatch || '').trim())
        .filter(Boolean))];
      if (activeLiveMatchIds.length) {
        await Promise.all(activeLiveMatchIds.map((matchId) => fetchLiveDetailByMatchId(matchId, { refresh: true }).catch(() => null)));
      }

      if (goalsDetected > 0) {
        playGoalAlert();
      }

      renderLiveMatchPage();
      renderGroupStage();
      renderGroupTablesPage();
      renderThirdPlacedTeamsPage();
      renderKnockoutPage('round32-grid', knockoutStages.slice(0, 1), 'round32-rendered-at', 'Round of 32');
      renderKnockoutPage('round16-grid', knockoutStages.slice(1, 2), 'round16-rendered-at', 'Round of 16');
      renderKnockoutPage('finals-grid', finalsStages, 'finals-rendered-at', 'Finals');
      renderThirdPlacedTeamsPage();
      renderPredictedBracketPage();
      renderCompletedPage();
      updateRefreshCountdownViews();

      if (shouldAutoScroll && state.shouldAutoScrollNextUp) {
        window.requestAnimationFrame(() => {
          const hasLiveMatch = (matches || []).some(isActivelyPlayedMatch);
          const didScroll = hasLiveMatch
            ? scrollToLiveMatchFocus('smooth')
            : scrollToNextUpMatch('smooth');
          if (didScroll) {
            state.shouldAutoScrollNextUp = false;
          }
        });
      }
    }

    async function refreshLiveMatchesOnly() {
      if (document.visibilityState !== 'visible') {
        return;
      }

      if (isReplayModeActive()) {
        try {
          await loadMatches({ autoScrollNextUp: false });
          updateSpotlightLiveClockDataAttributes();
        } catch (error) {
          console.warn('Failed to refresh demo live match view', error);
        }
        return;
      }

      const hasActiveMatch = (state.matches || []).some(isActivelyPlayedMatch);
      if (!hasActiveMatch) {
        return;
      }

      try {
        await loadMatches({ autoScrollNextUp: false });
        updateSpotlightLiveClockDataAttributes();
      } catch (error) {
        console.warn('Failed to refresh live match scores', error);
      }
    }

    async function refreshAll() {
      let oddsError = null;

      try {
        await loadOddsContenders();
      } catch (error) {
        oddsError = error;
        console.warn('Failed to refresh Odds API contenders, keeping last available odds snapshot', error);
      }

      try {
        await loadMatches({ autoScrollNextUp: true });
      } catch (error) {
        state.lastFifaPullStatus = 'error';
        state.lastFifaPullErrorMessage = String(error?.message || 'Unknown FIFA refresh error');
        updateRefreshCountdownViews();
        console.error('Failed to refresh FIFA data', error);
        const message = `Live refresh failed: ${error.message}`;
        document.querySelectorAll('.footer div:last-child').forEach((node) => {
          node.textContent = message;
        });
      }

      if (oddsError) {
        console.info('Odds integration unavailable for this refresh cycle:', oddsError.message);
      }
    }

    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible' && !state.timer) {
        refreshAll();
      }
    });

    window.refreshWorldCup = refreshAll;

    const completedAccordionStorageKey = 'fifa2026_completed_accordion_expanded_v1';

    // Generic accordion setup for any section
    const setupAccordion = (toggleId, contentId, storageKey, collapseLabel = 'Collapse', expandLabel = 'Expand') => {
      const toggleNode = document.getElementById(toggleId);
      const contentNode = document.getElementById(contentId);
      if (!toggleNode || !contentNode) {
        return;
      }

      const loadExpanded = () => {
        try {
          const rawValue = localStorage.getItem(storageKey);
          return rawValue === null ? true : rawValue === '1';
        } catch {
          return true;
        }
      };

      const applyExpanded = (expanded, { persist = true } = {}) => {
        const isExpanded = Boolean(expanded);
        toggleNode.setAttribute('aria-expanded', String(isExpanded));
        const labelNode = toggleNode.querySelector('.accordion-toggle-label');
        if (labelNode) {
          labelNode.textContent = isExpanded ? collapseLabel : expandLabel;
        }
        contentNode.hidden = !isExpanded;

        if (persist) {
          try {
            localStorage.setItem(storageKey, isExpanded ? '1' : '0');
          } catch {
            // Ignore storage failures.
          }
        }
      };

      applyExpanded(loadExpanded(), { persist: false });

      toggleNode.addEventListener('click', () => {
        const currentlyExpanded = toggleNode.getAttribute('aria-expanded') === 'true';
        applyExpanded(!currentlyExpanded);
      });
    };

    const loadCompletedAccordionExpanded = () => {
      try {
        const rawValue = localStorage.getItem(completedAccordionStorageKey);
        if (rawValue === null) {
          return false;
        }
        return rawValue === '1';
      } catch {
        return false;
      }
    };

    const applyCompletedAccordionExpanded = (expanded, { persist = true } = {}) => {
      const toggleNode = document.getElementById('completed-accordion-toggle');
      const contentNode = document.getElementById('completed-accordion-content');
      if (!toggleNode || !contentNode) {
        return;
      }

      const isExpanded = Boolean(expanded);
      toggleNode.setAttribute('aria-expanded', String(isExpanded));
      const labelNode = toggleNode.querySelector('.completed-accordion-toggle-label');
      if (labelNode) {
        labelNode.textContent = isExpanded ? 'Collapse archive' : 'Expand archive';
      }
      contentNode.hidden = !isExpanded;

      if (persist) {
        try {
          localStorage.setItem(completedAccordionStorageKey, isExpanded ? '1' : '0');
        } catch {
          // Ignore storage failures.
        }
      }
    };

    const setupCompletedAccordion = () => {
      const toggleNode = document.getElementById('completed-accordion-toggle');
      if (!toggleNode) {
        return;
      }

      applyCompletedAccordionExpanded(loadCompletedAccordionExpanded(), { persist: false });

      toggleNode.addEventListener('click', () => {
        const currentlyExpanded = toggleNode.getAttribute('aria-expanded') === 'true';
        applyCompletedAccordionExpanded(!currentlyExpanded);
      });
    };

    applySectionVisibilityAndOrder();

    setupCompletedAccordion();
    setupAccordion('group-stage-accordion-toggle', 'group-stage-accordion-content', 'fifa2026_group_stage_accordion_expanded', 'Collapse', 'Expand');
    setupAccordion('round32-accordion-toggle', 'round32-accordion-content', 'fifa2026_round32_accordion_expanded', 'Collapse', 'Expand');
    setupAccordion('round16-accordion-toggle', 'round16-accordion-content', 'fifa2026_round16_accordion_expanded', 'Collapse', 'Expand');
    setupAccordion('finals-accordion-toggle', 'finals-accordion-content', 'fifa2026_finals_accordion_expanded', 'Collapse', 'Expand');
    setupAccordion('lucky8-accordion-toggle', 'lucky8-accordion-content', 'fifa2026_lucky8_accordion_expanded', 'Collapse', 'Expand');
    setupAccordion('bracket-accordion-toggle', 'bracket-accordion-content', 'fifa2026_bracket_accordion_expanded', 'Collapse', 'Expand');
    setupAccordion('group-tables-accordion-toggle', 'group-tables-accordion-content', 'fifa2026_group_tables_accordion_expanded', 'Collapse', 'Expand');
    setupAccordion('lucky8-accordion-toggle', 'lucky8-accordion-content', 'fifa2026_lucky8_accordion_expanded', 'Collapse', 'Expand');
    setupAccordion('live-match-accordion-toggle', 'live-match-accordion-content', 'fifa2026_live_match_accordion_expanded', 'Collapse', 'Expand');
    setupAccordion('special-interest-accordion-toggle', 'special-interest-accordion-content', 'fifa2026_special_interest_accordion_expanded', 'Collapse', 'Expand');
    setupHeaderInfoToggles();
    setupBottomSectionNav();
    loadOddsProviderStatus();
    applyPreferredTeamSelection(loadStoredPreferredTeams(), { persist: false });
    attachMatchHoverHandlers();
    renderWorldCupWinnersSankey();
    renderSquadClubSunburst();
    fitSingleLineTitles();
    window.addEventListener('resize', renderWorldCupWinnersSankey);
    window.addEventListener('resize', renderSquadClubSunburst);
    window.addEventListener('resize', fitSingleLineTitles);

    const topScorersYearNode = document.getElementById('top-scorers-year');
    const topScorersTeamNode = document.getElementById('top-scorers-team');
    const topScorersSortNode = document.getElementById('top-scorers-sort');
    const topScorersResetNode = document.getElementById('top-scorers-reset');
    if (topScorersYearNode && topScorersTeamNode && topScorersSortNode && topScorersResetNode) {
      const onTopScorerFilterChange = () => renderTopScorersVisualization();
      topScorersYearNode.addEventListener('change', onTopScorerFilterChange);
      topScorersTeamNode.addEventListener('change', onTopScorerFilterChange);
      topScorersSortNode.addEventListener('change', onTopScorerFilterChange);
      topScorersResetNode.addEventListener('click', () => {
        state.topScorersFilters = { year: 'all', team: 'all', sortBy: 'year' };
        topScorersYearNode.value = 'all';
        topScorersTeamNode.value = 'all';
        topScorersSortNode.value = 'year';
        renderTopScorersVisualization();
      });
      renderTopScorersVisualization();
    }

    const preferredChipsNode = document.getElementById('preferred-team-chips');
    if (preferredChipsNode) {
      preferredChipsNode.addEventListener('click', (event) => {
        const chipNode = event.target?.closest?.('.team-chip');
        if (!chipNode) {
          return;
        }

        const canonicalTeam = String(chipNode.getAttribute('data-team') || '').trim();
        if (!canonicalTeam) {
          return;
        }

        togglePreferredTeam(canonicalTeam);
      });
    }

    const preferredClearButton = document.getElementById('preferred-clear-btn');
    if (preferredClearButton) {
      preferredClearButton.addEventListener('click', () => {
        applyPreferredTeamSelection([], { persist: true });
        renderPreferredTeamSelector();
        rerenderMatchPages();
      });
    }

    const preferredResetButton = document.getElementById('preferred-reset-btn');
    if (preferredResetButton) {
      preferredResetButton.addEventListener('click', () => {
        applyPreferredTeamSelection(defaultPreferredTeamNames, { persist: true });
        renderPreferredTeamSelector();
        rerenderMatchPages();
      });
    }

    loadMatchReminders();
    updateStickyPageMarker();
    document.addEventListener('scroll', updateStickyPageMarker, { passive: true });
    window.addEventListener('resize', updateStickyPageMarker);
    window.setInterval(checkMatchReminders, 60 * 1000);
    window.setInterval(updateNextUpCountdowns, 30 * 1000);
    updateRefreshCountdownViews();
    window.setInterval(updateRefreshCountdownViews, 1000);
    refreshAll();
    state.timer = window.setInterval(refreshAll, refreshIntervalMs);
    state.liveTimer = window.setInterval(refreshLiveMatchesOnly, liveRefreshIntervalMs);
  </script>
