import { useEffect, useMemo, useState } from 'react'
import { History as HistoryIcon, X } from 'lucide-react'
import { naira } from '../data/board'
import type { GameEvent, GameState } from '../game/game'
import { TokenDisc } from './Token'

type Props = {
  state: GameState
  onClose: () => void
}

/** Every event in the game so far, newest turn first, optionally for one player. */
export function History({ state, onClose }: Props) {
  const [only, setOnly] = useState<number | null>(null)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const turns = useMemo(() => {
    const events = only === null ? state.events : state.events.filter((e) => e.playerId === only)
    // Events are stored newest first; group consecutive ones by turn
    const groups: { turn: number | undefined; events: GameEvent[] }[] = []
    for (const e of events) {
      const last = groups[groups.length - 1]
      if (last && last.turn === e.turn) last.events.push(e)
      else groups.push({ turn: e.turn, events: [e] })
    }
    return groups
  }, [state.events, only])

  // Net money in/out for the filtered player, across the whole history
  const totals = useMemo(() => {
    if (only === null) return null
    let gained = 0
    let spent = 0
    for (const e of state.events) {
      if (e.playerId !== only || e.amount === undefined) continue
      if (e.amount >= 0) gained += e.amount
      else spent -= e.amount
    }
    return { gained, spent }
  }, [state.events, only])

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <aside className="sheet history" role="dialog" aria-label="Game history" onClick={(e) => e.stopPropagation()}>
        <header className="sheet__head">
          <span className="history__icon">
            <HistoryIcon size={22} />
          </span>
          <div className="sheet__who">
            <h2>History</h2>
            <span>
              Turn {state.turn} · {state.events.length} events
            </span>
          </div>
          <button className="sheet__close" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </header>

        <div className="history__filters" role="tablist" aria-label="Show events for">
          <button
            role="tab"
            aria-selected={only === null}
            className={only === null ? 'is-on' : undefined}
            onClick={() => setOnly(null)}
          >
            Everyone
          </button>
          {state.players.map((p) => (
            <button
              key={p.id}
              role="tab"
              aria-selected={only === p.id}
              className={only === p.id ? 'is-on' : undefined}
              onClick={() => setOnly(p.id)}
              style={{ '--token': p.color } as React.CSSProperties}
            >
              <span className="history__dot" />
              {p.name}
            </button>
          ))}
        </div>

        {totals && (
          <div className="history__totals">
            <span>
              Received <b className="is-up">+{naira(totals.gained)}</b>
            </span>
            <span>
              Paid out <b className="is-down">{naira(-totals.spent)}</b>
            </span>
          </div>
        )}

        {turns.length === 0 ? (
          <p className="history__empty">Nothing has happened yet.</p>
        ) : (
          <ol className="history__turns">
            {turns.map((group, gi) => {
              const who = state.players[group.events[group.events.length - 1].playerId]
              return (
                <li key={`${group.turn}-${gi}`} className="history__turn">
                  <div className="history__turn-head">
                    {group.turn === undefined ? 'Earlier' : `Turn ${group.turn}`}
                    {only === null && group.turn !== undefined && (
                      <span className="history__turn-who" style={{ '--token': who.color } as React.CSSProperties}>
                        <span className="history__dot" /> {who.name}
                      </span>
                    )}
                  </div>
                  <ul className="history__events">
                    {[...group.events].reverse().map((e) => {
                      const p = state.players[e.playerId]
                      return (
                        <li key={e.id} className="history__event">
                          <TokenDisc player={p} className="history__token" />
                          <span className="history__text">
                            <strong>{p.name}</strong> {e.text}
                          </span>
                          {e.amount !== undefined && (
                            <span className={`history__amt ${e.amount >= 0 ? 'is-up' : 'is-down'}`}>
                              {e.amount >= 0 ? '+' : ''}
                              {naira(e.amount)}
                            </span>
                          )}
                        </li>
                      )
                    })}
                  </ul>
                </li>
              )
            })}
          </ol>
        )}
      </aside>
    </div>
  )
}
