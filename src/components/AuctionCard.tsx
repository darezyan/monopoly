import { useEffect, useState } from 'react'
import { Gavel, Minus, Plus } from 'lucide-react'
import { BOARD, GROUP_COLORS, naira } from '../data/board'
import { MIN_RAISE, actingPlayer } from '../game/game'
import type { Game } from '../game/useGame'
import { TokenDisc } from './Token'

const QUICK_RAISES = [10, 50, 100]

/** The property up for auction, shown in the middle of the board for everyone. */
export function AuctionCard({ game }: { game: Game }) {
  const { state } = game
  const a = state.auction!
  const tile = BOARD[a.index]
  const accent = tile.kind === 'property' ? GROUP_COLORS[tile.group] : tile.kind === 'utility' ? '#b48a00' : '#1c1a16'
  const price = 'price' in tile ? tile.price : 0
  const up = state.players[actingPlayer(state)]
  const leader = a.leader === null ? null : state.players[a.leader]
  const minimum = a.bid + MIN_RAISE
  const myGo = game.myTurn
  const cash = up.cash

  const [amount, setAmount] = useState(minimum)
  // Each new high bid resets my box to the smallest raise
  useEffect(() => setAmount(minimum), [minimum])

  const bid = (n: number) => game.bid(Math.max(minimum, Math.min(cash, Math.round(n))))

  return (
    <div className="tradecard auction" style={{ '--accent': accent } as React.CSSProperties}>
      <header className="tradecard__head">
        <Gavel size={16} /> Auction
      </header>

      <div className="auction__lot">
        <span className="auction__band" />
        <span className="auction__name">{tile.name}</span>
        <span className="auction__price">Listed at {naira(price)}</span>
      </div>

      <div className="auction__high">
        {leader ? (
          <>
            <TokenDisc player={leader} className="tradecard__token" />
            <span>
              <b>{leader.name}</b> leads with
            </span>
            <strong>{naira(a.bid)}</strong>
          </>
        ) : (
          <span>No bids yet. Anyone can open from {naira(MIN_RAISE)}.</span>
        )}
      </div>

      <ul className="auction__bidders" aria-label="Still bidding">
        {a.bidders.map((id) => {
          const p = state.players[id]
          return (
            <li key={id} className={id === up.id ? 'is-up' : undefined} title={p.name}>
              <TokenDisc player={p} className="auction__token" />
              <span>{p.name}</span>
            </li>
          )
        })}
      </ul>

      {myGo ? (
        <div className="auction__controls">
          <div className="auction__quick">
            {QUICK_RAISES.map((r) => (
              <button key={r} className="tradecard__btn" disabled={a.bid + r > cash} onClick={() => bid(a.bid + r)}>
                +{naira(r)}
              </button>
            ))}
          </div>
          <div className="auction__custom">
            <div className="deal__stepper">
              <button
                onClick={() => setAmount(Math.max(minimum, amount - 10))}
                disabled={amount <= minimum}
                aria-label="Lower bid"
              >
                <Minus size={16} />
              </button>
              <input
                type="number"
                inputMode="numeric"
                min={minimum}
                max={cash}
                value={amount || ''}
                onChange={(e) => setAmount(Number(e.target.value))}
                aria-label="Your bid, in millions of naira"
              />
              <button
                onClick={() => setAmount(Math.min(cash, amount + 10))}
                disabled={amount >= cash}
                aria-label="Raise bid"
              >
                <Plus size={16} />
              </button>
            </div>
            <button className="reveal__ok" disabled={amount < minimum || amount > cash} onClick={() => bid(amount)}>
              Bid {naira(Math.max(amount, 0))}
            </button>
          </div>
          <button className="tradecard__btn auction__drop" onClick={game.dropOut}>
            Drop out
          </button>
        </div>
      ) : (
        <div className="tradecard__waiting">
          <span className="dots" aria-hidden>
            <i />
            <i />
            <i />
          </span>
          {up.robot ? `${up.name} dey think…` : `${up.name}’s go to bid`}
        </div>
      )}
    </div>
  )
}
