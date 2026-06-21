import * as THREE from 'three'
import { mulberry32 } from './prng'

/**
 * A seeded, tileable low-frequency value-noise CanvasTexture: a near-white base with many
 * soft, mostly-darker radial blobs. Kept near-white so it can multiply as an albedo `map`
 * (grass) without darkening the material, while still adding large-scale mottling; also
 * works as a `roughnessMap` (road) so the dusk key light glints unevenly. Built once.
 */
export function makeNoiseTexture(seed: number, size = 256, blobs = 600): THREE.CanvasTexture {
  const cvs = document.createElement('canvas')
  cvs.width = cvs.height = size
  const ctx = cvs.getContext('2d')!
  ctx.fillStyle = 'rgb(244,244,244)'
  ctx.fillRect(0, 0, size, size)

  const rand = mulberry32(seed)
  for (let i = 0; i < blobs; i++) {
    const x = rand() * size
    const y = rand() * size
    const radius = 8 + rand() * 46
    // Mostly subtle darkening patches; a few faint lighter ones for life.
    const shade = rand() < 0.78 ? 90 + rand() * 70 : 255
    const alpha = 0.04 + rand() * 0.08
    const grd = ctx.createRadialGradient(x, y, 0, x, y, radius)
    grd.addColorStop(0, `rgba(${shade},${shade},${shade},${alpha})`)
    grd.addColorStop(1, `rgba(${shade},${shade},${shade},0)`)
    ctx.fillStyle = grd
    ctx.beginPath()
    ctx.arc(x, y, radius, 0, Math.PI * 2)
    ctx.fill()
  }

  const tex = new THREE.CanvasTexture(cvs)
  tex.wrapS = THREE.RepeatWrapping
  tex.wrapT = THREE.RepeatWrapping
  tex.anisotropy = 8
  return tex
}
