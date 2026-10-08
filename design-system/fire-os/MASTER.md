# Design System Master File

> **LOGIC:** When building a specific page, first check `design-system/pages/[page-name].md`.
> If that file exists, its rules **override** this Master file.
> If not, strictly follow the rules below.

---

**Project:** FIRE OS
**Generated:** 2026-10-09 00:46:58
**Category:** Personal Finance Tracker
**Design Dials:** Variance 3/10 (Centered / Minimal) | Motion 2/10 (Subtle) | Density 9/10 (Dense / Dashboard)

---

## ⚠️ FIRE OS OVERRIDES — read before using anything below

The generated sections **Pattern**, **Color Strategy**, and **Motion** describe a
*marketing landing page*. FIRE OS is an authenticated application shell with no
hero, no CTA, no video, and no comparison table. Those sections are **discarded**.
The **Style**, **Typography**, **Spacing**, **Shadow**, **Anti-patterns** and
**Pre-Delivery Checklist** sections are adopted as written.

### O1 — Pattern discarded

"Product Demo + Features" with Hero → video → CTA → comparison does not apply.
Route shells are: app header, sidebar, content pane. Do not reintroduce hero
sections, marketing CTAs, or feature grids.

### O2 — Color Strategy discarded

"Video surround: brand color overlay" is meaningless for a dashboard. Colour
strategy is: primary for interactive affordances, green strictly for positive
financial deltas, amber strictly for warnings, red strictly for destructive.

### O3 — Motion: micro-transitions only, no scroll-reveal

GSAP ScrollTrigger scroll-reveals are **rejected**. Scroll-revealed KPI figures
delay the number the user came to read and fight dense tabular layout. GSAP is
not a project dependency.

Allowed motion, and nothing else:
- Hover / focus transitions, 150–300ms.
- State changes (drawer open, dialog open, row expand).
- Chart draw-in, disabled under `prefers-reduced-motion: reduce`.

### O4 — Light-mode palette derived (the generator only defines the dark half)

FIRE OS is **light-default** with a dark override following the system preference.
The generated table above is dark-only, so the light half is derived from the same
hues:

| Role | Light | Dark (generated) |
|------|-------|------------------|
| `--color-background` | `#F5F7FA` | `#0F172A` |
| `--color-card` | `#FFFFFF` | `#192134` |
| `--color-foreground` | `#0F172A` | `#FFFFFF` |
| `--color-muted-foreground` | `#64748B` | `#94A3B8` |
| `--color-border` | `rgba(15,23,42,0.10)` | `rgba(255,255,255,0.08)` |
| `--color-primary` | `#1E40AF` | `#3B82F6` |
| `--color-accent` | `#047857` | `#059669` |
| `--color-ring` | `#1E40AF` | `#FFFFFF` |

**"Avoid pure white backgrounds" interpretation:** the *page* background is tinted
(`#F5F7FA`); cards may be `#FFFFFF` and carry a 1px border. A pure-white page is
what the anti-pattern targets.

### O5 — Two defects in the generated Component Specs

Both contradict the generated checklist; fixed here.

1. `.btn-primary` below uses `#059669`, but the palette defines Primary as
   `#1E40AF`. Use `#1E40AF` in light mode, `#3B82F6` in dark.
2. `color: white` on `#059669` is ~3.1:1 and **fails** the checklist's own
   "light mode: text contrast 4.5:1 minimum". Use `#047857` as the accent
   background whenever the foreground is light.

### O6 — Chart constraints (from the skill's chart domain)

- Recharts renders **SVG**. The skill's threshold is **<1000 points**; beyond that
  switch to Canvas or downsample. `buildSnapshotSeries` / `buildBenchmarkSeries`
  **must downsample to <1000 points** or long-lived accounts regress.
- **Never distinguish series by hue alone.** Multi-series charts (benchmark vs
  portfolio) use solid / dashed / dotted line styles plus direct series labels.
