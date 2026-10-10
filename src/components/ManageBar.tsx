import { Building2, Home, Landmark, Undo2 } from 'lucide-react'
import { BOARD, naira } from '../data/board'
import {
  HOTEL,
  buildBlocker,
  level,
  mortgageBlocker,
  sellBlocker,
  unmortgageBlocker,
  unmortgageCost,
  type BuyableTile,
} from '../game/game'
import type { Game } from '../game/useGame'

/** Build / sell / mortgage controls shown on a deed the current player owns. */
export function ManageBar({ game, index }: { game: Game; index: number }) {
  const { state } = game
  const tile = BOARD[index] as BuyableTile
  const mortgaged = !!state.mortgaged[index]
  const built = level(state, index)
  const buildWhy = buildBlocker(state, index)
  const sellWhy = sellBlocker(state, index)
  const mortgageWhy = mortgaged ? unmortgageBlocker(state, index) : mortgageBlocker(state, index)
  // Explain the most useful disabled button: building first, then mortgaging
  const hint = (tile.kind === 'property' && !mortgaged && built < HOTEL && buildWhy) || mortgageWhy

  return (
    <div className="manage">
      {tile.kind === 'property' && !mortgaged && (
        <div className="manage__row">
          <button className="manage__btn manage__btn--build" disabled={!!buildWhy} onClick={() => game.build(index)}>
            {built >= 4 ? <Building2 size={16} /> : <Home size={16} />}
            <b>{built === HOTEL ? 'Hotel built' : built === 4 ? 'Build hotel' : 'Build house'}</b>
            <span>−{naira(tile.houseCost)}</span>
          </button>
          <button className="manage__btn" disabled={!!sellWhy} onClick={() => game.sell(index)}>
            <Undo2 size={16} />
            <b>{built === HOTEL ? 'Sell hotel' : 'Sell house'}</b>
            <span>+{naira(tile.houseCost / 2)}</span>
          </button>
        </div>
      )}
      {mortgaged ? (
        <button
          className="manage__btn manage__btn--wide"
          disabled={!!mortgageWhy}
          onClick={() => game.unmortgage(index)}
        >
          <Landmark size={16} /> <b>Pay off mortgage</b> <span>−{naira(unmortgageCost(tile))}</span>
        </button>
      ) : (
        <button
          className="manage__btn manage__btn--wide"
          disabled={!!mortgageWhy}
          onClick={() => game.mortgage(index)}
        >
          <Landmark size={16} /> <b>Mortgage</b> <span>+{naira(tile.price / 2)}</span>
        </button>
      )}
      {hint && <p className="manage__hint">{hint}</p>}
    </div>
  )
}
