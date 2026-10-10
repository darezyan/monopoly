import { useCallback, useEffect, useReducer, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { createGame, reducer, rollDice, type Action, type GameState } from './game'
import { bootGame, createGameRow, logAction, saveGameRow } from './persistence'

/** How long the dice tumble before the token starts moving */
export const ROLL_MS = 950
/** Time per square while a token hops around the board */
export const STEP_MS = 210
/** Quiet period before a snapshot is written, so a run of hops becomes one save */
const SAVE_DEBOUNCE_MS = 600

export type SyncStatus = 'offline' | 'loading' | 'saving' | 'saved' | 'error'

type HookAction = Action | { type: 'load'; state: GameState }

function hookReducer(state: GameState, action: HookAction): GameState {
  return action.type === 'load' ? action.state : reducer(state, action)
}

/** Timer-driven actions follow deterministically from the others, so they aren't logged. */
const isTick = (a: Action) => a.type === 'startMove' || a.type === 'step'

export function useGame() {
  const [state, dispatch] = useReducer(hookReducer, undefined, () => createGame())
  const [sync, setSync] = useState<SyncStatus>(supabase ? 'loading' : 'offline')
  const game = useRef<{ id: string; version: number } | null>(null)
  const lastSaved = useRef<GameState | null>(null)

  // Load the game named in the URL, or start a new one and put its id in the URL.
  useEffect(() => {
    if (!supabase) return
    let cancelled = false
    ;(async () => {
      try {
        const saved = await bootGame(createGame)
        if (cancelled) return
        game.current = { id: saved.id, version: saved.version }
        lastSaved.current = saved.state
        dispatch({ type: 'load', state: saved.state })
        const url = new URL(location.href)
        url.searchParams.set('game', saved.id)
        history.replaceState(null, '', url)
        setSync('saved')
      } catch (err) {
        console.error('Could not load game', err)
        if (!cancelled) setSync('error')
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  // Save a snapshot whenever the state settles.
  useEffect(() => {
    const g = game.current
    if (!g || state === lastSaved.current) return
    setSync('saving')
    const t = setTimeout(async () => {
      try {
        const version = await saveGameRow(g.id, state, g.version)
        if (version === null) throw new Error('Game was changed elsewhere')
        g.version = version
        lastSaved.current = state
        setSync('saved')
      } catch (err) {
        console.error('Could not save game', err)
        setSync('error')
      }
    }, SAVE_DEBOUNCE_MS)
    return () => clearTimeout(t)
  }, [state])

  // Dev-only console hook for setting up scenarios: __eko.load(state), __eko.state()
  const latest = useRef(state)
  latest.current = state
  useEffect(() => {
    if (!import.meta.env.DEV) return
    ;(window as unknown as { __eko: object }).__eko = {
      load: (s: GameState) => dispatch({ type: 'load', state: s }),
      state: () => latest.current,
    }
  }, [])

  const act = useCallback((action: Action) => {
    dispatch(action)
    const g = game.current
    if (g && !isTick(action)) logAction(g.id, action).catch((err) => console.error('Could not log action', err))
  }, [])

  useEffect(() => {
    if (state.phase === 'rolling') {
      const t = setTimeout(() => act({ type: 'startMove' }), ROLL_MS)
      return () => clearTimeout(t)
    }
    if (state.phase === 'moving' && state.stepsLeft > 0) {
      const t = setTimeout(() => act({ type: 'step' }), STEP_MS)
      return () => clearTimeout(t)
    }
  }, [state.phase, state.stepsLeft, act])

  const roll = useCallback(() => act({ type: 'roll', dice: rollDice() }), [act])
  const endTurn = useCallback(() => act({ type: 'endTurn' }), [act])
  const buy = useCallback(() => act({ type: 'buy' }), [act])
  const pass = useCallback(() => act({ type: 'pass' }), [act])
  const applyCard = useCallback(() => act({ type: 'applyCard' }), [act])
  const payBail = useCallback(() => act({ type: 'payBail' }), [act])
  const useJailCard = useCallback(() => act({ type: 'useJailCard' }), [act])
  const build = useCallback((index: number) => act({ type: 'build', index }), [act])
  const sell = useCallback((index: number) => act({ type: 'sell', index }), [act])
  const mortgage = useCallback((index: number) => act({ type: 'mortgage', index }), [act])
  const unmortgage = useCallback((index: number) => act({ type: 'unmortgage', index }), [act])
  const declareBankruptcy = useCallback(() => act({ type: 'declareBankruptcy' }), [act])

  /** Start over with a fresh game (and a fresh saved row when online). */
  const newGame = useCallback(async () => {
    const fresh = createGame()
    // Detach from the old game first so autosave can't write the fresh state into it
    game.current = null
    dispatch({ type: 'load', state: fresh })
    if (!supabase) return
    setSync('saving')
    try {
      const saved = await createGameRow(fresh)
      game.current = { id: saved.id, version: saved.version }
      lastSaved.current = fresh
      const url = new URL(location.href)
      url.searchParams.set('game', saved.id)
      history.replaceState(null, '', url)
      setSync('saved')
    } catch (err) {
      console.error('Could not create game', err)
      setSync('error')
    }
  }, [])

  return {
    state,
    sync,
    roll,
    endTurn,
    buy,
    pass,
    applyCard,
    payBail,
    useJailCard,
    build,
    sell,
    mortgage,
    unmortgage,
    declareBankruptcy,
    newGame,
  }
}

export type Game = ReturnType<typeof useGame>