- Every chart needs an **accessible fallback**: a visible data table or concise
  trend summary. Canvas `aria-label` alone does not satisfy this.
- `<1000 pts` also applies to `marketHistory` and `netWorthHistory` on screen.

### O7 — Typography

IBM Plex Sans for UI. **Keep a monospace face for IDs, scheme codes and tabular
figures** — financial tables must align digits.

---

## Global Rules

### Color Palette

| Role | Hex | CSS Variable |
|------|-----|--------------|
| Primary | `#1E40AF` | `--color-primary` |
| On Primary | `#FFFFFF` | `--color-on-primary` |
| Secondary | `#3B82F6` | `--color-secondary` |
| On Secondary | `#000000` | `--color-on-secondary` |
| Accent/CTA | `#059669` | `--color-accent` |
| On Accent/CTA | `#000000` | `--color-on-accent` |
| Background | `#0F172A` | `--color-background` |
| Foreground | `#FFFFFF` | `--color-foreground` |
| Card | `#192134` | `--color-card` |
| Card Foreground | `#FFFFFF` | `--color-card-foreground` |
| Muted | `#101A34` | `--color-muted` |
| Muted Foreground | `#94A3B8` | `--color-muted-foreground` |
| Border | `rgba(255,255,255,0.08)` | `--color-border` |
| Destructive | `#DC2626` | `--color-destructive` |
| On Destructive | `#FFFFFF` | `--color-on-destructive` |
| Ring | `#FFFFFF` | `--color-ring` |

**Color Notes:** Trust blue + profit green on dark

### Typography

- **Heading Font:** IBM Plex Sans
- **Body Font:** IBM Plex Sans
- **Mood:** financial, trustworthy, professional, corporate, banking, serious
- **Google Fonts:** [IBM Plex Sans + IBM Plex Sans](https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@300;400;500;600;700&display=swap)

**CSS Import:**
```css
@import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@300;400;500;600;700&display=swap');
```

### Spacing Variables

*Density: 9/10 — Dense / Dashboard*

| Token | Value | Usage |
|-------|-------|-------|
| `--space-xs` | `2px` / `0.125rem` | Tight gaps |
| `--space-sm` | `4px` / `0.25rem` | Icon gaps, inline spacing |
| `--space-md` | `8px` / `0.5rem` | Standard padding |
| `--space-lg` | `12px` / `0.75rem` | Section padding |
| `--space-xl` | `16px` / `1rem` | Large gaps |
| `--space-2xl` | `24px` / `1.5rem` | Section margins |
| `--space-3xl` | `32px` / `2rem` | Hero padding |

### Shadow Depths

| Level | Value | Usage |
|-------|-------|-------|
| `--shadow-sm` | `0 1px 2px rgba(0,0,0,0.05)` | Subtle lift |
| `--shadow-md` | `0 4px 6px rgba(0,0,0,0.1)` | Cards, buttons |
| `--shadow-lg` | `0 10px 15px rgba(0,0,0,0.1)` | Modals, dropdowns |
| `--shadow-xl` | `0 20px 25px rgba(0,0,0,0.15)` | Hero images, featured cards |

---

## Component Specs

### Buttons

```css
/* Primary Button */
.btn-primary {
  background: #059669;
  color: white;
  padding: 12px 24px;
  border-radius: 8px;
  font-weight: 600;
  transition: all 200ms ease;
  cursor: pointer;
}

.btn-primary:hover {
  opacity: 0.9;
  transform: translateY(-1px);
}

/* Secondary Button */
.btn-secondary {
  background: transparent;
  color: #1E40AF;
  border: 2px solid #1E40AF;
  padding: 12px 24px;
  border-radius: 8px;
  font-weight: 600;
  transition: all 200ms ease;
  cursor: pointer;
}
```

### Cards

