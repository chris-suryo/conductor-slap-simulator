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

**Phase 1 (in progress):**
- Created `docs/` structure: `ENGINEERING_NOTES.md`, `MODEL_TOPOLOGY.md`, this `DEVLOG.md`.
- Quick wins: 200 A live load current when energized & not faulting; fault-current slider min
  → 1500 A.

**Next:** finish Phase 1 verification, then Phase 2 (SEL US curves + two-device engine + event
test gate).
