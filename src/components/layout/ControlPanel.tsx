import { useScenarioStore } from '@/state/useScenarioStore'
import { CONDUCTOR_CATALOG } from '@/simulation/conductorCatalog'
import type { CurveType, FaultLocation, FaultType, ProtectionSettings } from '@/simulation/types'
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
  { value: 'us-moderately-inverse', label: 'US moderately inverse (U1)' },
  { value: 'us-inverse', label: 'US inverse (U2)' },
  { value: 'us-very-inverse', label: 'US very inverse (U3)' },
  { value: 'us-extremely-inverse', label: 'US extremely inverse (U4)' },
  { value: 'us-short-time-inverse', label: 'US short-time inverse (U5)' },
  { value: 'iec-standard-inverse', label: 'IEC standard inverse' },
  { value: 'iec-very-inverse', label: 'IEC very inverse' },
  { value: 'iec-extremely-inverse', label: 'IEC extremely inverse' },
  { value: 'definite', label: 'Definite time' },
]

const PRESET_BUTTONS = [
  { id: 'protected', label: 'Protected', tone: COLORS.healthy },
  { id: 'no-protection', label: 'No protection', tone: COLORS.fault },
  { id: 'restrike', label: 'Reclose into slap', tone: COLORS.arc },
  { id: 'recorded-event', label: 'Recorded event (3140 A)', tone: COLORS.energized },
]

const FAULT_LOCATION_OPTIONS = [
  { value: 'downstream', label: 'Downstream of recloser' },
  { value: 'upstream', label: 'Upstream (toward substation)' },
]

const RECLOSE_OUTCOME_OPTIONS = [
  { value: 'physics', label: 'By conductor motion (slap)' },
  { value: 'lockout', label: 'Persists → lockout' },
  { value: '1', label: 'Clears on 1st reclose' },
  { value: '2', label: 'Clears on 2nd reclose' },
  { value: '3', label: 'Clears on 3rd reclose' },
]

/** Quick-select downstream fault magnitudes (A). */
const QUICK_MAGNITUDES = [1500, 3140, 5000, 8500]

/**
 * One device's actual settings (CTR, pickup, curve, time dial) — used twice, side by side, for
 * the recloser controller and the substation relay so they can be compared directly.
 */
function DeviceSettingsColumn({
  title,
  accent,
  device,
  disabled,
  onPatch,
}: {
  title: string
  accent: string
  device: ProtectionSettings
  disabled?: boolean
  onPatch: (patch: Partial<ProtectionSettings>) => void
}) {
  const secondaryA = device.phasePickupA / device.ctr
  return (
    <div className={cn('space-y-3 rounded-lg border border-edge bg-panel-raised p-2.5', disabled && 'opacity-50')}>
      <div className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: accent }}>
        {title}
      </div>
      <div className="flex items-baseline justify-between gap-2">
        <span className="label-eyebrow">CTR</span>
        <span className="stat-value text-[13px] text-fg">{device.ctr}:1</span>
      </div>
      <div>
        <Slider
          label="Phase pickup (primary)"
          value={device.phasePickupA}
          min={100}
          max={1200}
          step={50}
          unit="A"
          disabled={disabled}
          onChange={(v) => onPatch({ phasePickupA: v })}
        />
        <p className="mt-1 text-[11px] text-fg-faint">= {secondaryA.toFixed(2)} A secondary (CTR {device.ctr}:1)</p>
      </div>
      <Select
        label="Inverse curve"
        value={device.curveType}
        options={CURVE_OPTIONS}
        disabled={disabled}
        onChange={(v) => onPatch({ curveType: v as CurveType })}
      />
      <Slider
        label="Time dial (TD)"
        value={device.timeMultiplier}
        min={0.05}
        max={3}
        step={0.05}
        disabled={disabled}
        format={(v) => v.toFixed(2)}
        onChange={(v) => onPatch({ timeMultiplier: v })}
      />
    </div>
  )
}

