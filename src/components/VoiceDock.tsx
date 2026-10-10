import { useEffect, useRef, useState } from 'react'
import { Headphones, HeadphoneOff, Mic, MicOff, Music, RotateCw, Settings2, Volume2, VolumeX } from 'lucide-react'
import { getGameVolume, setGameVolume } from '../audio/sound'
import type { TokenKind } from '../data/tokens'
import type { Voice } from '../voice/useVoice'
import { TokenDisc } from './Token'

/** A human seat at the table, for showing who's in voice. */
export type VoicePerson = { id: string; name: string; token: TokenKind; color: string }

type Props = { voice: Voice; people: VoicePerson[] }

/** Mic, deafen and voice settings for an online room. */
export function VoiceDock({ voice, people }: Props) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  // Close the settings when tapping elsewhere or pressing Escape
  useEffect(() => {
    if (!open) return
    const onDown = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('pointerdown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  if (voice.status === 'off') return null

  if (voice.status === 'unavailable') {
    return (
      <div className="voice voice--quiet" role="status">
        <MicOff size={15} /> Voice chat isn’t switched on yet
      </div>
    )
  }

  if (voice.status === 'error') {
    return (
      <div className="voice">
        <button className="voice__retry" onClick={voice.retry}>
          <RotateCw size={15} /> {voice.error ?? 'Voice dropped. Tap to rejoin.'}
        </button>
      </div>
    )
  }

  const live = voice.status === 'live'
  const inCall = people.filter((p) => p.id === voice.me || voice.people[p.id])
  const iSpeak = !!voice.me && voice.speaking.has(voice.me) && voice.micOn

  return (
    <div className="voice" ref={ref}>
      {voice.pushToTalk ? (
        <button
          className={`voice__mic${voice.holding ? ' is-on' : ''}${iSpeak ? ' is-speaking' : ''}`}
          disabled={!live || voice.deafened}
          onPointerDown={(e) => {
            e.currentTarget.setPointerCapture(e.pointerId)
            voice.talk(true)
          }}
          onPointerUp={() => voice.talk(false)}
          onPointerCancel={() => voice.talk(false)}
          onContextMenu={(e) => e.preventDefault()}
          aria-pressed={voice.holding}
          title="Hold to talk (or hold V)"
        >
          {voice.holding ? <Mic size={17} /> : <MicOff size={17} />}
          <span>{voice.holding ? 'Talking…' : 'Hold to talk'}</span>
          {!voice.holding && <kbd>V</kbd>}
        </button>
      ) : (
        <button
          className={`voice__mic${voice.micOn ? ' is-on' : ''}${iSpeak ? ' is-speaking' : ''}`}
          disabled={!live}
          onClick={voice.toggleMic}
          aria-pressed={voice.micOn}
          title={voice.micOn ? 'Mute your mic' : 'Turn on your mic'}
        >
          {voice.micOn ? <Mic size={17} /> : <MicOff size={17} />}
          <span>{!live ? 'Joining voice…' : voice.micOn ? 'Mic on' : 'Mic off'}</span>
        </button>
      )}

      <button
        className={`round-btn voice__deafen${voice.deafened ? ' is-off' : ''}`}
        disabled={!live}
        onClick={voice.toggleDeafen}
        aria-pressed={voice.deafened}
        aria-label={voice.deafened ? 'Hear voices again' : 'Stop hearing voices'}
        title={voice.deafened ? 'Speaker off: tap to hear everyone' : 'Speaker on'}
      >
        {voice.deafened ? <HeadphoneOff size={17} /> : <Headphones size={17} />}
      </button>

      <ul className="voice__faces" aria-label="In voice">
        {inCall.slice(0, 4).map((p) => (
          <li key={p.id} className={voice.speaking.has(p.id) ? 'is-speaking' : undefined} title={p.name}>
            <TokenDisc player={p} className="voice__face" />
          </li>
        ))}
        <li className="voice__count">{live ? `${inCall.length} in voice` : ''}</li>
      </ul>

      <div className="voice__more">
        <button
          className="round-btn"
          onClick={() => setOpen(!open)}
          aria-label="Voice settings"
          aria-expanded={open}
          title="Voice settings"
        >
          <Settings2 size={17} />
        </button>
        {open && <VoicePanel voice={voice} people={people} />}
      </div>

      {voice.blocked && live && (
        <button className="voice__unblock" onClick={voice.startAudio}>
          <Volume2 size={15} /> Tap to hear everyone
        </button>
      )}
      {voice.error && <p className="voice__error">{voice.error}</p>}
    </div>
  )
}

function VoicePanel({ voice, people }: Props) {
  const [gameVolume, setGameVol] = useState(getGameVolume)

  return (
    <div className="speed__panel voice__panel" role="dialog" aria-label="Voice settings">
      <span className="speed__title">Voice</span>

      <label className="voice__row">
        <span>
          <b>Push to talk</b>
          <small>Hold V or the talk button to speak.</small>
        </span>
        <input
          type="checkbox"
          className="switch"
          checked={voice.pushToTalk}
          onChange={(e) => voice.setPushToTalk(e.target.checked)}
        />
      </label>

      <label className="voice__slider">
        <Headphones size={16} aria-hidden />
        <span>Voices</span>
        <input
          type="range"
          min={0}
          max={1}
          step={0.05}
          value={voice.volume}
          onChange={(e) => voice.setVolume(Number(e.target.value))}
        />
      </label>
      <label className="voice__slider">
        <Music size={16} aria-hidden />
        <span>Game sounds</span>
        <input
          type="range"
          min={0}
          max={1}
          step={0.05}
          value={gameVolume}
          onChange={(e) => {
            setGameVol(Number(e.target.value))
            setGameVolume(Number(e.target.value))
          }}
        />
      </label>

      <span className="voice__heading">At the table</span>
      <ul className="voice__people">
        {people.map((p) => {
          const isMe = p.id === voice.me
          const there = isMe || !!voice.people[p.id]
          const micOn = isMe ? voice.micOn : !!voice.people[p.id]?.micOn
          const muted = voice.mutedPeers.has(p.id)
          return (
            <li key={p.id} className={there ? undefined : 'is-away'}>
              <span className={`voice__person${voice.speaking.has(p.id) && micOn ? ' is-speaking' : ''}`}>
                <TokenDisc player={p} className="voice__face" />
              </span>
              <span className="voice__name">
                {p.name}
                {isMe && <small> (you)</small>}
                <small>{!there ? 'Not in voice' : micOn ? 'Mic on' : 'Mic off'}</small>
              </span>
              {there && !isMe && (
                <button
                  className={`voice__mute${muted ? ' is-muted' : ''}`}
                  onClick={() => voice.togglePeer(p.id)}
                  aria-pressed={muted}
                  title={muted ? `Unmute ${p.name}` : `Mute ${p.name} for you`}
                >
                  {muted ? <VolumeX size={15} /> : <Volume2 size={15} />}
                  {muted ? 'Muted' : 'Mute'}
                </button>
              )}
            </li>
          )
        })}
      </ul>
      <p className="speed__note">Muting someone only affects what you hear.</p>
    </div>
  )
}
