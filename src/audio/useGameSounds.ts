import { useEffect, useRef, useState } from 'react'
import type { GameState } from '../game/game'
import { isMuted, onMutedChange, setMuted, sfx } from './sound'

const total = (r: Record<number, number>) => Object.values(r).reduce((a, b) => a + b, 0)

/**
 * Plays sound effects by watching what changed between game states,
 * so the rules engine never has to know about audio.
 */
export function useGameSounds(state: GameState) {
  const prev = useRef(state)

  useEffect(() => {
    const before = prev.current
    prev.current = state
    if (before === state) return

    if (state.phase === 'over' && before.phase !== 'over') return sfx.win()
    if (state.players.filter((p) => p.bankrupt).length > before.players.filter((p) => p.bankrupt).length)
      return sfx.bankrupt()
    if (state.players.some((p, i) => p.inJail && !before.players[i]?.inJail)) return sfx.jail()
    if (state.phase === 'rolling' && before.phase !== 'rolling') return sfx.dice()
    if (state.phase === 'card' && before.phase !== 'card') return sfx.card()
    if (Object.keys(state.owners).length > Object.keys(before.owners).length) return sfx.buy()
    if (total(state.buildings) > total(before.buildings)) return sfx.build()

    // Money: listen from the current player's side
    const me = state.current
    const delta = state.players[me].cash - (before.players[me]?.cash ?? 0)
    if (delta > 0) return sfx.coin()
    if (delta < 0) return sfx.pay()

    const moved = state.players.some((p, i) => p.position !== before.players[i]?.position)
    if (moved && state.phase === 'moving') return sfx.hop()
    if (moved || (state.phase === 'landed' && before.phase === 'moving')) return sfx.land()
  }, [state])
}

/** Mute state for the speaker button, kept in sync across the app. */
export function useMuted(): [boolean, () => void] {
  const [muted, set] = useState(isMuted)
  useEffect(() => {
    const off = onMutedChange(set)
    return () => {
      off()
    }
  }, [])
  return [muted, () => setMuted(!isMuted())]
}
