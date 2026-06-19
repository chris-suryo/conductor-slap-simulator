# Conductor Slap Simulator

An educational, interactive 3D web simulator showing how short-circuit **magnetic forces**
drive overhead distribution conductors to swing and "slap," and how **protective relay /
recloser sequencing** shapes that mechanical story.

> **Educational visualization only.** It uses simplified physics with tuned constants to
> build intuition — it is **not** a certified design or relay-setting validation tool.

## The teaching story

A fault drives equal-and-opposite current through two phase conductors. Those antiparallel
currents **repel**, pushing the conductors apart while the fault is energized. The relay /
recloser trips and the breaker opens — but the conductors keep swinging in silence. On the
**rebound** they overshoot back inward, and if the clearing was slow they swing far enough to
**slap**. When the recloser re-energizes, a clear span restores service while a still-close
span **re-strikes** — and repeated re-strikes drive the device to **lockout**.

Three one-click presets demonstrate the contrast:

| Preset | What happens |
| --- | --- |
| **Protected** | Fast instantaneous trip; small swing; reclose finds the span clear → **service restored**. |
| **No protection** | Fault rides through the swing; conductors slap on the rebound → **conductor slap**. |
| **Reclose into slap** | A slow-curve trip builds a big swing; reclose re-strikes repeatedly → **lockout**. |

## Run it

```bash
npm install
npm run dev        # http://localhost:5173
```

Other scripts:

```bash
npm run typecheck  # tsc --noEmit
npm run test       # vitest (model + calibration tests)
npm run build      # production bundle
```

## How it works

The code is split into a framework-free **simulation core** and a thin **React/3D UI**.

```
src/
  simulation/        pure, unit-tested model (no React)
    magneticForces   F/L = μ0·I1·I2 / (2π·d)  — force ∝ current²
    protection       IEC inverse / instantaneous trip times
    motionSolver     spring-mass-damper conductor swing (semi-implicit Euler)
    recloserSequence NORMAL → FAULT → TRIP → OPEN → DEAD_TIME → RECLOSE → RESTORED / LOCKOUT
    contactDetector  safe / near-miss / slap classification
    runSimulation    single time-stepping loop that couples motion + protection
  state/             zustand store + presets + playback clock
  components/
    scene/           react-three-fiber scene (poles, crossarm, sagging tubes, arcs, bloom)
    charts/          recharts force / clearance / TCC charts
    layout/          console shell, control panel, results, timeline
    ui/              small Tailwind primitives
  tests/             vitest unit + calibration tests
```

`runSimulation(scenario)` is computed once per scenario and returns a frame series; a single
playback clock advances a cursor that the 3D scene, charts, and timeline all sample — so the
heavy views never re-render every animation frame.

### Engineering basis

- **Conductor slapping** is a short-circuit phenomenon driven by magnetic forces between phase
  conductors (EPRI; the *Electric Power Distribution Handbook* conductor-slapping / critical-
  clearing-time precedent), with the slap occurring as conductors swing back together after
  clearing (T. A. Ward, IEEE).
- **Reclosers** sense overcurrent, interrupt, reclose after a dead time, and lock out after a
  preset number of operations (Eaton; NOJA).
- **Inverse-time overcurrent** uses the IEC 60255-style characteristic
  `t = TMS · (k / (Mᵃ − 1) + c)`.

The mechanical model is a lumped center-span oscillator with educational gain constants
(`src/simulation/constants.ts`) calibrated so the default 7.5 kA AB scenario tells the story.

## Status / roadmap

Implemented now: **AB / BC / AC** line-to-line faults, the full protection + recloser
sequence, the 3D scene, charts, and a presentation mode.

Stubbed for later (typed, disabled in the UI): **AG / BG / CG** ground faults and **ABC**
three-phase, a critical-clearing-boundary overlay on the TCC chart, ground-overcurrent
settings, and video export.
