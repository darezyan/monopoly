import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { MessageCircle, SendHorizontal, X } from 'lucide-react'
import { sfx } from '../audio/sound'
import { MAX_MESSAGE, type Chat, type ChatMessage } from '../chat/useChat'
import type { Player } from '../game/game'
import { TokenDisc } from './Token'

/** One-tap messages */
const QUICK = ['Oya roll!', 'Na wa o', 'E don happen!', 'Abeg no vex', 'Deal?', 'Wahala dey o']

/** Same sender within this long shares one name label */
const GROUP_MS = 2 * 60 * 1000

/** True on phone-sized screens, where chat opens as a sheet instead of a sidebar tab. */
export function useIsPhone() {
  const query = '(max-width: 700px)'
  const [phone, setPhone] = useState(() => window.matchMedia(query).matches)
  useEffect(() => {
    const mq = window.matchMedia(query)
    const on = () => setPhone(mq.matches)
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [])
  return phone
}

/**
 * Unread count, a short preview of the newest message and a soft sound, for messages from
 * other players. Anything that arrives while the chat is on screen counts as read.
 */
export function useChatAlerts(chat: Chat, me: string | null, visible: boolean) {
  /** Newest message id the player has had on screen */
  const seen = useRef<number | null>(null)
  /** Newest message id already announced with a sound */
  const alerted = useRef<number | null>(null)
  const [preview, setPreview] = useState<ChatMessage | null>(null)
  const confirmed = chat.messages.filter((m) => !m.pending)
  const latest = confirmed[confirmed.length - 1]
  const newest = latest?.id ?? 0

  // History loaded on opening the game counts as already read
  useEffect(() => {
    if (chat.status !== 'ready' || seen.current !== null) return
    seen.current = newest
    alerted.current = newest
  }, [chat.status, newest])

  useEffect(() => {
    if (!visible || seen.current === null) return
    seen.current = Math.max(seen.current, newest)
    setPreview(null)
  }, [visible, newest])

  // A new message from someone else: pop, and preview it if the chat is closed
  useEffect(() => {
    if (!latest || alerted.current === null || latest.id <= alerted.current) return
    alerted.current = latest.id
    if (latest.userId === me) return
    sfx.message()
    if (visible) return
    setPreview(latest)
    const t = setTimeout(() => setPreview(null), 4000)
    return () => clearTimeout(t)
  }, [newest])

  const unread = visible ? 0 : confirmed.filter((m) => m.userId !== me && m.id > (seen.current ?? Infinity)).length
  return { unread, preview }
}

/** How long a message stays up as a bubble on the sender's player card */
const BUBBLE_MS = 5000

/**
 * Each player's newest message, for a few seconds after they send it, so everyone sees it
 * on the player cards without opening the chat. History loaded on opening the game isn't shown.
 */
export function useChatBubbles(chat: Chat): Record<string, ChatMessage> {
  const [bubbles, setBubbles] = useState<Record<string, ChatMessage>>({})
  const ready = useRef(false)
  const shown = useRef(new Set<number>())
  const latest = chat.messages[chat.messages.length - 1]

  useEffect(() => {
    if (chat.status === 'ready' && !ready.current) {
      ready.current = true
      chat.messages.forEach((m) => shown.current.add(m.id))
    }
  }, [chat.status])

  // One hide timer per player, so a newer message restarts it and confirming a sent one doesn't
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>())
  useEffect(() => () => timers.current.forEach(clearTimeout), [])

  useEffect(() => {
    if (!latest || !ready.current || shown.current.has(latest.id)) return
    shown.current.add(latest.id)
    // A sent message shows straight away; when the server confirms it, the same bubble carries on
    const current = bubbles[latest.userId]
    if (!latest.pending && current?.pending && current.body === latest.body) return
    setBubbles((b) => ({ ...b, [latest.userId]: latest }))
    clearTimeout(timers.current.get(latest.userId))
    timers.current.set(
      latest.userId,
      setTimeout(() => setBubbles((b) => omit(b, latest.userId)), BUBBLE_MS),
    )
  }, [latest?.id])

  return bubbles
}

const omit = <T,>(record: Record<string, T>, key: string) => {
  const { [key]: _, ...rest } = record
  return rest
}

const clock = (at: number) => new Date(at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })

type ThreadProps = { chat: Chat; players: Player[]; me: string | null; autoFocus?: boolean }

