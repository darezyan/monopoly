import { useEffect, useState } from 'react'
import { Bot, ChevronRight, KeyRound, LogOut, Play, Radio, Trash2, Users } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { deleteGame, leaveGame, listMyGames, myUserId, type GameSummary } from '../game/persistence'
import { TokenDisc } from './Token'

export type SetupMode = 'robots' | 'local'

type Props = {
  nickname: string
  onNickname: (name: string) => void
  onSetup: (mode: SetupMode) => void
  onContinue: (id: string) => void
  onOpenRoom: (id: string) => void
  onCreateRoom: () => Promise<void>
  onJoin: () => void
  notice?: string | null
}

export function Home({ nickname, onNickname, onSetup, onContinue, onOpenRoom, onCreateRoom, onJoin, notice }: Props) {
  const [creating, setCreating] = useState(false)
  const [nameNeeded, setNameNeeded] = useState(false)

  const createRoom = async () => {
    if (!nickname.trim()) return setNameNeeded(true)
    setCreating(true)
    try {
      await onCreateRoom()
    } finally {
      setCreating(false)
    }
  }

  return (
    <div className="home">
      <header className="home__hero">
        <div className="logo logo--hero">
          <span className="logo__kicker">The Lagos property game</span>
          <h1 className="logo__word">
            Èkó<span className="logo__dot">.</span>
          </h1>
          <span className="logo__sub">Buy Lagos, one plot at a time.</span>
        </div>
      </header>

      <main className="home__panel">
        {notice && <p className="home__notice">{notice}</p>}

        <label className="field">
          <span className="field__label">Wetin we go call you?</span>
          <input
            className={`field__input${nameNeeded && !nickname.trim() ? ' is-invalid' : ''}`}
            value={nickname}
            maxLength={16}
            placeholder="Your nickname"
            onChange={(e) => {
              setNameNeeded(false)
              onNickname(e.target.value)
            }}
          />
          {nameNeeded && !nickname.trim() && (
            <span className="field__hint">Your friends need a name to see in the room.</span>
          )}
        </label>

        <div className="modes">
          <ModeCard
            icon={<Bot />}
            title="Play vs Robots"
            text="You against the computer. Pick how many and how sharp."
            onClick={() => onSetup('robots')}
          />
          <ModeCard
            icon={<Users />}
            title="Pass & Play"
            text="Friends in the same room, sharing one device."
            onClick={() => onSetup('local')}
          />
          <ModeCard
            icon={<Radio />}
            title={creating ? 'Creating room…' : 'Create Room'}
            text="Play online. Share a code with friends."
            onClick={createRoom}
            soon={!supabase}
          />
          <ModeCard
            icon={<KeyRound />}
            title="Join with Code"
            text="Got a code from a friend? Enter it here."
            onClick={onJoin}
            soon={!supabase}
          />
        </div>

        {supabase && <SavedGames onContinue={onContinue} onOpenRoom={onOpenRoom} />}
        {!supabase && <p className="home__offline">Playing offline. Games won’t be saved on this device.</p>}
      </main>
    </div>
  )
}

type ModeCardProps = { icon: React.ReactNode; title: string; text: string; onClick?: () => void; soon?: boolean }

function ModeCard({ icon, title, text, onClick, soon }: ModeCardProps) {
  return (
    <button className={`mode${soon ? ' is-soon' : ''}`} onClick={onClick} disabled={soon}>
      <span className="mode__icon">{icon}</span>
      <span className="mode__body">
        <span className="mode__title">
          {title}
          {soon && <span className="mode__soon">Next up</span>}
        </span>
        <span className="mode__text">{text}</span>
      </span>
      {!soon && <ChevronRight className="mode__arrow" />}
    </button>
  )
}

const SHORT_LIST = 6
const LONG_LIST = 50

