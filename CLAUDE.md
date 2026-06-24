# CLAUDE.md — guide for AI assistants working on this repo

This file orients an AI coding assistant (Claude Code, Cursor, etc.) to this codebase.
Read it before making changes. Keep it up to date when the architecture changes.

## What this project is

An educational **3D web simulator** (Vite + React + TypeScript) showing overhead distribution
**conductor slap** from short-circuit magnetic forces, and how **relay/recloser protection**
changes the outcome. It is a teaching/presentation tool for APC Relay Engineering — **not** a
certified engineering tool. Keep that framing; don't present the physics as exact.

## How to work here (golden rules)

1. **Prove every change.** After editing, run `npm run typecheck` and `npm test`, and — if the
   change is visible — **run the app and confirm it in the browser** (see "Verifying" below).
   Never claim something works without checking.
2. **Don't break the calibration test.** `src/tests/runSimulation.test.ts` asserts the core
   story: the default scenario *with* protection restores without a slap, and *without*
   protection it slaps. If you touch the model or its constants, run the tests and re-tune
   `src/simulation/constants.ts` until they pass again.
3. **Keep the model framework-free.** Everything in `src/simulation/` is pure TypeScript with
   no React imports. The UI depends on the model, never the reverse.
4. **Match the existing style.** Strict TypeScript, `@/` path alias for `src`, Tailwind for
   styling, small focused components. Read a nearby file before adding a new one.

## Architecture (three layers)

1. **Pure simulation core** — `src/simulation/*`. Deterministic, unit-tested functions.
2. **One orchestrator** — `runSimulation(scenario)` runs a single fixed-step loop that couples
   the conductor motion to the protection state machine and returns a `SimulationResult`
   (a frame series + timeline events + summary). Computed **once** per scenario.
3. **React + react-three-fiber UI** reads a **single Zustand store** (`state/useScenarioStore.ts`).
   A single playback clock (`state/usePlayback.tsx`) advances a `cursorMs`; the 3D scene,
   charts, and timeline **sample the precomputed frames** at that cursor. The heavy views read
   the cursor imperatively (`useScenarioStore.getState()` inside `useFrame` / subscriptions) so
   they don't re-render every animation frame.

## The simulation model (how the physics works)

- **`magneticForces.ts`** — `F/L = μ0·I1·I2 / (2π·d)`. For a line-to-line fault the same
  current flows in both conductors, so force ∝ I². Currents are antiparallel → **repulsion**
  (conductors pushed apart while energized).
- **`motionSolver.ts`** — a lumped spring-mass-damper per phase, integrated with semi-implicit
  Euler. The transverse swing is a **pendulum whose period depends on sag**: `T ≈ √(sag_ft)`
  (fundamental `f₁ = 0.55/√(sag_m)`), **independent of span/tension/mass**. Span enters only
  through the **constant-tension parabola `sag ∝ span²`** (`D = wL²/8H`): longer spans are
  strung with more sag → swing slower → larger amplitude → slap more readily. (In the lumped
  model span otherwise cancels out of `F/m`, so routing it through sag is the honest channel.)
  Slap happens on the **rebound** after the fault clears, not during it.
- **`protection.ts`** — IEC inverse curve `t = TMS·(k/(Mᵃ−1)+c)` plus an instantaneous element;
  total clearing time adds the breaker operating time.
- **`recloserSequence.ts`** — the `ProtectionController` FSM: NORMAL → FAULT_ACTIVE →
  RELAY_TIMING → TRIP → BREAKER_OPENING → DEAD_TIME → RECLOSE → (RESTORED | re-strike | LOCKOUT).
  A slap during the dead time forces a re-strike on reclose.
