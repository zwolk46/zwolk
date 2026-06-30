# Law Hub — Professional UI/UX Build Spec

> The detailed, opinionated build spec for the Law Hub front end. It supersedes the
> capability-level `DESIGN_BRIEF.md` (which still describes *what each screen must do*).
> This document adds the **professional design stack, the anti-"AI-generic" rules, the
> information architecture, the motion system, and the full feature set** — everything a
> builder needs to produce a polished, paid-grade product, not a generated-looking mockup.

---

## 0. Read first — who should build this, and how

**Recommendation: build this with Claude *Code*, not Claude *Design*.** Reasoning is in
§13. Short version: every weakness you've seen from Claude Design (invented icons, the same
AI UI dialect, generic hover/press animations, chip-soup, card-for-everything) comes from
*generating UI from scratch*. This spec instead **assembles real, battle-tested pieces** — a
real component library, a real icon set, a real motion library — which structurally prevents
those failure modes. Claude Code can wire those pieces to the real data layer
(`lib/data.js`, `lib/geo.js`), add auth/billing, and deploy. Use Claude Design only for
throwaway visual exploration of a single screen if you want — then implement for real in Code.

**Non-negotiables (the rest of the doc elaborates):**
1. Use the **mandated stack** (§1). Do not hand-roll generic components or invent icons.
2. Obey the **DO/DON'T rules** (§2). They exist specifically to kill the AI-generic look.
3. Use the **design tokens + motion system** (§3, §4). No magic numbers, no ad-hoc animations.
4. Build the **app shell + screens** in §5–§6, wired to the data contract in §9, with the
   states in §8.

---

## 1. The mandated design stack (free, professional, anti-generic)

| Layer | Use this | Why / notes |
|---|---|---|
| **Framework** | **React + TypeScript + Vite** | Matches the repo's `argmap` build precedent; the professional standard; required for the component/motion ecosystem below. (Next.js is acceptable if SSR/SEO is wanted later.) |
| **Styling** | **Tailwind CSS** (with CSS variables for tokens) | Token-driven, themeable (dark default + light), no bespoke CSS sprawl. |
| **Components** | **shadcn/ui** (Radix primitives under the hood) | Real, accessible, widely-used components — *not* an AI dialect. Copy-in, fully ownable/themeable. Dropdowns, dialogs, tooltips, command palette, tabs, tables, etc. come correct + accessible. |
| **Icons** | **Phosphor Icons** (primary) — `@phosphor-icons/react` | Deliberately **not Lucide**: Lucide is now so default-in-every-AI-template that it reads as "AI-generated." Phosphor is professional, has 7,700+ glyphs in multiple weights (use `regular` for UI, `duotone`/`fill` for emphasis), giving a distinctive-but-clean identity. (Tabler is an acceptable alt for a denser, data-heavy feel.) **Never invent an icon or use a bare `<svg>` shape.** Lucide is explicitly **forbidden** in this project — when a shadcn component installs with Lucide imports, swap them to Phosphor at install time (see the swap table in `DESIGN_TOKENS.md`). |
| **Motion** | **Motion (Framer Motion)** + Radix's built-in enter/exit states | The standard for React UI motion: page transitions, list stagger, modal/drawer/popover enter-exit, layout animations, hover/press feedback, scroll-reveal. Drives the motion tokens in §4. |
| **Type** | UI: **Plus Jakarta Sans** (`--font-sans`). Long legal reading: **Source Serif 4** (`--font-serif`, 18px / 1.65 LH / 68–78ch). Display headings only: **Playfair Display** (`--font-display`) — large hero/landing titles, never body. Citations: **Geist Mono** (`--font-mono`, `tabular-nums`). | Legal text is read in long passages — give it real reading typography (measure ~68–78ch, 1.6–1.7 line-height), distinct from UI chrome. Playfair is a display face and fatigues at body size; pair it with Source Serif 4 for the reader. |
| **Charts** (coverage/analytics, later) | **Recharts** or shadcn charts | Only where genuinely needed (coverage dashboard). |
| **Search index** (client) | **MiniSearch** or **Orama** | Fast in-browser search over the section index; swap to server/DB at scale. |

