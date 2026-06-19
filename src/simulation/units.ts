/**
 * Unit conversion helpers. The model computes physics in SI (meters, kg, newtons,
 * seconds) but the UI and scenario inputs use field-engineering units (feet, inches,
 * lb/1000ft, cycles). Keep all conversions here so they are testable and consistent.
 */

export const FT_TO_M = 0.3048
export const M_TO_FT = 1 / FT_TO_M
export const IN_TO_M = 0.0254
export const M_TO_IN = 1 / IN_TO_M
export const LB_TO_KG = 0.45359237

export const ftToM = (ft: number): number => ft * FT_TO_M
export const mToFt = (m: number): number => m * M_TO_FT
export const inToM = (inches: number): number => inches * IN_TO_M
export const inToFt = (inches: number): number => inches / 12

/** Convert catalog unit weight (lb per 1000 ft) to mass per length (kg/m). */
export const lbPerKftToKgPerM = (lbPerKft: number): number =>
  (lbPerKft * LB_TO_KG) / (1000 * FT_TO_M)

export const cyclesToMs = (cycles: number, freqHz = 60): number =>
  (cycles / freqHz) * 1000

export const msToCycles = (ms: number, freqHz = 60): number =>
  (ms / 1000) * freqHz
