# Dev Log

Running, dated log of work on the simulator. Append a new entry every working session. Newest
first. This is the cross-session memory for the two-device-protection / 3D-expansion effort —
read the top entry to see where we left off.

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

**Next:** Phase 6 — induced upstream fault behavior (when an energized slap occurs, strike a
user-set `inducedFaultCurrentA` fault upstream of the recloser, cleared by the substation relay;
visualize on an upstream span). The control value + upstream routing already exist.
