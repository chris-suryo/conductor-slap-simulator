/**
 * Default scenario and demo presets.
 *
 * The default mirrors the spec's teaching scenario: a 12.47 kV horizontal-crossarm
 * span, 250 ft, 3.5 ft phase spacing, 5 ft sag, a 7.5 kA AB line-to-line fault, and a
 * fast-instantaneous-then-delayed recloser.
 */
import type { ProtectionSettings, Scenario } from '@/simulation/types'
import { DEFAULT_CONDUCTOR_ID } from '@/simulation/conductorCatalog'

export const DEFAULT_PROTECTION: ProtectionSettings = {
  phasePickupA: 600,
  groundPickupA: 300,
  phaseInstantaneousPickupA: 6000,
  groundInstantaneousPickupA: 2000,
  curveType: 'iec-very-inverse',
  timeMultiplier: 0.5,
  definiteTimeMs: 200,
  breakerOpenTimeMs: 50,
  shotsToLockout: 3,
  recloseShots: [
    { operation: 1, curveMode: 'instantaneous', recloseDelayMs: 1000 },
    { operation: 2, curveMode: 'inverse', recloseDelayMs: 5000 },
    { operation: 3, curveMode: 'inverse', recloseDelayMs: 10000 },
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
}

/** Structured-clone a scenario so store edits never mutate shared preset objects. */
export function cloneScenario(s: Scenario): Scenario {
  return {
    ...s,
    protection: {
      ...s.protection,
      recloseShots: s.protection.recloseShots.map((shot) => ({ ...shot })),
    },
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
    description: 'Fast instantaneous trip clears the fault; reclose finds the conductors clear and restores service.',
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
        // Disable instantaneous so the first shot rides the slower inverse curve.
        phaseInstantaneousPickupA: 12000,
        timeMultiplier: 0.3,
        recloseShots: [
          { operation: 1, curveMode: 'inverse', recloseDelayMs: 500 },
          { operation: 2, curveMode: 'inverse', recloseDelayMs: 500 },
          { operation: 3, curveMode: 'inverse', recloseDelayMs: 500 },
        ],
      },
    }),
  },
]
