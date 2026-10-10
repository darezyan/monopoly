import {
  BusFront,
  CircleHelp,
  Droplets,
  Lightbulb,
  Plane,
  Ship,
  TrainFront,
  PiggyBank,
  HandCoins,
  PartyPopper,
  type LucideIcon,
} from 'lucide-react'
import type { Tile } from '../data/board'

export function iconFor(tile: Tile): LucideIcon | null {
  switch (tile.kind) {
    case 'transport':
      return { brt: BusFront, rail: TrainFront, air: Plane, ferry: Ship }[tile.transport]
    case 'utility':
      return tile.utility === 'power' ? Lightbulb : Droplets
    case 'wahala':
      return CircleHelp
    case 'ajo':
      return PiggyBank
    case 'tax':
      return tile.amount >= 200 ? HandCoins : PartyPopper
    default:
      return null
  }
}
