#!/usr/bin/env python3
"""
Parse FIFA World Cup 2026 squad lists PDF into structured JSON.
Output: squad-data.json
"""

import json, re, sys
from collections import defaultdict
from pdfminer.high_level import extract_pages
from pdfminer.layout import LTTextBox

PDF_PATH  = "squad-lists.pdf"
OUTPUT    = "squad-data.json"

COUNTRY_NAMES = {
    "AFG":"Afghanistan","ALB":"Albania","ALG":"Algeria","AND":"Andorra","ANG":"Angola",
    "ANT":"Antigua and Barbuda","ARG":"Argentina","ARM":"Armenia","ARU":"Aruba",
    "AUS":"Australia","AUT":"Austria","AZE":"Azerbaijan","BAH":"Bahamas","BHR":"Bahrain",
    "BAN":"Bangladesh","BLR":"Belarus","BEL":"Belgium","BLZ":"Belize","BEN":"Benin",
    "BHU":"Bhutan","BOL":"Bolivia","BIH":"Bosnia and Herzegovina","BOT":"Botswana",
    "BRA":"Brazil","BRU":"Brunei","BUL":"Bulgaria","BFA":"Burkina Faso","BDI":"Burundi",
    "CPV":"Cape Verde","CAM":"Cambodia","CMR":"Cameroon","CAN":"Canada",
    "CAF":"Central African Republic","CHA":"Chad","CHI":"Chile","CHN":"China",
    "COL":"Colombia","COM":"Comoros","CGO":"Congo","CRC":"Costa Rica","CRO":"Croatia",
    "CUB":"Cuba","CYP":"Cyprus","CZE":"Czech Republic","DEN":"Denmark","DJI":"Djibouti",
    "DOM":"Dominican Republic","ECU":"Ecuador","EGY":"Egypt","SLV":"El Salvador",
    "ENG":"England","EQG":"Equatorial Guinea","ERI":"Eritrea","EST":"Estonia",
    "SWZ":"Eswatini","ETH":"Ethiopia","FIJ":"Fiji","FIN":"Finland","FRA":"France",
    "GAB":"Gabon","GAM":"Gambia","GEO":"Georgia","GER":"Germany","GHA":"Ghana",
    "GRE":"Greece","GRN":"Grenada","GUA":"Guatemala","GUI":"Guinea","GNB":"Guinea-Bissau",
    "GUY":"Guyana","HAI":"Haiti","HON":"Honduras","HKG":"Hong Kong","HUN":"Hungary",
    "IND":"India","IDN":"Indonesia","IRN":"Iran","IRQ":"Iraq","IRL":"Republic of Ireland",
    "ISR":"Israel","ITA":"Italy","CIV":"Ivory Coast","JAM":"Jamaica","JPN":"Japan",
    "JOR":"Jordan","KAZ":"Kazakhstan","KEN":"Kenya","PRK":"North Korea","KOR":"South Korea",
    "KWT":"Kuwait","KGZ":"Kyrgyzstan","LAO":"Laos","LVA":"Latvia","LBN":"Lebanon",
    "LES":"Lesotho","LBR":"Liberia","LBA":"Libya","LIE":"Liechtenstein","LTU":"Lithuania",
    "LUX":"Luxembourg","MAC":"Macau","MKD":"North Macedonia","MAD":"Madagascar",
    "MWI":"Malawi","MAS":"Malaysia","MDV":"Maldives","MLI":"Mali","MLT":"Malta",
    "MTN":"Mauritania","MRI":"Mauritius","MEX":"Mexico","MDA":"Moldova","MNG":"Mongolia",
    "MNE":"Montenegro","MAR":"Morocco","MOZ":"Mozambique","MYA":"Myanmar","NAM":"Namibia",
    "NEP":"Nepal","NED":"Netherlands","NZL":"New Zealand","NCA":"Nicaragua","NIG":"Niger",
    "NGA":"Nigeria","NIR":"Northern Ireland","NOR":"Norway","OMA":"Oman","PAK":"Pakistan",
    "PLE":"Palestine","PAN":"Panama","PNG":"Papua New Guinea","PAR":"Paraguay","PER":"Peru",
    "PHI":"Philippines","POL":"Poland","POR":"Portugal","PUR":"Puerto Rico","QAT":"Qatar",
    "ROU":"Romania","RUS":"Russia","RWA":"Rwanda","SAM":"Samoa","SAU":"Saudi Arabia",
    "SCO":"Scotland","SEN":"Senegal","SRB":"Serbia","SLE":"Sierra Leone","SGP":"Singapore",
    "SVK":"Slovakia","SVN":"Slovenia","SOL":"Solomon Islands","SOM":"Somalia",
    "RSA":"South Africa","SSD":"South Sudan","ESP":"Spain","SRI":"Sri Lanka","SDN":"Sudan",
    "SUR":"Suriname","SWE":"Sweden","SUI":"Switzerland","SYR":"Syria","TPE":"Chinese Taipei",
    "TJK":"Tajikistan","TAN":"Tanzania","THA":"Thailand","TLS":"Timor-Leste","TOG":"Togo",
    "TGA":"Tonga","TRI":"Trinidad and Tobago","TUN":"Tunisia","TUR":"Turkey",
    "TKM":"Turkmenistan","UGA":"Uganda","UKR":"Ukraine","UAE":"United Arab Emirates",
    "USA":"United States","URU":"Uruguay","UZB":"Uzbekistan","VAN":"Vanuatu",
    "VEN":"Venezuela","VIE":"Vietnam","WAL":"Wales","YEM":"Yemen","ZAM":"Zambia",
    "ZIM":"Zimbabwe","KSA":"Saudi Arabia","SCT":"Scotland",
}

