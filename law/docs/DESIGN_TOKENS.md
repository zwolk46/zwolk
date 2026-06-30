# Law Hub — Design Tokens (concrete values)

> Single source of truth for the visible system. The Vite app's `src/index.css` is generated
> from these values (OKLCH primaries with hex column for human reference). Personality:
> **authoritative, calm, premium** — monochrome base with quiet status colors. Dark is the
> default theme; light must also be correct.

## Theme philosophy

- **Monochrome base.** No indigo, no decorative accent. The `--primary` token is the
  foreground itself (black on light, white on dark) — used sparingly for primary buttons,
  focus rings, active states.
- **Status colors are the only non-neutral colors.** Quiet, saturated semantic tokens
  (success / warning / danger) for genuine state — `repealed`, `coverage gap`, etc.
- **One radius:** `0.5rem` base. Not sharp-0, not pill-everywhere.
- **Restrained motion.** Token-driven; honors `prefers-reduced-motion`.
- **Real reading typography.** Workhorse text serif (Source Serif 4) for long legal
  passages; display serif (Playfair Display) for big headings only.
- **Dark is the default theme.** No-flash boot script.

## Color tokens (OKLCH — source of truth; hex for human reference)

### Dark theme (default)

| Token | OKLCH | Hex (approx) | Use |
|---|---|---|---|
| `--background` | `oklch(0 0 0)` | `#000000` | app background |
| `--foreground` | `oklch(1 0 0)` | `#FFFFFF` | primary text |
| `--card` | `oklch(0.1400 0 0)` | `#242424` | panels, surfaces |
| `--card-foreground` | `oklch(1 0 0)` | `#FFFFFF` | text on card |
| `--popover` | `oklch(0.1800 0 0)` | `#2E2E2E` | menus, dialogs |
| `--popover-foreground` | `oklch(1 0 0)` | `#FFFFFF` | text on popover |
| `--primary` | `oklch(1 0 0)` | `#FFFFFF` | primary buttons / accent fills (monochrome) |
| `--primary-foreground` | `oklch(0 0 0)` | `#000000` | text on primary |
| `--secondary` | `oklch(0.2500 0 0)` | `#404040` | secondary surfaces |
| `--secondary-foreground` | `oklch(1 0 0)` | `#FFFFFF` | text on secondary |
| `--muted` | `oklch(0.2300 0 0)` | `#3B3B3B` | subtle fills |
| `--muted-foreground` | `oklch(0.7200 0 0)` | `#B8B8B8` | secondary text |
| `--accent` | `oklch(0.3200 0 0)` | `#535353` | hover/active row bg |
| `--accent-foreground` | `oklch(1 0 0)` | `#FFFFFF` | text on accent |
| `--border` | `oklch(0.2600 0 0)` | `#424242` | hairlines |
| `--input` | `oklch(0.3200 0 0)` | `#535353` | input borders |
| `--ring` | `oklch(0.7200 0 0)` | `#B8B8B8` | focus ring |
| `--destructive` | `oklch(0.6900 0.2000 23.91)` | `#E5635F` | destructive button bg |
| `--destructive-foreground` | `oklch(0 0 0)` | `#000000` | text on destructive |
| `--success` | `oklch(0.7300 0.1500 156)` | `#3FB984` | success status text |
| `--success-quiet` | `oklch(0.2400 0.0500 156)` | `#11271F` | success status bg |
| `--warning` | `oklch(0.7400 0.1500 70)` | `#E0A23B` | warning status text |
| `--warning-quiet` | `oklch(0.2400 0.0400 60)` | `#2A2113` | warning status bg |
| `--danger` | `oklch(0.6800 0.1700 25)` | `#E5635F` | repealed / error text |
| `--danger-quiet` | `oklch(0.2400 0.0700 25)` | `#2A1414` | repealed / error bg |

### Light theme

| Token | OKLCH | Hex (approx) |
|---|---|---|
| `--background` | `oklch(0.9900 0 0)` | `#FBFBFD` |
| `--foreground` | `oklch(0 0 0)` | `#000000` |
| `--card` | `oklch(1 0 0)` | `#FFFFFF` |
| `--popover` | `oklch(0.9900 0 0)` | `#FBFBFD` |
| `--primary` | `oklch(0 0 0)` | `#000000` |
| `--primary-foreground` | `oklch(1 0 0)` | `#FFFFFF` |
| `--secondary` | `oklch(0.9400 0 0)` | `#EFEFEF` |
| `--muted` | `oklch(0.9700 0 0)` | `#F6F6F6` |
| `--muted-foreground` | `oklch(0.4400 0 0)` | `#707070` |
| `--accent` | `oklch(0.9400 0 0)` | `#EFEFEF` |
| `--border` | `oklch(0.9200 0 0)` | `#EAEAEA` |
| `--input` | `oklch(0.9400 0 0)` | `#EFEFEF` |
| `--ring` | `oklch(0 0 0)` | `#000000` |
| `--destructive` | `oklch(0.6300 0.1900 23.03)` | `#D1453F` |
| `--success` | `oklch(0.5800 0.1300 156)` | `#1E8E62` |
| `--warning` | `oklch(0.6400 0.1300 70)` | `#B57A1C` |
| `--danger` | `oklch(0.5800 0.2000 25)` | `#C7423E` |
| `--*-quiet` | very light, low-chroma tints | — |

### Sidebar tokens

Eight `--sidebar-*` tokens (background, foreground, primary, primary-foreground, accent,
accent-foreground, border, ring) mirror the surface tokens above. Use them only inside the
left jurisdiction navigation; they exist so the sidebar can be themed independently of the
content area without forking the rest of the palette.

