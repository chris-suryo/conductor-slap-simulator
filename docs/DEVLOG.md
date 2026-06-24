# Dev Log

Running, dated log of work on the simulator. Append a new entry every working session. Newest
first. This is the cross-session memory for the two-device-protection / 3D-expansion effort —
read the top entry to see where we left off.

---

## 2026-06-23 — Session 25: ABC three-phase faults — real physics + UI enable + 3D generalization

**Closes the last stub.** ABC was typed (`faultGeometry()` already returned `{ phases: ['A','B',
'C'], isPair: false }`) but had no physics (the force step was gated on `isPair`, so it never
ran) and was disabled in the fault-type dropdown ("3-phase (coming soon)").

**Physics (`runSimulation.ts` + `computeWitnessFrames()`):** a genuine 3-phase bolted fault puts
full fault current on all three conductors, so every pair (A–B, B–C, A–C) repels with the same
I·I formula already used for an L-L fault. Added an `isThreePhase` branch summing each
conductor's repulsion from the OTHER two: the two OUTER phases (A, C) get pushed further outward
because both contributions point the same way; the CENTER phase (B) gets opposing,
largely-cancelling contributions and stays near rest — verified live, B sits at EXACTLY 0 ft
displacement while A/C swing to ±2.09 ft symmetrically (default no-protection scenario). The
scalar frame fields (`pairSeparationFt`/`clearanceFt`/`forcePerLenNPerM`) now track whichever of
the 3 pairs is currently closest (same currents ⇒ closest pair = highest-force pair, so this is
self-consistent); `minClearanceFt` tracking and slap detection were generalized from an
`isPair`-only gate to `hasPairwiseClearance = isPair || isThreePhase`. `computeWitnessFrames()`
got the mirror-image branch so the upstream comparison spans show correct ABC motion too.
`singlePoleTrip` needed no change — it's already keyed on `geom.phases.length === 1`, which is
naturally false for ABC, so the recloser trips all 3 poles together like an L-L fault.

**UI:** `ControlPanel.tsx`'s fault-type dropdown — removed `disabled: true` and relabeled
`'3-phase (coming soon)'` → `'A–B–C (three-phase)'`.

**3D scene generalization:** the per-effect components were hardwired to a single `{a, b}` pair
+ `isPair` boolean, which has no way to express 3 simultaneous conductors. Generalized the whole
pipeline to a `phases: Phase[]` list (computed once in `DistributionScene.tsx` as `geom.phases`,
threaded through `Span.tsx`):
- `MagneticFieldRings`: now renders one ring set per phase in the list (was hardwired to
  `pair.a` + conditionally `pair.b`).
- `ForceArrows`: generalized from 2 fixed arrows to a 3-arrow pool (A/B/C), each pointing away
  from the AVERAGE position of the OTHER phases in the list — this collapses to the exact old
  pair formula when there are 2 phases, and naturally gives the center conductor a near-zero/
  don't-care direction for ABC (its length stays tiny since the real force on it is ~0).
- `FaultArc`: previously relied on the frame's GLOBAL scalar `frame.contact`, which only tracks
  ONE (the closest) pair — wrong for ABC, where 3 independent arcs need to flash independently.
  Changed it to compute its OWN pair's surface-to-surface clearance from live positions (added a
  `diameterIn` prop) and decide contact itself; `Span.tsx` now renders one `FaultArc` per pair
  that's fully contained in `phases` (its `ALL_PAIRS` constant, filtered) — 0 arcs for a ground
  fault, 1 for L-L, 3 for ABC. Caught and fixed a bug here during review: the contact check must
  use the UN-exaggerated displacement, not the `dispGain`-scaled rendering position, or the arc
  flashes before real contact.
- `FaultFireball`: changed from `pair.a`/`pair.b` midpoint to the average rest position of every
  phase in the list — collapses correctly to the single faulted phase for a ground fault, the
  midpoint for L-L, and dead-center for ABC.

**Tests:** new `describe('runSimulation — three-phase faults (ABC)')` block — protection clears
normally; the recloser is NOT single-pole trippable for ABC; outer phases swing, center phase
stays under 10% of the outer displacement; no-protection ABC swings and slaps, same teaching
story as an L-L fault; protected vs. unprotected comparison. 70 tests green (was 65), typecheck
clean. No existing test needed to change — the new branches are purely additive (only fire when
`geom.phases.length === 3`, which no prior test exercised).

**Verified live:** drove the store to `faultType: 'ABC'` and read `result.frames` directly —
`maxA`/`maxC` = 2.09 ft (symmetric), `maxB` = exactly 0, `finalState: 'RESTORED'`,
`slapOccurred: false`, `minClearanceFt: 1.63 ft`. Confirmed the Live-status Outcome card shows
the same numbers. No console errors with ABC selected in the running app (a stale-HMR error
storm appeared first, as documented before — a full `preview_stop`/`preview_start` cleared it,
unrelated to the code change). Updated `CLAUDE.md`'s and `README.md`'s "stubbed" language to
describe the finished feature.

---

## 2026-06-23 — Session 24: ground faults now couple a small force onto the two healthy phases

**Closes the open question from Session 23.** The user confirmed ("Yes") the proposed fix for
the gap flagged at the end of the last session: a ground fault (AG/BG/CG) has no pairwise
repulsion (no second high-current conductor to repel against — the faulted phase itself still
never moves in this model), but the two HEALTHY phases carry ~200 A load current sitting in the
faulted phase's field, so they should feel a small coupling force — the same mechanism already
used for the third/unfaulted phase during an L-L fault (`unfaultedForceNPerM` /
`UNFAULTED_COUPLING`), just from one source instead of two.

**`runSimulation.ts`:** the force-computation block was `if (snap.faultActive && isPair) {...}` —
ground faults (`isPair: false`) skipped it entirely. Added an `else if (snap.faultActive &&
!isPair && geom.phases.length === 1)` branch: for each phase other than the faulted one `pa`,
compute `forcePerLengthNPerM(UNFAULTED_PHASE_CURRENT_A, I, distance)` to the faulted phase, sign
it to push the healthy phase away, and de-rate it by `UNFAULTED_COUPLING * forceGain` — identical
de-rating to the L-L case, just applied per-healthy-phase against the single source instead of
summed from two. The adjacent phase (closer to `pa`) ends up with roughly double the force of the
far phase, matching the 1/distance falloff. ABC (3-phase, still stubbed) is untouched — the new
branch only fires when `geom.phases.length === 1`.

