# Engineering Notes — Conductor Slap Simulator

Authoritative record of the field/engineering inputs driving the model. Keep this in sync with
the code; when a constant or setting changes, note **why** here.

## Domain owner
Harianto Suryo (APC Relay) — relay protection & physics SME. The model is being evolved from a
single-device teaching toy toward a **field-faithful coordination tool** validated against real
recloser + substation-relay event data.

## Real event used as calibration ground truth
- Initial **line-to-line fault downstream of the recloser**.
- **3140 A** flows through **both** the recloser and the substation feeder relay.
- **Recloser** phase TOC operates in **~0.5 s**.
- **Substation relay does NOT operate** — the recloser clears first and the (digital SEL) relay
  **resets instantaneously** (no induction-disk coast-down).
- On the recloser's **first reclose**, the fault persists → recloser trips again **instantaneously**
  (instantaneous overcurrent element).

## Device settings (as provided)
| | Recloser (G&W, SEL control) | Substation feeder relay (SEL) |
|---|---|---|
| CTR | 1000:1 | 240:1 |
| Phase TOC pickup (secondary) | 0.9 A → **900 A primary** | 3.75 A → **900 A primary** |
| Time dial | 0.80 | 1.50 |
| Curve | **SEL US Extremely Inverse (U4)** | **SEL US Extremely Inverse (U4)** |
| Reclose attempts | 3 | 3 |
| Open intervals | 12 cyc / 1.5 s / 10 s | 6 cyc / 10 s / 10 s |

Both devices pick up at **900 A primary** by design — coordination is by **time**, not pickup.

## Curve family — SEL US curves (NOT IEEE C37.112)
IEEE C37.112 US Extremely Inverse (A=28.2, B=0.1217, p=2) predicts ~2.1 s at the recloser's
settings — **does not match** the 0.5 s event. The SEL controls use SEL's own **US** curve set,
which is much faster. SEL US operate time:

```
t = TD · ( A + B / (M^P − 1) ),   M = I / I_pickup
```

| SEL US curve | A | B | P |
|---|---|---|---|
| U1 Moderately Inverse | 0.0226 | 0.0104 | 0.02 |
| U2 Inverse | 0.180 | 5.95 | 2.0 |
| U3 Very Inverse | 0.0963 | 3.88 | 2.0 |
| **U4 Extremely Inverse (default)** | **0.0352** | **5.67** | **2.0** |
| U5 Short-Time Inverse | 0.00262 | 0.00342 | 0.02 |

### Validation against the event (M = 3140/900 = 3.49, M²−1 = 11.17)
- Recloser, TD 0.80: `0.80·(0.0352 + 5.67/11.17)` = **0.43 s** ✓ (≈ observed 0.5 s)
- Substation relay, TD 1.50: `1.50·(0.0352 + 5.67/11.17)` = **0.81 s** → recloser clears first →
  relay resets instantaneously → **no-op** ✓

> Implementation note: SEL's `A + B/(M^P−1)` is the **same algebraic form** as the existing IEC
> evaluator `TMS·(k/(M^α−1)+c)` with `c=A, k=B, α=P`. New US curves slot straight into
> `CURVE_CONSTANTS` (`src/simulation/constants.ts`) and reuse `inverseTripTimeMs()`.

## Line topology (left = source → right = remote), 3 spans / 4 poles P0–P3
- **P0** — substation/source end: **"S" marker** + feeder relay.
- **span 1** (P0–P1, upstream) · **P1** · **span 2** (P1–P2, upstream).
- **P2** — **G&W recloser + controller cabinet** (the "2nd pole from the last span").
- **span 3** (P2–P3) — the **faulted/instrumented** span, downstream of the recloser.
- **P3** — remote end: **downstream L-L fault** strikes here (remote end of span 3).
- **Induced upstream slap fault** lands on span 1/2 (between substation and recloser); on a radial
  feeder no fault current flows through the recloser for an upstream fault, so the **substation
  relay** clears it.

## Protection coordination logic (target behavior)
- Fault **downstream of recloser** → current through both devices; **recloser** operates (faster
  by time-dial), substation relay is backup and **resets** if the recloser clears first.
- Fault **upstream of recloser** → only the **substation relay** sees it and operates.
- A device trips only if it sees the fault **continuously** for ≥ its operate time; the instant the
  fault current drops, its integrator **resets to zero immediately** (digital SEL behavior).
