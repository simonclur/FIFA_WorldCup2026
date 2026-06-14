#!/usr/bin/env python3
"""
FIFA 2026 Player Tournament Stats Updater

Fetches completed matches from FIFA API, processes live event data to extract
player statistics (goals, yellow/red cards, appearances), and updates squad-data.json.

NOTE: The FIFA API live feed does not provide:
  - Assists (IdAssistPlayer is always null in goal events)
  - Minutes played (no minute-level tracking in the event feed)

These fields are populated with 0/empty and cannot be extracted from the available API.

Run locally: python3 update-player-stats.py
Run via CI: GitHub Actions workflow calls this with required env vars
"""

import json
import sys
from datetime import datetime
from typing import Any, Dict, List
from urllib.request import urlopen
from urllib.error import URLError, HTTPError

SQUAD_DATA_FILE = 'squad-data.json'
FIFA_API_BASE = 'https://api.fifa.com/api/v3'
SEASON_ID = '285023'  # FIFA 2026 World Cup


def fetch_matches() -> List[Dict[str, Any]]:
    """Fetch all matches for the current season."""
    try:
        url = f'{FIFA_API_BASE}/calendar/matches?language=en&count=500&idSeason={SEASON_ID}'
        with urlopen(url, timeout=10) as response:
            data = json.loads(response.read().decode('utf-8'))
            if data is None:
                print(f'⚠️  FIFA API returned null response', file=sys.stderr)
                return []
            return data.get('Results', [])
    except (URLError, HTTPError) as e:
        print(f'Error fetching matches (HTTP): {e}', file=sys.stderr)
        return []
    except json.JSONDecodeError as e:
        print(f'Error parsing FIFA API response: {e}', file=sys.stderr)
        return []
    except Exception as e:
        print(f'Unexpected error fetching matches: {e}', file=sys.stderr)
        return []


def fetch_match_detail(match_id: str) -> Dict[str, Any]:
    """Fetch detailed match info including live events."""
    try:
        url = f'{FIFA_API_BASE}/live/football/{match_id}?language=en'
        with urlopen(url, timeout=10) as response:
            return json.loads(response.read().decode('utf-8'))
    except (URLError, HTTPError) as e:
        # 404 is expected for non-live matches; suppress noise
        if '404' not in str(e):
            print(f'Error fetching match {match_id}: {e}', file=sys.stderr)
        return {}
    except json.JSONDecodeError as e:
        print(f'Error parsing match detail {match_id}: {e}', file=sys.stderr)
        return {}


def is_completed_match(match: Dict[str, Any]) -> bool:
    """Check if a match has finished (ResultType = 1)."""
    result_type = match.get('ResultType')
    return result_type == 1 or result_type == '1'


def extract_player_id(goal: Dict[str, Any]) -> str:
    """Extract player ID from goal record."""
    return str(goal.get('IdPlayer', ''))


def extract_player_id_from_booking(booking: Dict[str, Any]) -> str:
    """Extract player ID from booking record."""
    return str(booking.get('IdPlayer', ''))


def extract_player_id_from_sub(sub: Dict[str, Any], key: str) -> str:
    """Extract player ID from substitution record (PlayerOnId or PlayerOffId)."""
    return str(sub.get(key, ''))


def build_player_id_map(team: Dict[str, Any]) -> Dict[str, Dict[str, Any]]:
    """
    Build a map from IdPlayer -> {shirtNumber, playerName} for a team roster.
    This maps FIFA's IdPlayer to the live match feed's player data.
    """
    id_map = {}
    for player in team.get('Players', []):
        player_id = str(player.get('IdPlayer', ''))
        if player_id:
            id_map[player_id] = {
                'shirtNumber': player.get('ShirtNumber'),
                'playerName': player.get('PlayerName') or player.get('ShortName') or 'Player'
            }
    return id_map


