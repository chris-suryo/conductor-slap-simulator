# Dev Log

Running, dated log of work on the simulator. Append a new entry every working session. Newest
first. This is the cross-session memory for the two-device-protection / 3D-expansion effort —
read the top entry to see where we left off.

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
