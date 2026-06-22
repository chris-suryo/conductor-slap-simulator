import * as THREE from 'three'
import { mulberry32 } from './prng'

/**
 * A seeded building-facade CanvasTexture: a grid of window cells, ~55% lit. Used as BOTH
 * `map` (panes visible in daylight) and `emissiveMap` (cells glow at dusk) on the single
 * instanced Skyline material — one texture shared across every building (one draw call).
 *
 * The grid is intentionally tall (few columns, many rows) so that after the typical
 * building scale (height >> width) the cells land roughly square rather than smeared.
 */
const COLS = 8
const ROWS = 24
const CW = 16 // px per cell
const CH = 12

export function makeFacadeTexture(seed: number, litColor: string, dimColor: string): THREE.CanvasTexture {
  const cvs = document.createElement('canvas')
  cvs.width = COLS * CW
  cvs.height = ROWS * CH
  const ctx = cvs.getContext('2d')!

  // Dark mullions / gaps between windows.
  ctx.fillStyle = '#05070c'
  ctx.fillRect(0, 0, cvs.width, cvs.height)

  const rand = mulberry32(seed)
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      ctx.fillStyle = rand() < 0.55 ? litColor : dimColor
      ctx.fillRect(c * CW + 2, r * CH + 2, CW - 4, CH - 4)
    }
  }

  const tex = new THREE.CanvasTexture(cvs)
  tex.wrapS = THREE.RepeatWrapping
  tex.wrapT = THREE.RepeatWrapping
  tex.colorSpace = THREE.SRGBColorSpace
  return tex
}
