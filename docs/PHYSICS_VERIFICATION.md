# Physics & Math Verification Audit

A comprehensive audit of the simulator's physics, math, and protection theory, cross-checked
against authoritative references. Each governing equation and constant was read directly from
the source and verified for correctness, dimensional consistency, and physical plausibility.

**Headline verdict:** the model is *physically sound and well-built* for a teaching tool.
Every governing equation is transcribed correctly and is dimensionally consistent, and the
qualitative story (repulsion → swing → slap on rebound; fast protection prevents the slap)
matches the real failure mechanism documented by EPRI. **One real inaccuracy** (the swing-period
formula) was found and fixed; see the Changelog.

## Verdict at a glance

| Area | Status | Note |
|---|---|---|
| Magnetic force law `F/L = μ₀I₁I₂/(2πd)` | ✅ Correct | Standard Ampère force; units, μ₀, I² scaling, repulsion all right |
| Conductor-slap mechanism (repel → rebound → clash) | ✅ Matches reality | Exactly the EPRI-documented mechanism |
| Spring-mass-damper ODE + semi-implicit Euler | ✅ Correct | Energy-stable; ~300 steps/period; dimensionally clean |
| Swing-period model | ✅ Fixed | Was `T ∝ √(sag·span)`; now sag-physical `T ≈ √(sag_ft)` |
| AC vs steady fault current | ✅ Justified | Steady RMS force = correct *average*; misses asymmetric first-cycle peak |
| IEC inverse curves (k, α, c) | ✅ Exact | 0.14/0.02, 13.5/1, 80/2 match IEC 60255 to the digit |
| Recloser FSM + dead times / shots | ✅ Plausible | 1 s / 5 s / 10 s, fast-then-slow, lockout — all in real range |
| Contact / slap threshold (0.25 ft) | ✅ Reasonable | Flashover-bridging margin; tuning knob, clearly labelled |
| Unit conversions (ft↔m, lb/kft→kg/m) | ✅ Correct | Verified `0.45359237/(1000·0.3048)` etc. |

## Detailed findings

### 1. Magnetic force — ✅ correct
`magneticForces.ts` implements `F/L = μ₀·I₁·I₂/(2π·d)` with `MU_0 = 4π×10⁻⁷ H/m`.
- Dimensional check: H/m · A² / m = N/m. For a line-to-line fault the same current flows out and
  back, so `F/L ∝ I²` — the scaling the demo teaches.
- Antiparallel currents → repulsion, applied with correct signs in `runSimulation.ts`.
- Sanity magnitude: 7.5 kA at ~1.07 m → ~10.5 N/m (verified by `magneticForces.test.ts`), vs
  conductor weight ~3 N/m — the lateral force realistically exceeds conductor weight.
- EPRI confirms the mechanism and the risk factors (lighter conductors, tight spacing,
  above-average sag, long spans, high fault levels) — all of which are parameters in this model.

### 2. Motion solver — ✅ integration correct; swing-period model fixed
`stepOscillator` is textbook semi-implicit (symplectic) Euler for `m·x'' + c·x' + k·x = F`;
dimensionally clean and energy-stable, ~300 steps/cycle at `SIM_DT_MS = 3`.

**The fix:** the period previously used `T ∝ √(sag·span)` at ~1.0 s. The authoritative relation
for a conductor's fundamental transverse/pendulum swing is `f₁ = 0.55/√(sag_m)`, i.e.
`T ≈ √(sag_ft)` (≈ 2.24 s at 5 ft sag), **independent of span, tension, and mass**. The model now
computes the period from sag and routes span through the constant-tension parabola `sag ∝ span²`
(`D = wL²/8H`) — the physically honest reason longer spans swing more. (In the lumped model span
otherwise cancels out of `F/m`, so it *must* enter via sag to remain meaningful, which also keeps
the two-span "witness" comparison working.)

### 3. AC vs steady current — ✅ defensible simplification
The model drives with a constant `I` (RMS). Because the swing period (~2 s) ≫ the electrical
period (1/120 s), the conductor responds to the *time-averaged* force, and `avg(i²) = I_rms²` — so
a steady RMS force is the right average. Omitted: the asymmetric first-cycle DC offset (peak
instantaneous force ~2–2.8× the symmetric value). Reasonable for a teaching tool; noted in README.

### 4. Protection curves — ✅ exact
`protection.ts` implements IEC `t = TMS·(k/(Mᵃ−1)+c)`, `M = I/pickup`, returning `Infinity` for
`M ≤ 1`. `CURVE_CONSTANTS` match IEC 60255 to the digit: SI `k=0.14, α=0.02`; VI `k=13.5, α=1`;
EI `k=80, α=2`; definite via `k=0`. `clearTimeMs = relay + breakerOpenTime` is correct.
`RELAY_PROCESSING_MS = 25` (~1.5 cycles) is realistic.

### 5. Recloser sequence — ✅ plausible
The FSM (NORMAL→FAULT_ACTIVE→RELAY_TIMING→TRIP→BREAKER_OPENING→DEAD_TIME→RECLOSE→
RESTORED/re-strike/LOCKOUT) mirrors real recloser logic, including a clash *during dead time*
forcing a re-strike on reclose (EPRI: "when the device recloses, the upstream conductors can
swing together and cause a new fault, with even higher currents"). Default shots: fast then
slow, 1 s / 5 s / 10 s dead times, 3 ops to lockout — all consistent with real practice
(first dead time ~0.5–2 s, later 2–25 s).

### 6. Modal projection — note (no change)
`MASS_FRACTION = 0.5` is exactly the modal mass of the fundamental half-sine mode. The
consistent generalized force for that mode is `(2/π)·(F/L)·L ≈ 0.64·(F/L)·L`. With the corrected
(longer) swing period, displacement scales ~`T²`, so a modal-magnitude force gain (~0.64) would
over-swing wildly — even 0.4 slaps the protected case. `EDU_FORCE_GAIN` therefore stays a pure
calibration knob (now 0.15), documented as such.

### 7. Not dead code
`faultForcePerLengthNPerM` and `lateralRepulsionNPerM` are unused by the orchestrator but are
covered by `magneticForces.test.ts` — kept as tested public API.

## How this was verified
- `npm run typecheck` — clean (exit 0).
- `npm test` — 32 tests pass, including new period-physics tests and the calibration "story gate".
- `npm run build` — production build succeeds.
- Dev server boots and serves HTTP 200.

## Sources
- EPRI — Avoiding Conductor Slap / Vegetation-Caused Faults & Burndown (distribution.epri.com)
- T. A. Short, *Electric Power Distribution Handbook* — Conductor Slapping calculator
- IEEE — "Overhead Distribution Conductor Motion Due to Short-Circuit Forces"
- IEC 60255-151 inverse-time curve constants
- Conductor swing/sag fundamental-frequency relation `f₁ = 0.55/√(sag_m)`
- NOJA Power / recloser settings guides — dead times, shots-to-lockout, fast/slow curves
