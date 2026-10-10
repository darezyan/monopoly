import { useState } from 'react'
import { CircleHelp, Volume2, VolumeX } from 'lucide-react'
import { useMuted } from '../audio/useGameSounds'
import type { GameSettings } from '../game/game'
import { HowToPlay } from './HowToPlay'

/** Sound toggle and How to Play, shown on every screen. */
export function TopControls({ settings }: { settings?: GameSettings }) {
  const [muted, toggleMuted] = useMuted()
  const [help, setHelp] = useState(false)

  return (
    <div className="top-controls">
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