```css
.card {
  background: #0F172A;
  border-radius: 12px;
  padding: 24px;
  box-shadow: var(--shadow-md);
  transition: all 200ms ease;
  cursor: pointer;
}

.card:hover {
  box-shadow: var(--shadow-lg);
  transform: translateY(-2px);
}
```

### Inputs

```css
.input {
  padding: 12px 16px;
  border: 1px solid #E2E8F0;
  border-radius: 8px;
  font-size: 16px;
  transition: border-color 200ms ease;
}

.input:focus {
  border-color: #1E40AF;
  outline: none;
  box-shadow: 0 0 0 3px #1E40AF20;
}
```

### Modals

```css
.modal-overlay {
  background: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(4px);
}

.modal {
  background: white;
  border-radius: 16px;
  padding: 32px;
  box-shadow: var(--shadow-xl);
  max-width: 500px;
  width: 90%;
}
```

---

## Style Guidelines

**Style:** Minimalism & Swiss Style

**Keywords:** Clean, simple, spacious, functional, white space, high contrast, geometric, sans-serif, grid-based, essential

**Best For:** Enterprise apps, dashboards, documentation sites, SaaS platforms, professional tools

**Key Effects:** Subtle hover (200-250ms), smooth transitions, sharp shadows if any, clear type hierarchy, fast loading

### Page Pattern

**Pattern Name:** Product Demo + Features

- **Conversion Strategy:** Use an interactive demo only when it explains value better than static media. Provide captions, transcript, visible play/pause controls, and a non-video fallback; do not autoplay under reduced motion. Pause media when offscreen or hidden and keep the final product state available as static content.
- **CTA Placement:** Video center + CTA right/bottom
- **Section Order:** Hero > Product video/mockup (center) > Feature breakdown per section > Comparison (optional) > CTA

---

## Motion

**Scroll Reveal** (Subtle) — Trigger: scroll (viewport enter) | Duration: 300-400ms | Easing: `power1.out`

```js
gsap.from(el, { opacity: 0, y: 12, duration: 0.35, ease: 'power1.out', scrollTrigger: { trigger: el, start: 'top 90%', toggleActions: 'play none none reverse' } });
```

**Framework notes:** Requires the ScrollTrigger plugin registered once via gsap.registerPlugin(ScrollTrigger); Use matchMedia('(prefers-reduced-motion: reduce)') to skip non-essential motion and render the final state immediately

- ✅ Keep the y offset small (8-16px) so it reads as a fade, not a slide
- ❌ Don't reveal below-the-fold content needed for SEO/crawlers as invisible-by-default without a no-JS fallback
- ⚡ toggleActions 'play none none reverse' avoids re-triggering on every scroll direction change

---

## Anti-Patterns (Do NOT Use)

- ❌ Pure white backgrounds

### Additional Forbidden Patterns

- ❌ **Emojis as icons** — Use SVG icons (Heroicons, Lucide, Simple Icons)
- ❌ **Missing cursor:pointer** — All clickable elements must have cursor:pointer
- ❌ **Layout-shifting hovers** — Avoid scale transforms that shift layout
- ❌ **Low contrast text** — Maintain 4.5:1 minimum contrast ratio
- ❌ **Instant state changes** — Always use transitions (150-300ms)
- ❌ **Invisible focus states** — Focus states must be visible for a11y

---

## Pre-Delivery Checklist

Before delivering any UI code, verify:

- [ ] No emojis used as icons (use SVG instead)
- [ ] All icons from consistent icon set (Heroicons/Lucide)
- [ ] `cursor-pointer` on all clickable elements
- [ ] Hover states with smooth transitions (150-300ms)
- [ ] Light mode: text contrast 4.5:1 minimum
- [ ] Focus states visible for keyboard navigation
- [ ] `prefers-reduced-motion` respected
- [ ] Responsive: 375px, 768px, 1024px, 1440px
- [ ] No content hidden behind fixed navbars
- [ ] No horizontal scroll on mobile
