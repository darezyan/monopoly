import { GROUP_COLORS, TRANSPORT_RENT, naira, type Tile } from '../data/board'
import type { Player } from '../game/game'
import { iconFor } from './TileIcon'

type Props = {
  tile: Tile
  owner?: Player
  /** Buildings level when owned: 0–4 houses, 5 = hotel */
  level?: number
  mortgaged?: boolean
  /** Owner holds the whole colour group (base rent doubles) */
  fullSet?: boolean
  children?: React.ReactNode
}

export function DeedCard({ tile, owner, level = 0, mortgaged = false, fullSet = false, children }: Props) {
  const Icon = iconFor(tile)
  const accent = tile.kind === 'property' ? GROUP_COLORS[tile.group] : 'var(--ink)'

  return (
    <article className={`deed${mortgaged ? ' is-mortgaged' : ''}`} style={{ '--accent': accent } as React.CSSProperties}>
      <header className={`deed__head${tile.kind === 'property' ? '' : ' deed__head--plain'}`}>
        <span className="deed__eyebrow">{eyebrow(tile)}</span>
        <h2 className="deed__title">{tile.name}</h2>
        {Icon && tile.kind !== 'property' && <Icon className="deed__icon" strokeWidth={1.5} />}
      </header>
      <p className="deed__tagline">{tile.tagline}</p>
      {owner && (
        <p className="deed__owner" style={{ '--token': owner.color } as React.CSSProperties}>
          <span className="deed__owner-dot" /> Owned by <strong>{owner.name}</strong>
        </p>
      )}
      <DeedBody tile={tile} level={owner ? level : -1} fullSet={fullSet} />
      {mortgaged && <div className="deed__stamp">Mortgaged</div>}
      {children}
    </article>
  )
}

function eyebrow(tile: Tile) {
  switch (tile.kind) {
    case 'property':
      return 'Title deed'
    case 'transport':
      return 'Transport'
    case 'utility':
      return 'Utility'
    case 'tax':
      return 'Levy'
    case 'wahala':
    case 'ajo':
      return 'Card'
    default:
      return 'Corner'
  }
}

function Row({ label, value, strong, current }: { label: string; value: string; strong?: boolean; current?: boolean }) {
  return (
    <div className={`deed__row${strong ? ' deed__row--strong' : ''}${current ? ' is-current' : ''}`}>
      <span>{label}</span>
      <span className="deed__dots" aria-hidden />
      <span className="deed__value">{value}</span>
    </div>
  )
}

/** `level` highlights the rent row in force (−1 when unowned). */
function DeedBody({ tile, level, fullSet }: { tile: Tile; level: number; fullSet: boolean }) {
  switch (tile.kind) {
    case 'property': {
      const [base, ...built] = tile.rent
      return (
        <>
          <div className="deed__table">
            <Row label="Rent" value={naira(base)} strong current={level === 0 && !fullSet} />
            <Row label="Rent with full set" value={naira(base * 2)} current={level === 0 && fullSet} />
            {built.slice(0, 4).map((r, i) => (
              <Row key={i} label={`With ${i + 1} house${i ? 's' : ''}`} value={naira(r)} current={level === i + 1} />
            ))}
            <Row label="With hotel" value={naira(built[4])} strong current={level === 5} />
          </div>
          <div className="deed__foot">
            <Row label="Price" value={naira(tile.price)} />
            <Row label="Each house" value={naira(tile.houseCost)} />
            <Row label="Mortgage" value={naira(tile.price / 2)} />
          </div>
        </>
      )
    }
    case 'transport':
      return (
        <>
          <div className="deed__table">
            {TRANSPORT_RENT.map((r, i) => (
              <Row key={i} label={`Own ${i + 1} hub${i ? 's' : ''}`} value={naira(r)} strong={i === 0} />
            ))}
          </div>
          <div className="deed__foot">
            <Row label="Price" value={naira(tile.price)} />
            <Row label="Mortgage" value={naira(tile.price / 2)} />
          </div>
        </>
      )
    case 'utility':
      return (
        <>
          <div className="deed__table">
            <Row label="Own 1 utility" value="4× dice" strong />
            <Row label="Own both" value="10× dice" />
          </div>
          <div className="deed__foot">
            <Row label="Price" value={naira(tile.price)} />
            <Row label="Mortgage" value={naira(tile.price / 2)} />
          </div>
        </>
      )
    case 'tax':
      return (
        <div className="deed__table">
          <Row label="Pay the bank" value={naira(tile.amount)} strong />
        </div>
      )
    default:
      return null
  }
}
