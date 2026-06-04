const fs = require('fs');

let main = fs.readFileSync('src/main.ts', 'utf8');
main = main.replace(
  /state\.netWorthHistory\.push\(\{\s*date:\s*today,\s*netWorth:\s*nw\.netWorth,\s*invested,\s*liquid\s*\}\);/g,
  'state.netWorthHistory.push({ date: today, value: nw.netWorth });'
);
fs.writeFileSync('src/main.ts', main);

let nwHistory = fs.readFileSync('src/modules/plan/net-worth-history.ts', 'utf8');
nwHistory = nwHistory.replace(/d\.netWorth/g, 'd.value');
fs.writeFileSync('src/modules/plan/net-worth-history.ts', nwHistory);

let planIdx = fs.readFileSync('src/modules/plan/index.ts', 'utf8');
planIdx = planIdx.replace(
  /D\.completedActions\[id\]\s*=\s*\{\s*id,\s*completedAt:\s*new Date\(\)\.toISOString\(\)\s*\};/g,
  'D.completedActions[id] = { completedAt: new Date().toISOString() };'
);
fs.writeFileSync('src/modules/plan/index.ts', planIdx);

let actionEngine = fs.readFileSync('src/modules/plan/action-engine.ts', 'utf8');
actionEngine = actionEngine.replace(/calculatePortfolioDrift/g, 'calculateAllocationDrift');
actionEngine = actionEngine.replace(
  /\/\/ 8\. FD maturity within 30 days[\s\S]*?\/\/ 10\. Check Insurance Coverage/g,
  '// 10. Check Insurance Coverage'
);
fs.writeFileSync('src/modules/plan/action-engine.ts', actionEngine);
