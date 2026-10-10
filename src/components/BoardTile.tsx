import { ArrowLeft, Car, Siren } from 'lucide-react'
import { GROUP_COLORS, naira, type Tile } from '../data/board'
import type { Player } from '../game/game'
import { iconFor } from './TileIcon'
import { inkFor } from './Token'

export type Side = 'bottom' | 'left' | 'top' | 'right'

/** Grid position and facing for each of the 40 squares on an 11×11 grid. */
export function placement(index: number): { row: number; col: number; side: Side; corner: boolean } {
  const corner = index % 10 === 0
  if (index <= 10) return { row: 11, col: 11 - index, side: 'bottom', corner }
  if (index < 20) return { row: 11 - (index - 10), col: 1, side: 'left', corner }
  if (index <= 30) return { row: 1, col: index - 19, side: 'top', corner }
  return { row: index - 29, col: 11, side: 'right', corner }
}

type Props = {
  tile: Tile
  index: number
  active: boolean
  landed: boolean
  owner?: Player
  /** 0–4 houses, 5 = hotel */
  level: number
  mortgaged: boolean
  onHover: (index: number | null) => void
  onSelect: (index: number) => void
}

export function BoardTile({ tile, index, active, landed, owner, level, mortgaged, onHover, onSelect }: Props) {
  const { row, col, side, corner } = placement(index)

  return (
    <button
      type="button"
      className={`tile tile--${side} tile--${tile.kind}${corner ? ' tile--corner' : ''}${active ? ' is-active' : ''}${landed ? ' is-landed' : ''}${owner ? ' is-owned' : ''}${mortgaged ? ' is-mortgaged' : ''}`}
      style={{ gridRow: row, gridColumn: col, '--owner': owner?.color, '--owner-ink': owner && inkFor(owner.color) } as React.CSSProperties}
      onMouseEnter={() => onHover(index)}
      onMouseLeave={() => onHover(null)}
      onFocus={() => onHover(index)}
      onBlur={() => onHover(null)}
      onClick={(e) => {
        onSelect(index)
        // A mouse click shouldn't leave focus here, or Space would toggle the tile instead of rolling
        if (e.detail > 0) e.currentTarget.blur()
      }}
      aria-label={owner ? `${tile.name}, owned by ${owner.name}` : tile.name}
    >
      {corner ? <CornerContent tile={tile} /> : <SideContent tile={tile} owner={owner} level={level} mortgaged={mortgaged} />}
    </button>
  )
}

function SideContent({ tile, owner, level, mortgaged }: { tile: Tile; owner?: Player; level: number; mortgaged: boolean }) {
  const Icon = iconFor(tile)
  const price =
    tile.kind === 'property' || tile.kind === 'transport' || tile.kind === 'utility'
      ? naira(tile.price)
      : tile.kind === 'tax'
        ? `Pay ${naira(tile.amount)}`
        : null

  return (
    <div className="tile__inner">
      {tile.kind === 'property' && (
        <div className="tile__band" style={{ background: GROUP_COLORS[tile.group] }}>
          {level === 5 ? (
            <span className="bldg bldg--hotel" key="hotel" />
          ) : (
            Array.from({ length: level }, (_, i) => <span key={i} className="bldg" />)
          )}
        </div>
      )}
      <div className="tile__name">{tile.name}</div>
      {Icon && (
        <div className="tile__icon">
          <Icon strokeWidth={1.75} />
        </div>
      )}
      {mortgaged && <div className="tile__stamp">Mortgaged</div>}
      {owner ? (
        <div className="tile__owner" key={owner.id}>
          {owner.name}
        </div>
      ) : (
        price && <div className="tile__price">{price}</div>
      )}
    </div>
  )
}

function CornerContent({ tile }: { tile: Tile }) {
  switch (tile.kind) {
    case 'go':
      return (
        <div className="corner corner--go">
          <span className="corner__small">Collect ₦200M salary as you pass</span>
          <span className="corner__go">GO</span>
          <ArrowLeft className="corner__arrow" strokeWidth={2.5} />
        </div>
      )
    case 'jail':
      return (
        <div className="corner corner--jail">
          <div className="jail__cell">
            <span className="jail__bars" aria-hidden />
            <span className="jail__label">Kirikiri</span>
          </div>
          <span className="jail__visiting jail__visiting--left">Just</span>
          <span className="jail__visiting jail__visiting--bottom">Visiting</span>
        </div>
      )
    case 'goslow':
      return (
        <div className="corner corner--diag">
          <span className="corner__small">Third Mainland</span>
          <Car className="corner__icon" strokeWidth={1.75} />
          <span className="corner__title">Go-Slow</span>
        </div>
      )
    case 'gotojail':
      return (
        <div className="corner corner--diag corner--gotojail">
          <span className="corner__small">Go to</span>
          <Siren className="corner__icon" strokeWidth={1.75} />
          <span className="corner__title">Kirikiri</span>
        </div>
      )
    default:
      return null
  }
}