def process_match_stats(match_detail: Dict[str, Any]) -> Dict[tuple, Dict[str, int]]:
    """
    Process a match's live event data and extract per-player stats.
    Tracks: goals, yellowCards, redCards, appearances (from lineup + substitutions).
    Note: FIFA API does not provide assist data or minute-by-minute tracking.
    Returns a dict mapping (shirtNumber, side) -> {goals, assists, yellowCards, redCards, appeared}
    where side is 'home' or 'away'.
    """
    stats: Dict[tuple, Dict[str, int]] = {}

    home_team = match_detail.get('HomeTeam', {})
    away_team = match_detail.get('AwayTeam', {})

    home_id_map = build_player_id_map(home_team)
    away_id_map = build_player_id_map(away_team)

    # Track which players appeared (either started or came on as sub)
    home_appeared = set()
    away_appeared = set()

    # Add all starting players to appeared set
    for player in home_team.get('Players', []):
        player_id = str(player.get('IdPlayer', ''))
        if player_id:
            home_appeared.add(player_id)

    for player in away_team.get('Players', []):
        player_id = str(player.get('IdPlayer', ''))
        if player_id:
            away_appeared.add(player_id)

    # Track substitution appearances (players who came on)
    home_subs = home_team.get('Substitutions', [])
    away_subs = away_team.get('Substitutions', [])
    for sub in home_subs:
        player_on_id = extract_player_id_from_sub(sub, 'PlayerOnId')
        if player_on_id:
            home_appeared.add(player_on_id)
    for sub in away_subs:
        player_on_id = extract_player_id_from_sub(sub, 'PlayerOnId')
        if player_on_id:
            away_appeared.add(player_on_id)

    # Process home goals
    for goal in home_team.get('Goals', []):
        player_id = extract_player_id(goal)
        if player_id and player_id in home_id_map:
            shirt = home_id_map[player_id]['shirtNumber']
            key = (shirt, 'home')
            if key not in stats:
                stats[key] = {'goals': 0, 'assists': 0, 'yellowCards': 0, 'redCards': 0, 'appeared': 0}
            stats[key]['goals'] += 1

    # Process away goals
    for goal in away_team.get('Goals', []):
        player_id = extract_player_id(goal)
        if player_id and player_id in away_id_map:
            shirt = away_id_map[player_id]['shirtNumber']
            key = (shirt, 'away')
            if key not in stats:
                stats[key] = {'goals': 0, 'assists': 0, 'yellowCards': 0, 'redCards': 0, 'appeared': 0}
            stats[key]['goals'] += 1

    # Process home bookings
    for booking in home_team.get('Bookings', []):
        player_id = extract_player_id_from_booking(booking)
        if player_id and player_id in home_id_map:
            shirt = home_id_map[player_id]['shirtNumber']
            key = (shirt, 'home')
            if key not in stats:
                stats[key] = {'goals': 0, 'assists': 0, 'yellowCards': 0, 'redCards': 0, 'appeared': 0}
            card_type = booking.get('Card')
            if card_type == 1:
                stats[key]['yellowCards'] += 1
            elif card_type == 2:
                stats[key]['redCards'] += 1

    # Process away bookings
    for booking in away_team.get('Bookings', []):
        player_id = extract_player_id_from_booking(booking)
        if player_id and player_id in away_id_map:
            shirt = away_id_map[player_id]['shirtNumber']
            key = (shirt, 'away')
            if key not in stats:
                stats[key] = {'goals': 0, 'assists': 0, 'yellowCards': 0, 'redCards': 0, 'appeared': 0}
            card_type = booking.get('Card')
            if card_type == 1:
                stats[key]['yellowCards'] += 1
            elif card_type == 2:
                stats[key]['redCards'] += 1

    # Record appearances for all players who appeared
    for player_id in home_appeared:
        if player_id in home_id_map:
            shirt = home_id_map[player_id]['shirtNumber']
            key = (shirt, 'home')
            if key not in stats:
                stats[key] = {'goals': 0, 'assists': 0, 'yellowCards': 0, 'redCards': 0, 'appeared': 0}
            stats[key]['appeared'] = 1

    for player_id in away_appeared:
        if player_id in away_id_map:
            shirt = away_id_map[player_id]['shirtNumber']
            key = (shirt, 'away')
            if key not in stats:
                stats[key] = {'goals': 0, 'assists': 0, 'yellowCards': 0, 'redCards': 0, 'appeared': 0}
            stats[key]['appeared'] = 1

    return stats


def load_squad_data() -> List[Dict[str, Any]]:
    """Load squad-data.json."""
    try:
        with open(SQUAD_DATA_FILE, 'r', encoding='utf-8') as f:
            return json.load(f)
    except (FileNotFoundError, json.JSONDecodeError) as e:
        print(f'Error loading {SQUAD_DATA_FILE}: {e}', file=sys.stderr)
        return []


