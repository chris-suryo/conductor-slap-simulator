import { useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useThemeColors } from '@/theme/useThemeColors'
import { SCENE_EMISSIVE } from '@/utils/labels'
import { mulberry32 } from './prng'
import { makeFacadeTexture } from './facadeTexture'

/**
 * A faded low-poly city skyline ringing the scene. One instanced draw call of boxes with
 * deterministic (seeded) sizes/positions across THREE depth bands, biased toward the camera
 * sightline. A shared facade texture gives lit windows (glow at dusk via emissiveMap),
 * per-instance tint separates near/far depth, and a cheap sine "twinkle" keeps it alive.
 * Fully static geometry; the only per-frame work is one scalar emissive write (dark only).
 */
const GROUND_Y = -30
const SEED = 0x5eed
const WINDOW_EMISSIVE = 1.1 // dusk window glow (×) — tune here
/** The feeder/pole line runs along x=0 for the full depth of the scene — keep buildings clear of
 * that corridor (plus margin for the crossarm width and road verge) so none sit in the
 * distribution circuit's line of sight down the poles. */
const CIRCUIT_HALF_WIDTH = 12

// Depth bands: [count, rMin, rMax, hMin, hMax]
const BANDS: Array<[number, number, number, number, number]> = [
  [28, 150, 195, 14, 44], // near
  [22, 200, 255, 20, 60], // mid
  [14, 260, 320, 26, 80], // far (taller towers peek over the haze)
]

export function Skyline({ centerZ, isDark }: { centerZ: number; isDark: boolean }) {
  const c = useThemeColors()

  const facadeTex = useMemo(
    () => makeFacadeTexture(SEED, c.sceneWindow, c.sceneWindowDim),
    [c.sceneWindow, c.sceneWindowDim],
  )

  const { matrices, colors } = useMemo(() => {
    const rand = mulberry32(SEED)
    const ms: THREE.Matrix4[] = []
    const cols: THREE.Color[] = []
    const m = new THREE.Matrix4()
    const q = new THREE.Quaternion()
    const pos = new THREE.Vector3()
    const scl = new THREE.Vector3()
    const near = new THREE.Color(c.sceneSkyline)
    const far = new THREE.Color(c.sceneSkylineFar)

    BANDS.forEach(([count, rMin, rMax, hMin, hMax], band) => {
      for (let i = 0; i < count; i++) {
        // Bias angle toward the camera sightline (camera at -x/+z looking toward -z):
        // sample full circle but skip most that point behind the camera (+z hemisphere).
        let angle = rand() * Math.PI * 2
        if (Math.sin(angle) > 0.35 && rand() < 0.6) {
          // re-roll toward the forward (-z / side) arc
          angle = Math.PI * (0.5 + rand())
        }
        let r = rMin + rand() * (rMax - rMin)
        // Keep clear of the feeder corridor (x≈0, running the full depth of the scene) — re-roll
        // the angle/radius a few times rather than letting a building land on the circuit's
        // line of sight down the pole line.
        for (let tries = 0; tries < 8 && Math.abs(Math.cos(angle) * r) < CIRCUIT_HALF_WIDTH; tries++) {
          angle = rand() * Math.PI * 2
          r = rMin + rand() * (rMax - rMin)
        }
        let bx = Math.cos(angle) * r
        const bz = Math.sin(angle) * r
        // Fallback if every re-roll still landed in the corridor: push straight out to its edge,
        // keeping the same side, so a building can never visually sit on the pole line.
        if (Math.abs(bx) < CIRCUIT_HALF_WIDTH) {
          bx = bx < 0 ? -CIRCUIT_HALF_WIDTH : CIRCUIT_HALF_WIDTH
        }
        const isTower = band === 2 && rand() < 0.3
        const w = isTower ? 7 + rand() * 5 : 8 + rand() * 13
        const d = isTower ? 7 + rand() * 5 : 8 + rand() * 13
        const h = isTower ? hMax * (0.8 + rand() * 0.2) : hMin + rand() * (hMax - hMin)
        pos.set(bx, GROUND_Y + h / 2, centerZ + bz)
        scl.set(w, h, d)
        ms.push(m.clone().compose(pos, q, scl))
        // Far band reads bluer/faded; near band fuller.
        cols.push(band === 2 ? far.clone() : near.clone().lerp(far, band === 1 ? 0.4 : 0))
      }
    })
    return { matrices: ms, colors: cols }
  }, [centerZ, c.sceneSkyline, c.sceneSkylineFar])

  const ref = useRef<THREE.InstancedMesh>(null!)
  const matRef = useRef<THREE.MeshStandardMaterial>(null!)
  useLayoutEffect(() => {
    matrices.forEach((m, i) => {
      ref.current.setMatrixAt(i, m)
      ref.current.setColorAt(i, colors[i])
    })
    ref.current.instanceMatrix.needsUpdate = true
    if (ref.current.instanceColor) ref.current.instanceColor.needsUpdate = true
  }, [matrices, colors])

  // Cheap "alive" twinkle: a tiny global shimmer on the window glow (dusk only).
  useFrame((state) => {
    if (!isDark || !matRef.current) return
    const t = state.clock.elapsedTime
    matRef.current.emissiveIntensity = WINDOW_EMISSIVE * (1 + 0.06 * Math.sin(t * 1.7))
  })

  return (
    <instancedMesh ref={ref} args={[undefined, undefined, matrices.length]}>
      <boxGeometry args={[1, 1, 1]} />
      <meshStandardMaterial
        ref={matRef}
        color="#ffffff" /* per-instance color via setColorAt tints this */
        map={facadeTex}
        emissive={SCENE_EMISSIVE.window}
        emissiveMap={facadeTex}
        emissiveIntensity={isDark ? WINDOW_EMISSIVE : 0}
        roughness={1}
        metalness={0}
        toneMapped={false}
      />
    </instancedMesh>
  )
}
