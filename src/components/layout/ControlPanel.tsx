import { useScenarioStore } from '@/state/useScenarioStore'
import { CONDUCTOR_CATALOG } from '@/simulation/conductorCatalog'
import type { CurveType, FaultType } from '@/simulation/types'
import { Card, CardHeader } from '@/components/ui/Card'
import { Slider } from '@/components/ui/Slider'
import { Select } from '@/components/ui/Select'
import { Toggle } from '@/components/ui/Toggle'
import { cn } from '@/utils/cn'
import { COLORS, fmtAmps, fmtMs } from '@/utils/labels'
import { Disclaimer } from './Disclaimer'

const FAULT_OPTIONS = [
  { value: 'AB', label: 'A–B  (line-to-line)' },
  { value: 'BC', label: 'B–C  (line-to-line)' },
  { value: 'AC', label: 'A–C  (line-to-line)' },
  { value: 'AG', label: 'A–G  (coming soon)', disabled: true },
  { value: 'BG', label: 'B–G  (coming soon)', disabled: true },
  { value: 'CG', label: 'C–G  (coming soon)', disabled: true },
  { value: 'ABC', label: '3-phase  (coming soon)', disabled: true },
]

const CURVE_OPTIONS = [
  { value: 'definite', label: 'Definite time' },
  { value: 'iec-standard-inverse', label: 'IEC standard inverse' },
  { value: 'iec-very-inverse', label: 'IEC very inverse' },
  { value: 'iec-extremely-inverse', label: 'IEC extremely inverse' },
]

const PRESET_BUTTONS = [
  { id: 'protected', label: 'Protected', tone: COLORS.healthy },
  { id: 'no-protection', label: 'No protection', tone: COLORS.fault },
  { id: 'restrike', label: 'Reclose into slap', tone: COLORS.arc },
]

