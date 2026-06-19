import { useScenarioStore } from '@/state/useScenarioStore'
import { ControlPanel } from './ControlPanel'
import { ResultsPanel } from './ResultsPanel'
import { TimelinePanel } from './TimelinePanel'
import { ModeTabs } from './ModeTabs'
import { PlaybackControls } from './PlaybackControls'
import { DistributionScene } from '@/components/scene/DistributionScene'
import { ForceChart } from '@/components/charts/ForceChart'
import { DisplacementChart } from '@/components/charts/DisplacementChart'
import { TccChart } from '@/components/charts/TccChart'

function Header() {
  return (
    <header className="flex h-14 shrink-0 items-center justify-between gap-4 border-b border-edge bg-panel/40 px-4 backdrop-blur">
      <div className="flex items-center gap-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-energized/15">
          <svg className="h-4 w-4 text-energized" viewBox="0 0 24 24" fill="currentColor">
            <path d="M13 2 4.5 13.5H11l-1 8.5 9.5-12H13z" />
          </svg>
        </div>
        <div>
          <h1 className="text-sm font-semibold leading-tight text-slate-100">Conductor Slap Simulator</h1>
          <p className="text-[11px] leading-tight text-slate-500">
            12.47 kV distribution · magnetic forces &amp; recloser sequencing
          </p>
        </div>
      </div>
      <div className="flex items-center gap-4">
        <PlaybackControls />
        <ModeTabs />
      </div>
    </header>
  )
}

export function Shell() {
  const presentation = useScenarioStore((s) => s.mode === 'presentation')

  return (
    <div className="flex h-screen flex-col overflow-hidden">
      <Header />
      <div className="flex flex-1 gap-3 overflow-hidden p-3">
        {!presentation && (
          <aside className="w-[346px] shrink-0">
            <ControlPanel />
          </aside>
        )}

        <main className="flex min-w-0 flex-1 flex-col gap-3">
          <div className="min-h-0 flex-1">
            <DistributionScene />
          </div>
          <TimelinePanel />
          {!presentation && (
            <div className="grid grid-cols-3 gap-3">
              <ForceChart />
              <DisplacementChart />
              <TccChart />
            </div>
          )}
        </main>

        {!presentation && (
          <aside className="w-[324px] shrink-0">
            <ResultsPanel />
          </aside>
        )}
      </div>
    </div>
  )
}
