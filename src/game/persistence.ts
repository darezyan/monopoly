import { supabase } from '../lib/supabase'
import type { RobotLevel, TokenKind } from '../data/tokens'
import { upgradeState, type Action, type GameSettings, type GameState } from './game'

export type GameStatus = 'lobby' | 'playing' | 'finished'

export type SavedGame = {
  id: string
  state: GameState
  version: number
  /** Room code when this is an online game */
  code: string | null
  status: GameStatus
  createdBy: string
}

export type GameSummary = {
  id: string
  updatedAt: string
  status: GameStatus
  code: string | null
  /** Null while an online room is still in its lobby */
  state: GameState | null
}

export type RoomSeat = {
  seat: number
  userId: string | null
  nickname: string
  token: TokenKind
  robot: RobotLevel | null
}

export type Room = {
  id: string
  code: string
  status: GameStatus
  hostId: string
  settings: Partial<GameSettings>
  version: number
  seats: RoomSeat[]
}

/** Every browser gets a silent anonymous account so it can own games. */
async function ensureSession() {
  const { data } = await supabase!.auth.getSession()
  if (data.session) return
  const { error } = await supabase!.auth.signInAnonymously()
  if (error) throw error
}

/** The signed-in (anonymous) user's id, signing in first if needed. */
export async function myUserId(): Promise<string> {
  await ensureSession()
  const { data } = await supabase!.auth.getSession()
  return data.session!.user.id
}

type GameRow = {
  id: string
  state: GameState
  version: number
  code: string | null
  status: GameStatus
  created_by: string
}

const GAME_COLUMNS = 'id, state, version, code, status, created_by'

function toSaved(row: GameRow): SavedGame {
  return {
    id: row.id,
    // A lobby has no game state yet
    state: row.status === 'lobby' ? (row.state as GameState) : upgradeState(row.state),
    version: row.version,
    code: row.code,
    status: row.status,
    createdBy: row.created_by,
  }
}

export async function createGameRow(state: GameState): Promise<SavedGame> {
  await ensureSession()
  const { data, error } = await supabase!.from('games').insert({ state }).select(GAME_COLUMNS).single()
  if (error) throw error
  return toSaved(data as GameRow)
}

export async function loadGameRow(id: string): Promise<SavedGame | null> {
  await ensureSession()
  const { data, error } = await supabase!.from('games').select(GAME_COLUMNS).eq('id', id).maybeSingle()
  if (error) throw error
  return data && toSaved(data as GameRow)
}

/**
 * Saves a new snapshot only if nobody else saved since `version` was read.
 * Returns the new version, or null on a version conflict.
 */
export async function saveGameRow(id: string, state: GameState, version: number): Promise<number | null> {
  const status: GameStatus = state.phase === 'over' ? 'finished' : 'playing'
  // No .single()/.maybeSingle(): zero updated rows is a normal conflict, not an error
  const { data, error } = await supabase!
    .from('games')
    .update({ state, status, version: version + 1 })
    .eq('id', id)
    .eq('version', version)
    .select('version')
  if (error) throw error
  return data.length > 0 ? data[0].version : null
}

/** The latest saved version and decision count, to recover from a save conflict. */
export async function currentVersion(id: string): Promise<{ version: number; seq: number } | null> {
  const { data, error } = await supabase!.from('games').select('version, state->seq').eq('id', id).maybeSingle()
  if (error) throw error
  return data && { version: data.version, seq: Number(data.seq ?? 0) }
}

export async function logAction(gameId: string, action: Action) {
  const { error } = await supabase!.from('game_actions').insert({ game_id: gameId, action })
  if (error) throw error
}

/** This browser's most recent games and rooms, newest first, for the "Continue" list. */
export async function listMyGames(limit = 6): Promise<GameSummary[]> {
  await ensureSession()
  const { data, error } = await supabase!
    .from('games')
    .select('id, updated_at, status, code, state')
    .order('updated_at', { ascending: false })
    .limit(limit)
  if (error) throw error
  return data.map((row) => ({
    id: row.id,
    updatedAt: row.updated_at,
    status: row.status,
    code: row.code,
    state: row.status === 'lobby' ? null : upgradeState(row.state as GameState),
  }))
}

// ---------- Online rooms ----------

/** Turns database errors from the room functions into messages people can act on. */
function roomError(error: { message: string }): Error {
  return new Error(error.message.replace(/^.*?:\s*/, ''))
}

export async function createRoom(nickname: string, token: TokenKind, settings: GameSettings): Promise<string> {
  await ensureSession()
  const { data, error } = await supabase!.rpc('create_room', {
    p_nickname: nickname,
    p_token: token,
    p_settings: settings,
  })
  if (error) throw roomError(error)
  return (data as GameRow).id
}

/** Joins (or rejoins) a room by code; resolves to its game id. */
export async function joinRoom(code: string, nickname: string, token: TokenKind | null): Promise<string> {
  await ensureSession()
  const { data, error } = await supabase!.rpc('join_room', { p_code: code, p_nickname: nickname, p_token: token })
  if (error) throw roomError(error)
  return data as string
}

export async function loadRoom(id: string): Promise<Room> {
  await ensureSession()
  const [game, seats] = await Promise.all([
    supabase!.from('games').select('id, code, status, created_by, settings, version').eq('id', id).single(),
    supabase!.from('game_players').select('seat, user_id, nickname, token, robot').eq('game_id', id).order('seat'),
  ])
  if (game.error) throw game.error
  if (seats.error) throw seats.error
  return {
    id: game.data.id,
    code: game.data.code,
    status: game.data.status,
    hostId: game.data.created_by,
    settings: game.data.settings ?? {},
    version: game.data.version,
    seats: seats.data.map((s) => ({
      seat: s.seat,
      userId: s.user_id,
      nickname: s.nickname,
      token: s.token,
      robot: s.robot,
    })),
  }
}

export async function updateSeat(gameId: string, seat: number, patch: Partial<Pick<RoomSeat, 'nickname' | 'token' | 'robot'>>) {
  const { error } = await supabase!.from('game_players').update(patch).eq('game_id', gameId).eq('seat', seat)
  if (error) throw roomError(error)
}

export async function addRobotSeat(gameId: string, seat: RoomSeat) {
  const { error } = await supabase!.from('game_players').insert({
    game_id: gameId,
    seat: seat.seat,
    nickname: seat.nickname,
    token: seat.token,
    robot: seat.robot,
  })
  if (error) throw roomError(error)
}

export async function removeSeat(gameId: string, seat: number) {
  const { error } = await supabase!.from('game_players').delete().eq('game_id', gameId).eq('seat', seat)
  if (error) throw roomError(error)
}

export async function updateRoomSettings(gameId: string, settings: GameSettings) {
  const { error } = await supabase!.from('games').update({ settings }).eq('id', gameId)
  if (error) throw roomError(error)
}

/** Host starts the game: the lobby becomes a live game with its first state. */
export async function startRoom(gameId: string, state: GameState, version: number): Promise<number> {
  const { data, error } = await supabase!
    .from('games')
    .update({ state, status: 'playing', version: version + 1 })
    .eq('id', gameId)
    .eq('status', 'lobby')
    .select('version')
    .single()
  if (error) throw roomError(error)
  return data.version
}
