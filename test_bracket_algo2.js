const bracketMatches = new Map();
const matches = [
   { MatchNumber: 76, PlaceHolderA: "1C", PlaceHolderB: "2F", home: "Brazil", away: "Japan" }, // example
   { MatchNumber: 78, PlaceHolderA: "2E", PlaceHolderB: "2I", home: "Mexico", away: "Scotland" },
   { MatchNumber: 91, PlaceHolderA: "W76", PlaceHolderB: "W78", home: null, away: null },
   { MatchNumber: 99, PlaceHolderA: "W91", PlaceHolderB: "W92", home: null, away: null },
];

// Let me replicate the exact issue with South Africa and Netherlands.
// Assume Match 74: home=Germany, Match 77: home=France. Match 89 (W74 vs W77).
// Let's do Match 73 vs Match 75 -> Match 90 (Wait, in API it was Match 90 for 73 vs 75!)