function SavedGames({
  onContinue,
  onOpenRoom,
}: {
  onContinue: (id: string) => void
  onOpenRoom: (id: string) => void
}) {
  const [games, setGames] = useState<GameSummary[] | null>(null)
  const [me, setMe] = useState<string | null>(null)
  const [failed, setFailed] = useState(false)
  const [showAll, setShowAll] = useState(false)
  /** The game whose delete/leave is waiting for confirmation */
  const [confirming, setConfirming] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    Promise.all([listMyGames(showAll ? LONG_LIST : SHORT_LIST + 1), myUserId()])
      .then(([list, uid]) => {
        setGames(list)
        setMe(uid)
      })
      .catch((err) => {
        console.error('Could not list games', err)
        setFailed(true)
      })
  }, [showAll])

  const remove = async (g: GameSummary) => {
    setBusy(g.id)
    setError(null)
    try {
      if (g.createdBy === me) await deleteGame(g.id)
      else await leaveGame(g.id)
      setGames((all) => all?.filter((x) => x.id !== g.id) ?? null)
      setConfirming(null)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(null)
    }
  }

  if (failed) return <p className="home__offline">Couldn’t reach your saved games right now.</p>
  if (games === null) {
    return (
      <section className="saved">
        <h2 className="saved__title">Continue playing</h2>
        <div className="saved__skeleton" />
      </section>
    )
  }
  if (games.length === 0) return null

  const visible = showAll ? games : games.slice(0, SHORT_LIST)

  return (
    <section className="saved">
      <div className="saved__head">
        <h2 className="saved__title">Continue playing</h2>
        {(showAll || games.length > SHORT_LIST) && (
          <button className="saved__more" onClick={() => setShowAll(!showAll)}>
            {showAll ? 'Show fewer' : 'Show all'}
          </button>
        )}
      </div>
      {error && <p className="home__notice">{error}</p>}
      <ul className="saved__list">
        {visible.map((g) => {
          const mine = g.createdBy === me
          // Deleting removes it for everyone; leaving just takes you out of someone else's room
          const verb = mine ? 'Delete' : 'Leave'
          if (confirming === g.id) {
            return (
              <li key={g.id} className="saved__confirm">
                <span>
                  {mine
                    ? g.code
                      ? 'Delete this online game for everyone in it?'
                      : 'Delete this game? This can’t be undone.'
                    : 'Leave this game? It’ll be removed from your list.'}
                </span>
                <button className="saved__confirm-yes" onClick={() => remove(g)} disabled={busy === g.id}>
                  {busy === g.id ? `${verb === 'Delete' ? 'Deleting' : 'Leaving'}…` : verb}
                </button>
                <button className="saved__confirm-no" onClick={() => setConfirming(null)} disabled={busy === g.id}>
                  Cancel
                </button>
              </li>
            )
          }

          const { state } = g
          const card = !state ? (
            <button className="saved__game" onClick={() => onOpenRoom(g.id)}>
              <span className="saved__room">
                <Radio size={18} />
              </span>
              <span className="saved__meta">
                <span className="saved__names">Room {g.code}</span>
                <span className="saved__status">Waiting to start · {timeAgo(g.updatedAt)}</span>
              </span>
              <span className="saved__go">
                <Play size={14} /> Open
              </span>
            </button>
          ) : (
            (() => {
              const over = state.phase === 'over'
              const current = state.players[over ? state.winner! : state.current]
              return (
                <button className="saved__game" onClick={() => onContinue(g.id)}>
                  <span className="saved__tokens">
                    {state.players.slice(0, 5).map((p) => (
                      <TokenDisc key={p.id} player={p} />
                    ))}
                  </span>
                  <span className="saved__meta">
                    <span className="saved__names">
                      {g.code && <span className="saved__online">Online</span>}
                      {state.players.map((p) => p.name).join(', ')}
                    </span>
                    <span className="saved__status">
                      {over ? `${current.name} won` : `${current.name}’s turn`} · {timeAgo(g.updatedAt)}
                    </span>
                  </span>
                  <span className="saved__go">
                    <Play size={14} /> {over ? 'View' : 'Continue'}
                  </span>
                </button>
              )
            })()
          )
          return (
            <li key={g.id} className="saved__row">
              {card}
              <button
                className="saved__del"
                onClick={() => setConfirming(g.id)}
                aria-label={`${verb} this game`}
                title={`${verb} this game`}
              >
                {mine ? <Trash2 size={17} /> : <LogOut size={17} />}
              </button>
            </li>
          )
        })}
      </ul>
    </section>
  )
}

function timeAgo(iso: string) {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.round(mins / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.round(hours / 24)}d ago`
}