**Resources to hand the builder (all free):**
- shadcn/ui — https://ui.shadcn.com (code) · Figma kit (329k+ users) on Figma Community
- Untitled UI Free Figma Kit (10k+ components, the SaaS reference) — https://www.untitledui.com/free-figma-ui-kit (use for visual exploration / mockups)
- Phosphor Icons — https://phosphoricons.com · Tabler — https://tabler.io/icons
- Motion (Framer Motion) — https://motion.dev
- Design-system completeness checklists — https://www.designsystemchecklist.com · https://www.checklist.design
- (Optional, Code route) Claude Code motion/animation skills — `freshtechbro/claudedesignskills` (Motion, GSAP skills)

---

## 2. The anti-"AI-generic" rules — DO / DON'T (this is the heart of the brief)

These are **hard constraints**. They're what separates a professional product from a
generated one. Leave creative latitude in *aesthetics* (color, exact layout, illustration),
but obey these.

### Icons
- **DO** use Phosphor (or Tabler) for *every* glyph, at consistent size + weight.
- **DON'T** ever invent an icon, draw a custom `<svg>` shape, or use a geometric placeholder
  as if it were an icon. If no good icon exists, use a text label instead.

### Cards
- **DON'T** default to cards. This is the #1 AI tell. Most content is **not** a card.
- **DO** use a card *only* for a discrete, self-contained, individually-actionable object —
  e.g., a saved item in the Library, a jurisdiction tile, a single search result you can act
  on. Reading content, settings, the TOC, lists, tables, the section reader = **not cards**.
- Default to **plain sections, real tables, and lists** with dividers and whitespace (see
  eCFR's TOC and Stripe's content area — almost no cards).

### Chips / tags / badges / pills
- **DON'T** scatter chips. No "pill soup," no decorative tags, no chip for every metadata
  field.
- **DO** allow a small badge **only** for genuine *status*: `active` / `repealed` /
  `reserved`, law type (`statute`/`regulation`/`ordinance`), and coverage status
  (`ingested`/`available`/`gap`). One per object, semantic color, quiet.

### Buttons & interaction feedback
- **DON'T** use bouncy/springy scale-up-on-hover, big shadows-on-hover, or playful pop
  animations. They read as generic/AI.
- **DO** use restrained feedback from the motion tokens (§4): hover = subtle background /
  border / text-color shift (~120ms); press = slight `:active` darken or 0.98 translate, not
  scale-bounce; focus = a clear focus ring (accessibility). Primary buttons solid, secondary
  ghost/outline, tertiary text — one accent color, used sparingly.

### Layout & color
- **DON'T** build the "everything centered in a 3-card grid on a white page" look. Use real
  app chrome (persistent sidebar + content), real density, real navigation.
- **DON'T** rainbow it. One accent color + neutral grays + semantic status colors only.
- **DO** lean on whitespace, type hierarchy, and alignment for polish — not decoration.

### When in doubt
Emulate **Stripe Docs / Linear**: calm, dense-where-it-should-be, generous whitespace,
near-zero chips, cards only for "pick one of these" choices. Avoid eCFR's dated chrome and
OLC's over-sparseness.

---

## 3. Design tokens (define once, in CSS variables; both themes)

**Themes:** `data-theme="dark" | "light"` on `<html>`, dark default, no-flash inline script,
respects `prefers-color-scheme`, user toggle persisted. (Mirror the pattern already in the
`wc` app.)

- **Color** — The accent system is **monochrome** (the `--primary` token is the foreground
  itself — high-contrast on background, used sparingly for primary buttons / focus rings /
  active states). Status colors (`--success`, `--warning`, `--danger`, each with a `-quiet`
  background variant) are quiet, saturated semantic tokens — the **only** non-neutral colors
  in the UI. The full enumeration (surfaces, borders, sidebar, chart, status) and exact
  OKLCH values live in `DESIGN_TOKENS.md`.
- **Type scale** — display, h1–h4, body-lg, body, body-sm, caption, mono (citations,
  section numbers — tabular). Reading body distinct from UI body (§1).
- **Spacing** — 4px base scale (`--sp-1..12`).
- **Radius** — `--r-sm/md/lg/full`; pick one personality (slightly-rounded, ~6–8px, is the
  professional default — avoid both sharp-0 and pill-everywhere).
