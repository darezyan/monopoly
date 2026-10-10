import { useEffect, useState } from 'react'

// Game speed is a per-device preference, like the sound switch.

export type Speed = 'slow' | 'normal' | 'fast'

const SPEED_KEY = 'eko:speed'

/** Multiplier on every animation and robot pause: bigger is slower. */
export const SPEED_FACTOR: Record<Speed, number> = { slow: 1.6, normal: 1, fast: 0.5 }

let speed: Speed = read()
const listeners = new Set<(s: Speed) => void>()
applyToCss()

function read(): Speed {
  try {
    const saved = localStorage.getItem(SPEED_KEY)
    return saved === 'slow' || saved === 'fast' ? saved : 'normal'
  } catch {
    return 'normal'
  }
}

/** CSS animations (dice tumble, token hops, card deal) scale with --speed. */
function applyToCss() {
  document.documentElement.style.setProperty('--speed', String(SPEED_FACTOR[speed]))
}

export const getSpeed = () => speed

export function setSpeed(next: Speed) {
  speed = next
  try {
    localStorage.setItem(SPEED_KEY, next)
  } catch {
    // Not remembered in private mode; still applies for this visit
  }
  applyToCss()
  listeners.forEach((fn) => fn(next))
}

export function useSpeed(): [Speed, (s: Speed) => void] {
  const [value, set] = useState(speed)
  useEffect(() => {
    listeners.add(set)
    return () => {
      listeners.delete(set)
    }
  }, [])
  return [value, setSpeed]
}
