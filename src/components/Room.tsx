import { useEffect, useState } from 'react'
import { ArrowLeft, Bot, Check, Copy, Crown, Play, Share2, UserRound, X } from 'lucide-react'
import { tokenInfo, type RobotLevel } from '../data/tokens'
import { useRoom } from '../game/useRoom'
import { SettingsPanel, TokenPicker } from './Setup'
import { TokenDisc } from './Token'
import { VoiceDock } from './VoiceDock'
import type { Voice } from '../voice/useVoice'

const SEATS = 8

type Props = {
  gameId: string
  voice: Voice
  onLeave: () => void
  onStarted: () => void
}

export function Room({ gameId, voice, onLeave, onStarted }: Props) {
  const room = useRoom(gameId, onStarted)
  const [picking, setPicking] = useState(false)
  const [copied, setCopied] = useState(false)

  if (!room.room) {
    return (
      <div className="splash">
        <p>{room.error ?? 'Opening the room…'}</p>
        {room.error && (
          <button className="menu-btn" onClick={onLeave}>
            <ArrowLeft size={16} /> Back
          </button>
        )}
      </div>
    )
  }

  const { code, seats } = room.room
  const link = `${location.origin}${location.pathname}?room=${code}`
  const invite = `Come play Èkó with me! Room code ${code}. Join here: ${link}`

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link)
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    } catch {
      // Clipboard can be blocked; the code is on screen to read out anyway
    }
  }

  const share = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title: 'Play Èkó', text: invite, url: link })
      } catch {
        // Share sheet dismissed
      }
    } else {
      copy()
    }
  }

  const canStart = room.isHost && seats.length >= 2

  return (
    <div className="setup room">
      <header className="setup__head">
        <button
          className="icon-btn"
          onClick={async () => {
            if (!room.isHost) await room.leave()
            onLeave()
          }}
          aria-label="Leave room"
        >
          <ArrowLeft size={20} />
        </button>
        <div>
          <h1 className="setup__title">Game room</h1>
          <p className="setup__sub">{room.isHost ? 'Invite your people, then start.' : 'You’re in. Pick your token.'}</p>
        </div>
      </header>

      <section className="code-card">
        <span className="code-card__label">Room code</span>
        <span className="code-card__code">{code}</span>
        <div className="code-card__actions">
          <button className="code-card__btn" onClick={copy}>
            {copied ? <Check size={16} /> : <Copy size={16} />} {copied ? 'Link copied' : 'Copy link'}
          </button>
          <a
            className="code-card__btn code-card__btn--wa"
            href={`https://wa.me/?text=${encodeURIComponent(invite)}`}
            target="_blank"
            rel="noreferrer"
          >
            <WhatsAppIcon /> WhatsApp
          </a>
          <button className="code-card__btn" onClick={share}>
            <Share2 size={16} /> Share
          </button>
        </div>
      </section>

      {room.error && <p className="home__notice">{room.error}</p>}

      <VoiceDock
        voice={voice}
        people={seats.flatMap((s) =>
          s.userId && !s.robot ? [{ id: s.userId, name: s.nickname, token: s.token, color: tokenInfo(s.token).color }] : [],
        )}
      />

      <section className="panel">
        <div className="panel__head">
          <h2>Players</h2>
          <span className="panel__count">
            {seats.length}/{SEATS}
          </span>
        </div>
        <ul className="seats">
          {seats.map((seat) => {
            const i = seat.seat
            const mine = seat.userId === room.me
            const hostSeat = seat.userId === room.room!.hostId
            const online = !seat.userId || room.online.has(seat.userId)
            return (
              <li key={i} className={`seat${mine ? ' seat--me' : ''}`}>
                <div className="seat__token">
                  <button
                    className={`seat__token-btn${seat.userId && voice.speaking.has(seat.userId) ? ' is-talking' : ''}`}
                    disabled={!mine}
                    onClick={() => setPicking(!picking)}
                    aria-label={mine ? 'Change your token' : tokenInfo(seat.token).label}
                  >
                    <TokenDisc player={{ token: seat.token, color: tokenInfo(seat.token).color }} />
                    {seat.userId && <span className={`player__presence${online ? ' is-on' : ''}`} />}
                  </button>
                  {mine && picking && (
                    <TokenPicker
                      current={seat.token}
                      taken={seats.filter((s) => s.seat !== i).map((s) => s.token)}
                      onPick={(token) => {
                        setPicking(false)
                        room.setToken(i, token)
                      }}
                      onClose={() => setPicking(false)}
                    />
                  )}
                </div>
                <div className="seat__main">
                  <div className="seat__name-row">
                    {mine ? (
                      <NameField value={seat.nickname} onSave={(name) => room.setNickname(i, name)} />
                    ) : (
                      <span className="seat__name seat__name--static">{seat.nickname}</span>
                    )}
                    <span className={`seat__kind${seat.robot ? ' is-robot' : ''}`}>
                      {seat.robot ? <Bot size={13} /> : hostSeat ? <Crown size={13} /> : <UserRound size={13} />}
                      {seat.robot ? 'Robot' : mine ? 'You' : hostSeat ? 'Host' : online ? 'Online' : 'Away'}
                    </span>
                  </div>
                  <span className="seat__token-label">{tokenInfo(seat.token).label}</span>
                  {seat.robot && room.isHost && (
                    <div className="segmented segmented--sm" role="radiogroup" aria-label="Robot level">
                      {(['easy', 'normal', 'sharp'] as RobotLevel[]).map((lvl) => (
                        <button
                          key={lvl}
                          role="radio"
                          aria-checked={seat.robot === lvl}
                          className={seat.robot === lvl ? 'is-on' : undefined}
                          onClick={() => room.setRobotLevel(i, lvl)}
                        >
                          {lvl[0].toUpperCase() + lvl.slice(1)}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                {room.isHost && !hostSeat && (
                  <button className="icon-btn icon-btn--sm" onClick={() => room.remove(i)} aria-label={`Remove ${seat.nickname}`}>
                    <X size={16} />
                  </button>
                )}
              </li>
            )
          })}
          {seats.length < SEATS && (
            <li className="seat seat--empty">
              <span className="seat__ghost" />
              <span className="seat__waiting">
                {SEATS - seats.length} seat{SEATS - seats.length === 1 ? '' : 's'} open · share the code
              </span>
            </li>
          )}
        </ul>
        {room.isHost && (
          <div className="seats__add">
            <button className="add-btn" onClick={room.addRobot} disabled={room.full}>
              <Bot size={16} /> Add robot
            </button>
          </div>
        )}
      </section>

      <SettingsPanel settings={room.settings} onChange={room.setSettings} readOnly={!room.isHost} />

      <div className="setup__bar">
        {room.isHost ? (
          <>
            {!canStart && <p className="setup__problem">Invite someone or add a robot to start</p>}
            <button className="turn__btn setup__start" disabled={!canStart} onClick={room.start}>
              <Play size={20} /> Start game
            </button>
          </>
        ) : (
          <p className="room__waiting">
            <span className="dots" aria-hidden>
              <i />
              <i />
              <i />
            </span>
            Waiting for the host to start
          </p>
        )}
      </div>
    </div>
  )
}

/** Your nickname, saved when you finish typing (Enter or leaving the field). */
function NameField({ value, onSave }: { value: string; onSave: (name: string) => void }) {
  const [draft, setDraft] = useState(value)
  useEffect(() => setDraft(value), [value])
  const commit = () => {
    const name = draft.trim()
    if (name && name !== value) onSave(name)
    else setDraft(value)
  }
  return (
    <input
      className="seat__name"
      value={draft}
      maxLength={16}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
      aria-label="Your name"
    />
  )
}

function WhatsAppIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Zm0 18.2c-1.5 0-3-.4-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2Zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8-.2-.1-.4-.1-.6.1l-.8 1c-.1.2-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.3-.4.2-.4.7-1.4.1-.2 0-.3 0-.5l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5c-.2 0-.5.1-.7.3-.2.3-.9.9-.9 2.2s.9 2.5 1 2.7c.1.2 1.8 2.8 4.4 3.9 1.6.7 2.3.8 3.1.6.5-.1 1.5-.6 1.7-1.2.2-.6.2-1.1.2-1.2-.1-.1-.3-.2-.5-.3Z" />
    </svg>
  )
}