- **Elevation** — 3–4 shadow tokens, used sparingly (menus, dialogs, popovers) — *not* on
  every card.
- **Motion** — see §4.

---

## 4. Motion system (so animation is professional, not generic)

A UI kit gives static screens; **this** makes it feel alive and intentional. Define and
reuse — never one-off.

**Tokens:**
- Durations: `--dur-1: 120ms` (hover/press feedback), `--dur-2: 200ms` (most enter/exit),
  `--dur-3: 320ms` (drawers, page transitions), `--dur-slow: 480ms` (rare, large).
- Easing: `--ease-standard: cubic-bezier(.2,0,0,1)`; `--ease-out: cubic-bezier(0,0,0,1)`
  (enter); `--ease-in: cubic-bezier(.4,0,1,1)` (exit). No default `ease` / `linear`.
- **Respect `prefers-reduced-motion`** — drop to opacity-only/instant.

**What animates (and how):**
- **Page/route transitions:** quick cross-fade + 4–8px rise (`--dur-3`, `--ease-out`). Subtle.
- **Lists / search results / TOC reveal:** staggered fade-in-up, ~20–30ms stagger, cap the
  count so long lists don't cascade forever.
- **Modal / drawer / popover / dropdown / command palette:** scale-from-98% + fade in
  (`--dur-2`), fade out (`--dur-1`); backdrop fade. Use Radix's `data-state` + Motion.
- **Hover/press feedback:** per §2 — subtle, fast, no bounce.
- **Skeletons:** content-shaped skeletons with a calm shimmer for loading — **not spinners**
  (except tiny inline ones).
- **Scroll-reveal:** only on the marketing/landing hero and the map intro — sparingly. The
  app interior should not animate on scroll.
- **Map interactions:** smooth zoom/pan transitions, hover highlight on regions (`--dur-1`),
  selected-region emphasis.
- **The "crawling/fetching" state:** an indeterminate, calm progress treatment (see §8).

---

## 5. Information architecture & the highest-level layout

### What the user sees first
A **persistent app shell** (not a marketing page). Inside it, the default panel is **Home**:

- **Top bar (always present):** wordmark (left) · **global command-search**, centered, with a
  visible `/` shortcut hint and an **"Ask"** affordance for AI Q&A (future) · right: theme
  toggle, account menu + (future) **Upgrade** button.
