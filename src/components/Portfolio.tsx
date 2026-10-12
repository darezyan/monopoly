import { useEffect, useState } from 'react'
import { ArrowLeftRight, Building2, DoorOpen, KeyRound, Lock, X } from 'lucide-react'
import { BOARD, GROUP_COLORS, naira, type ColorGroup } from '../data/board'
import { HOTEL, buildingsOf, isBuyable, level, netWorth, ownsGroup, type GameState } from '../game/game'
import { TOKEN_LABELS, TokenDisc } from './Token'
import { iconFor } from './TileIcon'

const GROUPS = Object.keys(GROUP_COLORS) as ColorGroup[]

/** Board indexes for each row of the portfolio: the 8 colour sets, then hubs and utilities. */
const ROWS: { key: string; label: string; color: string; indexes: number[] }[] = [
  ...GROUPS.map((g) => ({
    key: g,
    label: '',
    color: GROUP_COLORS[g],
    indexes: BOARD.flatMap((t, i) => (t.kind === 'property' && t.group === g ? [i] : [])),
  })),
  {
    key: 'transport',
    label: 'Transport',
    color: '#1c1a16',
    indexes: BOARD.flatMap((t, i) => (t.kind === 'transport' ? [i] : [])),
  },
  {
    key: 'utility',
    label: 'Utilities',
    color: '#b48a00',
    indexes: BOARD.flatMap((t, i) => (t.kind === 'utility' ? [i] : [])),
  },
]

type Props = {
  state: GameState
  playerId: number
  onClose: () => void
  /** Open a deed on the board (for managing your own properties) */
  onOpenDeed: (index: number) => void
  /** Whether this device may build and mortgage for the current player */
  canManage: boolean
  /** Offer this player a deal (only when the current player can trade) */
  onTrade?: () => void
  /** Walk out of the game for good (only on your own seat) */
  onLeave?: () => void
}

export function Portfolio({ state, playerId, onClose, onOpenDeed, canManage, onTrade, onLeave }: Props) {
  const [confirmingLeave, setConfirmingLeave] = useState(false)
  const player = state.players[playerId]
  const mine = playerId === state.current && canManage
  const owned = BOARD.filter((_, i) => state.owners[i] === playerId).length
  const { houses, hotels } = buildingsOf(state, playerId)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <aside
        className="sheet"
        role="dialog"
        aria-label={`${player.name}'s properties`}
        style={{ '--token': player.color } as React.CSSProperties}
        onClick={(e) => e.stopPropagation()}
      >
        <header className="sheet__head">
          <TokenDisc player={player} className="token-disc--lg" />
          <div className="sheet__who">
            <h2>{player.name}</h2>
            <span>
              {TOKEN_LABELS[player.token]}
              {player.bankrupt && (player.left ? ' · Left the game' : ' · Bankrupt')}
              {player.inJail && (
                <>
                  {' · '}
                  <Lock size={12} /> Kirikiri
                </>
              )}
              {player.jailFree.length > 0 && (
                <>
                  {' · '}
                  <KeyRound size={12} /> {player.jailFree.length} jail card
                </>
              )}
            </span>
          </div>
          <button className="sheet__close" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </header>

        <dl className="sheet__stats">
          <div>
            <dt>Cash</dt>
            <dd className={player.cash < 0 ? 'is-broke' : undefined}>{naira(player.cash)}</dd>
          </div>
          <div>
            <dt>Net worth</dt>
            <dd>{naira(netWorth(state, playerId))}</dd>
          </div>
          {player.loan && (
            <div>
              <dt>Loan</dt>
              <dd className="is-broke">{naira(player.loan.balance)}</dd>
            </div>
          )}
          <div>
            <dt>Deeds</dt>
            <dd>{owned}</dd>
          </div>
          <div>
            <dt>Buildings</dt>
            <dd>
              {houses}
              <small>h</small> {hotels}
              <small>H</small>
            </dd>
          </div>
        </dl>

        {mine && !player.bankrupt && <p className="sheet__tip">Tap one of your deeds to build, sell or mortgage.</p>}
        {onTrade && !player.bankrupt && playerId !== state.current && (
          <button className="turn__btn sheet__trade" onClick={onTrade}>
            <ArrowLeftRight size={18} /> Propose a deal to {player.name}
          </button>
        )}

        <div className="sheet__sets">
          {ROWS.map((row) => {
            const complete = row.key in GROUP_COLORS && ownsGroup(state, playerId, row.key as ColorGroup)
            return (
              <div key={row.key} className={`set${complete ? ' is-complete' : ''}`}>
                <span
                  className="set__swatch"
                  style={{ background: row.color }}
                  title={complete ? 'Full set' : undefined}
                />
                <div className="set__deeds">
                  {row.indexes.map((i) => {
                    const tile = BOARD[i]
                    if (!isBuyable(tile)) return null
                    const ownerId = state.owners[i]
                    const isOwned = ownerId === playerId
                    const otherOwner = ownerId !== undefined && !isOwned ? state.players[ownerId] : null
                    const built = level(state, i)
                    const Icon = iconFor(tile)
                    return (
                      <button
                        key={i}
                        className={`mini${isOwned ? ' is-owned' : ''}${state.mortgaged[i] ? ' is-mortgaged' : ''}`}
                        style={{ '--accent': row.color } as React.CSSProperties}
                        disabled={!isOwned || !mine}
                        onClick={() => onOpenDeed(i)}
                        title={otherOwner ? `${tile.name}: owned by ${otherOwner.name}` : tile.name}
                      >
                        <span className="mini__band">
                          {Icon && <Icon size={12} strokeWidth={2.2} />}
                          {built === HOTEL ? (
                            <Building2 size={12} strokeWidth={2.4} />
                          ) : (
                            Array.from({ length: built }, (_, h) => <span key={h} className="bldg" />)
                          )}
                        </span>
                        <span className="mini__name">{tile.name}</span>
                        <span className="mini__meta">
                          {state.mortgaged[i]
                            ? 'Mortgaged'
                            : otherOwner
                              ? otherOwner.name
                              : isOwned
                                ? naira(tile.price)
                                : 'Unowned'}
                        </span>
                        {otherOwner && <span className="mini__owner" style={{ background: otherOwner.color }} />}
                      </button>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
        {onLeave && !player.bankrupt && (
          <div className="sheet__leave">
            <button
              className={`offer__pass debt__bust${confirmingLeave ? ' is-confirming' : ''}`}
              onClick={() => (confirmingLeave ? onLeave() : setConfirmingLeave(true))}
              onBlur={() => setConfirmingLeave(false)}
            >
              <DoorOpen size={16} /> {confirmingLeave ? 'Sure? Tap again' : 'Leave game'}
            </button>
            <p>All your property goes back to the bank and your cash is gone. You can’t come back in.</p>
          </div>
        )}
      </aside>
    </div>
  )
}
