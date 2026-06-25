const fs = require('fs');
let c = fs.readFileSync('index.html', 'utf8');

c = c.replace(/      appendVisibleSection\(spreadNode, finalsPageNode\);\n      appendVisibleSection\(spreadNode, specialInterestPageNode\);/g, 
`      appendVisibleSection(spreadNode, finalsPageNode);
      appendVisibleSection(spreadNode, bracketPageNode);
      appendVisibleSection(spreadNode, specialInterestPageNode);`);

c = c.replace(/      const teamStrength = new Map\(state\.winnerOdds \? state\.winnerOdds\.map\(\(o, idx\) => \[o\.canonical, o\.price \|\| 1000 \+ idx\]\) : \[\]\);\n      const getStrength = \(name\) => teamStrength\.get\(canonicalTeamName\(name\)\) \|\| 2000;/,
`      const teamStrength = new Map(state.winnerOdds ? state.winnerOdds.map((o) => [o.canonical, o.price || 5000]) : []);
      // Provide an ordered list of fallback teams, ensuring stronger teams have lower rank indices.
      const fallbackArr = [...(typeof fallbackContenderTeams !== 'undefined' ? fallbackContenderTeams : [])].map(canonicalTeamName);
      
      const getStrength = (name) => {
          const canon = canonicalTeamName(name);
          if (teamStrength.has(canon)) return teamStrength.get(canon);
          const fbRank = fallbackArr.indexOf(canon);
          if (fbRank >= 0) return 1000 + fbRank;
          return 2000;
      };`);

c = c.replace(
/          const matchesHTML = nums\.map\(n => \{\n              const b = bracketMatches\.get\(n\);\n              if \(!b\) return '';\n              const hw = !!b\.w && b\.w === b\.home;\n              const aw = !!b\.w && b\.w === b\.away;\n              return \`\n                <div class="bracket-match">\n                   \$\{renderTeam\(b\.home, b\.homePred, hw\)\}\n                   \$\{renderTeam\(b\.away, b\.awayPred, aw\)\}\n                <\/div>\n              \`;/,
`          const matchesHTML = nums.map(n => {
              const b = bracketMatches.get(n);
              if (!b) return '';
              const hw = !!b.w && b.w === b.home;
              const aw = !!b.w && b.w === b.away;
              
              let labelHTML = '';
              if (n === 104) labelHTML = '<div style="font-size:0.65rem;text-align:center;color:var(--muted);text-transform:uppercase;letter-spacing:0.05em;margin-bottom:2px;">Final</div>';
              if (n === 103) labelHTML = '<div style="font-size:0.65rem;text-align:center;color:var(--muted);text-transform:uppercase;letter-spacing:0.05em;margin-bottom:2px;margin-top:10px;">3rd Place</div>';
              
              return \`
                <div style="display:flex;flex-direction:column;">
                  \${labelHTML}
                  <div class="bracket-match">
                     \${renderTeam(b.home, b.homePred, hw)}
                     \${renderTeam(b.away, b.awayPred, aw)}
                  </div>
                </div>
              \`;`
);

fs.writeFileSync('index.html', c);
console.log('Bracket patched.');