export function ControlPanel() {
  const scenario = useScenarioStore((s) => s.scenario)
  const activePresetId = useScenarioStore((s) => s.activePresetId)
  const applyPreset = useScenarioStore((s) => s.applyPreset)
  const patchScenario = useScenarioStore((s) => s.patchScenario)
  const patchProtection = useScenarioStore((s) => s.patchProtection)
  const setFaultType = useScenarioStore((s) => s.setFaultType)
  const setProtectionEnabled = useScenarioStore((s) => s.setProtectionEnabled)

  const p = scenario.protection
  const firstRecloseDelay = p.recloseShots.find((s) => s.operation === 1)?.recloseDelayMs ?? 1000
  const setFirstRecloseDelay = (ms: number) =>
    patchProtection({
      recloseShots: p.recloseShots.map((s) => (s.operation === 1 ? { ...s, recloseDelayMs: ms } : s)),
    })

  const protOff = !scenario.protectionEnabled

  return (
    <div className="csim-scroll flex h-full flex-col gap-3 overflow-y-auto pr-1">
      {/* Presets */}
      <Card>
        <CardHeader eyebrow="Scenario presets" title="Run a teaching scenario" />
        <div className="grid grid-cols-3 gap-2">
          {PRESET_BUTTONS.map((b) => (
            <button
              key={b.id}
              onClick={() => applyPreset(b.id)}
              className={cn(
                'rounded-lg border px-2 py-2 text-xs font-medium transition-colors',
                activePresetId === b.id
                  ? 'border-transparent text-on-accent'
                  : 'border-edge bg-panel-raised text-fg-muted hover:border-edge-bright',
              )}
              style={activePresetId === b.id ? { backgroundColor: b.tone } : undefined}
            >
              {b.label}
            </button>
          ))}
        </div>
        <p className="mt-2 text-[11px] leading-snug text-fg-faint">
          12.47 kV distribution feeder · horizontal crossarm construction
        </p>
      </Card>

      {/* Scenario */}
      <Card>
        <CardHeader eyebrow="Fault & span" title="Scenario" />
        <div className="space-y-4">
          <Select
            label="Fault type"
            value={scenario.faultType}
            options={FAULT_OPTIONS}
            onChange={(v) => setFaultType(v as FaultType)}
          />
          <Slider
            label="Fault current"
            value={scenario.faultCurrentA}
            min={1500}
            max={10000}
            step={100}
            onChange={(v) => patchScenario({ faultCurrentA: v })}
            format={fmtAmps}
            fill={COLORS.fault}
            hint="Force between conductors scales with current² — 10× current ≈ 100× force."
          />
          <Slider
            label="Faulted span length"
            value={scenario.spanLengthFt}
            min={150}
            max={400}
            step={10}
            unit="ft"
            onChange={(v) => patchScenario({ spanLengthFt: v })}
            hint="Longer spans swing more — and slap more readily."
          />
          <Slider
            label="Adjacent span length"
            value={scenario.secondSpanLengthFt}
            min={100}
            max={400}
            step={10}
            unit="ft"
            onChange={(v) => patchScenario({ secondSpanLengthFt: v })}
            fill={COLORS.slate}
            hint="The comparison span on the other side of the center pole."
          />
          <Slider
            label="Phase spacing"
            value={scenario.phaseSpacingFt}
            min={2}
            max={6}
            step={0.1}
            unit="ft"
            format={(v) => v.toFixed(1)}
            onChange={(v) => patchScenario({ phaseSpacingFt: v })}
          />
          <Slider
            label="Conductor sag"
            value={scenario.sagFt}
            min={2}
            max={10}
            step={0.5}
            unit="ft"
            format={(v) => v.toFixed(1)}
            onChange={(v) => patchScenario({ sagFt: v })}
            hint="More sag → slower, larger swing."
          />
          <Select
            label="Conductor"
            value={scenario.conductorTypeId}
            options={CONDUCTOR_CATALOG.map((c) => ({ value: c.id, label: c.name }))}
            onChange={(v) => patchScenario({ conductorTypeId: v })}
          />
        </div>
      </Card>

      {/* Protection */}
      <Card>
        <CardHeader eyebrow="Relay / recloser" title="Protection" />
        <div className="space-y-4">
          <Toggle
            label="Protection enabled"
            checked={scenario.protectionEnabled}
            onChange={(b) => setProtectionEnabled(b)}
          />

          <Slider
            label="Phase pickup"
            value={p.phasePickupA}
            min={100}
            max={1200}
            step={50}
            unit="A"
            disabled={protOff}
            onChange={(v) => patchProtection({ phasePickupA: v })}
          />
          <Slider
            label="Instantaneous pickup"
            value={p.phaseInstantaneousPickupA}
            min={1000}
            max={12000}
            step={250}
            disabled={protOff}
            onChange={(v) => patchProtection({ phaseInstantaneousPickupA: v })}
            format={fmtAmps}
            hint="Fault above this trips instantly; below it rides the time curve."
          />
          <Select
            label="Inverse curve"
            value={p.curveType}
            options={CURVE_OPTIONS}
            disabled={protOff}
            onChange={(v) => patchProtection({ curveType: v as CurveType })}
          />
          <Slider
            label="Time multiplier (TMS)"
            value={p.timeMultiplier}
            min={0.05}
            max={1}
            step={0.05}
            disabled={protOff}
            format={(v) => v.toFixed(2)}
            onChange={(v) => patchProtection({ timeMultiplier: v })}
          />
          <Slider
            label="Breaker open time"
            value={p.breakerOpenTimeMs}
            min={16}
            max={120}
            step={1}
            unit="ms"
            disabled={protOff}
            onChange={(v) => patchProtection({ breakerOpenTimeMs: v })}
          />
          <Slider
            label="First reclose dead time"
            value={firstRecloseDelay}
            min={200}
            max={5000}
            step={50}
            disabled={protOff}
            format={fmtMs}
            onChange={setFirstRecloseDelay}
            fill={COLORS.energized}
          />
          <Slider
            label="Shots to lockout"
            value={p.shotsToLockout}
            min={1}
            max={4}
            step={1}
            disabled={protOff}
            onChange={(v) => patchProtection({ shotsToLockout: v })}
          />
        </div>
      </Card>

      <Disclaimer className="px-1 pb-2" />
    </div>
  )
}
