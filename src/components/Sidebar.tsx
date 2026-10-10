import { useEffect, useRef, useState } from 'react'
import { AlertTriangle, ChevronRight, Dices, Handshake, KeyRound, LayoutGrid, Lock } from 'lucide-react'
import { BOARD, GROUP_COLORS, naira, type Tile } from '../data/board'
import type { Game, SyncStatus } from '../game/useGame'
import { DECK_NAMES, drawnCard, type BuyableTile, type GameState, type Player } from '../game/game'
import { TOKEN_LABELS, TokenDisc, inkFor } from './Token'

type Props = {
  game: Game
  onOpenPortfolio: (playerId: number) => void
}

export function Sidebar({ game, onOpenPortfolio }: Props) {
  const { state } = game
  return (
    <aside className="sidebar">
      <TurnCard game={game} onOpenPortfolio={onOpenPortfolio} />
      <div className="players">
        {state.players.map((p) => (
          <PlayerCard
            key={p.id}
            player={p}
            active={p.id === state.current}
            state={state}
            onOpen={() => onOpenPortfolio(p.id)}
          />
        ))}
      </div>
      <Feed state={state} />
      <SyncBadge sync={game.sync} />
    </aside>
  )
}

const SYNC_LABEL: Record<SyncStatus, string> = {
  offline: 'Playing offline',
  loading: 'Loading game…',
  saving: 'Saving…',
  saved: 'Saved',
  error: 'Couldn’t save. Check your connection',
}

function SyncBadge({ sync }: { sync: SyncStatus }) {
  return (
    <p className={`sync sync--${sync}`} role="status">
      <span className="sync__dot" />
      {SYNC_LABEL[sync]}
    </p>
  )
}

function statusText(state: GameState): string {
  const player = state.players[state.current]
  switch (state.phase) {
    case 'over':
      return `${state.players[state.winner!].name} don win the game.`
    case 'idle':
      if (player.cash < 0) return 'You no get money for hand. Settle your debt before you roll.'
      return player.inJail
        ? `In Kirikiri. Roll doubles to get out (try ${player.jailTurns + 1} of 3).`
        : state.doublesStreak > 0
          ? 'Doubles! Roll again.'
          : 'Your move. Shake the dice.'
    case 'rolling':
      return 'Rolling…'
    case 'moving':
      return 'On the move…'
    case 'card':
      return `You picked ${DECK_NAMES[state.drawn!.deck]}: “${drawnCard(state)!.title}”.`
    case 'landed': {
      const last = state.events.find((e) => e.playerId === player.id)
      if (player.cash < 0) return 'Money don finish. Settle your debt before you end your turn.'
      if (player.inJail) return 'Locked up in Kirikiri.'
      if (state.pendingPurchase !== null) return `Nobody owns ${BOARD[state.pendingPurchase].name} yet. You go buy am?`
      return `${last ? `You ${last.text}.` : BOARD[player.position].name}${state.rollAgain ? ' Doubles, roll again!' : ''}`
    }
  }
}

