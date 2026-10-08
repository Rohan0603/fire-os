/**
 * Route inventory. Single source of truth for the paths, the DOM ids the existing
 * Playwright specs assert on, and the per-route copy used for document metadata.
 *
 * `id` is the pre-existing feature id from `src/main.ts`, reused verbatim as the
 * route container's DOM id. Renaming one breaks `portfolio.spec.ts`, which locates
 * `#profile`, `#dashboard`, `#calculators`, `#insurance`, `#plan`, `#esop` and
 * `#assistant`.
 */
export interface RouteMeta {
  path: string;
  /** Extra paths that resolve to the same route without redirecting. */
  aliases?: string[];
  id: string;
  title: string;
  description: string;
}

export const ROUTE_META: RouteMeta[] = [
  {
    path: '/',
    // The legacy app resolved both `/` and `/profile` to the profile tab, and
    // `e2e/portfolio.spec.ts` navigates to `/profile` and expects the URL to stay.
    aliases: ['/profile'],
    id: 'profile',
    title: 'Profile — FIRE OS',
    description: 'Set up your portfolio profile, financial independence target and income details.',
  },
  {
    path: '/dashboard',
    id: 'dashboard',
    title: 'Dashboard — FIRE OS',
    description: 'Net worth, asset allocation, SIP tracking and market performance over time.',
  },
  {
    path: '/calculators',
    id: 'calculators',
    title: 'Calculators — FIRE OS',
    description: 'Financial independence projection, SWP scheduling, portfolio rebalancing and tax planning.',
  },
  {
    path: '/insurance',
    id: 'insurance',
    title: 'Insurance — FIRE OS',
    description: 'Assess life and health cover adequacy for you and your family.',
  },
  {
    path: '/plan',
    id: 'plan',
    title: 'Plan — FIRE OS',
    description: 'Retirement milestones, monthly cashflow and overall plan health.',
  },
  {
    path: '/esop',
    id: 'esop',
    title: 'ESOP — FIRE OS',
    description: 'Employee stock option vesting, exercise cost and liquidity planning.',
  },
  {
    path: '/assistant',
    id: 'assistant',
    title: 'Assistant — FIRE OS',
    description: 'Ask questions about your FIRE plan and portfolio.',
  },
];

const DEFAULT_ROUTE = ROUTE_META[0];

/** Route for a pathname. Trailing slashes are ignored; unknown paths fall back to `/`. */
export function metaForPath(pathname: string): RouteMeta {
  const normalised = pathname.replace(/\/+$/, '') || '/';
  return (
    ROUTE_META.find((meta) => meta.path === normalised || meta.aliases?.includes(normalised)) ??
    DEFAULT_ROUTE
  );
}