export function ControlPanel() {
  const scenario = useScenarioStore((s) => s.scenario)
  const activePresetId = useScenarioStore((s) => s.activePresetId)
  const applyPreset = useScenarioStore((s) => s.applyPreset)
  const patchScenario = useScenarioStore((s) => s.patchScenario)
  const patchProtection = useScenarioStore((s) => s.patchProtection)
  const patchSubstationRelay = useScenarioStore((s) => s.patchSubstationRelay)
  const setFaultType = useScenarioStore((s) => s.setFaultType)
  const setProtectionEnabled = useScenarioStore((s) => s.setProtectionEnabled)
  const restart = useScenarioStore((s) => s.restart)
  const stop = useScenarioStore((s) => s.stop)

  // Reclose-outcome selector maps to the deterministic model fields.
  const recloseOutcomeValue =
    scenario.restoreOnReclose != null
      ? String(scenario.restoreOnReclose)
      : scenario.faultPersists
        ? 'lockout'
        : 'physics'
  const setRecloseOutcome = (v: string) => {
    if (v === 'physics') patchScenario({ restoreOnReclose: undefined, faultPersists: false })
    else if (v === 'lockout') patchScenario({ restoreOnReclose: undefined, faultPersists: true })
    else patchScenario({ restoreOnReclose: Number(v), faultPersists: false })
  }

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
        <div className="grid grid-cols-2 gap-2">
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

      {/* Fault simulation */}
      <Card>
        <CardHeader eyebrow="Fault simulation" title="Simulate a fault" />
        <div className="space-y-4">
          <div>
            <div className="label-eyebrow mb-1.5">Downstream fault current</div>
            <div className="grid grid-cols-4 gap-1.5">
              {QUICK_MAGNITUDES.map((m) => (
                <button
                  key={m}
                  onClick={() => patchScenario({ faultCurrentA: m })}
                  className={cn(
                    'rounded-md border px-1 py-1.5 text-[11px] font-medium transition-colors',
                    scenario.faultCurrentA === m
                      ? 'border-transparent bg-fault text-on-accent'
                      : 'border-edge bg-panel-raised text-fg-muted hover:border-edge-bright',
                  )}
                >
                  {fmtAmps(m)}
                </button>
              ))}
            </div>
          </div>
          <Slider
            label="Fault current"
            value={scenario.faultCurrentA}
            min={1500}
            max={10000}
            step={100}
            onChange={(v) => patchScenario({ faultCurrentA: v })}
            format={fmtAmps}
            fill={COLORS.fault}
            hint="Drag to set the magnitude. Force between conductors scales with current²."
          />
          <Select
            label="Fault location"
            value={scenario.faultLocation}
            options={FAULT_LOCATION_OPTIONS}
            onChange={(v) => patchScenario({ faultLocation: v as FaultLocation })}
          />
          <div>
            <Select
              label="Reclose outcome"
              value={recloseOutcomeValue}
              options={RECLOSE_OUTCOME_OPTIONS}
              onChange={setRecloseOutcome}
            />
            <p className="mt-1.5 text-[11px] leading-snug text-fg-faint">
              Force a successful reclose on a chosen attempt, persist to lockout, or let conductor
              motion decide.
            </p>
          </div>
          <Slider
            label="Induced upstream fault"
            value={scenario.inducedFaultCurrentA ?? 6000}
            min={1500}
            max={10000}
            step={100}
            onChange={(v) => patchScenario({ inducedFaultCurrentA: v })}
            format={fmtAmps}
            fill={COLORS.arc}
            hint="Magnitude of a slap-induced fault upstream of the recloser (cleared by the substation relay)."
          />
          <div className="flex gap-2">
            <button
              onClick={() => restart()}
              className="flex-1 rounded-lg border border-transparent bg-fault px-3 py-2 text-xs font-semibold text-on-accent transition-opacity hover:opacity-90"
            >
              ▶ Run simulation
            </button>
            <button
              onClick={() => stop()}
              className="flex-1 rounded-lg border border-edge bg-panel-raised px-3 py-2 text-xs font-semibold text-fg-muted transition-colors hover:border-edge-bright hover:text-fg"
            >
              ■ Stop &amp; reset
            </button>
          </div>
        </div>
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
        <CardHeader eyebrow="Relay / recloser" title="Protection settings" />
        <div className="space-y-4">
          <div>
            <Toggle
              label="Recloser controller enabled"
              checked={scenario.protectionEnabled}
              onChange={(b) => setProtectionEnabled(b)}
            />
            <p className="mt-1.5 text-[11px] leading-snug text-fg-faint">
              Only disables the recloser. The substation relay always stays in service — if the
              recloser doesn't react to a downstream fault, the relay clears it instead and
              de-energizes the whole feeder (no split) when its breaker opens.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            <DeviceSettingsColumn
              title="Recloser (downstream)"
              accent={COLORS.fault}
              device={p}
              disabled={protOff}
              onPatch={patchProtection}
            />
            <DeviceSettingsColumn
              title="Substation relay (upstream)"
              accent={COLORS.energized}
              device={scenario.substationRelay}
              onPatch={patchSubstationRelay}
            />
          </div>

          <div className={cn('space-y-4 border-t border-edge pt-4', protOff && 'opacity-50')}>
            <p className="text-[11px] font-medium uppercase tracking-wide text-fg-faint">
              Recloser sequence
            </p>
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
        </div>
      </Card>

      <Disclaimer className="px-1 pb-2" />
    </div>
  )
}
