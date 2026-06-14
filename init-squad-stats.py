#!/usr/bin/env python3
"""
One-time initialization: Add tournamentStats schema to all players in squad-data.json.
Run once before using the tournament stats feature.
"""

import json
from datetime import datetime

SQUAD_FILE = 'squad-data.json'

def init_stats():
    with open(SQUAD_FILE, 'r', encoding='utf-8') as f:
        squad_data = json.load(f)

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

    with open(SQUAD_FILE, 'w', encoding='utf-8') as f:
        json.dump(squad_data, f, indent=2, ensure_ascii=False)

    print(f'✅ Initialized tournamentStats for {init_count} players')
    print(f'📝 {len(squad_data)} total players in squad database')

if __name__ == '__main__':
    init_stats()
