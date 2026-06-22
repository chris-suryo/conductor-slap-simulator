# Model Topology & Protection Logic

How the simulated line is laid out and which device clears which fault. This is the shared mental
model for both the **3D scene** and the **protection engine**.

## Single-line diagram (radial feeder)

```
 SOURCE                                                          REMOTE
 (substation)                                                    (open end)
   [S]                                                              │
    │                                                               │
  ┌─┴─┐        ┌───┐        ┌───┐ G&W            ┌───┐              │
  │P0 │─span1──│P1 │─span2──│P2 │ recloser ─span3│P3 │  ✻ fault     │
  └───┘        └───┘        └─┬─┘ + cabinet      └───┘  (remote end │
  feeder                     recloser            instrumented      of span 3)
  relay                      (downstream device)  span
   │
   └── upstream zone (spans 1–2): an INDUCED slap fault here is cleared by the feeder relay
```

- **P0** substation/source. `S` billboard marker. Feeder **relay** lives here.
- **P2** carries the **G&W recloser** + **controller cabinet** ("2nd pole from the last span").
- **span 3** (P2→P3) is the **instrumented/faulted** span; the downstream L-L fault arcs at the
  **remote end (P3)**.

## Which device clears which fault (radial coordination)

| Fault location | Recloser sees current? | Relay sees current? | Clears the fault |
|---|---|---|---|
| **Downstream of recloser** (span 3 / P3) | ✅ yes | ✅ yes | **Recloser** (faster TD); relay is backup, resets if recloser clears first |
| **Upstream of recloser** (spans 1–2, induced slap) | ❌ no | ✅ yes | **Substation relay** |

### Reset rule
A device trips only if it sees the fault **continuously** for ≥ its operate time. The instant the
fault current drops (recloser opens, or dead time), the device's integrator **resets to zero
immediately** (digital SEL — no induction-disk coast-down). This is why, at 3140 A, the recloser
(~0.43 s) clears before the relay (~0.81 s) can operate.

## Reclose sequence (per device)
- Recloser: 3 reclose attempts; open intervals **12 cyc / 1.5 s / 10 s**.
- Relay: 3 reclose attempts; open intervals **6 cyc / 10 s / 10 s**.
- A reclose into a still-close / still-arcing conductor pair **re-strikes** (new fault) and steps
  toward **lockout**. The event showed the recloser re-trip on **instantaneous** after the 1st
  reclose into a persistent fault.

## Mapping to code (current vs. target)
- **Today:** one `ProtectionSettings` + one `ProtectionController`; scene hardwires 2 spans
  (left = faulted, right = witness).
- **Target:** two device configs (`recloser`, `substationRelay`); orchestrator picks the operating
  device by fault location; scene renders ≥3 spans with the faulted span = span 3 (downstream).
