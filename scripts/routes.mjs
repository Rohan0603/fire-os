export const routes = [
  {
    route: '',
    title: 'FIRE OS — Financial Independence Dashboard',
    description: 'Local-first financial independence planning for Indian investors.',
    heading: 'FIRE OS Financial Independence Dashboard',
    details: [],
  },
  {
    route: 'profile',
    title: 'Profile | FIRE OS',
    description:
      'Set up a financial profile, import portfolio statements, and manage holdings for FIRE planning.',
    heading: 'Portfolio Profile',
    details: [
      'Personal financial assumptions',
      'Mutual fund, SIP, FD, EPF, bond, ESOP, and demat holdings',
      'Local-first portfolio data with optional sign-in for cloud sync',
    ],
  },
  {
    route: 'dashboard',
    title: 'Dashboard | FIRE OS',
    description:
      'Review net worth, portfolio breakdown, SIP status, milestones, and market risk indicators.',
    heading: 'Financial Independence Dashboard',
    details: [
      'Net worth and asset allocation',
      'SIP and portfolio performance',
      'Crash protocol and milestone tracking',
    ],
  },
  {
    route: 'calculators',
    title: 'Calculators | FIRE OS',
    description:
      'Model retirement, SIP, withdrawal, tax, emergency runway, insurance, and market scenarios.',
    heading: 'Financial Calculators',
    details: [
      'Retirement and corpus projections',
      'SIP, SWP, and scenario modeling',
      'Tax, insurance, emergency runway, and rebalancing tools',
    ],
  },
  {
    route: 'insurance',
    title: 'Insurance | FIRE OS',
    description:
      'Estimate life and health insurance needs from income, expenses, liabilities, and dependents.',
    heading: 'Insurance Planner',
    details: [
      'Coverage requirement estimates',
      'Income replacement planning',
      'Expense and liability assumptions',
    ],
  },
  {
    route: 'plan',
    title: 'Plan | FIRE OS',
    description:
      'Turn FIRE goals into plain-English actions, milestones, health status, and net-worth history.',
    heading: 'FIRE Plan',
    details: [
      'Financial health status',
      'Action recommendations and milestones',
      'Net-worth history and cash-flow summaries',
    ],
  },
  {
    route: 'esop',
    title: 'ESOP Tools | FIRE OS',
    description:
      'Model employee stock option value, exercise scenarios, currency conversion, and tax planning.',
    heading: 'ESOP Tools',
    details: [
      'Generic employee stock option projections',
      'Exercise and value scenarios',
      'Currency conversion and tax planning inputs',
    ],
  },
  {
    route: 'assistant',
    title: 'Assistant | FIRE OS',
    description:
      'Ask an opt-in portfolio assistant for read-only FIRE insights. Sharing is consent-driven and read-only by default.',
    heading: 'FIRE OS Assistant',
    details: [
      'Read-only portfolio Q&A with explicit opt-in consent',
      'Sanitized context: ranges only, no personal identifiers',
      'Suggested changes require confirmation before anything is saved',
    ],
  },
];
