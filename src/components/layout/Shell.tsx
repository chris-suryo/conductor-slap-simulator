import { Suspense, lazy } from 'react'
import { useScenarioStore } from '@/state/useScenarioStore'
import { useLayoutStore } from '@/state/useLayoutStore'
import { BRAND } from '@/theme/brand'
import { ControlPanel } from './ControlPanel'
import { ResultsPanel } from './ResultsPanel'
import { TimelinePanel } from './TimelinePanel'
import { ModeTabs } from './ModeTabs'
import { PlaybackControls } from './PlaybackControls'
import { ApcLogo } from './ApcLogo'
import { ThemeToggle } from './ThemeToggle'
import { ResetLayoutButton } from './ResetLayoutButton'
import { ResizeHandle } from './ResizeHandle'
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
    <header className="flex h-14 shrink-0 items-center justify-between gap-4 border-b border-edge bg-panel/95 px-4 shadow-panel backdrop-blur-sm">
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
        <ResetLayoutButton />
        <ThemeToggle />
      </div>
    </header>
  )
}

export function Shell() {
  const presentation = useScenarioStore((s) => s.mode === 'presentation')
  const sceneExpanded = useLayoutStore((s) => s.sceneExpanded)
  const leftWidth = useLayoutStore((s) => s.leftWidth)
  const rightWidth = useLayoutStore((s) => s.rightWidth)

  // Both presentation mode and the "expand scene" toggle collapse the surrounding
  // chrome (asides + charts + timeline) so the 3D scene takes the whole stage.
  const chromeHidden = presentation || sceneExpanded

  return (
    <div className="flex h-screen flex-col overflow-hidden">
      <Header />
      <div className="flex flex-1 gap-3 overflow-hidden p-3">
        {!chromeHidden && (
          <>
            <aside className="shrink-0" style={{ width: leftWidth }}>
              <ControlPanel />
            </aside>
            <ResizeHandle
              ariaLabel="Resize controls panel"
              // Read live width from the store (avoids stale-closure lag during fast drags).
              onDrag={(d) => useLayoutStore.getState().setLeftWidth(useLayoutStore.getState().leftWidth + d)}
            />
          </>
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
          </div>
          {/* Timeline stays visible in presentation mode; only the expand toggle hides it. */}
          {!sceneExpanded && <TimelinePanel />}
          {!chromeHidden && (
            <div className="mx-auto grid w-[28.3%] shrink-0 grid-cols-3 gap-3">
              <ForceChart />
              <DisplacementChart />
              <TccChart />
            </div>
          )}
        </main>

        {!chromeHidden && (
          <>
            <ResizeHandle
              ariaLabel="Resize results panel"
              onDrag={(d) => useLayoutStore.getState().setRightWidth(useLayoutStore.getState().rightWidth - d)}
            />
            <aside className="shrink-0" style={{ width: rightWidth }}>
              <ResultsPanel />
            </aside>
          </>
        )}
      </div>
    </div>
  )
}