- **`runSimulation.ts`** — the orchestrator loop, plus `computeWitnessFrames()` which solves a
  **second adjacent span's** motion using the faulted span's energization timeline (so a long
  span can slap while a shorter one doesn't).
- **`constants.ts`** — ⭐ all the **hand-tuned educational constants** (force gain, damping,
  swing-period references, contact threshold). This is the calibration knob. Changing these
  changes whether scenarios slap; always re-run the tests after.
- **Important physics nuance:** in the "no protection" case the fault is cleared near the
  conductor's outward swing **peak** (`runSimulation` computes this) so the rebound is large and
  the slap is reliable rather than depending on timing luck.

## Theming (dark/light) — how colors flow

- **One source of truth:** `src/theme/tokens.ts` holds per-theme NEUTRAL palettes (surfaces,
  text, borders, scene environment) + theme-CONSTANT `STATUS` colors (energized/fault/arc/… —
  they encode physics/protection meaning and must read the same in both themes). The neutral
  triples are mirrored in the `.dark`/`.light` blocks of `src/index.css` (keep them in sync).
- **Three consumers, one source:** (1) Tailwind utilities map to `rgb(var(--token) /
  <alpha-value>)` in `tailwind.config.js`, so `bg-panel`/`text-fg`/`border-edge` flip
  automatically; (2) Recharts reads concrete strings via `useChartTheme()`; (3) the 3D scene's
  themeable neutrals (bg/fog/grid/poles) come from `useThemeColors()` and re-render only on
  theme change — its per-frame `useFrame` code reads only constant `COLORS`/status, so the hot
  path never reacts to a theme switch.
- **Theme state:** `src/state/useThemeStore.ts` (dark default, persisted to `localStorage`,
  `prefers-color-scheme` aware), `ThemeToggle` in the header, and a pre-paint script in
  `index.html` that sets the class before first paint to avoid a flash. Dev: `window.__theme`.
- **Use semantic text tokens, not raw slate:** `text-fg` (primary), `text-fg-muted`,
  `text-fg-faint`. Raw `text-slate-*` won't flip with the theme.

## Brand layer (APC) — swap assets in ONE place

- All brand specifics live in `src/theme/brand.ts` (`BRAND`: colors, wordmark, presenter, logo
  paths, fonts) + `public/brand/` for logo files. The header/favicon now use a **hand-recreated
  APC lockup** (`apc-logo.svg` dark, `apc-logo-light.svg` light, `apc-favicon.svg`) — when the
  official vector arrives, just overwrite those files (keep the `brand.ts` paths). `ApcLogo`
  renders the image when `logo.src` is set, else a typographic wordmark (kept as a fallback).
- **Typography:** UI uses **IBM Plex Sans** (variable) + **IBM Plex Mono** (static 400/500/600),
  loaded via `@fontsource*` in `src/main.tsx` and mapped in `tailwind.config.js` `fontFamily`
  (this mirrors APC's website). The exact CSS family names are `'IBM Plex Sans Variable'` and
  `'IBM Plex Mono'` — confirm against the `@fontsource*` package CSS if you swap fonts.

## Layout (resizable)

- `state/useLayoutStore.ts` holds the side-panel widths (`leftWidth`/`rightWidth`, clamped +
  persisted to `localStorage` key `csim-layout`, dev `window.__layout`) and a `sceneExpanded`
  toggle. `Shell.tsx` drives the asides' widths from the store, drops a `ResizeHandle` between
  each aside and the center, and gates all chrome on `chromeHidden = presentation || sceneExpanded`
  (the center stays `flex-1 min-w-0` so the charts reflow). The **expand-scene** button lives in
  the 3D scene overlay and just flips `sceneExpanded`.

## Conventions & gotchas

- **Tailwind config changes need a dev-server restart.** If you add/change colors in
  `tailwind.config.js` and the UI looks half-styled, restart `npm run dev`. Brand colors come
  from `src/theme/brand.ts` (`brand` = APC orange `#FD8505`, `navy` = `#0C3552`); status colors
  (`energized` cyan, `fault` red, etc.) are theme-constant and kept distinct from brand chrome.
- **Dev-only HMR quirk:** the Zustand store is exposed as `window.__store` in dev (bottom of
  `useScenarioStore.ts`) for quick scripting/inspection. After a hot reload the store can briefly
  duplicate — do a full page reload before trusting in-page debugging.
- **The 3D scene rebuilds tube geometry per frame** when a conductor moves; sample displacement
  via the passed `frames` array + `dtMs`, not a stale closure. (A past bug compared against
  `NaN` and froze the lines — make sure motion actually updates on screen.)
- **Street/environment is a "cinematic dusk city," mostly static.** `scene/Ground.tsx`,
  `DistantPoles.tsx` (poles + crossarms + insulators + transformer + dusk street lamps),
  `Skyline.tsx` (lit-window buildings in depth bands) build geometry once in `useMemo`
  (instanced — ~1 draw call each); `<Sky>` + `<ContactShadows>` (drei) give the backdrop/shadows.
  Procedural `CanvasTexture`s are generated once via `scene/facadeTexture.ts` (building windows)
  and `scene/groundTexture.ts` (grass/asphalt noise), both seeded by `scene/prng.ts`. Colors come
  from **scene-only** tokens in `tokens.ts` (`scene-road`/`-grass`/`-skyline`/`-window`/`-lamp`/
  `-car-*`/…), resolved through `buildPalette()`/`useThemeColors()` — *not* mirrored in `index.css`
  (only `--scene-bg` is, because Tailwind consumes it).
- **Only three things move in the scene besides the physics:** `scene/Cars.tsx` (instanced
  traffic, 1 `useFrame`), the Skyline window **twinkle** (1 `useFrame`, dusk only), and the
  per-conductor **idle "breeze" sway** in `Conductor.tsx`. The sway is **render-only** —
  it's added to the local `disp`, gated to `!faultActive && contact==='safe'`, and **never**
  written back into the shared `frames`/`witnessFrames` arrays (the charts read those).
- **Decorative emissive (windows/car lights/lamps)** reads theme-CONSTANT colors from
  `SCENE_EMISSIVE` in `utils/labels.ts` (so the hot path never calls the theme hook); day-vs-dusk
  is gated on `isDark` *intensity*. Every emissive material sets `toneMapped:false` so Bloom
  catches it. The conductor is a dim metallic body + a separate bright **core tube**
  (`MeshBasicMaterial`) that carries the glow — keep both in sync when editing.
- **Path alias:** import from `@/...` (configured in `vite.config.ts` and `tsconfig.json`).

## Running, testing, verifying

```bash
npm run dev         # http://localhost:5173
npm test            # vitest (model + calibration) — keep green
npm run typecheck   # tsc --noEmit
npm run build       # production build
```

**Verifying visually:** start the dev server and use your tool's browser/preview capability to
load `localhost:5173`, take a screenshot, and check the console for errors. To drive a scenario
without clicking, use the dev `window.__store`, e.g.
`window.__store.getState().applyPreset('no-protection')` then `...seek(990)`.

## What's done vs. open

- **Done:** AB/BC/AC line-to-line faults + AG/BG/CG line-to-ground faults, two-device protection (downstream G&W recloser + upstream substation
  relay) with SEL US curves and fault-location coordination, full reclose sequence, dual TCC chart,
  fault-simulation UX (magnitudes, location, reclose outcome, Run/Stop), **three-span 3D scene**
  (source "S" marker → G&W recloser + cabinet at P2 → faulted span 3 with a fireball + rising
  smoke at its remote end) on a street (road + receding feeder + skyline + ground shadows + sky), resizable panels +
  expand-scene toggle, charts, presentation mode, dark/light theming, IBM Plex typography, APC
  branding (recreated logo). Split energization (upstream stays live at reduced load while only
  the recloser is open) + split Live-state UI; small magnetic coupling on the unfaulted phase
  during an L-L fault. **Protection settings panel shows both devices side by side** (CTR, pickup,
  curve, time dial); the "Protection enabled" toggle is **recloser-only** — disabling it routes a
  downstream fault to the substation relay's own curve, which de-energizes the whole feeder (no
  upstream/downstream split), matching how a real backup relay behaves. **Induced upstream fault
  (Phase 6):** if the still-energized upstream span clashes after the recloser clears the original
  fault, that strikes a NEW fault (sized by the "Induced upstream fault" control) that the
  substation relay clears on its own curve, de-energizing the whole feeder; surfaced via
  `SimulationResult.upstreamFaultEvent` and a banner in the Outcome card. **AG/BG/CG ground
  faults** (enabled in the fault-type selector): `faultGeometry()` returns `isPair: false` and a
  single faulted phase — `runSimulation`'s force step is gated on `isPair`, so a ground fault
  correctly produces NO pairwise magnetic repulsion/slap in this model (protection still trips
  normally on current magnitude); the 3D fault fireball/smoke (`FaultFireball.tsx`) renders at
  that single conductor since `pair.a === pair.b` collapses cleanly to one position. **The
  recloser single-pole trips ground faults:** `SimulationResult.singlePoleTrip` is true whenever
  the RECLOSER (not the substation relay/breaker, which has no such capability and always trips
  three-pole) is clearing an AG/BG/CG fault — only the faulted phase opens; the other two stay
  energized throughout (`SimulationFrame.downstreamHealthyEnergized`, distinct from `energized`,
  which still tracks the faulted pole specifically). The Live-status Recloser card reflects this:
  eyebrow reads "single-pole trip", and the state cell shows an amber "1 pole open" instead of a
  full "Open", with load current still shown on the two healthy phases.
- **Stubbed (typed, UI-disabled):** ABC three-phase
  (`faultGeometry()` returns `isPair: false`, phases `['A','B','C']` — needs a real model + UI enable).
- **Roadmap:** critical-clearing overlay on the TCC chart, ground-overcurrent settings, video
  export. See README "Status & roadmap".

## A good change checklist

- [ ] Read the relevant existing file(s) first.
- [ ] Make the change; keep the model React-free.
- [ ] `npm run typecheck` and `npm test` pass.
- [ ] If visible, run the app and confirm in the browser (screenshot + no console errors).
- [ ] Update this file / README if you changed architecture or added a feature.
