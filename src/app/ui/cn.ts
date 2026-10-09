/**
 * Join class names, dropping falsy values.
 *
 * Deliberately not `clsx`/`tailwind-merge`: the kit composes a fixed set of
 * internal variant maps, so later classes are never meant to override earlier
 * ones the way `tailwind-merge` would allow. Adding a dependency here would buy
 * nothing the kit actually uses.
 */
export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ');
}