def get_country_name(code):
    return COUNTRY_NAMES.get(code, code)

def parse_club_field(raw):
    m = re.match(r'^(.+?)\s*\(([A-Z]{2,4})\)\s*$', raw.strip())
    if m:
        return m.group(1).strip(), m.group(2), get_country_name(m.group(2))
    return raw.strip(), "", ""

def parse_team_header(text):
    m = re.match(r'^(.+?)\s*\(([A-Z]{2,4})\)\s*$', text.strip())
    if m:
        return m.group(1).strip(), m.group(2)
    return None

def is_position(t):  return t.strip() in {"GK","DF","MF","FW"}
def is_dob(t):       return bool(re.match(r'^\d{2}/\d{2}/\d{4}$', t.strip()))
def is_number(t):    return bool(re.match(r'^\d+$', t.strip()))

def boxes_from_pdf(path):
    for pg, layout in enumerate(extract_pages(path)):
        for el in layout:
            if isinstance(el, LTTextBox):
                txt = el.get_text().strip()
                if txt:
                    yield pg, round(el.y0, 1), round(el.x0, 1), txt

# Observed fullname x: always 26–30 across all 48 pages.
# Observed firstname x: 79–108 across all 48 pages.
# Setting fullname upper bound at 65 guarantees no overlap.
FULLNAME_X  = (25, 65)
FIRSTNAME_X = (65, 155)
LASTNAME_X  = (155, 205)
SHIRT_X     = (205, 262)

