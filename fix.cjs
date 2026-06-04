const fs = require('fs');
const files = [
  'src/modules/insurance/index.ts',
  'src/modules/plan/action-engine.ts',
  'src/modules/plan/cashflow-summary.ts',
  'src/modules/plan/health-status.ts',
  'src/modules/plan/index.ts',
  'src/modules/plan/milestones.ts',
  'src/modules/plan/net-worth-history.ts',
  'src/modules/plan/plain-english.ts'
];
for (const file of files) {
  let content = fs.readFileSync(file, 'utf8');
  content = content.replace(/\\`/g, '`').replace(/\\\$\{/g, '${');
  fs.writeFileSync(file, content);
}
