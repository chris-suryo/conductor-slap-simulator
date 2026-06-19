import { create } from 'zustand'
import type {
  FaultType,
  ProtectionSettings,
  Scenario,
  SimulationResult,
} from '@/simulation/types'
import { runSimulation } from '@/simulation/runSimulation'
import { clamp } from '@/utils/math'
import { DEFAULT_SCENARIO, PRESETS, cloneScenario } from './presets'

export type ViewMode = 'physics' | 'protection' | 'presentation'

interface ScenarioState {
  scenario: Scenario
  result: SimulationResult
  mode: ViewMode

  // Playback
  cursorMs: number
  playing: boolean
  speed: number
  activePresetId: string | null

  // Scenario edits (each re-runs the simulation and replays from the start)
  patchScenario: (patch: Partial<Scenario>) => void
  patchProtection: (patch: Partial<ProtectionSettings>) => void
  setFaultType: (faultType: FaultType) => void
  setProtectionEnabled: (enabled: boolean) => void
  applyPreset: (id: string) => void
  setMode: (mode: ViewMode) => void

  // Playback controls
  play: () => void
  pause: () => void
  togglePlay: () => void
  restart: () => void
  seek: (ms: number) => void
  setSpeed: (speed: number) => void
  advanceCursor: (deltaMs: number) => void
}

export const useScenarioStore = create<ScenarioState>((set, get) => {
  const rerun = (scenario: Scenario, presetId: string | null) => {
    const result = runSimulation(scenario)
    set({ scenario, result, cursorMs: 0, playing: true, activePresetId: presetId })
  }

  return {
    scenario: cloneScenario(DEFAULT_SCENARIO),
    result: runSimulation(DEFAULT_SCENARIO),
    mode: 'physics',

    cursorMs: 0,
    playing: true,
    speed: 1,
    activePresetId: 'protected',

    patchScenario: (patch) => rerun({ ...get().scenario, ...patch }, null),
    patchProtection: (patch) => {
      const s = get().scenario
      rerun({ ...s, protection: { ...s.protection, ...patch } }, null)
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
    seek: (ms) => set((st) => ({ cursorMs: clamp(ms, 0, st.result.durationMs), playing: false })),
    setSpeed: (speed) => set({ speed }),
    advanceCursor: (deltaMs) =>
      set((st) => {
        if (!st.playing) return {}
        const dur = st.result.durationMs
        const next = st.cursorMs + deltaMs
        if (next >= dur) return { cursorMs: dur, playing: false }
        return { cursorMs: next }
      }),
  }
})

// Dev-only: expose the store for quick inspection / scripted verification.
if (import.meta.env.DEV) {
  ;(window as unknown as { __store?: typeof useScenarioStore }).__store = useScenarioStore
}
