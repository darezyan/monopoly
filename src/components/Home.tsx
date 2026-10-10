import { useEffect, useState } from 'react'
import { Bot, ChevronRight, KeyRound, Play, Radio, Users } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { listMyGames, type GameSummary } from '../game/persistence'
import { TokenDisc } from './Token'

export type SetupMode = 'robots' | 'local'

type Props = {
  nickname: string
  onNickname: (name: string) => void
  onSetup: (mode: SetupMode) => void
  onContinue: (id: string) => void
  notice?: string | null
}

export function Home({ nickname, onNickname, onSetup, onContinue, notice }: Props) {
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
            className="field__input"
            value={nickname}
            maxLength={16}
            placeholder="Your nickname"
            onChange={(e) => onNickname(e.target.value)}
          />
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
          <ModeCard icon={<Radio />} title="Create Room" text="Play online. Share a code with friends." soon />
          <ModeCard icon={<KeyRound />} title="Join with Code" text="Got a code from a friend? Enter it here." soon />
        </div>

        {supabase && <SavedGames onContinue={onContinue} />}
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

function SavedGames({ onContinue }: { onContinue: (id: string) => void }) {
  const [games, setGames] = useState<GameSummary[] | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    listMyGames()
      .then(setGames)
      .catch((err) => {
        console.error('Could not list games', err)
        setFailed(true)
      })
  }, [])

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

  return (
    <section className="saved">
      <h2 className="saved__title">Continue playing</h2>
      <ul className="saved__list">
        {games.map((g) => {
          const { state } = g
          const over = state.phase === 'over'
          const current = state.players[over ? state.winner! : state.current]
          return (
            <li key={g.id}>
              <button className="saved__game" onClick={() => onContinue(g.id)}>
                <span className="saved__tokens">
                  {state.players.slice(0, 5).map((p) => (
                    <TokenDisc key={p.id} player={p} />
                  ))}
                </span>
                <span className="saved__meta">
                  <span className="saved__names">{state.players.map((p) => p.name).join(', ')}</span>
                  <span className="saved__status">
                    {over ? `${current.name} won` : `${current.name}’s turn`} · {timeAgo(g.updatedAt)}
                  </span>
                </span>
                <span className="saved__go">
                  <Play size={14} /> {over ? 'View' : 'Continue'}
                </span>
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