**Tests:** rewrote the now-contradicted `'a single faulted conductor has no pairwise repulsion,
so it never slaps'` test (it asserted hard-zero displacement on ALL three phases). The faulted
phase itself still asserts exactly 0 displacement and `forcePerLenNPerM` still asserts exactly 0
(there's no faulted PAIR for that metric to describe), but the two healthy phases now assert
nonzero-but-small displacement (`< contactThresholdFt`), with `slapOccurred` still `false`. 65
tests green, typecheck clean.

**Verified live:** drove the store to `faultType: 'AG'` and read `result.frames` — adjacent phase
B reaches ~0.0117 ft, far phase C ~0.0058 ft (almost exactly the expected 2:1 ratio from
1/distance), both far under the 0.25 ft contact threshold; `finalState: 'RESTORED'`,
`slapOccurred: false`, no console errors. Updated `CLAUDE.md`'s ground-fault physics description
to match (was: "correctly produces NO pairwise magnetic repulsion/slap"; now describes the new
healthy-phase coupling).

---

## 2026-06-23 — Session 23: single-pole trip converts to 3-pole on the final/lockout shot

**User correction on Session 22:** single-pole tripping should NOT apply to every trip
indefinitely — a real recloser/SEL control single-pole trips the early shots (here: shots 1–3,
DEFAULT_SCENARIO's `shotsToLockout: 4` = 3 reclose attempts) but converts to a three-pole trip on
the FINAL operation before lockout, since it's about to give up and fully isolate the circuit
rather than stay unbalanced. `runSimulation.ts`: imported `isLockout` from `recloserSequence.ts`
and compute `isFinalShot = isLockout(snap.shot, operatingDevice.shotsToLockout)` per frame;
`downstreamHealthyEnergized` is now `singlePoleTrip && !isFinalShot ? true : snap.energized`
(was unconditionally `true` whenever `singlePoleTrip`). `ResultsPanel.tsx`: simplified
`recloserPartialOpen` to `!recloserClosed && frame.downstreamHealthyEnergized` — this is
automatically a full "Open" on the final shot without any extra branching, since
`downstreamHealthyEnergized` already reflects the 3-pole conversion there; also fixed
`subCurrentA` to key off `frame.downstreamHealthyEnergized` instead of the static
`singlePoleTrip` flag, so the substation breaker correctly shows reduced (not nominal) load once
the healthy phases are also interrupted on that final shot.

**Tests:** new case — a persistent AG fault (`faultPersists: true`) sequences all the way to
`LOCKOUT` after exactly 4 trips; frames during shots 1–3's open periods have
`downstreamHealthyEnergized: true` (single-pole), frames during shot 4's open period have it
`false` (three-pole). Verified live: seeking to shot 1's dead-time shows "1 pole open" / "200 A
load"; seeking to shot 4's lockout shows a plain "Open" / "—" current. No console errors. 65
tests green (was 64), typecheck clean.

**Open question raised by the user (not yet implemented):** the two healthy phases on a ground
fault carry ~200 A load current next to the much larger fault current on the faulted phase —
shouldn't proximity to that field push them slightly, the same way the model already pushes the
THIRD (unfaulted) phase a little during an L-L fault (`unfaultedForceNPerM` /
`UNFAULTED_COUPLING`)? Worked out the numbers (see chat) — yes, physically there should be a
small nonzero force, currently NOT modeled because the whole force step in `runSimulation.ts` is
gated on `isPair` and skipped entirely for ground faults. Flagged as a real model gap and a
candidate follow-up (would change the currently-tested "ground faults produce exactly zero
force/displacement" behavior from Session 21) — deferred pending the user's go-ahead rather than
implemented unprompted.

---

## 2026-06-23 — Session 22: recloser single-pole tripping for ground faults

**User feedback on Session 21:** the Live-status panel didn't reflect that the G&W
recloser/SEL control is actually programmed for SINGLE-POLE tripping on a ground fault — it
should open only the faulted phase, leaving the other two energized, while the substation
breaker (no single-pole capability) always trips all three poles. Previously `energized` was a
single all-or-nothing flag for the whole downstream section, so the UI showed the recloser as
fully "Open" (and load current dropping to 0) even on a single-phase fault — physically wrong.

**Model change** (`types.ts`, `runSimulation.ts`):
- New `SimulationResult.singlePoleTrip`: true iff the RECLOSER (not the relay) is the operating
  device AND the fault is single-phase (`geom.phases.length === 1`, i.e. AG/BG/CG) — computed
  once per run from `recloserEngaged && geom.phases.length === 1`.
- New `SimulationFrame.downstreamHealthyEnergized`: true whenever the two healthy phases are
  energized — always `true` under `singlePoleTrip` (they're never interrupted), otherwise equal
  to `energized` (no behavior change for L-L/3-phase faults, which still trip all 3 poles
  together). `energized` itself is UNCHANGED — it still tracks the faulted pole specifically, so
  the existing FSM/tests didn't need touching.
- `computeWitnessFrames`'s witness-span frames get `downstreamHealthyEnergized: pfEff.upstreamEnergized`
  (that span has no per-phase distinction of its own; mirrors its single energization flag for
  type completeness).

**UI** (`ResultsPanel.tsx`): `BreakerStateCell` gained a `partial` prop — shows an amber "1 pole
open" instead of a full red "Open" when `singlePoleTrip && !energized`. The Recloser card's
current readout now keys off `downstreamHealthyEnergized` instead of `energized`, so load current
on the 2 healthy phases stays visible (`200 A · load`) even while the faulted pole is open. The
card's eyebrow reads "Live · downstream · single-pole trip" when applicable. Substation breaker
card is untouched (always full Closed/Open, three-pole, as the user confirmed is correct).

**Tests:** 3 new cases in `runSimulation.test.ts` — AG fault confirms `singlePoleTrip: true`,
`energized` still toggles false on trip, but `downstreamHealthyEnergized` is true for every
frame; an AB (line-to-line) fault confirms `singlePoleTrip: false` and `downstreamHealthyEnergized
=== energized` throughout; a ground fault with the recloser disabled (routed to the substation
relay) also confirms `singlePoleTrip: false` (relay has no single-pole capability).

Verified live: seeking to the trip frame for a default AG fault, the Recloser card reads
"1 pole open" (amber) with "200 A · load" current, eyebrow "single-pole trip", while the
Substation breaker card stays "Closed". Switching to an AB fault reverts the eyebrow to plain
"Live · downstream" with no partial state (confirmed after allowing the re-render to flush — a
synchronous DOM read right after the state change briefly showed stale text). No console errors.
64 tests green (was 61), typecheck clean.

---

## 2026-06-23 — Session 21: AG/BG/CG line-to-ground faults enabled

**User request:** add line-to-ground faults. Turned out the model already handled them safely —
`faultGeometry()` in `runSimulation.ts` has returned `{ phases: [p], isPair: false }` for AG/BG/CG
since early on, and the orchestrator's force step (`if (snap.faultActive && isPair)`) already
skips applying any magnetic force when `isPair` is false, so a ground fault correctly produces
zero conductor motion in this model (no return-path conductor to repel against) — pedagogically
honest: real single-phase-to-ground faults don't slap conductors the way an L-L fault does. The
work was three small changes:
1. `ControlPanel.tsx`: removed `disabled: true` from the AG/BG/CG fault-type options and
   relabeled them "(line-to-ground)" instead of "(coming soon)". ABC (3-phase) stays disabled —
   out of scope for this request.
2. `DistributionScene.tsx`: the fault fireball/smoke at the remote end of the faulted span was
   gated on `g.isPair`, so ground faults showed NO visual at all. Removed the gate — `g.pair`
   already collapses to `{ a: faultedPhase, b: faultedPhase }` when `!isPair` (existing logic,
   unchanged), so `FaultFireball`'s `midX = (restX[a] + restX[b]) / 2` naturally resolves to the
   single faulted conductor's position with no new branching needed. Verified via a temporary
   debug probe (added then removed) that for an AG fault `pair = {a:'A', b:'A'}` and
   `midX = -3.5` (phase A's rest position) — correct.
3. `runSimulation.test.ts`: added a new `describe('line-to-ground faults (AG/BG/CG)')` block —
   6 new tests (`it.each` over AG/BG/CG) asserting (a) protection still trips and restores
   normally (current-magnitude-based, phase-agnostic) and (b) zero displacement/force/slap for
   the whole run under the no-protection preset (proving the model never applies a pairwise
   force for a non-pair fault).
Verified live: all three ground-fault types selectable and not disabled in the UI, each runs to
`RESTORED` with `maxDisplacementFt: 0`; no console errors. 61 tests green (was 55), typecheck
clean.

---

## 2026-06-23 — Session 20: charts too flat/small — restored aspect-ratio sizing

**User feedback:** the 3 charts (force, clearance, TCC) had become too small/flat to actually
see the curves — Session 18's fix for "triple width, keep height" had pinned each chart's plot
container to a tiny fixed `h-[clamp(24px,3.2vh,36px)]`, decoupled from the (now-wide, 84.9%)
row width. Reverted `ForceChart.tsx`/`DisplacementChart.tsx`/`TccChart.tsx`'s non-expanded plot
containers back to `aspect-[4/5] w-full` (the 1:1.25 ratio from Session 12/13), so height once
again scales with the wide row width instead of being pinned tiny. Verified live at 1440×900:
each plot now measures 152×190px (ratio 1.250, was 152×28 — clearly flat before), force/
clearance/TCC curves all visibly readable in a screenshot (was indistinguishable hairlines).
Also hit a pre-existing gotcha while checking: `useLayoutStore`'s `sceneExpanded` persists to
`localStorage`, so a leftover "expand scene" click from an earlier session/server restart can
silently hide the charts entirely on reload — not a regression from this change, but worth
remembering when charts/asides appear to vanish after a restart (toggle via
`window.__layout.getState().toggleSceneExpanded()` or the UI button). No console errors. 55
tests green, typecheck clean.

---

## 2026-06-23 — Session 19: fault fireball + smoke instead of an arc line

**User request:** simulate the fault at the remote end of the faulted span as a small
fireball/smoke effect instead of the existing flickering arc line. Replaced
`scene/EndFaultArc.tsx` with `scene/FaultFireball.tsx` (and updated the one import/usage site in
`DistributionScene.tsx`) — same trigger (`frame.faultActive`) and position (midpoint of the
faulted pair at the remote pole), but the visual is now: a small pulsing emissive sphere
(orange/yellow flicker between `#ffb33d` and `COLORS.arc`, scale jitter 0.55–0.9) instead of a
jittering line, plus 5 looping smoke puffs (soft radial-gradient `THREE.Sprite`s, gray,
1.4s-cycle rise + expand + fade, reusing the project's established procedural-canvas-texture
pattern from `facadeTexture.ts`/`groundTexture.ts`) drifting upward from the same point. The
existing flicker point-light is kept (now lights the fireball's glow instead of an arc).
`FaultArc.tsx` (the separate mid-span conductor-clash arc on contact) is untouched — this only
replaces the fault-current-location effect, not the slap effect. Verified: typecheck clean, 55
tests green; live-injected a one-line debug probe (removed after) confirming the new component
mounts, toggles visibility correctly with `faultActive`, and computes the correct remote-pole
world position — the preview tool's screenshot capture was glitching/timing out for unrelated
infra reasons this session (recurring tiled/cropped renders even after server restarts and
viewport resets), so pixel-level visual confirmation wasn't obtained; relied on the debug-probe
position/visibility check plus a clean console instead.

---

## 2026-06-23 — Session 18: triple chart width, keep height fixed

**User request:** triple the 3 charts' width but keep their height unchanged. First attempt
tried compensating by changing each chart's `aspect-[4/5]` to `aspect-[12/5]` while tripling the
row's width (`w-[28.3%]` → `w-[84.9%]`, mirroring Session 16/17's math) — this was wrong: each
card has a *fixed* `p-4` padding, so tripling the grid-column width doesn't triple the chart's
*inner* content width by the same factor (padding is a much bigger fraction of a small column
than a large one), so the aspect-ratio-derived height ballooned to ~2.25× instead of staying
flat (caught via DOM measurement: height 28px → 63px). **Fix:** decoupled width from height —
`ForceChart.tsx`/`DisplacementChart.tsx`/`TccChart.tsx`'s plot containers now use an explicit
`h-[clamp(24px,3.2vh,36px)]` (matching the previous rendered height almost exactly) instead of
an `aspect-*` class, while `Shell.tsx`'s row width stays at the tripled `w-[84.9%]`. Verified
live at 1440×900: row width 582px (84.9% of mainW 686, as intended), plot height 28px → 29px
(flat, 1px rounding) while plot width grew 23px → 152px (clearly wider). The maximized TCC
overlay (separate code path, still `aspect-[4/5]`) is unaffected — re-checked at 634×792, ratio
1.250. No console errors. 55 tests green, typecheck clean.

---

## 2026-06-23 — Session 17: charts shrunk to a third of their previous size

**User request:** make the 3 charts a third of their current size. `Shell.tsx`: chart grid
width changed from `w-[85%]` (Session 16) to `w-[28.3%]` (85% ÷ 3) — same `mx-auto … shrink-0
grid-cols-3 gap-3` wrapper, ratio (`aspect-[4/5]` on each chart) untouched since it's driven by
column width. Verified via DOM measurement at 1440×900: row width dropped from 583px to 194px
(583/3 ≈ 194.3, matches exactly), each plot ~23×28 (ratio ~1.23, same family as before, small
rounding from low pixel counts). No console errors. 55 tests green, typecheck clean.

---

## 2026-06-23 — Session 16: chart row width set to 85% of the main column

**User request:** make the 3-chart row occupy 85% of the width of the "bottom front view" (the
main column under the 3D scene), instead of the fixed `max-w-md` cap from Session 14.
`Shell.tsx`: changed the chart grid wrapper from `mx-auto grid w-full max-w-md shrink-0
grid-cols-3 gap-3` to `mx-auto grid w-[85%] shrink-0 grid-cols-3 gap-3` — width is now always
85% of `main`'s width (which itself flexes with the left/right aside widths and window size)
rather than a fixed pixel cap. Verified via DOM measurement at both 1440×900 (mainW 686 → rowW
583, 85.0%) and the default viewport (mainW 526 → rowW 447, 85.0%, 3 equal 141px cards); no
console errors. Note: the preview tool's screenshot capture was unavailable this session
(timed out repeatedly even on a fresh server / before any of this change, with `eval` and the
dev server itself both healthy) — verification relied on DOM/computed-style assertions instead.
55 tests green, typecheck clean.

---

## 2026-06-23 — Session 15: light background on the Protection sequence panel

**User request:** change the Protection sequence (timeline) panel's background from dark to
light, same as the charts. `TimelinePanel.tsx`: added the existing `force-light` class (from
Session 8, originally built for the 3 chart cards) to the panel's root `div`. Since `force-light`
overrides the same theme CSS vars the panel's `bg-panel`/`bg-panel-muted`/`border-edge`/
`text-fg*`/`--playhead` utilities read, the whole timeline (track, segments, playhead, event
chips) flips to light regardless of the app's active theme, with no other code changes. Verified
live: panel background computed as white (`rgb(255,255,255)`), border slate-200, screenshot
confirms it now reads light against the dark app shell. No console errors. 55 tests green,
typecheck clean (presentational-only).

---

## 2026-06-23 — Session 14: taller 3D scene, smaller charts (ratio unchanged)

**User request:** make the conductor slap simulation (3D scene) section taller and the charts
shorter, while keeping the charts' 1:1.25 ratio from the previous session. Since each chart's
height is now derived from its column width via `aspect-[4/5]`, shrinking the row's width
shrinks height too at the same ratio — no chart-component changes needed. `Shell.tsx`: capped
the chart grid's width with `mx-auto w-full max-w-md shrink-0` (was full-width `grid-cols-3
gap-3`, stretching across the whole main column). Because `main` is a column flex container with
the 3D scene as the only `flex-1` child, shrinking the chart row's height hands that freed space
straight to the scene automatically — no separate "make scene taller" change was needed either.
Verified live at 1440×900: scene grew to 359px tall (was sharing space with a much taller ~584px
chart row), chart row dropped to 308px total, each plot measured 107×134 → ratio 1.252 (still
1:1.25); the maximized TCC overlay is unaffected (792×634 → 1.250). No console errors. 55 tests
green, typecheck clean.

---

## 2026-06-23 — Session 13: 1:1.25 ratio applied to all 3 front-page charts

**User request:** apply the same 1:1.25 ratio (just confirmed for the maximized TCC chart) to
all three charts as shown on the front page (not maximized) — Magnetic force, Conductor
clearance, TCC. Replaced each chart's plot container with `aspect-[4/5] w-full` (was a fixed
pixel/clamp height — `min-h-[150px] flex-1` for the first two, `h-[clamp(220px,30vh,320px)]
w-[70%]` for TCC) so the height is always derived from the column width at the same ratio as the
maximized view. Since the three charts sit in equal-width grid columns, this also makes all
three cards land at the same height automatically — dropped the `h-full`/`flex-1` card-stretch
hack from Session 10 (no longer needed; `useChartData.ts`/`force-light` theming untouched).
TCC's `Card` only takes `h-full` while `expanded` (the maximized overlay still needs to fill its
fixed-aspect frame). Verified live: all three plot areas measured 40×50 px → ratio 1.250 on a
1000×1000 viewport, matching each other and the maximized chart's ratio. No console errors.
55 tests green, typecheck clean.

---

## 2026-06-23 — Session 12: maximized TCC ratio relaxed from 1:2 to 1:1.25

**User feedback:** the 1:2 maximized ratio from the previous session was too elongated.
`TccChart.tsx`: changed the overlay frame's `aspect-[1/2]` to `aspect-[4/5]` (width:height =
1:1.25) and raised its `max-w` cap from `44vw` to `80vw` so the cap doesn't bind and distort the
ratio on narrower/squarer viewports (verified the old `44vw` cap, sized for the 1:2 case, was
clipping width below the 1:1.25 target on a 1000×1000 test viewport — `80vw` leaves enough room
for the height-driven width to win). Verified live: measured overlay box at 704×880 → ratio
1.250 exactly. No console errors. 55 tests green, typecheck clean.

---

## 2026-06-23 — Session 11: maximized TCC overlay locked to a 1:2 aspect ratio

**User request:** when the TCC chart is maximized, its width:height should be exactly 1:2.
`TccChart.tsx`: the overlay frame was `h-[88vh] w-[60vw] max-w-3xl` (independent width/height,
no fixed ratio) — changed to `aspect-[1/2] h-[88vh] max-w-[44vw]`, so width is always derived as
height/2 instead of being set independently. Verified live: measured overlay box at
440×880 → ratio 0.500 exactly. No console errors. 55 tests green, typecheck clean.

---

## 2026-06-23 — Session 10: TCC x-axis to 100 kA, skinnier/taller plot

**User request:** extend the TCC chart's current (x) axis from 10–10,000 A to 10–100,000 A, and
make the chart drawing skinnier but taller. `TccChart.tsx`: added `X_AXIS_MAX_A = 100_000`,
extended `X_TICKS` to `[10, 100, 1000, 3000, 10000, 30000, 100000]`, and the curve-data
generation loop now runs out to `X_AXIS_MAX_A` instead of a hardcoded 12000. The non-expanded
plot area is now `mx-auto w-[70%]` (was full width) at `h-[clamp(220px,30vh,320px)]` (was
`clamp(150px,17vh,196px)`) — narrower and taller. The maximized overlay's frame is now
`88vh × min(60vw, 3xl)` (was `80vh × min(92vw, 5xl)`) for the same portrait-ish proportions.
Since the 3 charts share one grid row, just growing the TCC card would have left dead space
under the other two (their charts had a fixed pixel height) — fixed by making `ForceChart`'s and
`DisplacementChart`'s `Card`s `h-full` and their chart containers `flex-1` so all three cards
stretch together and the row grows cleanly. Verified live: TCC plot measured narrower (28px)
and taller (300px) than the other two charts' (40px × 252px) at matching card heights (491px);
x-axis ticks render 10/100/1k/3k/10k/30k/100k in the maximized view; no console errors. 55 tests
green, typecheck clean.

---

## 2026-06-23 — Session 9: TCC chart maximize/restore toggle

**User request:** be able to maximize just the TCC chart (not the other two) and restore it to
its original grid size, to read operating times more precisely while hovering the cursor across
the curves. `TccChart.tsx`: added local `expanded` state; the chart's Recharts tree is now built
once (`chart` const) and reused both in the normal grid-sized card and in a maximized view. A new
maximize/minimize icon button (`lucide-react` `Maximize2`/`Minimize2`, matching the existing
"expand scene" button's style) sits in the card header next to the "Disabled" badge. When
expanded, the same `Card` renders inside a `fixed inset-0 z-50` dark backdrop, sized
`80vh × min(92vw, 5xl)`; clicking the backdrop, clicking the button again, or pressing Escape
(window keydown listener, only attached while expanded) all restore it. Kept local to this one
component (no layout-store changes) since only the TCC chart needed it — Force/Displacement
charts are untouched. Verified live: maximize opens a large centered overlay with both curves
clearly readable, restore button and Escape both close it back to the original 3-chart grid, no
console errors. 55 tests green, typecheck clean.

---

## 2026-06-23 — Session 8: light background on the 3 chart cards

**User request:** change the background of all 3 charts (Magnetic force, Conductor clearance,
TOC/TCC curve) from dark to light, regardless of the app's active dark/light theme. Added a
`.force-light` class in `index.css` that overrides the same theme CSS vars the `.dark`/`.light`
root blocks set (`--panel`, `--text-1/2/3`, `--edge*`, `--grid-line`, `--tooltip-bg`,
`--playhead`) with the light theme's values — every Tailwind utility built on those vars
(`bg-panel`, `text-fg*`, `border-edge*`) flips to light within that scope, so card chrome and
text stay correctly readable without touching the rest of the app. Applied `force-light` to the
three chart `Card`s (`ForceChart.tsx`, `DisplacementChart.tsx`, `TccChart.tsx`). Pinned
`useChartTheme()` (`useChartData.ts`) to `buildPalette('light')` instead of the resolved app
theme, since Recharts needs concrete JS color strings, not CSS vars — this is the same hook all
3 (and only those 3) charts use. Verified live: card background/border/title color computed as
white/slate-200/navy regardless of the app being in dark mode; hit the known stale-HMR cascade
after the CSS+component edits (errors in all 3 chart components) — full `preview_stop`/
`preview_start` cleared it, no errors after. 55 tests green, typecheck clean.

---

## 2026-06-23 — Session 7: TCC chart legend moved below, caption removed

**User request:** remove the explanatory caption underneath the TCC chart and move the
"Recloser"/"Substation relay" legend to the bottom of the chart instead of the top.
`TccChart.tsx`: deleted the legend `<div>` from its old spot between the header and the chart
container, deleted the trailing `<p>` caption entirely, and re-added the same legend `<div>`
(centered, `mt-1`) immediately after the chart container so the rendered order is
header → chart → legend. No logic/data changes. Verified via DOM inspection (child order:
header div → chart div → legend div, caption text absent) and no console errors. 55 tests green,
typecheck clean (presentational-only change).

---

## 2026-06-22 — Session 6: official APC logo

Swapped the recreated/placeholder logo for the official one. Found two matched PNGs (3333×833,
RGBA/transparent) in the user's `APC Office Related Stationary/PNG/` folder — vendor naming is
the INVERSE of the app's convention (`_Light`/`_Dark` describe the ink color, not the intended
background): `APC-Logo_Light.png` has white ink (for dark backgrounds), `APC-Logo_Dark.png` has
navy ink (for light backgrounds). Copied to `public/brand/apc-logo.png` (→ `BRAND.logo.src`, the
dark-theme header) and `public/brand/apc-logo-light.png` (→ `BRAND.logo.srcLight`, the light-theme
header), removed the old recreated SVGs, updated `aspect` to 3333/833. Verified live in both
themes: correct file loads per theme (`naturalWidth` 3333, `complete: true`), renders at the
right size/aspect in the header, no console errors. 55 tests green, typecheck clean (asset +
config only, no source logic changed). Favicon (`apc-favicon.svg`) untouched — out of scope,
flagged if wanted later.

---

## 2026-06-22 — Session 5: minor tweaks — default sag, TCC x-axis floor

**User request:** default conductor sag → 4 ft (was 5); TCC chart x-axis should start at 10 A
instead of ~1 kA. Two small, independent edits:
- `DEFAULT_SCENARIO.sagFt` 5 → 4 (`presets.ts`). Re-ran the full suite — the calibration story
  (protected restores, unprotected slaps) still holds at 4 ft.
- `TccChart.tsx`: the x-axis domain was pinned to the lower device's pickup (~900 A) — cut off
  everything below it. Now fixed at `X_AXIS_MIN_A = 10` regardless of pickup (like a real TCC
  sheet, which always shows full standard decades), with `X_TICKS` extended down to
  `[10, 100, 1000, 2000, 3000, 5000, 7000, 10000]`. The plotted curve data itself still only starts
  at the actual pickup (undefined below it) — only the axis/grid extends further left for context.
  Verified live: domain renders 10A-12kA; Recharts thins overlapping tick labels at the card's
  narrow width (shows 10/100/1k/3k/10k) but the underlying ticks/gridlines are all present.
  55 tests still green, typecheck clean.

**Follow-up in the same session:** y-axis (clearing time) range changed to 10 ms – 1000 s (was
30 ms – 40 s), with `Y_TICKS = [10, 100, 1000, 10000, 100000, 1000000]` (ms) rendering as
10ms/100ms/1.0s/10s/100s/1000s. Raised the `tocMs()` display cap (`Y_AXIS_MAX_MS`) to match so the
curve can actually reach the new ceiling instead of flattening at 40s. Verified live: ticks render
exactly as listed, both device curves + operating-time dots plot correctly within the new range.
Typecheck clean, 55 tests still green (chart-only, no model changes).

---

## 2026-06-22 — Session 4: Phase 6 — induced upstream fault from a witness-span slap

**User report:** "when the recloser trips open after seeing the initial fault and upstream
conductors slap, there should create another fault that will cause the upstream relay at the
substation to operate and trip its breaker — but it does not currently." This is exactly the
deferred Phase 6 item. Root cause: the upstream/witness spans (`computeWitnessFrames`) already
mechanically swing and already detect `contact` (the same `classifyClearance` used for the
primary span's own slap), but nothing read that — the substation relay's FSM was completely
unaware of it, so a clash there was visual-only with no electrical consequence.

**Fix (`runSimulation.ts`):** `computeWitnessFrames` now arms a second, independent
`ProtectionController` for `scenario.substationRelay` the first time the witness span clashes
WHILE still energized (split energization keeps it live after the recloser clears the original
fault) — only for downstream-primary scenarios with the recloser actually engaged (an
upstream-primary fault already has the relay engaged on the original event; not double-counted).
The strike magnitude is `scenario.inducedFaultCurrentA` (previously a completely unwired UI
control — `DEFAULT_INDUCED_FAULT_A = 6000` fallback in `constants.ts`). From the strike onward,
this controller's snapshot OVERRIDES `primary.frames[i].upstreamEnergized`/`.energized`/
`.faultActive`/`.currentA` too (mutated in place) — since the substation breaker is upstream of
the recloser, tripping it de-energizes the WHOLE feeder, not just the upstream span. Added
`SimulationResult.upstreamFaultEvent` (atMs / tripTimeMs / finalState) and a banner in
`ResultsPanel`'s Outcome card when one occurs.

**Timeline-extension fix:** the relay's own reclose schedule (dead times up to 10 s) can easily
outlast the PRIMARY run's own horizon, since the strike typically happens well after the
recloser has already settled — was leaving the new sequence cut off mid-way. `computeWitnessFrames`
now synthesizes extra "held" frames (capped at `MAX_UPSTREAM_EXTENSION_MS = 13000`, repeating the
recloser side's already-settled state) and appends them to BOTH `primary.frames` and the witness
output, updating `primary.durationMs` so the playback scrubber can actually reach the resolution.

**Verified live (5kA+ downstream, 400 ft / 10 ft sag adjacent span to force a real clash):** strike
at 2.75 s → relay TOC trip in 249 ms → both Recloser AND Substation-breaker live cards correctly
show 6 kA fault current while timing, then Open/— together (no split) once the breaker opens, then
RESTORED together once it recloses successfully. Outcome banner renders correctly. **Caveat for
the user:** at fully DEFAULT geometry (180 ft adjacent span, 5 ft sag) a plain 5 kA fault gets to
2.14 ft minimum clearance — short of the 0.25 ft contact threshold, so it does NOT actually slap;
the "Adjacent span length" and/or sag sliders need to be pushed up (or current higher) to
reproduce the user's literal example. 5 new tests (`protectionCoordination.test.ts`) — 55 total,
typecheck clean.

---

## 2026-06-22 — Session 3: TCC legend overflow fix + reset-layout button

**Bug report ("why can't I see the entire page anymore"):** user's screenshot showed the
"Substation relay" legend label in the TCC chart (`TccChart.tsx`) floating outside its card,
into the gutter before the right panel. Root cause: the legend row (`flex items-center gap-4`,
two `LegendDot`s) had no wrap, and `Card` doesn't clip overflow — so once the chart card got
narrow enough (e.g. after widening the left panel to read the new two-column recloser/relay
settings, which shrinks the center column), the second label overflowed horizontally instead of
wrapping. Fix: `flex flex-wrap items-center gap-x-3 gap-y-0.5` — wraps to a second line instead of
spilling out. Verified by reproducing the exact cramped state (`leftWidth` 520, `rightWidth` 480 —
the panel max) via `window.__layout`: legend height doubled (wrapped) and stayed inside the card
bounds (`legendRect.right < cardRect.right`).

**Added a reset-layout button** (`ResetLayoutButton.tsx`, header next to the theme toggle) calling
the existing `useLayoutStore.resetWidths()` — lets the user recover from an awkward panel-width
state (like the one that triggered the bug above) without knowing to drag the dividers back.
Verified live: dragging panels to max then clicking the button snaps `leftWidth`/`rightWidth` back
to 346/324. 50 tests green, typecheck clean (no model/test changes this session — UI only).

---

## 2026-06-22 — Session 2: split protection settings panel + recloser-disable semantics

**Two-column device settings (user request — uncommitted, ready to commit):** Split the single
"Protection" card in `ControlPanel.tsx` into a side-by-side comparison: **Recloser (downstream)**
vs **Substation relay (upstream)**, each showing its actual settings — CTR, phase pickup (primary,
with a derived "= X.XX A secondary" readout), inverse curve, and time dial — via a new
`DeviceSettingsColumn` component. Added `patchSubstationRelay` to `useScenarioStore.ts` so the
relay column is editable, not just a readout. The recloser-only sequence controls (instantaneous
pickup, breaker open time, first reclose dead time, shots to lockout) stay below as a separate
"Recloser sequence" block, gated on the recloser-enabled toggle. Time-dial slider max raised
0.05–1 → 0.05–3 (the `restrike` preset already used TD 3.0 — was silently clipped in the old
single-device slider).

**Behavior fix that came with it (user-identified gap): "Protection enabled" was disabling BOTH
devices.** The user's framing: the toggle is the **recloser controller's** enable only; the
substation relay is a real backup device that's always in service. Expected operation when the
recloser is disabled: it doesn't react to a downstream fault at all, so the fault rides through to
the substation relay, which clears it on ITS OWN pickup/curve/TD — and because the relay's breaker
is the substation breaker, opening it de-energizes the **entire** feeder (no upstream/downstream
split), current → 0 everywhere. Implemented in `runSimulation.ts` via a `recloserEngaged =
faultLocation === 'downstream' && protectionEnabled` flag: `operatingDevice = recloserEngaged ?
protection : substationRelay`, controller always constructed with `protectionEnabled: true` (the
device-selection step now encodes whether the recloser is "in the loop," not a blanket disable),
and `upstreamEnergized = recloserEngaged ? true : snap.energized` (split only when the recloser is
actually the operating device). An upstream fault was already routed to the relay regardless of
the toggle — now that's deliberate everywhere, not a side effect.

**Calibration-test fallout:** the existing "no protection" teaching preset/tests relied on
`protectionEnabled: false` meaning **nothing** clears the fault. With the relay now always live,
DEFAULT_SCENARIO's relay (900 A pickup) would clear a 7500 A fault in ~177 ms — defeating that
demo. Fixed by neutralizing the relay specifically in the **`no-protection` preset** (pickup
50000 A, above the fault-slider's 10000 A ceiling) rather than in the engine, preserving the "feeder
with no working protection at all" teaching case. Updated `runSimulation.test.ts`'s calibration
tests to consume `PRESETS.find(p => p.id === 'no-protection').scenario` instead of re-deriving the
old `{ ...DEFAULT_SCENARIO, protectionEnabled: false }` inline (which now means something
different — a real relay-backup case). Added a new test block asserting the new behavior
explicitly: disabling the recloser routes to the relay's own curve, the whole line de-energizes
together, and an upstream fault is unaffected by the recloser toggle either way. 50 tests green
(47 → 50), typecheck clean. Verified live: recloser-disabled run trips at 177 ms (matches
`relayDecisionMs` for the relay's settings) with both Recloser and Substation-breaker live cards
reading Open/— together (no split); `no-protection` preset still shows 0 trips + a slap.

**Next:** Phase 6 — induced upstream fault (unchanged, still pending).

---

## 2026-06-22 — Session 1: kickoff, plan, Phase 1 foundation

**Branch:** `feature/two-device-protection` (off `main` @ `ccf145d`).

**Context established.** Walked the existing model with the SME (Harianto). Agreed to evolve the
single-device IEC model into a **two-device** (recloser + substation relay) coordination tool
validated against a **real event** (3140 A L-L downstream fault). See `ENGINEERING_NOTES.md`.

**Key decisions:**
- Curve family = **SEL US** curves (U1–U5), default **U4 Extremely Inverse**. Reproduces the
  event (recloser ~0.43 s, relay ~0.81 s → relay no-op). IEEE C37.112 was wrong (~2.1 s).
- Topology fixed: `S/relay @P0 → span1 → span2 → recloser @P2 → span3 → fault @P3`. See
  `MODEL_TOPOLOGY.md`.
- 6-phase build sequence (foundation → protection engine → dual TCC → fault-sim UX → 3D → induced
  upstream fault). Full plan in `.claude/plans/`.

**Phase 1 (done — commit ea7d831):**
- Created `docs/` structure: `ENGINEERING_NOTES.md`, `MODEL_TOPOLOGY.md`, this `DEVLOG.md`.
- Quick wins: 200 A live load current when energized & not faulting (`NOMINAL_LOAD_CURRENT_A`,
  shown in `ResultsPanel`); fault-current slider min → 1500 A. Verified live + 32 tests green.

**Phase 2a (done — commit e47f9a3):** Added SEL US curve family (U1–U5) to `CURVE_CONSTANTS` /
`CurveType` (maps onto the existing evaluator via c=A, k=B, alpha=P). US + IEC selectable in the
curve dropdown. Calibration tests: U4 @ TD 0.80 → 0.434 s, @ TD 1.50 → 0.814 s at 3140 A/900 A.

**Phase 2b (done — commit 0ec95fb):** Two-device model. Scenario now carries `protection` (the
downstream recloser), `substationRelay` (upstream relay), `faultLocation`, and optional
`faultPersists`. Added `ctr` to `ProtectionSettings` (secondary↔primary). Orchestrator
(`runSimulation`) picks the operating device by fault location. New **"Recorded event (3140 A)"**
preset reproduces the field event (recloser TOC trip @584 ms = 434 ms TOC, instantaneous re-trip
@859 ms, lockout @2434 ms). Event-data gate in `protectionCoordination.test.ts`. 43 tests green.

**Verification tooling note:** preview via `mcp__Claude_Preview__preview_*` on port 5173; drive
scenarios with `window.__store`; after `seek()`/`applyPreset()` wait ~120–150 ms before reading
the DOM (React renders async). `preview_screenshot` times out on the animating WebGL canvas — use
`preview_eval`/`preview_inspect` instead.

**Phase 3 (done — commit 6e6fef3):** Dual TCC chart — recloser (solid orange) + substation relay
(dashed cyan) on one log-log plot, legend, per-device operating-time dots (recloser 484 ms vs
relay 864 ms at 3140 A). Verified live at 1400×900 (the 3-col chart row needs width; the preview's
small native viewport collapses it — resize before checking charts).

**Default-settings change (user request, post-Phase-3):** Made the REAL field settings the app
defaults for BOTH devices (previously only the recorded-event preset used them; the default
recloser was still old IEC teaching values). Now `DEFAULT_PROTECTION` = recloser CTR 1000:1 /
0.9 A sec (900 A) / TD 0.80 / SEL US EI / 12 cyc·1.5 s·10 s, and `DEFAULT_SUBSTATION_RELAY` = CTR
240:1 / 3.75 A sec (900 A) / TD 1.50 / SEL US EI / 6 cyc·10 s·10 s. "Reclose 3 times" ⇒
`shotsToLockout = 4` (3 attempts → 4 trips) for both. Re-tuned the `restrike` teaching preset
(TD 0.3→3.0) so US EI is still slow enough to build a swing (verified: slap + lockout). Recorded-
event recloser now derives from the default + an armed fast element. All presets verified live
(protected RESTORED 94 ms; no-protection SLAP; restrike SLAP→LOCKOUT 298 ms; recorded-event TOC
434 ms→LOCKOUT, 4 trips). 43 tests green.

**Phase 4 (done — commit 2e442b7):** Fault-simulation UX. New "Fault simulation" card in the
control panel: quick downstream-magnitude buttons (1.5/3.14/5/8.5 kA), the draggable fault-current
slider (moved out of the Scenario card), a fault-location selector (downstream/upstream), a
reclose-outcome selector, an induced upstream-fault magnitude input, and a "Run fault simulation"
button (restarts playback). Reclose-outcome maps to `Scenario.restoreOnReclose` (restore on
1st/2nd/3rd attempt) / `faultPersists` (lockout) / clearance-physics. Added
`Scenario.inducedFaultCurrentA` (control value; behavior lands in Phase 6). Verified live:
clearOn1/2/3 → 1/2/3 trips RESTORED, lockout → 4 trips; upstream routing → relay. 44 tests green.

**Paused here for user review (per request: "continue to phase 4 only and let me review after").**

**Phase 5 (done):** 3D scene rework. `DistributionScene.tsx` now renders **3 spans / 4 poles**
(P0–P3), re-centered on z=0, source at P0 (far) and the faulted span 3 nearest the camera. New
components: `SourceMarker.tsx` (billboarded drei `<Html>` "S/SOURCE" badge, always faces camera),
`Recloser.tsx` (pole-mounted G&W tank + bushings + control cabinet + conduit + label at P2),
`EndFaultArc.tsx` (flickering L-L arc at the remote end of span 3, visible while faultActive).
`Span.tsx` got a `showEffects` prop (upstream spans render clean, no force arrows/rings). Camera
moved to [-58,24,52]/fov 46, `CameraRig` maxDistance→150. Verified live (1400×900): S/SOURCE +
G&W RECLOSER labels render, no console errors, slap scenario plays stably, screenshot confirms the
scene + remote-end arc glow. 44 tests green.

VERIFY TOOLING REMINDER: a fresh `preview_start` resets the viewport to a tiny native size — the
3-col chart row AND the scene Html overlays only populate at a real size; `preview_resize` to
1400×900 before checking. Screenshots can succeed when the scene is seek-paused into a frame.

**Split energization fix (user request, post-Phase-5 — commit 3091185):** When the recloser
trips but the substation breaker stays closed, the section substation→recloser must stay
ENERGIZED at reduced load (was wrongly shown fully dead). Added `SimulationFrame.upstreamEnergized`
(runSimulation sets it true for downstream faults — substation breaker closed); `computeWitnessFrames`
(upstream spans) now use it and carry load current (`NOMINAL_LOAD_CURRENT_A` 200 A → `REDUCED_LOAD_CURRENT_A`
100 A once the recloser sheds downstream load). ResultsPanel live readout shows "Source side" /
"100 A src load". 46 tests green. NOTE: editing several files in a row triggered Vite partial-HMR
errors (stale "X is not defined") — a full page reload (or preview restart) clears them; verify
against a NEW module `?t=` timestamp.

**Split live-state readout (user request — commit ef23b0a):** Replaced the single "Now playing"
card with TWO device cards in `ResultsPanel`: **Recloser** (FSM-state badge, Closed/Open, current
through it, live clearance) and **Substation breaker** (Closed/Open, current through it). Per-device
current logic: both carry the fault current during the fault; with no fault the recloser passes
downstream load while closed (none when open) and the substation passes full load (recloser closed)
or reduced 100 A (recloser open). Verified live (fault: both 3.14 kA; recloser-open: recloser —,
substation 100 A; normal: both 200 A). 46 tests green.

**Next:** Phase 6 — induced upstream fault behavior (when an energized slap occurs, strike a
user-set `inducedFaultCurrentA` fault upstream of the recloser, cleared by the substation relay;
visualize on an upstream span). The control value + upstream routing already exist.
