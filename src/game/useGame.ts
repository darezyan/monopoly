import { useCallback, useEffect, useReducer, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { robotMove } from './bot'
import { createGame, reducer, rollDice, seatsOf, type Action, type GameSettings, type GameState, type Seat } from './game'
import { createGameRow, loadGameRow, logAction, saveGameRow } from './persistence'

/** How long the dice tumble before the token starts moving */
export const ROLL_MS = 950
/** Time per square while a token hops around the board */
export const STEP_MS = 210
/** Pause before each robot move, so people can follow what it's doing */
const ROBOT_MS = 750
/** Quiet period before a snapshot is written, so a run of hops becomes one save */
const SAVE_DEBOUNCE_MS = 600

export type SyncStatus = 'offline' | 'idle' | 'loading' | 'saving' | 'saved' | 'error'

type HookAction = Action | { type: 'load'; state: GameState }

function hookReducer(state: GameState, action: HookAction): GameState {
  return action.type === 'load' ? action.state : reducer(state, action)
}

/** Timer-driven actions follow deterministically from the others, so they aren't logged. */
const isTick = (a: Action) => a.type === 'startMove' || a.type === 'step'

/** Moves a robot can always fall back on if its chosen move isn't allowed. */
const FALLBACKS: Action[] = [
  { type: 'applyCard' },
  { type: 'pass' },
  { type: 'endTurn' },
  { type: 'declareBankruptcy' },
]

function setGameInUrl(id: string | null) {
  const url = new URL(location.href)
  if (id) url.searchParams.set('game', id)
  else url.searchParams.delete('game')
  history.replaceState(null, '', url)
}

export function useGame() {
  const [state, dispatch] = useReducer(hookReducer, undefined, () => createGame())
  const [sync, setSync] = useState<SyncStatus>(supabase ? 'idle' : 'offline')
  const game = useRef<{ id: string; version: number } | null>(null)
  const lastSaved = useRef<GameState | null>(null)

  /** Start a brand-new game (and its saved row when online). */
  const start = useCallback(async (seats: Seat[], settings: GameSettings) => {
    const fresh = createGame(seats, settings)
    // Detach from any previous game first so autosave can't write the new state into it
    game.current = null
    lastSaved.current = fresh
    dispatch({ type: 'load', state: fresh })
    if (!supabase) return
    setSync('saving')
    try {
      const saved = await createGameRow(fresh)
      game.current = { id: saved.id, version: saved.version }
      setGameInUrl(saved.id)
      setSync('saved')
    } catch (err) {
      console.error('Could not create game', err)
      setSync('error')
    }
  }, [])

  /** Load a saved game. Resolves false if it can't be found or opened. */
  const open = useCallback(async (id: string) => {
    if (!supabase) return false
    setSync('loading')
    try {
      const saved = await loadGameRow(id)
      if (!saved) {
        setSync('idle')
        return false
      }
      game.current = { id: saved.id, version: saved.version }
      lastSaved.current = saved.state
      dispatch({ type: 'load', state: saved.state })
      setGameInUrl(saved.id)
      setSync('saved')
      return true
    } catch (err) {
      console.error('Could not load game', err)
      setSync('error')
      return false
    }
  }, [])

  /** Leave the current game (it stays saved and can be continued later). */
  const leave = useCallback(() => {
    game.current = null
    setGameInUrl(null)
    setSync(supabase ? 'idle' : 'offline')
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

  // Animation timers: dice settle, then the token hops square by square.
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

  // Robots take their turns on their own, one visible move at a time.
  useEffect(() => {
    if (sync === 'loading') return
    const move = robotMove(state)
    if (!move) return
    const t = setTimeout(() => {
      // Never let a robot stall the game with a move the rules refuse
      const choice = [move, ...FALLBACKS].find((a) => reducer(state, a) !== state)
      if (choice) act(choice)
    }, ROBOT_MS)
    return () => clearTimeout(t)
  }, [state, sync, act])

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

  /** Rematch: same players and settings, fresh board. */
  const newGame = useCallback(() => start(seatsOf(latest.current), latest.current.settings), [start])

  /** True while it's a robot's turn, so the UI holds back human controls */
  const robotTurn = !!state.players[state.current].robot && state.phase !== 'over'

  return {
    state,
    sync,
    robotTurn,
    start,
    open,
    leave,
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