function TurnCard({ game, onOpenPortfolio }: Props) {
  const { state, sync } = game
  const player = state.players[state.current]
  const busy = state.phase === 'rolling' || state.phase === 'moving' || sync === 'loading'
  const inDebt = player.cash < 0 && (state.phase === 'idle' || state.phase === 'landed')
  const ownsSomething = Object.values(state.owners).includes(player.id)

  if (state.phase === 'over') {
    const winner = state.players[state.winner!]
    return (
      <section className="turn" style={{ '--token': winner.color } as React.CSSProperties}>
        <div className="turn__who">
          <TokenDisc player={winner} className="token-disc--lg" />
          <div>
            <span className="turn__kicker">Winner</span>
            <h2 className="turn__name">{winner.name}</h2>
          </div>
        </div>
        <p className="turn__status">{statusText(state)}</p>
        <button className="turn__btn" onClick={game.newGame}>
          Play again
        </button>
      </section>
    )
  }

  const action =
    state.phase === 'landed'
      ? state.rollAgain && !player.inJail
        ? 'Continue'
        : 'End turn'
      : state.phase === 'card'
        ? 'Na so'
        : player.inJail
          ? 'Roll for doubles'
          : 'Roll dice'
  const onMain = state.phase === 'landed' ? game.endTurn : state.phase === 'card' ? game.applyCard : game.roll
  const jailChoices = state.phase === 'idle' && player.inJail && !inDebt
  const { bail } = state.settings

  return (
    <section className="turn" style={{ '--token': player.color } as React.CSSProperties}>
      <div className="turn__who">
        <TokenDisc player={player} className="token-disc--lg" />
        <div>
          <span className="turn__kicker">Now playing</span>
          <h2 className="turn__name">{player.name}</h2>
        </div>
      </div>
      <p className="turn__status" aria-live="polite">
        {statusText(state)}
      </p>
      {inDebt ? (
        <DebtPanel game={game} onManage={() => onOpenPortfolio(player.id)} />
      ) : state.pendingPurchase !== null ? (
        <BuyOffer
          tile={BOARD[state.pendingPurchase] as BuyableTile}
          cash={player.cash}
          onBuy={game.buy}
          onPass={game.pass}
          onRaise={ownsSomething ? () => onOpenPortfolio(player.id) : undefined}
        />
      ) : (
        <>
          <button className="turn__btn" disabled={busy} onClick={onMain}>
            {(state.phase === 'idle' || busy) && <Dices size={20} strokeWidth={2} />}
            {busy ? 'Hold on…' : action}
            <kbd>Space</kbd>
          </button>
          {jailChoices && (
            <div className="jail-options">
              <button className="offer__pass" onClick={game.payBail} disabled={player.cash < bail}>
                Pay {naira(bail)} bail
              </button>
              {player.jailFree.length > 0 && (
                <button className="offer__pass" onClick={game.useJailCard}>
                  <KeyRound size={18} /> Use card
                </button>
              )}
            </div>
          )}
        </>
      )}
      {ownsSomething && !inDebt && (
        <button className="turn__link" onClick={() => onOpenPortfolio(player.id)}>
          <LayoutGrid size={15} /> Your properties
          <ChevronRight size={15} />
        </button>
      )}
    </section>
  )
}

function DebtPanel({ game, onManage }: { game: Game; onManage: () => void }) {
  const { state } = game
  const player = state.players[state.current]
  const [confirming, setConfirming] = useState(false)
  const creditor =
    player.creditor === null || player.creditor === 'bank' ? 'the bank' : state.players[player.creditor].name

  return (
    <div className="debt">
      <div className="debt__amount">
        <AlertTriangle size={18} />
        You owe {creditor} <strong>{naira(-player.cash)}</strong>
      </div>
      <p className="debt__note">Sell houses or mortgage property to raise the money. If you can’t, you’re bankrupt.</p>
      <div className="offer__actions">
        <button className="turn__btn" onClick={onManage}>
          <LayoutGrid size={18} /> Raise money
        </button>
        <button
          className={`offer__pass debt__bust${confirming ? ' is-confirming' : ''}`}
          onClick={() => (confirming ? game.declareBankruptcy() : setConfirming(true))}
          onBlur={() => setConfirming(false)}
        >
          {confirming ? 'Sure? Tap again' : 'Go bankrupt'}
        </button>
      </div>
    </div>
  )
}

type OfferProps = {
  tile: BuyableTile
  cash: number
  onBuy: () => void
  onPass: () => void
  /** Open your portfolio to mortgage something and afford the purchase */
  onRaise?: () => void
}

function BuyOffer({ tile, cash, onBuy, onPass, onRaise }: OfferProps) {
  const short = cash < tile.price
  return (
    <div className="offer">
      <div
        className="offer__deed"
        style={{ '--accent': tileColor(tile), '--accent-ink': inkFor(tileColor(tile)) } as React.CSSProperties}
      >
        <span className="offer__name">{tile.name}</span>
        <span className="offer__price">{naira(tile.price)}</span>
      </div>
      <p className="offer__note">
        {short ? `You're ${naira(tile.price - cash)} short.` : `You'll have ${naira(cash - tile.price)} left.`}
        {short && onRaise && (
          <button className="offer__raise" onClick={onRaise}>
            Mortgage something?
          </button>
        )}
      </p>
      <div className="offer__actions">
        <button className="turn__btn offer__buy" onClick={onBuy} disabled={short}>
          <Handshake size={20} strokeWidth={2} />
          Buy it
          <kbd>B</kbd>
        </button>
        <button className="offer__pass" onClick={onPass}>
          Pass
          <kbd>P</kbd>
        </button>
      </div>
    </div>
  )
}

