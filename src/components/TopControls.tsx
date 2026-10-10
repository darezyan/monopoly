import { useEffect, useRef, useState } from 'react'
import { CircleHelp, Gauge, Volume2, VolumeX } from 'lucide-react'
import { useMuted } from '../audio/useGameSounds'
import type { GameSettings } from '../game/game'
import { useSpeed, type Speed } from '../game/speed'
import { HowToPlay } from './HowToPlay'

const SPEEDS: { value: Speed; label: string; hint: string }[] = [
  { value: 'slow', label: 'Slow', hint: 'Easy to follow' },
  { value: 'normal', label: 'Normal', hint: 'Default' },
  { value: 'fast', label: 'Fast', hint: 'Less waiting' },
]

/** Game speed, How to Play and sound, shown on every screen. */
export function TopControls({ settings }: { settings?: GameSettings }) {
  const [muted, toggleMuted] = useMuted()
  const [speed, setSpeed] = useSpeed()
  const [help, setHelp] = useState(false)
  const [speedOpen, setSpeedOpen] = useState(false)
  const speedRef = useRef<HTMLDivElement>(null)

  // Close the speed panel when tapping elsewhere or pressing Escape
  useEffect(() => {
    if (!speedOpen) return
    const onDown = (e: PointerEvent) => {
      if (!speedRef.current?.contains(e.target as Node)) setSpeedOpen(false)
    }
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setSpeedOpen(false)
    document.addEventListener('pointerdown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [speedOpen])

  return (
    <div className="top-controls">
      <div className="speed" ref={speedRef}>
        <button
          className="round-btn"
          onClick={() => setSpeedOpen(!speedOpen)}
          aria-label="Game speed"
          aria-expanded={speedOpen}
          title="Game speed"
        >
          <Gauge size={18} />
        </button>
        {speedOpen && (
          <div className="speed__panel" role="dialog" aria-label="Game speed">
            <span className="speed__title">Game speed</span>
            <div className="speed__options" role="radiogroup">
              {SPEEDS.map((s) => (
                <button
                  key={s.value}
                  role="radio"
                  aria-checked={speed === s.value}
                  className={speed === s.value ? 'is-on' : undefined}
                  onClick={() => setSpeed(s.value)}
                >
                  <b>{s.label}</b>
                  <span>{s.hint}</span>
                </button>
              ))}
            </div>
            <p className="speed__note">Dice, moves and how long robots take. Just for this device.</p>
          </div>
        )}
      </div>
      <button className="round-btn" onClick={() => setHelp(true)} aria-label="How to play" title="How to play">
        <CircleHelp size={18} />
      </button>
      <button
        className="round-btn"
        onClick={toggleMuted}
        aria-label={muted ? 'Turn sound on' : 'Turn sound off'}
        aria-pressed={!muted}
        title={muted ? 'Sound off' : 'Sound on'}
      >
        {muted ? <VolumeX size={18} /> : <Volume2 size={18} />}
      </button>
      {help && <HowToPlay settings={settings} onClose={() => setHelp(false)} />}
    </div>
  )
}
