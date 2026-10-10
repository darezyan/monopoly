import { useState } from 'react'
import { ArrowLeft, LogIn } from 'lucide-react'
import { joinRoom } from '../game/persistence'

type Props = {
  initialCode?: string
  nickname: string
  onNickname: (name: string) => void
  onBack: () => void
  onJoined: (gameId: string) => void
}

/** Strip the EKO- prefix and anything that isn't part of a code. */
const tidy = (raw: string) =>
  raw
    .toUpperCase()
    .replace(/^EKO-?/, '')
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 4)

export function JoinRoom({ initialCode = '', nickname, onNickname, onBack, onJoined }: Props) {
  const [code, setCode] = useState(tidy(initialCode))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const ready = code.length === 4 && nickname.trim().length > 0

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!ready || busy) return
    setBusy(true)
    setError(null)
    try {
      onJoined(await joinRoom(`EKO-${code}`, nickname.trim(), null))
    } catch (err) {
      setError((err as Error).message)
      setBusy(false)
    }
  }

  return (
    <div className="setup join">
      <header className="setup__head">
        <button className="icon-btn" onClick={onBack} aria-label="Back">
          <ArrowLeft size={20} />
        </button>
        <div>
          <h1 className="setup__title">Join a room</h1>
          <p className="setup__sub">Enter the code your friend shared.</p>
        </div>
      </header>

      <form className="panel join__form" onSubmit={submit}>
        <label className="field">
          <span className="field__label field__label--dark">Room code</span>
          <span className="join__code">
            <span className="join__prefix">EKO-</span>
            <input
              className="join__input"
              value={code}
              onChange={(e) => setCode(tidy(e.target.value))}
              placeholder="7KQ2"
              autoFocus={!initialCode}
              autoCapitalize="characters"
              autoComplete="off"
              spellCheck={false}
              inputMode="text"
              aria-label="Room code"
            />
          </span>
        </label>
        <label className="field">
          <span className="field__label field__label--dark">Your nickname</span>
          <input
            className="field__input field__input--light"
            value={nickname}
            maxLength={16}
            placeholder="What should we call you?"
            onChange={(e) => onNickname(e.target.value)}
            autoFocus={!!initialCode && !nickname}
          />
        </label>
        {error && <p className="setup__problem join__error">{error}</p>}
        <button className="turn__btn" type="submit" disabled={!ready || busy}>
          <LogIn size={20} /> {busy ? 'Joining…' : 'Join game'}
        </button>
      </form>
    </div>
  )
}