### Chart tokens

Five `--chart-*` tokens, reserved for the coverage dashboard. `--chart-1` is the only
saturated chart color in the dark theme (a gold, `oklch(0.81 0.17 75)`); the rest are
neutrals + a single blue (`--chart-2`). Not used by core screens.

## Status → token mapping (the only place badges appear)

One badge per object. Quiet.

| Status | Token | Notes |
|---|---|---|
| `active` | (no badge usually) | neutral text |
| `repealed` | `bg-danger-quiet` + `text-danger` | repealed sections |
| `reserved` | `bg-muted` + `text-muted-foreground` | reserved sections |
| `statute` / `regulation` / `ordinance` | neutral outline | law type — one per object |
| coverage `ingested` | `bg-success-quiet` + `text-success` | corpus is in our store |
| coverage `available` | neutral outline | source exists, not yet ingested |
| coverage `gap` | `bg-warning-quiet` + `text-warning` | no digital source found |

## Typography

| Slot | Family | Source package | Use |
|---|---|---|---|
| `--font-sans` | Plus Jakarta Sans (Variable) | `@fontsource-variable/plus-jakarta-sans` | All UI chrome |
| `--font-serif` | Source Serif 4 (Variable) | `@fontsource-variable/source-serif-4` | **Long-form legal reading body** (~18px / 1.65 line-height / 68–78ch measure) |
| `--font-display` | Playfair Display (Variable) | `@fontsource-variable/playfair-display` | **Big display headings only** — hero, jurisdiction-landing titles. Never body. |
| `--font-mono` | Geist Mono (Variable) | `@fontsource-variable/geist-mono` | Citations, § numbers, dates (`tabular-nums`) |

**Why two serifs.** Playfair Display is a high-contrast display face — beautiful at 48px+,
brittle at body sizes. Source Serif 4 is a workhorse text serif designed by Adobe
specifically for sustained on-screen reading. Pair them so headings get personality and body
stays readable. The pairing is enforced via `--font-display` vs `--font-serif`; do not use
`font-display` on long passages.

### Type scale (rem)

| Step | Size | Notes |
|---|---|---|
| display | 2.5 | `--font-display`, weight 600 |
| h1 | 2.0 | `--font-sans`, weight 600 |
| h2 | 1.5 | `--font-sans`, weight 600 |
| h3 | 1.25 | `--font-sans`, weight 500 |
| reading-body | 1.125 | `--font-serif`, weight 400, line-height 1.65, measure 68–78ch |
| body | 1.0 | `--font-sans`, weight 400 |
| small | 0.875 | |
| caption | 0.8 | |
| mono | 0.875 | `--font-mono`, `tabular-nums` |

## Radius, spacing, elevation

- `--radius`: `0.5rem` (8px) base. `--radius-sm` (4px) / `--radius-md` (6px) / `--radius-lg`
  (8px) / `--radius-xl` (12px) derived.
- Spacing: Tailwind 4px scale (default).
- Elevation: tweakcn shadow scale (`--shadow-2xs` through `--shadow-2xl`) used **only** on
  popover / dialog / menu / dropdown. **Never on cards or rows.**

## Motion tokens

| Token | Value | Use |
|---|---|---|
| `--dur-1` | 120ms | hover / press feedback |
| `--dur-2` | 200ms | most enter / exit |
| `--dur-3` | 320ms | drawer / page transition |
| `--dur-slow` | 480ms | rare, large |
| `--ease-standard` | `cubic-bezier(.2,0,0,1)` | default |
| `--ease-out` | `cubic-bezier(0,0,0,1)` | enter |
| `--ease-in` | `cubic-bezier(.4,0,1,1)` | exit |

**Reduced motion.** `@media (prefers-reduced-motion: reduce)` in `index.css` zeroes all
durations and transition times. The React tree is wrapped in
`<MotionConfig reducedMotion="user">` so Framer Motion entrances honor the same OS setting.

## Theme switching

- Default = **dark**. `.dark` class lives on `<html>`.
- No-flash inline script in `index.html` reads `localStorage.lawHubTheme` (or defaults to
  dark) and sets the class **before** React mounts.
- `src/lib/theme.ts` exposes `getTheme()` / `setTheme()` / `toggleTheme()` — flips the
  class and persists the choice. `<ThemeToggle />` (Phosphor Sun/Moon) is the UI affordance.

## Component primitives

- **shadcn/ui** `new-york` style over Radix primitives. Base color `neutral`. CSS variables
  on. `components.json` lives at `law/app/components.json`.
- **Icons:** `@phosphor-icons/react`, `regular` weight, sized 16 / 20 / 24px. **Never
  Lucide; never bare `<svg>` shapes.** When a shadcn component installs with Lucide imports,
  swap them at install time (see the swap table below).
- **Motion:** `motion` package (Framer Motion successor). Use `<MotionConfig>` at the root.
- **Tailwind:** v4 via `@tailwindcss/vite`. No `postcss.config`; no `tailwind.config.js`.
  All tokens live in `src/index.css` via `@theme inline { … }`.

### Lucide → Phosphor swap table

Used when `npx shadcn@latest add <component>` produces a file with Lucide imports.

| Lucide | Phosphor |
|---|---|
| `ChevronDown` / `Up` / `Left` / `Right` | `CaretDown` / `Up` / `Left` / `Right` |
| `Check` / `X` | `Check` / `X` |
| `Search` | `MagnifyingGlass` |
| `Loader2` | `CircleNotch` (spin via `animate-spin`) |
| `MoreHorizontal` | `DotsThree` |
| `Sun` / `Moon` | `Sun` / `Moon` |
