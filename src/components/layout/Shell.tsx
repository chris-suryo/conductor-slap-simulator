import { Suspense, lazy } from 'react'
import { useScenarioStore } from '@/state/useScenarioStore'
import { BRAND } from '@/theme/brand'
import { ControlPanel } from './ControlPanel'
import { ResultsPanel } from './ResultsPanel'
import { TimelinePanel } from './TimelinePanel'
import { ModeTabs } from './ModeTabs'
import { PlaybackControls } from './PlaybackControls'
import { ApcLogo } from './ApcLogo'
import { ThemeToggle } from './ThemeToggle'
import { Spinner } from '@/components/ui/Spinner'
import { ForceChart } from '@/components/charts/ForceChart'
import { DisplacementChart } from '@/components/charts/DisplacementChart'
import { TccChart } from '@/components/charts/TccChart'

// Code-split the heavy three.js / react-three-fiber scene out of the initial bundle.
const DistributionScene = lazy(() =>
  import('@/components/scene/DistributionScene').then((m) => ({ default: m.DistributionScene })),
)

function Header() {
  return (
    <header className="flex h-14 shrink-0 items-center justify-between gap-4 border-b border-edge bg-panel/60 px-4 backdrop-blur-md">
      <div className="flex items-center gap-3">
        <ApcLogo />
        <div className="h-8 w-px bg-edge" />
        <div>
          <h1 className="text-sm font-semibold leading-tight text-fg">Conductor Slap Simulator</h1>
          <p className="text-[11px] leading-tight text-fg-faint">
            Presented by <span className="font-medium text-brand">{BRAND.presenter}</span> · {BRAND.name}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <PlaybackControls />
        <div className="h-6 w-px bg-edge" />
        <ModeTabs />
        <ThemeToggle />
      </div>
    </header>
  )
}

function PresentationCard() {
  return (
    <div className="pointer-events-none absolute inset-x-0 top-0 flex flex-col items-center gap-3 pt-8">
      <div className="flex flex-col items-center gap-3 rounded-2xl border border-edge/70 bg-panel/70 px-8 py-5 shadow-panel backdrop-blur-md">
        <ApcLogo size="lg" />
        <div className="text-center">
          <div className="label-eyebrow mb-1 text-brand">12.47 kV distribution demo</div>
          <div className="text-xl font-semibold tracking-tight text-fg">Conductor Slap Simulator</div>
          <div className="mt-1 text-xs text-fg-muted">
            Presented by <span className="font-medium text-brand">{BRAND.presenter}</span> · {BRAND.name}
          </div>
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
            <Suspense
              fallback={
                <div className="grid h-full w-full place-items-center rounded-xl border border-edge bg-scene">
                  <Spinner label="Loading scene…" />
                </div>
              }
            >
              <DistributionScene />
            </Suspense>
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