- **Left sidebar (always present):** the **jurisdiction browse tree** — grouped (Federal ▸
  U.S. Code, CFR; States ▸ searchable; Your place ▸ saved jurisdictions), collapsible, quiet,
  nested-expand (model on Stripe's sidebar). A search/filter at its top because the list is
  huge.
- **Main canvas:** the active screen (Home, search results, reader, map, etc.).
- **Right rail (contextual, only on the reader):** metadata, "cited by" cases, your notes for
  this section, source link.

**Home panel contents (what loads first), in priority order:**
1. A large **global search** ("Search 1.6M+ sections of federal, state & local law…") — the
   primary action. Search is the front door.
2. The **interactive US map** as the visual jurisdiction selector — distinctive, on-brand,
   and our differentiator (click a state → its law; zoom → counties/cities; colored by
   coverage). This is the anti-generic hero, not a stock card grid.
3. **Your shelf:** recently viewed + saved (compact list, not cards-everywhere).
4. **What's changed:** a quiet feed of recent amendments / new bills for things you track
   (future-wired; placeholder now).

Rationale: legal users split into "I know the cite → search" and "I want my place → map/
browse." Lead with search, make the map the memorable second beat, keep personal shelf +
changes glanceable. This beats both a search-only page and a card-grid dashboard.

### Global command palette
`⌘K` opens a command palette (shadcn `Command`) for jump-to-anything: a citation, a
jurisdiction, a section, a saved item, an action. This is a hallmark of professional apps
(Linear/Stripe) and the fastest path through 1.6M sections.

---

## 6. Screens (full set — mark v1 vs future). Each: purpose · layout · components.

1. **Home / workspace default** — §5. v1.
2. **Global search results** — query → ranked results (citation, heading, breadcrumb, matched
   snippet). Left **filter rail** (jurisdiction, law type, status, corpus) — *filters*, not
   chips. Sort. Infinite scroll or pager. Components: input, result **list** (not cards),
   `Tabs` for result type later (statutes/regs/cases). v1.
3. **US map explorer** — full-screen map; drill nation → state → county/place; regions colored
   by coverage; hover tooltip (name + status + counts); click → jurisdiction landing. Legend.
   Uses `lib/geo.js` + us-atlas topo. v1 (states+counties; places later).
4. **Jurisdiction / corpus landing** — overview of one body of law: what it is, source,
   last-updated, coverage status, a search-within, and entry into its tree. v1.
5. **Browse / table of contents** — deep hierarchical tree (Title→Chapter→Article→Section);
   expand/collapse; breadcrumb; lazy-load; current-location highlight. Plain tree, **no
   cards**. v1.
6. **Section reader (THE core screen)** — emulate eCFR's reader, modernized:
   - Sticky **breadcrumb** + **Prev / Next sibling / Up** controls.
   - Big citation + heading; **status badge** if repealed/reserved; effective/as-of date.
   - The law **text** with lettered/numbered subsection markers and **linkified
     cross-references** (clicking a cite navigates).
   - Reading rail (right or a toolbar): **Save**, **Annotate/Highlight + note**, Copy citation,
     **View official source**, **Display options** (font size, serif/sans, width, theme),
     "**Cited by** N opinions" (links out). 
   - Reading typography per §1 (this screen is for *long reading* — get it right). v1.
7. **Library / saved** — your bookmarks, organized by folder/tag, with note previews; search
   within. Here cards (or a dense list) for saved items are *justified*. v1.
8. **Annotations & notes** — aggregate of your highlights/notes across sections; jump to
   source; edit/delete. v1.
9. **Tracking & alerts (changes / new bills)** — follow a section/corpus/topic; a feed of
   amendments + new legislation; manage subscriptions; per-item settings; mark-as-read.
   v1 UI, data wired later (Federal Register / Congress.gov / state bills).
10. **Compare** — two sections / two jurisdictions' equivalents / one section across two dates
    (amendment history), side-by-side with synced scroll + diff highlighting. v1.1.
11. **Coverage dashboard + map** — the honest coverage view: % per state, gap list, "no
    digital source found — last checked" — powered by `data/coverage/`. v1 (read-only).
12. **Settings** — theme, default jurisdiction, reading defaults, alert preferences,
    data/source info. v1.
13. **Account / Billing (future paid)** — profile, plan, usage, upgrade, invoices. Design the
    chrome now (account menu, Upgrade CTA, locked-feature states) even if unwired.
14. **Auth (future)** — sign in/up, for the paid tier. Placeholder now.

---

## 7. Feature set — now + future (incl. paid-tier scaffolding)

**v1 (build + wire to existing data):** global + in-corpus search; browse tree; section
reader with linkified cross-refs; US map browse; save/bookmark; highlight + notes; jurisdiction
landing; coverage view; settings; command palette; dark/light.

**Near-future (UI now, data later):** change/new-bill **alerts**; **AI Q&A / plain-English
summaries** with citations to real text; **compare/diff** + amendment history; **"cited by"**
case law (CourtListener); pronunciations/audio (we have data); related-sections.

**Paid-tier scaffolding (design the surfaces now, gate later):** accounts + auth; billing
(Stripe); **plan gating** — e.g., Free = browse/search/limited saves; Pro = alerts, AI Q&A,
unlimited saves + folders, multi-jurisdiction compare, export, API. Build **locked-feature
states** (a tasteful lock + "Upgrade to Pro" inline, not a nag-wall), usage meters, and an
account menu now so adding paid users later is a wiring job, not a redesign.

---

## 8. States (design all of them — this is where polish lives)

- **Loading:** content-shaped **skeletons** (lists, reader, map), not spinners.
- **Empty:** purposeful empty states (no saved items yet, no results) with a clear next action
  and a real icon — never a blank panel.
- **Error:** inline, recoverable, human ("Couldn't load this section — retry").
- **"Content is being fetched" (the OLC crawl state):** a calm, honest async state — "Fetching
  this code from the official source… this can take a moment" with indeterminate progress —
  *because some content genuinely loads on demand.* Don't fake a spinner forever.
- **Coverage gap state:** for a place with no source — "No digital code found for X — last
  checked <date>" + a link to search official sources. Honest, not an error.
- **Offline / stale:** indicate when data is cached/as-of a date.

---

## 9. Data wiring (use the real backend; placeholder only where data is missing)

The front end consumes two ready modules — wire to them, don't invent data shapes:
- **Laws:** `import { createLawData } from '/law/lib/data.js'` — see `docs/API_CONTRACT.md`
  for the full method↔screen map (search, getToc, getNode w/ breadcrumb + prev/next,
  save/annotate/subscribe). The node shape (citation, heading, text, status, ancestors,
  source) is defined there.
- **Map/geo:** `import { createGeo } from '/law/lib/geo.js'` — see `docs/MAP_GEO.md` (FIPS↔
  jurisdiction↔coverage, us-atlas topo URLs, state table).
User data (saved/notes/alerts) persists via the data layer's store (localStorage now, KV/DB
later) — no caller changes when it swaps.

