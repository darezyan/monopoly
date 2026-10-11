import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'

// Text chat for online rooms: messages live in game_messages (so they survive a reload)
// and arrive live through Realtime.

export type ChatMessage = {
  id: number
  userId: string
  body: string
  at: number
  /** Still sending (shown faded until the server confirms) */
  pending?: boolean
}

export type ChatStatus = 'off' | 'loading' | 'ready' | 'unavailable' | 'error'

export const MAX_MESSAGE = 280
/** Messages kept on screen */
const HISTORY = 150
/** Smallest gap between two sends, so a held Enter key can't flood the room */
const SEND_GAP_MS = 600

type Row = { id: number; user_id: string; body: string; created_at: string }

const toMessage = (r: Row): ChatMessage => ({
  id: r.id,
  userId: r.user_id,
  body: r.body,
  at: Date.parse(r.created_at),
})

/** Keep the list ordered and free of duplicates (a sent message also comes back over Realtime). */
function merge(list: ChatMessage[], incoming: ChatMessage[]) {
  const byId = new Map(list.map((m) => [m.id, m]))
  for (const m of incoming) byId.set(m.id, m)
  return [...byId.values()].sort((a, b) => a.id - b.id).slice(-HISTORY)
}

export function useChat(gameId: string | null, me: string | null) {
  const [status, setStatus] = useState<ChatStatus>('off')
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [error, setError] = useState<string | null>(null)
  const lastSent = useRef(0)
  /** Temporary negative ids for messages still on their way */
  const tempId = useRef(-1)

  useEffect(() => {
    if (!gameId || !supabase) {
      setStatus('off')
      setMessages([])
      return
    }
    let cancelled = false
    setStatus('loading')
    setError(null)

    const channel = supabase
      .channel(`chat:${gameId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'game_messages', filter: `game_id=eq.${gameId}` },
        ({ new: row }) => setMessages((list) => merge(list, [toMessage(row as Row)])),
      )
      .subscribe()

    supabase
      .from('game_messages')
      .select('id, user_id, body, created_at')
      .eq('game_id', gameId)
      .order('id', { ascending: false })
      .limit(HISTORY)
      .then(({ data, error }) => {
        if (cancelled) return
        if (error) {
          // The chat table hasn't been created yet (its migration not run)
          if (error.code === '42P01' || error.code === 'PGRST205') return setStatus('unavailable')
          setStatus('error')
          return setError('Couldn’t load the chat.')
        }
        setMessages((list) => merge(list, (data as Row[]).map(toMessage)))
        setStatus('ready')
      })

    return () => {
      cancelled = true
      supabase!.removeChannel(channel)
      setMessages([])
    }
  }, [gameId])

  const send = useCallback(
    async (text: string) => {
      const body = text.trim().slice(0, MAX_MESSAGE)
      if (!body || !gameId || !me || !supabase) return false
      const now = Date.now()
      if (now - lastSent.current < SEND_GAP_MS) return false
      lastSent.current = now

      // Show it straight away; swap in the real one when the server confirms
      const temp: ChatMessage = { id: tempId.current--, userId: me, body, at: now, pending: true }
      setMessages((list) => [...list, temp])
      const { data, error } = await supabase
        .from('game_messages')
        .insert({ game_id: gameId, body })
        .select('id, user_id, body, created_at')
        .single()
      setMessages((list) => {
        const rest = list.filter((m) => m.id !== temp.id)
        return error ? rest : merge(rest, [toMessage(data as Row)])
      })
      if (error) {
        setError('Message didn’t send. Try again.')
        return false
      }
      setError(null)
      return true
    },
    [gameId, me],
  )

  return { status, messages, error, send }
}

export type Chat = ReturnType<typeof useChat>