def classify_row_cells(cells):
    col_map = {}
    numeric_cells = []

    for x, text in cells:
        t = text.strip()

        if is_position(t):
            col_map["pos"] = t;  continue
        if is_dob(t):
            col_map["dob"] = t;  continue
        if re.match(r'^.+\s\([A-Z]{2,4}\)\s*$', t):
            col_map["club"] = t; continue
        if is_number(t) and x < 20:
            col_map["num"] = t;  continue
        if is_number(t) and x >= 340:
            numeric_cells.append((x, t)); continue

        if not is_number(t):
            if FULLNAME_X[0]  <= x < FULLNAME_X[1]:  col_map["fullname"]  = t
            elif FIRSTNAME_X[0] <= x < FIRSTNAME_X[1]: col_map["firstname"] = t
            elif LASTNAME_X[0]  <= x < LASTNAME_X[1]:  col_map["lastname"]  = t
            elif SHIRT_X[0]     <= x < SHIRT_X[1]:     col_map["shirt"]     = t

    numeric_cells.sort(key=lambda c: c[0])
    for x, t in numeric_cells:
        v = int(t)
        if "height" not in col_map and 150 <= v <= 225:
            col_map["height"] = t
        elif "caps" not in col_map:
            col_map["caps"] = t
        elif "goals" not in col_map:
            col_map["goals"] = t

    return col_map

def parse_squads(path):
    rows = defaultdict(list)
    for pg, y0, x0, text in boxes_from_pdf(path):
        rows[(pg, round(y0 / 1.5) * 1.5)].append((x0, text))

    sorted_keys = sorted(rows.keys(), key=lambda k: (k[0], -k[1]))
    players, current_team, current_team_code = [], None, None

    for key in sorted_keys:
        cells = sorted(rows[key])
        texts = [t for _, t in cells]

        # Skip column header row
        if "POS" in texts and "CLUB" in texts:
            continue

        # Team header: 1–3 cells, one matching "Team (CODE)"
        if len(cells) <= 3:
            for _, text in cells:
                r = parse_team_header(text)
                if r:
                    current_team, current_team_code = r
                    break
            continue

        col_map = classify_row_cells(cells)
        pos = col_map.get("pos", "").strip()
        if not is_position(pos):
            continue
        # Require at least a DOB or a club to be a genuine player row
        if not col_map.get("dob") and not col_map.get("club"):
            continue

        num_raw   = col_map.get("num", "")
        club_raw  = col_map.get("club", "")
        club, club_cc, club_country = parse_club_field(club_raw)

        players.append({
            "nationalTeam":     current_team,
            "nationalTeamCode": current_team_code,
            "jersey":           int(num_raw) if is_number(num_raw) else None,
            "position":         pos,
            "playerName":       col_map.get("fullname",  "").strip(),
            "firstName":        col_map.get("firstname", "").strip(),
            "lastName":         col_map.get("lastname",  "").strip(),
            "shirtName":        col_map.get("shirt",     "").strip(),
            "dob":              col_map.get("dob",       "").strip(),
            "club":             club,
            "clubCountryCode":  club_cc,
            "clubCountry":      club_country,
            "height": int(col_map["height"]) if is_number(col_map.get("height","")) else None,
            "caps":   int(col_map["caps"])   if is_number(col_map.get("caps",""))   else None,
            "goals":  int(col_map["goals"])  if is_number(col_map.get("goals",""))  else None,
        })
    return players

if __name__ == "__main__":
    print(f"Parsing {PDF_PATH}...", file=sys.stderr)
    players = parse_squads(PDF_PATH)
    print(f"Extracted {len(players)} player records.", file=sys.stderr)

    from collections import Counter
    teams = sorted(set(p["nationalTeam"] for p in players if p["nationalTeam"]))
    print(f"Teams ({len(teams)}): {', '.join(teams[:10])}...", file=sys.stderr)
    squad_sizes = Counter(Counter(p["nationalTeam"] for p in players).values())
    print(f"Squad size distribution: {dict(squad_sizes)}", file=sys.stderr)
    missing = sum(1 for p in players if not p.get("clubCountry"))
    print(f"Missing club country: {missing}", file=sys.stderr)

    club_cc = Counter(p["clubCountry"] for p in players if p["clubCountry"])
    print(f"Top club countries: {club_cc.most_common(10)}", file=sys.stderr)

    with open(OUTPUT, "w", encoding="utf-8") as f:
        json.dump(players, f, ensure_ascii=False, indent=2)
    print(f"Saved to {OUTPUT}", file=sys.stderr)
