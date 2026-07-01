import { create } from 'zustand'
import type {
  FaultType,
  ProtectionSettings,
  Scenario,
  SimulationFrame,
  SimulationResult,
} from '@/simulation/types'
import { computeUpstreamSpanFrames, runSimulation } from '@/simulation/runSimulation'
import { clamp } from '@/utils/math'
import { DEFAULT_SCENARIO, PRESETS, cloneScenario } from './presets'

export type ViewMode = 'physics' | 'protection' | 'presentation'

interface ScenarioState {
  scenario: Scenario
  result: SimulationResult
  /** Motion of SPAN 1 (nearest the source), aligned 1:1 with `result.frames`. */
  span1Frames: SimulationFrame[]
  /** Motion of SPAN 2 (between the mid pole and the recloser), aligned 1:1 with `result.frames`. */
  span2Frames: SimulationFrame[]
  mode: ViewMode

  // Playback
  cursorMs: number
  playing: boolean
  speed: number
  loop: boolean
  activePresetId: string | null

  // Scenario edits (each re-runs the simulation and replays from the start)
  patchScenario: (patch: Partial<Scenario>) => void
  /** Like `patchScenario`, but keeps the active preset selected (e.g. "Protected") — changing
   * just the fault magnitude is exploring that same teaching scenario, not leaving it. */
  setFaultCurrent: (faultCurrentA: number) => void
  patchProtection: (patch: Partial<ProtectionSettings>) => void
  patchSubstationRelay: (patch: Partial<ProtectionSettings>) => void
  setFaultType: (faultType: FaultType) => void
  setProtectionEnabled: (enabled: boolean) => void
  applyPreset: (id: string) => void
  setMode: (mode: ViewMode) => void

  // Playback controls
  play: () => void
  pause: () => void
  togglePlay: () => void
  restart: () => void
  /** Stop the simulation and reset to the pre-fault energized (load-current) state. */
  stop: () => void
  seek: (ms: number) => void
  setSpeed: (speed: number) => void
  toggleLoop: () => void
  advanceCursor: (deltaMs: number) => void
}

export const useScenarioStore = create<ScenarioState>((set, get) => {
  const rerun = (scenario: Scenario, presetId: string | null) => {
    const result = runSimulation(scenario)
    const { span1Frames, span2Frames } = computeUpstreamSpanFrames(scenario, result)
    set({ scenario, result, span1Frames, span2Frames, cursorMs: 0, playing: true, activePresetId: presetId })
  }

  const initialResult = runSimulation(DEFAULT_SCENARIO)
  const initialUpstream = computeUpstreamSpanFrames(DEFAULT_SCENARIO, initialResult)

  return {
    scenario: cloneScenario(DEFAULT_SCENARIO),
    result: initialResult,
    span1Frames: initialUpstream.span1Frames,
    span2Frames: initialUpstream.span2Frames,
    mode: 'physics',

    cursorMs: 0,
    playing: true,
    speed: 0.5,
    loop: true,
    activePresetId: 'protected',

    patchScenario: (patch) => rerun({ ...get().scenario, ...patch }, null),
    setFaultCurrent: (faultCurrentA) =>
      rerun({ ...get().scenario, faultCurrentA }, get().activePresetId),
    patchProtection: (patch) => {
      const s = get().scenario
      rerun({ ...s, protection: { ...s.protection, ...patch } }, null)
    },
    patchSubstationRelay: (patch) => {
      const s = get().scenario
      rerun({ ...s, substationRelay: { ...s.substationRelay, ...patch } }, null)
    },
    setFaultType: (faultType) => rerun({ ...get().scenario, faultType }, null),
    setProtectionEnabled: (enabled) =>
      rerun({ ...get().scenario, protectionEnabled: enabled }, enabled ? null : 'no-protection'),
    applyPreset: (id) => {
      const preset = PRESETS.find((p) => p.id === id)
      if (!preset) return
      rerun(cloneScenario(preset.scenario), id)
    },
    setMode: (mode) => set({ mode }),

    play: () =>
      set((st) =>
        st.cursorMs >= st.result.durationMs
          ? { cursorMs: 0, playing: true }
          : { playing: true },
      ),
    pause: () => set({ playing: false }),
    togglePlay: () => (get().playing ? get().pause() : get().play()),
    restart: () => set({ cursorMs: 0, playing: true }),
    // Stop and reset to the pre-fault frame (t=0): the line is energized and carrying load
    // current, no fault yet — so starting again replays cleanly from the load state.
    stop: () => set({ cursorMs: 0, playing: false }),
    seek: (ms) => set((st) => ({ cursorMs: clamp(ms, 0, st.result.durationMs), playing: false })),
    setSpeed: (speed) => set({ speed }),
    toggleLoop: () => set((st) => ({ loop: !st.loop })),
    advanceCursor: (deltaMs) =>
      set((st) => {
        if (!st.playing) return {}
        const dur = st.result.durationMs
        const next = st.cursorMs + deltaMs
        if (next >= dur) {
          // Loop continuously (great for a live demo); otherwise stop at the end.
          return st.loop ? { cursorMs: 0 } : { cursorMs: dur, playing: false }
        }
        return { cursorMs: next }
      }),
  }
})

// Dev-only: expose the store for quick inspection / scripted verification.
if (import.meta.env.DEV) {
  ;(window as unknown as { __store?: typeof useScenarioStore }).__store = useScenarioStore
}
