import { useCallback, useEffect, useReducer, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { robotMove } from './bot'
import {
  actingPlayer,
  applyAction,
  createGame,
  isTick,
  reducer,
  rollDice,
  seatsOf,
  type Action,
  type Bundle,
  type GameSettings,
  type GameState,
  type Seat,
} from './game'
import { createGameRow, currentVersion, loadGameRow, logAction, myUserId, saveGameRow } from './persistence'
import { SPEED_FACTOR, useSpeed } from './speed'

/** How long the dice tumble before the token starts moving */
export const ROLL_MS = 950
/** Time per square while a token hops around the board */
export const STEP_MS = 210
/** Pause before each robot move, so people can follow what it's doing */
const ROBOT_MS = 750
/** Robots leave a drawn card on screen long enough to read */
const ROBOT_CARD_MS = 2600
/** And think a little before buying or passing */
const ROBOT_DECIDE_MS = 1300
/** Deals stay on screen long enough to read before a robot answers */
const ROBOT_DEAL_MS = 3200
/** Quiet period before a snapshot is written, so a run of hops becomes one save */
const SAVE_DEBOUNCE_MS = 600
/** How long to wait for a missing move before reloading the saved game */
const RESYNC_MS = 1500

export type SyncStatus = 'offline' | 'idle' | 'loading' | 'saving' | 'saved' | 'live' | 'error'

type HookAction = Action | { type: 'load'; state: GameState }

function hookReducer(state: GameState, action: HookAction): GameState {
  return action.type === 'load' ? action.state : applyAction(state, action)
}

/** Moves a robot can always fall back on if its chosen move isn't allowed. */
const fallbacks = (): Action[] => [
  { type: 'applyCard' },
  { type: 'pass' },
  { type: 'declineTrade' },
  { type: 'roll', dice: rollDice() },
  { type: 'endTurn' },
  { type: 'declareBankruptcy' },
]

/** A decision sent between players in an online room, numbered so gaps can be spotted. */
type Move = { seq: number; action: Action }

type Online = { me: string; hostId: string; channel: ReturnType<NonNullable<typeof supabase>['channel']> }

function setGameInUrl(id: string | null) {
  const url = new URL(location.href)
  if (id) url.searchParams.set('game', id)
  else url.searchParams.delete('game')
  history.replaceState(null, '', url)
}

export function useGame() {
  const [state, dispatch] = useReducer(hookReducer, undefined, () => createGame())
  const [sync, setSync] = useState<SyncStatus>(supabase ? 'idle' : 'offline')
  const [online, setOnline] = useState<Online | null>(null)
  const [peers, setPeers] = useState<Set<string>>(new Set())
  const game = useRef<{ id: string; version: number } | null>(null)
  const lastSaved = useRef<GameState | null>(null)
  const inbox = useRef<Move[]>([])
  /** The live channel, plus a counter so a slow connect can't outlive a newer one */
  const channelRef = useRef<Online['channel'] | null>(null)
  const liveAttempt = useRef(0)
  const [inboxSize, setInboxSize] = useState(0)

  const latest = useRef(state)
  latest.current = state
  // Every timer below scales with this device's game speed setting
  const [speed] = useSpeed()
  const pace = SPEED_FACTOR[speed]

  /** Whether a human at this device plays this player */
  const controls = useCallback(
    (playerId: number) => {
      const p = latest.current.players[playerId]
      return online ? p.userId === online.me : !p.robot
    },
    [online],
  )
  // The decision the game is waiting on: a deal's responder, otherwise whoever's turn it is
  const acting = state.players[actingPlayer(state)]
  /** A human at this device should be making the current decision (shows the controls) */
  const myTurn = online ? acting.userId === online.me : !acting.robot
  /** This device plays the robots: always offline, only the host's device online */
  const runsRobots = !online || online.hostId === online.me
  const robotHere = !!acting.robot && runsRobots
  /** Whether this device should be the one saving the shared state right now */
  const iSave = !online || myTurn || robotHere

  const stopOnline = useCallback(() => {
    liveAttempt.current++
    if (channelRef.current) supabase!.removeChannel(channelRef.current)
    channelRef.current = null
    setOnline(null)
    inbox.current = []
    setInboxSize(0)
    setPeers(new Set())
  }, [])

  const resync = useCallback(async () => {
    const g = game.current
    if (!g) return
    const saved = await loadGameRow(g.id)
    if (!saved) return
    // Always take the newest version number, even if our own state is further ahead
    g.version = Math.max(g.version, saved.version)
    if (saved.state.seq < latest.current.seq) return
    lastSaved.current = saved.state
    inbox.current = inbox.current.filter((m) => m.seq >= saved.state.seq)
    setInboxSize(inbox.current.length)
    dispatch({ type: 'load', state: saved.state })
  }, [])

  /** Join the live channel for an online game. */
  const goLive = useCallback(
    async (id: string, hostId: string) => {
      const attempt = ++liveAttempt.current
      const me = await myUserId()
      // A newer open() or leave() happened while we waited; let that one win
      if (attempt !== liveAttempt.current) return
      const channel = supabase!
        .channel(`game:${id}`, { config: { broadcast: { self: false }, presence: { key: me } } })
        .on('broadcast', { event: 'move' }, ({ payload }) => {
          inbox.current = [...inbox.current, payload as Move].sort((a, b) => a.seq - b.seq)
          setInboxSize(inbox.current.length)
        })
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'games', filter: `id=eq.${id}` }, ({ new: row }) => {
          // Keep our version current so we can save when it's our turn
          if (game.current && row.version > game.current.version) game.current.version = row.version
        })
        .on('presence', { event: 'sync' }, () => setPeers(new Set(Object.keys(channel.presenceState()))))
        .subscribe((status) => {
          if (status === 'SUBSCRIBED') {
            channel.track({ at: Date.now() })
            // Catch up on anything that happened while we were connecting
            resync()
          }
        })
      channelRef.current = channel
      setOnline({ me, hostId, channel })
    },
    [resync],
  )

  /** Start a brand-new offline or pass-and-play game (saved when online). */
  const start = useCallback(
    async (seats: Seat[], settings: GameSettings) => {
      stopOnline()
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
    },
    [stopOnline],
  )

  /** Load a saved game (and go live if it's an online room). Resolves false if it can't be opened. */
  const open = useCallback(
    async (id: string) => {
      if (!supabase) return false
      stopOnline()
      setSync('loading')
      try {
        const saved = await loadGameRow(id)
        if (!saved || saved.status === 'lobby') {
          setSync('idle')
          return false
        }
        game.current = { id: saved.id, version: saved.version }
        lastSaved.current = saved.state
        dispatch({ type: 'load', state: saved.state })
        setGameInUrl(saved.id)
        if (saved.code) await goLive(saved.id, saved.createdBy)
        setSync('saved')
        return true
      } catch (err) {
        console.error('Could not load game', err)
        setSync('error')
        return false
      }
    },
    [goLive, stopOnline],
  )

  /** Leave the current game (it stays saved and can be continued later). */
  const leave = useCallback(() => {
    stopOnline()
    game.current = null
    setGameInUrl(null)
    setSync(supabase ? 'idle' : 'offline')
  }, [stopOnline])

  // Save a snapshot whenever the state settles (online, only the device in control saves).
  useEffect(() => {
    const g = game.current
    if (!g) return
    // Watching someone else's turn online: their device saves, ours just follows along
    if (!iSave) return setSync('live')
    if (state === lastSaved.current) return
    setSync('saving')
    const t = setTimeout(async () => {
      try {
        let version = await saveGameRow(g.id, state, g.version)
        if (version === null) {
          // Someone saved first (usually the previous player, just as the turn passed).
          // If we're not behind them, take the newer version number and save again.
          const latestRow = await currentVersion(g.id)
          if (!latestRow || latestRow.seq > state.seq) throw new Error('Game was changed elsewhere')
          g.version = latestRow.version
          version = await saveGameRow(g.id, state, g.version)
          if (version === null) throw new Error('Game was changed elsewhere')
        }
        g.version = version
        lastSaved.current = state
        setSync('saved')
      } catch (err) {
        console.error('Could not save game', err)
        setSync('error')
        if (online) resync()
      }
    }, SAVE_DEBOUNCE_MS)
    return () => clearTimeout(t)
  }, [state, iSave, online, resync])

  // Dev-only console hook for setting up scenarios: __eko.load(state), __eko.state()
  useEffect(() => {
    if (!import.meta.env.DEV) return
    ;(window as unknown as { __eko: object }).__eko = {
      load: (s: GameState) => dispatch({ type: 'load', state: s }),
      state: () => latest.current,
    }
  }, [])

  /** Apply a decision locally, record it, and (online) send it to everyone else. */
  const act = useCallback(
    (action: Action) => {
      const before = latest.current
      if (!isTick(action) && online) {
        if (applyAction(before, action) === before) return
        online.channel.send({ type: 'broadcast', event: 'move', payload: { seq: before.seq, action } satisfies Move })
      }
      dispatch(action)
      const g = game.current
      if (g && !isTick(action)) logAction(g.id, action).catch((err) => console.error('Could not log action', err))
    },
    [online],
  )

  // Apply moves from other players in order, once our board is ready for them.
  useEffect(() => {
    if (!online || inbox.current.length === 0) return
    const next = inbox.current[0]
    if (next.seq < state.seq) {
      inbox.current = inbox.current.slice(1)
      setInboxSize(inbox.current.length)
      return
    }
    if (next.seq > state.seq) {
      // We missed a move: give it a moment to arrive, then reload the saved game
      const t = setTimeout(resync, RESYNC_MS)
      return () => clearTimeout(t)
    }
    if (state.phase === 'rolling' || state.phase === 'moving') return // still animating
    if (reducer(state, next.action) === state) {
      const t = setTimeout(resync, RESYNC_MS)
      return () => clearTimeout(t)
    }
    inbox.current = inbox.current.slice(1)
    setInboxSize(inbox.current.length)
    dispatch(next.action)
  }, [state, online, inboxSize, resync])

  // Animation timers: dice settle, then the token hops square by square (every device runs these).
  useEffect(() => {
    if (state.phase === 'rolling') {
      const t = setTimeout(() => act({ type: 'startMove' }), ROLL_MS * pace)
      return () => clearTimeout(t)
    }
    if (state.phase === 'moving' && state.stepsLeft > 0) {
      const t = setTimeout(() => act({ type: 'step' }), STEP_MS * pace)
      return () => clearTimeout(t)
    }
  }, [state.phase, state.stepsLeft, act, pace])

  // Robots take their turns on their own (online, the host's device plays them).
  useEffect(() => {
    if (sync === 'loading' || !robotHere || inboxSize > 0) return
    const move = robotMove(state)
    if (!move) return
    const pause = state.trade
      ? ROBOT_DEAL_MS
      : state.phase === 'card'
        ? ROBOT_CARD_MS
        : state.pendingPurchase !== null
          ? ROBOT_DECIDE_MS
          : ROBOT_MS
    const t = setTimeout(() => {
      // Never let a robot stall the game with a move the rules refuse
      const choice = [move, ...fallbacks()].find((a) => reducer(state, a) !== state)
      if (choice) act(choice)
    }, pause * pace)
    return () => clearTimeout(t)
  }, [state, sync, robotHere, inboxSize, act, pace])

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
  const proposeTrade = useCallback(
    (to: number, give: Bundle, get: Bundle) => act({ type: 'proposeTrade', to, give, get }),
    [act],
  )
  const counterTrade = useCallback((give: Bundle, get: Bundle) => act({ type: 'counterTrade', give, get }), [act])
  const acceptTrade = useCallback(() => act({ type: 'acceptTrade' }), [act])
  const declineTrade = useCallback(() => act({ type: 'declineTrade' }), [act])
  const cancelTrade = useCallback(() => act({ type: 'cancelTrade' }), [act])

  /** Rematch: same players and settings, fresh board (offline / pass-and-play only). */
  const newGame = useCallback(() => start(seatsOf(latest.current), latest.current.settings), [start])

  return {
    state,
    sync,
    /** True when the player whose turn it is isn't controlled from this device */
    waiting: !myTurn && state.phase !== 'over',
    myTurn,
    online: online ? { me: online.me, hostId: online.hostId, peers } : null,
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
    proposeTrade,
    counterTrade,
    acceptTrade,
    declineTrade,
    cancelTrade,
    controls,
    newGame,
  }
}

export type Game = ReturnType<typeof useGame>
