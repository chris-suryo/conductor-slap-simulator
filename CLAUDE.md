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
  slot, optional fonts) + `public/brand/` for logo files. To drop in official assets, edit only
  `brand.ts` (`logo.src`/`colors.accent`/`colors.navy`) and the favicon/title in `index.html`.
  Look for `TODO(APC)` markers. `ApcLogo` renders the image when set, else a typographic wordmark.

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

- **Done:** AB/BC/AC faults, full relay+recloser sequence, two-span 3D scene, charts,
  presentation mode, APC branding.
- **Stubbed (typed, UI-disabled):** AG/BG/CG ground faults, ABC three-phase
  (`faultGeometry()` returns `isPair: false` for these — they need a real model + UI enable).
- **Roadmap:** critical-clearing overlay on the TCC chart, ground-overcurrent settings, video
  export, bundle code-splitting, official logo asset. See README "Status & roadmap".

## A good change checklist

- [ ] Read the relevant existing file(s) first.
- [ ] Make the change; keep the model React-free.
- [ ] `npm run typecheck` and `npm test` pass.
- [ ] If visible, run the app and confirm in the browser (screenshot + no console errors).
- [ ] Update this file / README if you changed architecture or added a feature.
