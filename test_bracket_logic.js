const m = {
  "IdMatch": "400021530",
  "MatchNumber": 90,
  "PlaceHolderA": "W73",
  "PlaceHolderB": "W75",
  "HomeTeamScore": null,
  "AwayTeamScore": null,
  "HomeTeamPenaltyScore": null,
  "AwayTeamPenaltyScore": null,
  "MatchStatus": 0,
  "ResultType": 1
};
const home = "South Africa";
const away = "Netherlands";

let w = null;
let l = null;
const isCompletedMatch = (match) => {
    const status = Number(match?.MatchStatus);
    const resultType = Number(match?.ResultType);
    return resultType === 1 || status === 0;
};
if (isCompletedMatch(m)) {
    const hs = Number(m.HomeTeamScore); const as = Number(m.AwayTeamScore);
    if (hs > as) { w = home; l = away; }
    else if (as > hs) { w = away; l = home; }
    else {
        if (Number(m.HomeTeamPenaltyScore) > Number(m.AwayTeamPenaltyScore)) { w = home; l = away; }
        else { w = away; l = home; }
    }
}
console.log("w:", w);