/** The messages and the box to write in. */
export function ChatThread({ chat, players, me, autoFocus }: ThreadProps) {
  const [draft, setDraft] = useState('')
  const listRef = useRef<HTMLOListElement>(null)
  const pinned = useRef(true)
  const byUser = new Map(players.filter((p) => p.userId).map((p) => [p.userId!, p]))

  // Stay at the newest message unless the reader has scrolled up to look back
  useLayoutEffect(() => {
    const el = listRef.current
    if (el && pinned.current) el.scrollTop = el.scrollHeight
  }, [chat.messages])

  const send = async (text: string) => {
    if (await chat.send(text)) {
      if (text === draft) setDraft('')
      pinned.current = true
    }
  }

  if (chat.status === 'unavailable') {
    return <p className="chat__empty">Chat isn’t switched on for this game yet.</p>
  }

  return (
    <div className="chat">
      <ol
        className="chat__list"
        ref={listRef}
        onScroll={(e) => {
          const el = e.currentTarget
          pinned.current = el.scrollHeight - el.scrollTop - el.clientHeight < 40
        }}
        aria-live="polite"
      >
        {chat.status === 'loading' && chat.messages.length === 0 && <li className="chat__empty">Loading chat…</li>}
        {chat.status !== 'loading' && chat.messages.length === 0 && (
          <li className="chat__empty">No messages yet. Say hi, or start the yabbing.</li>
        )}
        {chat.messages.map((m, i) => (
          <Bubble
            key={m.id}
            message={m}
            player={byUser.get(m.userId)}
            mine={m.userId === me}
            first={!sameGroup(chat.messages[i - 1], m)}
          />
        ))}
      </ol>

      <div className="chat__quick" aria-label="Quick messages">
        {QUICK.map((q) => (
          <button key={q} onClick={() => send(q)}>
            {q}
          </button>
        ))}
      </div>

      <form
        className="chat__compose"
        onSubmit={(e) => {
          e.preventDefault()
          send(draft)
        }}
      >
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          maxLength={MAX_MESSAGE}
          placeholder="Type a message…"
          aria-label="Message"
          autoFocus={autoFocus}
          enterKeyHint="send"
        />
        <button type="submit" disabled={!draft.trim()} aria-label="Send">
          <SendHorizontal size={18} />
        </button>
      </form>
      {chat.error && <p className="chat__error">{chat.error}</p>}
    </div>
  )
}

const sameGroup = (prev: ChatMessage | undefined, m: ChatMessage) =>
  !!prev && prev.userId === m.userId && m.at - prev.at < GROUP_MS

function Bubble({
  message,
  player,
  mine,
  first,
}: {
  message: ChatMessage
  player?: Player
  mine: boolean
  first: boolean
}) {
  return (
    <li
      className={`chat__msg${mine ? ' is-mine' : ''}${first ? ' is-first' : ''}${message.pending ? ' is-pending' : ''}`}
      style={{ '--token': player?.color ?? '#9aa3b5' } as React.CSSProperties}
    >
      {!mine && (
        <span className="chat__avatar">{first && player && <TokenDisc player={player} className="chat__token" />}</span>
      )}
      <div className="chat__bubble">
        {first && !mine && <span className="chat__name">{player?.name ?? 'Someone'}</span>}
        <span className="chat__body">{message.body}</span>
        <time className="chat__time">{clock(message.at)}</time>
      </div>
    </li>
  )
}

type DockProps = ThreadProps & {
  open: boolean
  onOpen: () => void
  onClose: () => void
  unread: number
  /** The latest message from someone else, previewed above the button for a few seconds */
  preview: { message: ChatMessage; player?: Player } | null
}

/** Phones: a chat button in the corner that opens the chat as a sheet. */
export function ChatDock({ open, onOpen, onClose, unread, preview, ...thread }: DockProps) {
  // Escape closes the sheet
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  return (
    <>
      {!open && (
        <div className="chat-fab">
          {preview && (
            <button key={preview.message.id} className="chat-fab__preview" onClick={onOpen}>
              <b style={{ '--token': preview.player?.color } as React.CSSProperties}>
                {preview.player?.name ?? 'Someone'}
              </b>{' '}
              {preview.message.body}
            </button>
          )}
          <button className="chat-fab__btn" onClick={onOpen} aria-label={unread ? `Chat, ${unread} new` : 'Chat'}>
            <MessageCircle size={24} />
            {unread > 0 && <span className="chat-fab__badge">{unread > 9 ? '9+' : unread}</span>}
          </button>
        </div>
      )}
      {open && (
        <div className="chat-backdrop" onClick={onClose}>
          <section className="chat-sheet" role="dialog" aria-label="Chat" onClick={(e) => e.stopPropagation()}>
            <header className="chat-sheet__head">
              <MessageCircle size={18} /> Chat
              <button className="icon-btn chat-sheet__close" onClick={onClose} aria-label="Close chat">
                <X size={18} />
              </button>
            </header>
            <ChatThread {...thread} />
          </section>
        </div>
      )}
    </>
  )
}
