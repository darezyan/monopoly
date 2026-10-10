import { Bike, Bus, CarTaxiFront, CookingPot, Drum, Sailboat, Shirt, createLucideIcon, type LucideIcon } from 'lucide-react'
import { TOKENS, type TokenKind } from '../data/tokens'
import type { Player } from '../game/game'

/** "I better pass my neighbour": carry frame, spark on the body, exhaust with a puff of smoke. */
const Generator = createLucideIcon('Generator', [
  ['rect', { x: '2.5', y: '9', width: '16', height: '10', rx: '2', key: 'body' }],
  ['path', { d: 'M5.5 9V6.5A1.5 1.5 0 0 1 7 5h7a1.5 1.5 0 0 1 1.5 1.5V9', key: 'handle' }],
  ['path', { d: 'M18.5 14h3v-3', key: 'exhaust' }],
  ['path', { d: 'M21.5 7.5h.01', key: 'smoke' }],
  ['path', { d: 'M11 11.5 9 14h3l-2 2.5', key: 'spark' }],
  ['path', { d: 'M5 19v2M16 19v2', key: 'feet' }],
])

export const TOKEN_ICONS: Record<TokenKind, LucideIcon> = {
  danfo: Bus,
  okada: Bike,
  taxi: CarTaxiFront,
  canoe: Sailboat,
  jollof: CookingPot,
  drum: Drum,
  agbada: Shirt,
  gen: Generator,
}

export const TOKEN_LABELS = Object.fromEntries(TOKENS.map((t) => [t.kind, t.label])) as Record<TokenKind, string>

/** A player's token: a coloured disc with their vehicle. */
export function TokenDisc({
  player,
  className = '',
}: {
  player: Pick<Player, 'token' | 'color'>
  className?: string
}) {
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
