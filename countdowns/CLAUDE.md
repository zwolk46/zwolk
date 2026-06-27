# CLAUDE.md — Countdown Scene Contract

This file describes the contract every "scene" component must satisfy in this app.
Read this before writing or modifying any scene.

## Repo shape

- Single-file React app at `index.html`. No build system. No Tailwind. No CSS modules.
- React 18 from UMD CDN. Babel standalone in the browser.
- All styling is inline JSX `style={{}}` objects on JSX elements.
- One global `<style>` block exists for resets and scrollbars; do not add to it
  except for `@keyframes` definitions if a scene needs them.

## A "scene" is a React function component

Signature:

    function XxxScene({ countdown }) { ... }

It must:

1. Call `useTick(countdown.targetISO)` to get `{ days, hours, minutes, seconds, done }`.
2. Call `resolvePalette(countdown)` to get colors `{ bg, ink, c1, c2?, c3? }`.
3. Call `resolveCopy(countdown)` to get `{ prefix, dayLabel }`.
4. Call `resolveTweaks(countdown)` to get `{ composition, atmosphere }`, then derive:
       const cs = COMP_SCALE[tw.composition] || 1;     // 0.74 / 1 / 1.22
       const ao = ATMOS_OPACITY[tw.atmosphere] || 1;   // 0.18 / 1 / 1.45
   `cs` scales display type sizes. `ao` scales the opacity of decorative effects.
5. Render an absolute-positioned full-screen container with `inset:0`, the palette
   background, and the scene's content wrapped in `<SceneFrame>`.
6. Use `formatTarget(countdown.targetISO, countdown.tz)` to render the target date.
7. Use `pad(n)` to render zero-padded hours/minutes/seconds.
8. Use `hexAlpha(hex, a)` when you need a translucent version of a hex color.

## Existing utility functions you may use

`useTick`, `useIsMobile`, `useViewport`, `resolvePalette`, `resolveCopy`,
`resolveTweaks`, `hexAlpha`, `isLightHex`, `pad`, `formatTarget`, `SceneFrame`.

Do not redefine any of these. Do not import new ones.

## Adding a new scene requires four edits

1. Add the `XxxScene` function component near the other scenes.
2. Add an entry to the `SCENES` object: key, label, blurb, suits, default palette,
   default copy `{prefix, dayLabel}`, and `light: true` if the scene has a
   light-colored background (this affects header contrast).
3. Add an entry to `PRESETS` with named palette variations.
4. Add a `case` to the `SceneRenderer` switch statement that dispatches to your new
   scene component.

## Fonts available (already loaded — do NOT add new ones)

Archivo Black, Cormorant Garamond, EB Garamond, Geist, Geist Mono, IBM Plex Mono,
JetBrains Mono, Manrope, Newsreader (weights 200/300/400 + 300 italic),
Space Grotesk.

## Hard prohibitions

- No new dependencies. No npm installs. No CDN script additions.
- No new font @imports. Use only the fonts above.
- No Tailwind utility classes. Inline styles only.
- No localStorage / sessionStorage / cookies.
- No fetch / network requests from inside a scene.
- Do not modify existing scenes when adding a new one.
- Do not modify `useTick`, the `SCENES` schema, or any utility function. Add only.
- Mobile must work. Use `useIsMobile()` when behavior must branch by viewport.

## Acceptance criteria for any new scene

- Renders without console errors or React warnings.
- Day count updates correctly (test with a near-future target).
- The new scene appears in the scene picker (because `SCENES[key]` is populated).
- All `PRESETS[key]` variations render correctly when selected.
- Mobile (≤720px) does not break the layout — text scales, nothing overflows.
- The scene respects `composition` and `atmosphere` props via `cs` and `ao`.
- The scene's essence (per its spec file) still reads as true when the result is
  viewed. If the essence statement no longer applies, the scene is not done.

## Anti-patterns that betray ANY scene

- Generic AI defaults: Inter/Roboto, purple gradients, "glass" frosted backgrounds
  not motivated by the brief, evenly-spaced centered compositions when the brief
  calls for asymmetry.
- Adding decoration the spec did not ask for.
- Reaching for a font outside the available set.
- "Fixing" the existing component contract.