def save_squad_data(squad_data: List[Dict[str, Any]]) -> None:
    """Save updated squad-data.json."""
    try:
        with open(SQUAD_DATA_FILE, 'w', encoding='utf-8') as f:
            json.dump(squad_data, f, indent=2, ensure_ascii=False)
    except IOError as e:
        print(f'Error saving {SQUAD_DATA_FILE}: {e}', file=sys.stderr)
        sys.exit(1)


def main():
    print('🔄 FIFA 2026 Player Tournament Stats Updater')
    print(f'📅 Run timestamp: {datetime.utcnow().isoformat()}Z')

    # Load squad data
    squad_data = load_squad_data()
    if not squad_data:
        print('❌ No squad data loaded. Exiting.', file=sys.stderr)
        sys.exit(1)

    # Initialize tournamentStats for all players if not present
    init_count = 0
    for player in squad_data:
        if 'tournamentStats' not in player:
            player['tournamentStats'] = {
                'goals': 0,
                'assists': 0,
                'yellowCards': 0,
                'redCards': 0,
                'minutesPlayed': 0,
                'appearances': 0,
                'lastUpdated': datetime.utcnow().isoformat() + 'Z'
            }
            init_count += 1

    if init_count > 0:
        print(f'✅ Initialized tournamentStats for {init_count} players')

    # Build team name -> team code mapping
    team_name_to_code: Dict[str, str] = {}
    for player in squad_data:
        team_name = player.get('nationalTeam', '')
        team_code = player.get('nationalTeamCode', '')
        if team_name and team_code:
            team_name_to_code[team_name.lower()] = team_code

    # Fetch and process matches
    print('📥 Fetching completed matches...')
    matches = fetch_matches()
    completed_matches = [m for m in matches if is_completed_match(m)]
    print(f'📊 Found {len(completed_matches)} completed matches')

    processed_count = 0
    for match in completed_matches:
        match_id = str(match.get('IdMatch', ''))
        if not match_id:
            continue

        print(f'  Match {match_id}...', end=' ')
        detail = fetch_match_detail(match_id)
        if not detail:
            print('⚠️  (no detail)')
            continue

        # Extract team codes from the match detail
        home_team = detail.get('HomeTeam', {})
        away_team = detail.get('AwayTeam', {})

        # TeamName is a list of localized descriptions, extract English one
        home_team_data = home_team.get('TeamName', [])
        away_team_data = away_team.get('TeamName', [])
        home_team_name = ''
        away_team_name = ''

        if isinstance(home_team_data, list) and len(home_team_data) > 0:
            home_team_name = str(home_team_data[0].get('Description', '')).strip().lower()
        if isinstance(away_team_data, list) and len(away_team_data) > 0:
            away_team_name = str(away_team_data[0].get('Description', '')).strip().lower()

        home_code = team_name_to_code.get(home_team_name, '')
        away_code = team_name_to_code.get(away_team_name, '')

        if not home_code or not away_code:
            print(f'⚠️  (team mapping failed)')
            continue

        match_stats = process_match_stats(detail)
        print(f'({len(match_stats)} players)', end=' ')

        # Apply stats to squad_data
        for (shirt, side), stat_deltas in match_stats.items():
            team_code = home_code if side == 'home' else away_code
            for player in squad_data:
                if player.get('nationalTeamCode') == team_code and player.get('jersey') == shirt:
                    ts = player['tournamentStats']
                    ts['goals'] += stat_deltas.get('goals', 0)
                    ts['assists'] += stat_deltas.get('assists', 0)
                    ts['yellowCards'] += stat_deltas.get('yellowCards', 0)
                    ts['redCards'] += stat_deltas.get('redCards', 0)
                    # Increment appearances if player appeared in this match
                    if stat_deltas.get('appeared', 0) > 0:
                        ts['appearances'] += 1
                    ts['lastUpdated'] = datetime.utcnow().isoformat() + 'Z'
                    break

        print('✓')
        processed_count += 1

    print(f'\n✅ Processed {processed_count} completed matches')
    print(f'📝 Saving updated squad-data.json...')
    save_squad_data(squad_data)
    print(f'✅ Complete. {len(squad_data)} players in squad database.')


if __name__ == '__main__':
    main()
