import { NavLink } from 'react-router-dom';
import { ROUTE_META } from '../routes/route-meta';

/** Visible label for a route: the part of the title before the em dash. */
function labelFor(title: string): string {
  return title.split('—')[0].trim();
}

/**
 * Primary navigation.
 *
 * `NavLink` supplies `aria-current="page"` for the active route. The accessible
 * names are exactly Profile, Dashboard, Calculators, Insurance, Plan, ESOP and
 * Assistant: `e2e/portfolio.spec.ts` locates several of them by role+name.
 */
export function Sidebar() {
  return (
    <nav aria-label="Primary" className="flex flex-col gap-1 p-3">
      {ROUTE_META.map((meta) => (
        <NavLink
          key={meta.id}
          to={meta.path}
          className={({ isActive }) =>
            [
              'block rounded-md px-3 py-2 text-sm font-medium no-underline transition-colors',
              'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[--color-secondary]',
              isActive
                ? 'bg-[--color-surface-raised] text-[--color-primary]'
                : 'text-[--color-muted-foreground] hover:bg-[--color-surface-raised] hover:text-[--color-foreground]',
            ].join(' ')
          }
        >
          {labelFor(meta.title)}
        </NavLink>
      ))}
    </nav>
  );
}
