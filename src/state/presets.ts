/**
 * Default scenario and demo presets.
 *
 * The default mirrors the spec's teaching scenario: a 12.47 kV horizontal-crossarm
 * span, 250 ft, 3.5 ft phase spacing, 5 ft sag, a 7.5 kA AB line-to-line fault, and a
 * fast-instantaneous-then-delayed recloser.
 */
import type { ProtectionSettings, Scenario } from '@/simulation/types'
import { DEFAULT_CONDUCTOR_ID } from '@/simulation/conductorCatalog'

/**
 * Default DOWNSTREAM recloser — the real field SEL settings:
 *   CTR 1000:1, phase TOC pickup 0.9 A sec (900 A primary), TD 0.80, SEL US Extremely Inverse,
 *   3 reclose attempts (→ 4 trips to lockout), open intervals 12 cyc / 1.5 s / 10 s.
 * The instantaneous element is left effectively disabled here (TOC-only) per the stated settings;
 * the recorded-event preset arms a fast element to reproduce the instantaneous re-trip on reclose.
 */
export const DEFAULT_PROTECTION: ProtectionSettings = {
  ctr: 1000,
  phasePickupA: 900, // 0.9 A sec * 1000
  groundPickupA: 300,
  phaseInstantaneousPickupA: 20000, // effectively disabled — TOC-only per the field settings
  groundInstantaneousPickupA: 8000,
  curveType: 'us-extremely-inverse',
  timeMultiplier: 0.8,
  definiteTimeMs: 200,
  breakerOpenTimeMs: 50,
  shotsToLockout: 4, // 3 reclose attempts -> 4 trip operations before lockout
  recloseShots: [
    { operation: 1, curveMode: 'inverse', recloseDelayMs: 200 }, // 12 cycles
    { operation: 2, curveMode: 'inverse', recloseDelayMs: 1500 }, // 1.5 s
    { operation: 3, curveMode: 'inverse', recloseDelayMs: 10000 }, // 10 s
  ],
}

/**
 * Default UPSTREAM substation feeder relay — the field SEL relay settings. Picks up at the same
 * 900 A primary as the recloser but with a higher time dial, so for a downstream fault it is the
 * slower (backup) device and resets when the recloser clears first. CTR 240:1, 3.75 A secondary.
 */
export const DEFAULT_SUBSTATION_RELAY: ProtectionSettings = {
  ctr: 240,
  phasePickupA: 900, // 3.75 A sec * 240
  groundPickupA: 480,
  phaseInstantaneousPickupA: 20000, // effectively no instantaneous element (coordinated backup)
  groundInstantaneousPickupA: 8000,
  curveType: 'us-extremely-inverse',
  timeMultiplier: 1.5,
  definiteTimeMs: 400,
  breakerOpenTimeMs: 50,
  shotsToLockout: 4, // 3 reclose attempts -> 4 trip operations before lockout
  recloseShots: [
    { operation: 1, curveMode: 'inverse', recloseDelayMs: 100 }, // 6 cycles
    { operation: 2, curveMode: 'inverse', recloseDelayMs: 10000 }, // 10 s
    { operation: 3, curveMode: 'inverse', recloseDelayMs: 10000 }, // 10 s
  ],
}

/**
 * The recloser as programmed for the recorded 3140 A event. Same as the default recloser
 * (SEL US EI, 900 A, TD 0.80, 12 cyc / 1.5 s / 10 s) but with the fast/instantaneous element
 * ARMED on the reclose shots — so the first operation rides the TOC curve (~0.5 s) and the
 * re-trip into the still-persistent fault is instantaneous, matching the event record.
 */
export const RECORDED_EVENT_RECLOSER: ProtectionSettings = {
  ...DEFAULT_PROTECTION,
  phaseInstantaneousPickupA: 2500, // fast element armed (below the 3140 A fault)
  groundInstantaneousPickupA: 1500,
  recloseShots: [
    { operation: 1, curveMode: 'inverse', recloseDelayMs: 200 }, // 12 cyc; first op rides TOC
    { operation: 2, curveMode: 'instantaneous', recloseDelayMs: 1500 }, // re-trip instantaneous
    { operation: 3, curveMode: 'instantaneous', recloseDelayMs: 10000 }, // 10 s
  ],
}

export const DEFAULT_SCENARIO: Scenario = {
  voltageClassKv: 12.47,
  spanLengthFt: 250,
  secondSpanLengthFt: 180,
  phaseSpacingFt: 3.5,
  sagFt: 5,
  faultCurrentA: 7500,
  faultType: 'AB',
  conductorTypeId: DEFAULT_CONDUCTOR_ID,
  protectionEnabled: true,
  protection: DEFAULT_PROTECTION,
  substationRelay: DEFAULT_SUBSTATION_RELAY,
  faultLocation: 'downstream',
}

/** Structured-clone a scenario so store edits never mutate shared preset objects. */
export function cloneScenario(s: Scenario): Scenario {
  const cloneDevice = (d: ProtectionSettings): ProtectionSettings => ({
    ...d,
    recloseShots: d.recloseShots.map((shot) => ({ ...shot })),
  })
  return {
    ...s,
    protection: cloneDevice(s.protection),
    substationRelay: cloneDevice(s.substationRelay),
  }
}

export interface ScenarioPreset {
  id: string
  name: string
  description: string
  scenario: Scenario
}

export const PRESETS: ScenarioPreset[] = [
  {
    id: 'protected',
    name: 'Protected feeder',
    description: 'Fast TOC trip clears the fault; reclose finds the conductors clear and restores service.',
    scenario: cloneScenario(DEFAULT_SCENARIO),
  },
  {
    id: 'no-protection',
    name: 'No / slow protection',
    description: 'Fault stays energized long enough to drive a large swing — the conductors slap on the rebound.',
    scenario: cloneScenario({ ...DEFAULT_SCENARIO, protectionEnabled: false }),
  },
  {
    id: 'restrike',
    name: 'Reclose into slap',
    description: 'Slower curve trip builds a big swing; the reclose lands while conductors are still close and re-strikes toward lockout.',
    scenario: cloneScenario({
      ...DEFAULT_SCENARIO,
      faultCurrentA: 8500,
      protection: {
        ...DEFAULT_PROTECTION,
        // Keep the fast element disabled so the first shot rides the slower TOC curve, and raise
        // the time dial so the US EI trip is slow enough (~0.3 s) to build a large swing before
        // clearing (the default TD 0.80 would clear in ~30 ms at this current — far too fast).
        phaseInstantaneousPickupA: 12000,
        timeMultiplier: 3.0,
        // Dead time set near a half swing period (~1.1 s) so the reclose lands while the
        // rebounding conductors are still close — re-striking the fault toward lockout.
        recloseShots: [
          { operation: 1, curveMode: 'inverse', recloseDelayMs: 1150 },
          { operation: 2, curveMode: 'inverse', recloseDelayMs: 1150 },
          { operation: 3, curveMode: 'inverse', recloseDelayMs: 1150 },
        ],
      },
    }),
  },
  {
    id: 'recorded-event',
    name: 'Recorded event (3140 A)',
    description:
      'Real L-L fault downstream of the recloser: recloser TOC clears in ~0.5 s while the substation relay does not operate; the first reclose into the still-persistent fault re-trips instantaneously toward lockout.',
    scenario: cloneScenario({
      ...DEFAULT_SCENARIO,
      faultCurrentA: 3140,
      faultType: 'AB',
      faultLocation: 'downstream',
      faultPersists: true,
      protection: RECORDED_EVENT_RECLOSER,
      substationRelay: DEFAULT_SUBSTATION_RELAY,
    }),
  },
]
