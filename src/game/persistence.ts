import { supabase } from '../lib/supabase'
import { upgradeState, type Action, type GameState } from './game'

export type SavedGame = { id: string; state: GameState; version: number }

/** Every browser gets a silent anonymous account so it can own games. */
async function ensureSession() {
  const { data } = await supabase!.auth.getSession()
  if (data.session) return
  const { error } = await supabase!.auth.signInAnonymously()
  if (error) throw error
}

let booting: Promise<SavedGame> | null = null

/**
 * Loads the game named in the URL (?game=…), or creates a new one from `fresh()`.
 * Memoised so React's dev double-effects don't create two games.
 */
export function bootGame(fresh: () => GameState): Promise<SavedGame> {
  booting ??= (async () => {
    const id = new URLSearchParams(location.search).get('game')
    return (id && (await loadGameRow(id))) || (await createGameRow(fresh()))
  })()
  return booting
}

export async function createGameRow(state: GameState): Promise<SavedGame> {
  await ensureSession()
  const { data, error } = await supabase!
    .from('games')
    .insert({ state })
    .select('id, state, version')
    .single()
  if (error) throw error
  return data as SavedGame
}

export async function loadGameRow(id: string): Promise<SavedGame | null> {
  await ensureSession()
  const { data, error } = await supabase!
    .from('games')
    .select('id, state, version')
    .eq('id', id)
    .maybeSingle()
  if (error) throw error
  return data && { ...(data as SavedGame), state: upgradeState(data.state as GameState) }
}

/**
 * Saves a new snapshot only if nobody else saved since `version` was read.
 * Returns the new version, or null on a version conflict.
 */
export async function saveGameRow(id: string, state: GameState, version: number): Promise<number | null> {
  const { data, error } = await supabase!
    .from('games')
    .update({ state, version: version + 1 })
    .eq('id', id)
    .eq('version', version)
    .select('version')
    .maybeSingle()
  if (error) throw error
  return data ? data.version : null
}

export async function logAction(gameId: string, action: Action) {
  const { error } = await supabase!.from('game_actions').insert({ game_id: gameId, action })
  if (error) throw error
}
