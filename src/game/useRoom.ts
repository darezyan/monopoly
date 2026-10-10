import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { ROBOT_NAMES, TOKENS, type RobotLevel, type TokenKind } from '../data/tokens'
import { DEFAULT_SETTINGS, createGame, type GameSettings, type Seat } from './game'
import {
  addRobotSeat,
  loadRoom,
  myUserId,
  removeSeat,
  startRoom,
  updateRoomSettings,
  updateSeat,
  type Room,
} from './persistence'

const MAX_SEATS = 8

/**
 * A room's lobby: who's seated, who's online, and the host's controls.
 * Follows changes live, and calls `onStarted` once the host starts the game.
 */
export function useRoom(gameId: string, onStarted: () => void) {
  const [room, setRoom] = useState<Room | null>(null)
  const [me, setMe] = useState<string | null>(null)
  const [online, setOnline] = useState<Set<string>>(new Set())
  const [error, setError] = useState<string | null>(null)
  const started = useRef(onStarted)
  started.current = onStarted
  // Several updates can report the start at once; move into the game only once
  const fired = useRef(false)

  const refresh = useCallback(async () => {
    try {
      const next = await loadRoom(gameId)
      setRoom(next)
      if (next.status !== 'lobby' && !fired.current) {
        fired.current = true
        started.current()
      }
    } catch (err) {
      setError((err as Error).message)
    }
  }, [gameId])

  useEffect(() => {
    let cancelled = false
    let channel: ReturnType<NonNullable<typeof supabase>['channel']> | null = null
    ;(async () => {
      const uid = await myUserId()
      if (cancelled) return
      setMe(uid)
      await refresh()
      // The effect may have been cleaned up while we were waiting; don't leave a stray subscription behind
      if (cancelled) return
      channel = supabase!
        .channel(`room:${gameId}`, { config: { presence: { key: uid } } })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'game_players', filter: `game_id=eq.${gameId}` }, refresh)
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'games', filter: `id=eq.${gameId}` }, refresh)
        .on('presence', { event: 'sync' }, () => setOnline(new Set(Object.keys(channel!.presenceState()))))
        .subscribe((status) => {
          if (status === 'SUBSCRIBED') channel!.track({ at: Date.now() })
        })
    })()
    return () => {
      cancelled = true
      if (channel) supabase!.removeChannel(channel)
    }
  }, [gameId, refresh])

  const isHost = !!room && room.hostId === me
  const mySeat = room?.seats.find((s) => s.userId === me) ?? null
  const settings: GameSettings = { ...DEFAULT_SETTINGS, ...room?.settings }

  // Every change is followed by a refresh, so the UI reflects what the database accepted.
  const run = useCallback(
    async (fn: () => Promise<unknown>) => {
      setError(null)
      try {
        await fn()
      } catch (err) {
        setError((err as Error).message)
      }
      await refresh()
    },
    [refresh],
  )

  const freeToken = (r: Room): TokenKind | null => TOKENS.find((t) => !r.seats.some((s) => s.token === t.kind))?.kind ?? null
  const freeSeat = (r: Room): number | null => {
    for (let i = 0; i < MAX_SEATS; i++) if (!r.seats.some((s) => s.seat === i)) return i
    return null
  }

  return {
    room,
    me,
    isHost,
    mySeat,
    settings,
    online,
    error,
    full: (room?.seats.length ?? 0) >= MAX_SEATS,
    setToken: (seat: number, token: TokenKind) => run(() => updateSeat(gameId, seat, { token })),
    setNickname: (seat: number, nickname: string) => run(() => updateSeat(gameId, seat, { nickname })),
    setRobotLevel: (seat: number, robot: RobotLevel) => run(() => updateSeat(gameId, seat, { robot })),
    addRobot: () =>
      run(async () => {
        // Work from the latest seating, not what's on screen, in case someone just joined
        const fresh = await loadRoom(gameId)
        const seat = freeSeat(fresh)
        const token = freeToken(fresh)
        if (seat === null || !token) return
        const name = ROBOT_NAMES.find((n) => !fresh.seats.some((s) => s.nickname === n)) ?? 'Robot'
        await addRobotSeat(gameId, { seat, token, nickname: name, robot: 'normal', userId: null })
      }),
    remove: (seat: number) => run(() => removeSeat(gameId, seat)),
    leave: () => (mySeat ? removeSeat(gameId, mySeat.seat) : Promise.resolve()),
    setSettings: (next: GameSettings) => run(() => updateRoomSettings(gameId, next)),
    start: () =>
      run(async () => {
        const seats: Seat[] = room!.seats.map((s) => ({
          name: s.nickname,
          token: s.token,
          robot: s.robot,
          userId: s.userId,
        }))
        await startRoom(gameId, createGame(seats, settings), room!.version)
      }),
  }
}

export type RoomControls = ReturnType<typeof useRoom>
