import { useEffect, useMemo, useState } from 'react'
import { ArrowLeftRight, KeyRound, Minus, Plus, Send, X } from 'lucide-react'
import { BOARD, GROUP_COLORS, naira } from '../data/board'
import {
  EMPTY_BUNDLE,
  deedTradeBlocker,
  isBuyable,
  tradeInterest,
  tradeProblem,
  type Bundle,
  type GameState,
} from '../game/game'
import { TokenDisc } from './Token'

type Props = {
  state: GameState
  /** Who is making this offer */
  me: number
  /** Preselected partner (fixed when countering) */
  partner?: number
  /** Countering: start from the deal on the table, seen from my side */
  initial?: { give: Bundle; get: Bundle }
  onSend: (to: number, give: Bundle, get: Bundle) => void
  onClose: () => void
}

const deedColor = (i: number) => {
  const t = BOARD[i]
  return t.kind === 'property' ? GROUP_COLORS[t.group] : t.kind === 'utility' ? '#b48a00' : '#1c1a16'
}

/** Build (or counter) a deal: pick a partner, then what each side puts in. */
export function TradeBuilder({ state, me, partner: initialPartner, initial, onSend, onClose }: Props) {
  const others = state.players.filter((p) => p.id !== me && !p.bankrupt)
  const [partner, setPartner] = useState<number>(initialPartner ?? others[0]?.id ?? -1)
  const [give, setGive] = useState<Bundle>(initial?.give ?? EMPTY_BUNDLE)
  const [get, setGet] = useState<Bundle>(initial?.get ?? EMPTY_BUNDLE)
  const countering = !!initial

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const switchPartner = (id: number) => {
    setPartner(id)
    // What we asked from the previous partner no longer applies
    setGet(EMPTY_BUNDLE)
  }

  const problem = partner < 0 ? 'Nobody else is left to trade with' : tradeProblem(state, me, partner, give, get)
  const interestMe = useMemo(() => tradeInterest(get.deeds, state), [get.deeds, state])

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="deal" role="dialog" aria-label="Make a deal" onClick={(e) => e.stopPropagation()}>
        <header className="deal__head">
          <ArrowLeftRight size={22} />
          <h2>{countering ? 'Counter-offer' : 'Make a deal'}</h2>
          <button className="sheet__close" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </header>

        {!countering && (
          <div className="deal__partners" role="tablist" aria-label="Trade with">
            {others.map((p) => (
              <button
                key={p.id}
                role="tab"
                aria-selected={partner === p.id}
                className={partner === p.id ? 'is-on' : undefined}
                onClick={() => switchPartner(p.id)}
              >
                <TokenDisc player={p} className="deal__partner-token" />
                {p.name}
              </button>
            ))}
          </div>
        )}

        {partner >= 0 && (
          <div className="deal__sides">
            <Side title="You give" state={state} owner={me} bundle={give} onChange={setGive} />
            <div className="deal__swap" aria-hidden>
              <ArrowLeftRight size={18} />
            </div>
            <Side
              title={`You get from ${state.players[partner].name}`}
              state={state}
              owner={partner}
              bundle={get}
              onChange={setGet}
            />
          </div>
        )}

        <footer className="deal__foot">
          {problem ? (
            <p className="deal__problem">{problem}</p>
          ) : interestMe > 0 ? (
            <p className="deal__note">You’ll pay {naira(interestMe)} interest on mortgaged deeds you receive.</p>
          ) : (
            <p className="deal__note">They can accept, decline or send back a counter-offer.</p>
          )}
          <button className="turn__btn deal__send" disabled={!!problem} onClick={() => onSend(partner, give, get)}>
            <Send size={18} /> {countering ? 'Send counter' : 'Send offer'}
          </button>
        </footer>
      </div>
    </div>
  )
}

type SideProps = {
  title: string
  state: GameState
  owner: number
  bundle: Bundle
  onChange: (b: Bundle) => void
}

function Side({ title, state, owner, bundle, onChange }: SideProps) {
  const player = state.players[owner]
  const deeds = BOARD.flatMap((t, i) => (isBuyable(t) && state.owners[i] === owner ? [i] : []))
  const maxCash = Math.max(0, player.cash)
  const setCash = (cash: number) => onChange({ ...bundle, cash: Math.min(maxCash, Math.max(0, Math.round(cash))) })
  const toggle = (i: number) =>
    onChange({
      ...bundle,
      deeds: bundle.deeds.includes(i) ? bundle.deeds.filter((d) => d !== i) : [...bundle.deeds, i],
    })

  return (
    <section className="deal__side" style={{ '--token': player.color } as React.CSSProperties}>
      <h3 className="deal__title">
        <TokenDisc player={player} className="deal__side-token" />
        {title}
      </h3>

      <div className="deal__deeds">
        {deeds.length === 0 && <p className="deal__empty">No properties</p>}
        {deeds.map((i) => {
          const blocker = deedTradeBlocker(state, i)
          const picked = bundle.deeds.includes(i)
          return (
            <button
              key={i}
              className={`deal__deed${picked ? ' is-picked' : ''}${state.mortgaged[i] ? ' is-mortgaged' : ''}`}
              style={{ '--accent': deedColor(i) } as React.CSSProperties}
              onClick={() => toggle(i)}
              disabled={!!blocker}
              title={blocker ?? undefined}
              aria-pressed={picked}
            >
              <span className="deal__deed-band" />
              <span className="deal__deed-name">{BOARD[i].name}</span>
              {state.mortgaged[i] && <span className="deal__deed-tag">Mortgaged</span>}
              {blocker && <span className="deal__deed-tag">Has houses</span>}
            </button>
          )
        })}
      </div>

      <div className="deal__cash">
        <span className="deal__label">Cash</span>
        <div className="deal__stepper">
          <button onClick={() => setCash(bundle.cash - 50)} aria-label="Less cash" disabled={bundle.cash <= 0}>
            <Minus size={16} />
          </button>
          <input
            type="number"
            inputMode="numeric"
            min={0}
            max={maxCash}
            step={10}
            value={bundle.cash || ''}
            placeholder="0"
            onChange={(e) => setCash(Number(e.target.value))}
            aria-label={`Cash from ${player.name}, in millions of naira`}
          />
          <button onClick={() => setCash(bundle.cash + 50)} aria-label="More cash" disabled={bundle.cash >= maxCash}>
            <Plus size={16} />
          </button>
        </div>
        <span className="deal__hint">of {naira(maxCash)}</span>
      </div>

      {player.jailFree.length > 0 && (
        <div className="deal__cash">
          <span className="deal__label">
            <KeyRound size={14} /> Jail cards
          </span>
          <div className="deal__stepper">
            <button
              onClick={() => onChange({ ...bundle, jailCards: bundle.jailCards - 1 })}
              disabled={bundle.jailCards <= 0}
              aria-label="Fewer jail cards"
            >
              <Minus size={16} />
            </button>
            <output>{bundle.jailCards}</output>
            <button
              onClick={() => onChange({ ...bundle, jailCards: bundle.jailCards + 1 })}
              disabled={bundle.jailCards >= player.jailFree.length}
              aria-label="More jail cards"
            >
              <Plus size={16} />
            </button>
          </div>
          <span className="deal__hint">of {player.jailFree.length}</span>
        </div>
      )}
    </section>
  )
}
