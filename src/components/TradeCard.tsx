import { ArrowLeftRight, Check, KeyRound, Repeat, X } from 'lucide-react'
import { BOARD, GROUP_COLORS, naira } from '../data/board'
import { tradeInterest, type Bundle } from '../game/game'
import type { Game } from '../game/useGame'
import { TokenDisc } from './Token'

const deedColor = (i: number) => {
  const t = BOARD[i]
  return t.kind === 'property' ? GROUP_COLORS[t.group] : t.kind === 'utility' ? '#b48a00' : '#1c1a16'
}

/** The deal on the table, shown in the middle of the board for everyone. */
export function TradeCard({ game, onCounter }: { game: Game; onCounter: () => void }) {
  const { state } = game
  const t = state.trade!
  const proposer = state.players[t.proposer]
  const responder = state.players[t.responder]
  const answering = game.myTurn
  const proposing = game.controls(t.proposer)
  const interest = tradeInterest(t.give.deeds, state)

  return (
    <div className="tradecard">
      <header className="tradecard__head">
        <ArrowLeftRight size={16} /> {t.counters > 0 ? 'Counter-offer' : 'Deal on the table'}
      </header>
      <div className="tradecard__sides">
        <Column title={`${proposer.name} gives`} who={proposer} bundle={t.give} />
        <Column title={`${responder.name} gives`} who={responder} bundle={t.get} />
      </div>

      {answering ? (
        <>
          {interest > 0 && (
            <p className="tradecard__note">You’d pay {naira(interest)} interest on the mortgaged deeds.</p>
          )}
          <div className="tradecard__actions">
            <button className="reveal__ok tradecard__accept" onClick={game.acceptTrade}>
              <Check size={16} /> Accept
            </button>
            {t.counters < 6 && (
              <button className="tradecard__btn" onClick={onCounter}>
                <Repeat size={15} /> Counter
              </button>
            )}
            <button className="tradecard__btn" onClick={game.declineTrade}>
              <X size={15} /> Decline
            </button>
          </div>
        </>
      ) : (
        <div className="tradecard__waiting">
          <span className="dots" aria-hidden>
            <i />
            <i />
            <i />
          </span>
          {responder.robot ? `${responder.name} dey consider am…` : `Waiting for ${responder.name}`}
          {proposing && (
            <button className="tradecard__btn tradecard__withdraw" onClick={game.cancelTrade}>
              Withdraw
            </button>
          )}
        </div>
      )}
    </div>
  )
}

/** One side of a deal: who gives what. Shared with the history panel. */
export function Column({
  title,
  who,
  bundle,
}: {
  title: string
  who: Parameters<typeof TokenDisc>[0]['player']
  bundle: Bundle
}) {
  const empty = bundle.deeds.length === 0 && bundle.cash === 0 && bundle.jailCards === 0
  return (
    <div className="tradecard__col">
      <span className="tradecard__title">
        <TokenDisc player={who} className="tradecard__token" /> {title}
      </span>
      <ul className="tradecard__items">
        {empty && <li className="tradecard__nothing">Nothing</li>}
        {bundle.deeds.map((i) => (
          <li key={i} style={{ '--accent': deedColor(i) } as React.CSSProperties}>
            <span className="tradecard__swatch" />
            {BOARD[i].name}
          </li>
        ))}
        {bundle.cash > 0 && <li className="tradecard__cash">{naira(bundle.cash)}</li>}
        {bundle.jailCards > 0 && (
          <li>
            <KeyRound size={13} /> {bundle.jailCards} jail card{bundle.jailCards > 1 ? 's' : ''}
          </li>
        )}
      </ul>
    </div>
  )
}
