import { useScenarioStore } from '@/state/useScenarioStore'
import { ControlPanel } from './ControlPanel'
import { ResultsPanel } from './ResultsPanel'
import { TimelinePanel } from './TimelinePanel'
import { ModeTabs } from './ModeTabs'
import { PlaybackControls } from './PlaybackControls'
import { ApcLogo } from './ApcLogo'
import { DistributionScene } from '@/components/scene/DistributionScene'
import { ForceChart } from '@/components/charts/ForceChart'
import { DisplacementChart } from '@/components/charts/DisplacementChart'
import { TccChart } from '@/components/charts/TccChart'

const PRESENTER = 'Arianna Surya'

function Header() {
  return (
    <header className="flex h-14 shrink-0 items-center justify-between gap-4 border-b border-edge bg-panel/50 px-4 backdrop-blur">
      <div className="flex items-center gap-3">
        <ApcLogo />
        <div className="h-8 w-px bg-edge" />
        <div>
          <h1 className="text-sm font-semibold leading-tight text-slate-100">Conductor Slap Simulator</h1>
          <p className="text-[11px] leading-tight text-slate-500">
            Presented by <span className="text-brand">{PRESENTER}</span> · APC Relay Engineering
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

function PresentationCard() {
  return (
    <div className="pointer-events-none absolute inset-x-0 top-0 flex flex-col items-center gap-3 pt-7">
      <ApcLogo size="lg" />
      <div className="text-center">
        <div className="text-xl font-semibold tracking-tight text-slate-50">Conductor Slap Simulator</div>
        <div className="mt-0.5 text-xs text-slate-400">
          Presented by <span className="text-brand">{PRESENTER}</span> · APC Relay Engineering
        </div>
      </div>
    </div>
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
          <div className="relative min-h-0 flex-1">
            <DistributionScene />
            {presentation && <PresentationCard />}
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
