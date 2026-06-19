export const clamp = (v: number, lo: number, hi: number): number =>
  Math.min(hi, Math.max(lo, v))

export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t

export const invLerp = (a: number, b: number, v: number): number =>
  a === b ? 0 : (v - a) / (b - a)

export const round = (v: number, decimals = 0): number => {
  const p = 10 ** decimals
  return Math.round(v * p) / p
}
