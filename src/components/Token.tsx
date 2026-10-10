import { Bike, Bus, CarTaxiFront, Sailboat, type LucideIcon } from 'lucide-react'
import type { Player, TokenKind } from '../game/game'

export const TOKEN_ICONS: Record<TokenKind, LucideIcon> = {
  danfo: Bus,
  okada: Bike,
  taxi: CarTaxiFront,
  canoe: Sailboat,
}

export const TOKEN_LABELS: Record<TokenKind, string> = {
  danfo: 'Danfo',
  okada: 'Okada',
  taxi: 'Taxi',
  canoe: 'Canoe',
}

/** A player's token: a coloured disc with their vehicle. */
export function TokenDisc({ player, className = '' }: { player: Player; className?: string }) {
  const Icon = TOKEN_ICONS[player.token]
  return (
    <span
      className={`token-disc ${className}`}
      style={{ '--token': player.color, '--token-ink': inkFor(player.color) } as React.CSSProperties}
    >
      <Icon strokeWidth={2.2} />
    </span>
  )
}

/** Dark icon on light tokens (e.g. danfo yellow), white on the rest. */
export function inkFor(hex: string) {
  const n = parseInt(hex.slice(1), 16)
  const lum = 0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)
  return lum > 160 ? '#1c1a16' : '#fff'
}
