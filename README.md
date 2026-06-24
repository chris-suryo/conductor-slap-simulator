# Conductor Slap Simulator

An interactive, browser-based **3D teaching simulator** for **APC Relay Engineering**. It
shows how short-circuit **magnetic forces** make overhead distribution conductors swing and
"slap," and how **protective relay / recloser sequencing** changes the outcome.

Built for live presentations (there's a full-screen Presentation mode). Presented by
**Harianto Suryo, P.E. · APC Relay Engineering**.

> ⚠️ **Educational visualization only.** It uses simplified physics with hand-tuned
> constants to build intuition — it is **not** a certified design or relay-setting tool.

---

## What it shows (the teaching story)

A fault drives equal-and-opposite current through two phase conductors. Those antiparallel
currents **repel**, pushing the conductors apart while the fault is energized. The relay /
recloser trips and the breaker opens — but the conductors keep swinging in silence. On the
**rebound** they overshoot back inward, and if clearing was slow they swing far enough to
**slap**. When the recloser re-energizes, a clear span restores service while a still-close
span **re-strikes** — and repeated re-strikes drive the device to **lockout**.

Three one-click presets demonstrate the contrast:

| Preset | What happens |
| --- | --- |
| **Protected** | Fast instantaneous trip; small swing; reclose finds the span clear → **service restored**. |
| **No protection** | Fault rides through the swing; conductors slap on the rebound → **conductor slap**. |
| **Reclose into slap** | A slow-curve trip builds a big swing; the reclose re-strikes → **lockout**. |

It also draws **three spans** (SPAN 1 nearest the source, SPAN 2 upstream of the recloser, SPAN 3
faulted) and independently tracks each one's clearance/force — a long span can slap while a
shorter one stays clear, and a slap on SPAN 1 or SPAN 2 strikes its own new fault that the
substation relay has to clear.

---

## Quick start

**You need:** [Node.js](https://nodejs.org) 18 or newer (developed on 22) and npm. Check with
`node --version`.

```bash
# 1. Get the code
git clone https://github.com/chris-suryo/conductor-slap-simulator.git
cd conductor-slap-simulator

# 2. Install dependencies (one time, ~1 min)
npm install

# 3. Run it
npm run dev
```

Then open the URL it prints — **http://localhost:5173** — in your browser. Press `Ctrl+C` in
the terminal to stop.

### All commands

| Command | What it does |
| --- | --- |
| `npm run dev` | Start the live dev server (auto-reloads on save). |
| `npm test` | Run the model unit tests (must stay green). |
| `npm run typecheck` | Check TypeScript types (no compile errors). |
| `npm run build` | Production build into `dist/`. |

### Deploying (Vercel)

The app is a static Vite SPA, so it deploys to any static host. It's wired for **Vercel**:
`vercel.json` pins the framework (`vite`), build command (`npm run build`), output (`dist`), and
an SPA fallback rewrite — so Vercel builds it reproducibly and pushes to the connected branch
trigger deploys (with automatic preview URLs for PRs). No environment variables are required.

> Note: Vercel's free **Hobby** plan is intended for non-commercial use; this is an internal
> teaching/demo tool. Hosts whose free tier explicitly permits commercial use (Netlify,
> Cloudflare Pages) are alternatives if that matters — the same `dist/` build works on any of them.

---

## Using the app

- **Presets** (top-left): the fastest way to demo — click *Protected*, *No protection*, or
  *Reclose into slap*.
- **Sliders**: fault current, span lengths, phase spacing, sag, conductor type, and all the
  relay/recloser settings. Every change re-runs the simulation and replays it.
- **Modes** (top-right): *Physics*, *Protection*, *Presentation*. Presentation hides the
  controls, shows a title card, and slowly orbits — set a scenario running and talk over it.
- **Playback** (top): play/pause, replay, loop, and 0.25× / 0.5× / 1× speed. Click the
  timeline to scrub.
- **Charts**: magnetic force, conductor clearance (with the "slap" line), and the relay
  time–current curve (TCC) with the operating point.

---

## Working with AI coding tools (read this if you're new to them)

This repo is set up to be continued with AI assistants like **Claude Code** or **Cursor**.

1. **Open the project folder in your AI tool.** In Claude Code: `cd` into the folder and run
   `claude`. In Cursor: *File → Open Folder*.
2. There's a **[`CLAUDE.md`](CLAUDE.md)** at the root that automatically tells the AI how this
   codebase is organized, how the physics model works, and the traps to avoid. You don't have
   to read it, but the AI will.
3. **Ask in plain English.** Good first prompts:
   - *"Run the app and take a screenshot so I can see it working."*
   - *"Explain how the conductor-slap simulation works, in simple terms."*
   - *"Add support for the BC and AC fault types and verify they animate in the browser."*
4. **Always have the AI prove its work.** After a change, ask it to run `npm test` and
   `npm run typecheck`, and to **open the app in the browser and confirm the change visibly
   works**. Don't trust "done" without that.
5. **The safety net:** `npm test` includes a *calibration test* that fails if a change breaks
   the core story (protected → no slap, no-protection → slap). If tests are green, you
   probably didn't break the physics.

**One gotcha to know:** if you change theme **colors** (in `tailwind.config.js`) and the app
looks half-styled, **stop and restart `npm run dev`** — Tailwind config changes aren't always
picked up by a running server.

---

## Project structure

```
src/
  simulation/        Pure physics/protection model — no React, fully unit-tested
    magneticForces   Force between conductors:  F/L = μ0·I1·I2 / (2π·d)  (force ∝ current²)
    protection       IEC inverse / instantaneous relay trip times
    motionSolver     Spring-mass-damper conductor swing
    recloserSequence Trip → open → dead time → reclose → restore / re-strike / lockout
    contactDetector  safe / near-miss / slap classification
    runSimulation    Ties it together; also computes the upstream SPAN 1 / SPAN 2 motion
    constants.ts     ⭐ The hand-tuned "educational" constants live here
  state/             Zustand store + scenario presets + the playback clock
  theme/             Theme tokens (dark/light), applyTheme, brand layer (brand.ts)
  components/
    scene/           react-three-fiber 3D scene (poles, conductors, force/arc effects)
    charts/          recharts force / clearance / TCC charts
    layout/          Header, control panel, results, timeline, APC logo, theme toggle
    ui/              Small Tailwind UI primitives
  tests/             Vitest unit + calibration tests
```

### Theming & branding

The UI ships **dark (default) + light** themes from one source of truth in `src/theme/tokens.ts`,
surfaced as CSS variables that drive Tailwind utilities, the charts, and the 3D scene. The header
toggle persists the choice (and respects `prefers-color-scheme`).

All APC brand specifics live in **`src/theme/brand.ts`** (colors, wordmark, presenter) plus
`public/brand/` for logo files. To drop in official assets, edit only `brand.ts` (set
`logo.src` / `colors.accent` / `colors.navy`) and the favicon in `index.html` — see the
`TODO(APC)` markers.

For a deeper architecture explanation, see [`CLAUDE.md`](CLAUDE.md).

---

## Status & roadmap

**Working now:** AB / BC / AC line-to-line, AG / BG / CG line-to-ground, and ABC three-phase
faults, full relay + recloser sequence, the 3D
two-span scene set on a street (road, receding feeder, soft ground shadows, sky, and a faded
city skyline), **resizable side panels + an "expand scene" toggle**, charts, presentation mode,
dark/light theming, **IBM Plex typography**, and APC branding with a recreated logo (swappable
brand layer + the 3D scene code-split out of the initial bundle).

**Not done yet (good next tasks):**

- **Critical-clearing-boundary overlay** on the TCC chart (and a possible visx/D3/uPlot upgrade
  for publication-grade log-log gridlines — flagged in `TccChart.tsx`).
- **Ground-overcurrent settings** and richer per-shot recloser configuration.
- **Video / GIF export** for sharing clips.
- **Official APC logo:** the header now shows a hand-recreated APC lockup
  (`public/brand/apc-logo*.svg`). Drop the official vector over those files (keeping the paths
  in `src/theme/brand.ts`) when it's available.

---

## Notes / honesty

- The mechanical model is a simplified lumped oscillator with **educational gain constants**
  (`src/simulation/constants.ts`) calibrated so the default scenario tells the story. It is
  not catenary-accurate. Lateral motion in the 3D view is exaggerated ~1.5× for clarity (noted
  on screen).
- The transverse-swing **period follows the pendulum relation `T ≈ √(sag_ft)`** (depends on
  sag, not span/tension/mass); span influences the swing through the constant-tension
  `sag ∝ span²` relation. See `docs/PHYSICS_VERIFICATION.md` for the full audit.
- Fault current is modeled as a **steady RMS-equivalent** force. The real force pulsates at
  120 Hz with an asymmetric first-cycle peak (~2–2.8× the symmetric value); since the swing
  period (~2 s) ≫ the electrical period, the conductor responds to the time-average, so the
  steady force is the correct *average* — but the initial peak "kick" is not shown.
- Engineering basis is cited in comments throughout `src/simulation/` (EPRI conductor
  slapping; the *Electric Power Distribution Handbook*; T. A. Ward, IEEE; Eaton / NOJA
  recloser behavior; IEC 60255 inverse curves).

© APC Relay Engineering — internal teaching tool.