Where data isn't populated yet (e.g., alerts feed, most municipalities), use **clearly-labeled
placeholders** and the proper empty/fetching states — never block the screen.

---

## 10. Accessibility & responsive (required)

- WCAG 2.1 AA: keyboard-navigable everything, visible focus rings, semantic headings/landmarks,
  AA contrast in **both** themes, `prefers-reduced-motion` honored, screen-reader labels on
  icon-only buttons (this is also why icons must be real + labeled).
- Responsive: desktop-first (it's a reading/research tool) but fully usable on mobile — the
  sidebar becomes a hamburger→drawer, the reader goes full-width, the map adapts. It's a
  website, not a native app: no bottom tab bar.

---

## 11. Reference teardown — emulate vs avoid (from the live analysis)

- **eCFR (legal reader):** EMULATE the breadcrumb + Prev/Next/Top, lettered subsection
  markers, **linkified cross-references**, currency banner ("as of <date> / view changes"),
  and the reader action rail (TOC, Print, Display Options, Subscribe). AVOID its heavy, dated
  gov branding and cramped chrome.
- **Stripe Docs / Linear (pro frame):** EMULATE the top-bar search with `/` + "Ask AI", the
  quiet grouped/nested left sidebar, underline tabs, disciplined card use, whitespace, and the
  command palette. This is the target feel.
- **Open Legal Codes:** EMULATE its restraint (clean nav, zero chips). AVOID its
  over-sparseness — we need real density and features.
- **General AI-generic look:** AVOID centered card grids, chip soup, invented icons, bouncy
  hovers, rainbow color — see §2.

---

## 12. Out of scope / placeholders (for now)

Real auth + billing flows (chrome only); the alerts data pipeline; full municipal data;
case-law and AI-answer backends (design the surfaces, stub the data). Keep the canonical law
text coming from `lib/data.js`; never hardcode legal text.

---

## 13. Why Claude Code over Claude Design (the recommendation, expanded)

Your specific frustrations are *structural* to generate-from-scratch design:
- **Invented icons / same UI dialect / generic animations / card+chip overuse** happen because
  the tool is composing pixels from its own priors. **Building on shadcn/ui + Phosphor + Motion
  removes the opportunity** — the components, icons, and animations are real, named, and
  consistent. The DO/DON'T rules in §2 then close the remaining gaps.
- **Scaling to paid users** needs maintainable code: routing, auth, billing, data wiring to
  `lib/data.js`/`lib/geo.js`, deploys on Vercel, plan gating. Claude Design outputs mockups
  that must be rebuilt anyway; Claude Code builds the real thing once.
- There's a mature **Claude Code design-skill ecosystem** (e.g., Motion/GSAP skills) to lean on.

**So:** use this spec as the build brief for **Claude Code** (React + Vite + Tailwind +
shadcn/ui + Phosphor + Motion). If you want quick *visual* options for a specific screen first,
generate them in Claude Design (or from the Untitled UI Figma kit), pick a direction, then have
Claude Code implement it for real against this spec. The flagship app — the one that will take
paid users — should be real code on a real design system, governed by §2.
