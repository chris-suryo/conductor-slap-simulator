/**
 * Small built-in conductor catalog. Values are representative/approximate and intended
 * for educational visualization (lighter conductors swing more, increasing slap risk).
 */
import type { ConductorType } from './types'

export const CONDUCTOR_CATALOG: ConductorType[] = [
  {
    id: 'aac-336-4',
    name: '336.4 kcmil AAC (Tulip)',
    material: 'AAC',
    diameterIn: 0.666,
    weightLbPerKft: 207,
    ratedAmpacityA: 470,
    description: 'All-aluminum, common 12.47 kV feeder conductor. Light — swings readily.',
  },
  {
    id: 'acsr-336-4',
    name: '336.4 kcmil ACSR (Linnet 26/7)',
    material: 'ACSR',
    diameterIn: 0.72,
    weightLbPerKft: 463,
    ratedAmpacityA: 530,
    description: 'Steel-reinforced — heavier, stiffer, less prone to large swing.',
  },
  {
    id: 'aac-477',
    name: '477 kcmil AAC (Cosmos)',
    material: 'AAC',
    diameterIn: 0.793,
    weightLbPerKft: 293,
    ratedAmpacityA: 600,
    description: 'Larger all-aluminum conductor for heavier feeders.',
  },
  {
    id: 'aac-795',
    name: '795 kcmil AAC (Arbutus)',
    material: 'AAC',
    diameterIn: 1.026,
    weightLbPerKft: 746,
    ratedAmpacityA: 900,
    description: 'Large all-aluminum main-feeder conductor.',
  },
  {
    id: 'acsr-4-0',
    name: '4/0 ACSR (Penguin 6/1)',
    material: 'ACSR',
    diameterIn: 0.563,
    weightLbPerKft: 291,
    ratedAmpacityA: 340,
    description: 'Common smaller feeder / large lateral conductor.',
  },
  {
    id: 'acsr-1-0',
    name: '1/0 ACSR (Raven 6/1)',
    material: 'ACSR',
    diameterIn: 0.398,
    weightLbPerKft: 145,
    ratedAmpacityA: 230,
    description: 'Light lateral conductor — most susceptible to magnetic swing.',
  },
]

export const DEFAULT_CONDUCTOR_ID = 'aac-336-4'

export function getConductor(id: string): ConductorType {
  return (
    CONDUCTOR_CATALOG.find((c) => c.id === id) ??
    CONDUCTOR_CATALOG.find((c) => c.id === DEFAULT_CONDUCTOR_ID)!
  )
}
