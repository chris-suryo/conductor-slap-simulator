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

**Next:** Phase 3 — dual TCC chart (recloser + substation relay curves on one log-log plot,
colored + labeled, per-curve operating-time dots so any fault current is traceable on both).
