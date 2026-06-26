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
    <header className="flex shrink-0 items-center justify-between gap-4 border-b border-edge bg-panel/95 px-4 py-2 shadow-panel backdrop-blur-sm">
      <div className="flex items-center gap-3">
        <ApcLogo />
        <div className="h-40 w-px bg-edge" />
        <div className="min-w-0 flex-1 overflow-hidden">
          <h1 className="truncate text-[64px] font-semibold leading-tight text-fg">
            Magnetic Force - Conductor Slapping Simulator
          </h1>
          <p className="truncate text-[64px] leading-tight text-fg-faint">
            <span className="text-white">Presented by</span>{' '}
            <span className="font-medium text-brand">{BRAND.presenter}</span> ·{' '}
            {/* Only the "APC" word goes orange — the rest of BRAND.name stays the default
                muted color, so this still tracks brand.ts if the name ever changes. */}
            <span className="font-medium text-brand">{BRAND.name.split(' ')[0]}</span>{' '}
            {BRAND.name.split(' ').slice(1).join(' ')}
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

        <main className="csim-scroll flex min-w-0 flex-1 flex-col gap-2 overflow-y-auto">
          {/* Fixed 40vh normally (room for the timeline/charts below). When the surrounding
              chrome is hidden (presentation mode or the scene's own expand toggle), the scene
              is the only thing in `main` — let its OUTER box fill the whole stage, but
              letterbox the canvas itself to a fixed 16:9 (`aspect-video`, capped by
              `max-h-full`/`max-w-full`) so an ultra-wide/tall viewport doesn't stretch the fixed
              camera's FOV into mostly-empty sky/fog — without this the camera (tuned for a
              ~4:3 box) reveals a lot of dark void on the sides with only the Source/Recloser
              labels (drei Html, screen-projected) still legible. */}
          <div
            className={
              chromeHidden
                ? 'relative flex min-h-0 flex-1 items-center justify-center'
                : 'relative h-[40vh] shrink-0'
            }
          >
            <div
              className={chromeHidden ? 'relative' : 'h-full w-full'}
              // `aspect-ratio` needs ONE definite dimension to derive the other from — height
              // fills the flex track, width is computed from it, then clamped if the viewport is
              // narrower than 16:9 (tall/narrow window) so it never overflows sideways.
              style={chromeHidden ? { aspectRatio: '16 / 9', height: '100%', width: 'auto', maxWidth: '100%' } : undefined}
            >
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
          </div>
          {/* Timeline stays visible in presentation mode; only the expand toggle hides it.
              It's now 3x its old height with text matching the scene overlay's size, so
              `main` scrolls (above) rather than clipping it or squeezing the scene. */}
          {!sceneExpanded && <TimelinePanel />}
          {!chromeHidden && (
            <div className="mx-auto grid w-[84.9%] shrink-0 grid-cols-3 gap-2 pb-3">
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
