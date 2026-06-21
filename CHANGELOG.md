# Changelog

All notable changes to the Conductor Slap Simulator are documented here.

## [Unreleased]

### Physics & math verification audit (swing-period correction)

A comprehensive audit verified the simulator's physics, math, and protection theory against
authoritative references (EPRI conductor-slap material, the *Electric Power Distribution
Handbook*, IEC 60255, conductor swing/sag literature, NOJA Power recloser guidance). The full
report is in [`docs/PHYSICS_VERIFICATION.md`](docs/PHYSICS_VERIFICATION.md).

**Verdict:** the model was already physically sound — magnetic force law, slap mechanism,
integration scheme, IEC relay curves, recloser sequence, and unit conversions all check out.
One real inaccuracy was found and fixed.

#### Fixed
- **Swing-period model (`src/simulation/motionSolver.ts`).** The period previously used
  `T ∝ √(sag·span)` at a ~1.0 s reference. A conductor's transverse swing is a pendulum whose
  period depends on **sag alone** — `f₁ = 0.55/√(sag_m)`, i.e. `T ≈ √(sag_ft)` (≈ 2.24 s at
  5 ft sag) — independent of span, tension, and mass. Span now enters through the
  constant-tension parabola `sag ∝ span²` (`D = wL²/8H`), which is the physically honest way
  longer spans end up swinging more (in the lumped model span otherwise cancels out of `F/m`).

#### Changed (re-tuning to keep the calibration story green)
- `SWING_PERIOD_REF_S` 1.0 → **2.24 s** (≈ √5 ft), with clamps widened to **0.8–4.5 s** for
  realistic periods (`src/simulation/constants.ts`).
- `EDU_FORCE_GAIN` 0.4 → **0.15**. The corrected (longer) period scales displacement ~`T²`, so
  the force gain had to drop to keep the protected case clear and the unprotected case slapping.
  Documented that this is a calibration knob, *not* the textbook modal projection (~0.64), which
  would now over-swing wildly.
- No-protection clearing cap raised 900 → **1400 ms** so it still clears near the (now longer)
  outward swing peak (`src/simulation/runSimulation.ts`).
- "Reclose into slap" preset dead time 500 → **1150 ms** (≈ half the new swing period) so the
  reclose again lands while the rebounding conductors are close and re-strikes toward lockout
  (`src/state/presets.ts`).

#### Added
- Unit tests locking in the corrected period physics — `T ≈ √(sag_ft)`, `T ∝ √sag` at fixed
  span, and the constant-tension span→period relation (`src/tests/motionSolver.test.ts`).
- `docs/PHYSICS_VERIFICATION.md` — the full audit (what was verified correct, the one fix, and
  references).

#### Documentation
- `CLAUDE.md` and `README.md` swing-period descriptions updated to the sag-physical model, plus
  a note that fault current is modeled as a steady RMS-equivalent force.

#### Notes
- The two force helpers `faultForcePerLengthNPerM` / `lateralRepulsionNPerM` are **not** dead
  code — they are covered by `src/tests/magneticForces.test.ts` and kept as tested API.
- All 32 tests pass; `npm run typecheck` and `npm run build` are clean; dev server boots OK.