/** Swatch colour for a deed: its colour group, or ink/gold for transport and utilities. */
function tileColor(tile: Tile) {
  if (tile.kind === 'property') return GROUP_COLORS[tile.group]
  if (tile.kind === 'utility') return '#b48a00'
  return '#1c1a16'
}

type PlayerCardProps = { player: Player; active: boolean; state: GameState; onOpen: () => void }

function PlayerCard({ player, active, state, onOpen }: PlayerCardProps) {
  const shown = useAnimatedNumber(player.cash)
  // Latest money event for this player drives the floating +/− badge
  const lastMoney = state.events.find((e) => e.playerId === player.id && e.amount !== undefined)
  const deeds = BOARD.flatMap((tile, i) => (state.owners[i] === player.id ? [{ tile, i }] : []))

  return (
    <button
      className={`player${active ? ' is-active' : ''}${player.bankrupt ? ' is-bankrupt' : ''}`}
      style={{ '--token': player.color } as React.CSSProperties}
      onClick={onOpen}
      aria-label={`${player.name}: see properties`}
    >
      <TokenDisc player={player} />
      <span className="player__meta">
        <span className="player__name">
          {player.name}
          {player.bankrupt && <span className="player__badge player__badge--out">Bankrupt</span>}
          {player.inJail && (
            <span className="player__badge">
              <Lock size={11} strokeWidth={2.5} /> Kirikiri
            </span>
          )}
          {player.jailFree.length > 0 && (
            <span className="player__badge player__badge--key" title="Get out of Kirikiri free">
              <KeyRound size={11} strokeWidth={2.5} /> ×{player.jailFree.length}
            </span>
          )}
        </span>
        <span className="player__sub">
          {TOKEN_LABELS[player.token]} · {BOARD[player.position].name}
        </span>
      </span>
      <span className={`player__cash${player.cash < 0 ? ' is-broke' : ''}`}>
        {naira(Math.round(shown))}
        {lastMoney && (
          <span
            key={lastMoney.id}
            className={`player__delta ${lastMoney.amount! >= 0 ? 'is-up' : 'is-down'}`}
          >
            {lastMoney.amount! >= 0 ? '+' : '−'}
            {naira(Math.abs(lastMoney.amount!))}
          </span>
        )}
      </span>
      {deeds.length > 0 && (
        <span className="player__deeds">
          {deeds.map(({ tile, i }) => (
            <span
              key={i}
              className={`player__deed${state.mortgaged[i] ? ' is-mortgaged' : ''}`}
              title={tile.name}
              style={{ '--accent': tileColor(tile) } as React.CSSProperties}
            />
          ))}
        </span>
      )}
    </button>
  )
}

function Feed({ state }: { state: GameState }) {
  if (state.events.length === 0) {
    return <p className="feed feed--empty">Nothing don happen yet. First roll is yours.</p>
  }
  return (
    <ol className="feed">
      {state.events.slice(0, 6).map((e) => {
        const p = state.players[e.playerId]
        return (
          <li key={e.id} className="feed__item" style={{ '--token': p.color } as React.CSSProperties}>
            <span className="feed__dot" />
            <span>
              <strong>{p.name}</strong> {e.text}
            </span>
            {e.amount !== undefined && (
              <span className={`feed__amt ${e.amount >= 0 ? 'is-up' : 'is-down'}`}>
                {e.amount >= 0 ? '+' : '−'}
                {naira(Math.abs(e.amount))}
              </span>
            )}
          </li>
        )
      })}
    </ol>
  )
}

/** Eases a displayed number toward its target so balance changes count up/down. */
function useAnimatedNumber(target: number, duration = 700) {
  const [value, setValue] = useState(target)
  const from = useRef(target)

  useEffect(() => {
    const start = performance.now()
    const initial = from.current
    let frame: number
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration)
      const eased = 1 - Math.pow(1 - t, 3)
      const v = initial + (target - initial) * eased
      from.current = v
      setValue(v)
      if (t < 1) frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [target, duration])

  return value
}
