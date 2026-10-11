import { useEffect, useRef, useState } from 'react'
import { installAudioUnlock, startMusic } from './audio/sound'
import { useGameSounds } from './audio/useGameSounds'
import { Board } from './components/Board'
import { History } from './components/History'
import { Home, type SetupMode } from './components/Home'
import { JoinRoom } from './components/JoinRoom'
import { Portfolio } from './components/Portfolio'
import { Room } from './components/Room'
import { Setup } from './components/Setup'
import { Sidebar, canTrade, type FeedTab } from './components/Sidebar'
import { TopControls } from './components/TopControls'
import { LoanPanel } from './components/LoanPanel'
import { TradeBuilder } from './components/TradeBuilder'
import { DEFAULT_SETTINGS } from './game/game'
import { createRoom, loadGameRow } from './game/persistence'
import { useGame } from './game/useGame'
import { useVoice, type Voice } from './voice/useVoice'
import { useChat } from './chat/useChat'
import { ChatDock, ChatThread, useChatAlerts, useChatBubbles, useIsPhone } from './components/Chat'

type Screen =
  | { name: 'home' }
  | { name: 'setup'; mode: SetupMode }
  | { name: 'join'; code?: string }
  | { name: 'room'; gameId: string }
  | { name: 'game' }
  /** Opening a game or room; the id keeps its voice call going through the switch */
  | { name: 'loading'; gameId?: string }

const NICKNAME_KEY = 'eko:nickname'

function readNickname() {
  try {
    return localStorage.getItem(NICKNAME_KEY) ?? ''
  } catch {
    return ''
  }
}

/** Keep the address bar pointing at what's on screen, so links and reloads land in the same place. */
function setUrl(params: Record<string, string | null>) {
  const url = new URL(location.href)
  for (const [k, v] of Object.entries(params)) {
    if (v) url.searchParams.set(k, v)
    else url.searchParams.delete(k)
  }
  history.replaceState(null, '', url)
}

export function App() {
  const game = useGame()
  const params = new URLSearchParams(location.search)
  const linkedGame = params.get('game')
  const linkedRoom = params.get('room')
  const [screen, setScreen] = useState<Screen>(
    linkedGame ? { name: 'loading' } : linkedRoom ? { name: 'join', code: linkedRoom } : { name: 'home' },
  )
  const [notice, setNotice] = useState<string | null>(null)
  const [nickname, setNickname] = useState(readNickname)
  // Voice runs from the lobby right through the game, for online rooms only
  const voiceId = useRef<string | null>(null)
  voiceId.current =
    screen.name === 'room'
      ? screen.gameId
      : screen.name === 'game'
        ? (game.online?.gameId ?? null)
        : // Stay in the call while the same room loads into its game
          screen.name === 'loading' && screen.gameId === voiceId.current
          ? voiceId.current
          : null
  const voice = useVoice(voiceId.current)

  const saveNickname = (name: string) => {
    setNickname(name)
    try {
      localStorage.setItem(NICKNAME_KEY, name)
    } catch {
      // Storage can be unavailable (private mode); the name just won't be remembered
    }
  }

  const goHome = (message: string | null = null) => {
    setUrl({ game: null, room: null })
    setNotice(message)
    setScreen({ name: 'home' })
  }

  const openGame = async (id: string) => {
    setScreen({ name: 'loading', gameId: id })
    if (await game.open(id)) return setScreen({ name: 'game' })
    goHome('That game couldn’t be opened. It may belong to another device.')
  }

  /** A room you're seated in: its lobby while waiting, the game once it has started. */
  const openRoom = async (id: string) => {
    setScreen({ name: 'loading', gameId: id })
    try {
      const row = await loadGameRow(id)
      if (!row) return goHome('That room couldn’t be found.')
      if (row.status !== 'lobby') return openGame(id)
      setUrl({ game: null, room: row.code })
      setScreen({ name: 'room', gameId: id })
    } catch {
      goHome('Couldn’t reach that room. Check your connection.')
    }
  }

  // A ?game=… link opens that game straight away
  useEffect(() => {
    if (linkedGame) openGame(linkedGame)
  }, [])

  // Browsers block audio until the first tap or keypress; start the music then
  useEffect(() => installAudioUnlock(startMusic), [])

  switch (screen.name) {
    case 'loading':
      return (
        <div className="splash">
          <div className="logo">
            <h1 className="logo__word">
              Èkó<span className="logo__dot">.</span>
            </h1>
          </div>
          <p>Loading…</p>
        </div>
      )
    case 'home':
      return (
        <>
          <TopControls />
          <Home
            nickname={nickname}
            onNickname={saveNickname}
            notice={notice}
            onSetup={(mode) => {
              setNotice(null)
              setScreen({ name: 'setup', mode })
            }}
            onContinue={openGame}
            onOpenRoom={openRoom}
            onCreateRoom={async () => {
              setNotice(null)
              try {
                await openRoom(await createRoom(nickname.trim(), 'danfo', DEFAULT_SETTINGS))
              } catch (err) {
                goHome(`Couldn’t create a room: ${(err as Error).message}`)
              }
            }}
            onJoin={() => {
              setNotice(null)
              setScreen({ name: 'join' })
            }}
          />
        </>
      )
    case 'setup':
      return (
        <>
          <TopControls />
          <Setup
            mode={screen.mode}
            nickname={nickname}
            onBack={() => setScreen({ name: 'home' })}
            onStart={(seats, settings) => {
              game.start(seats, settings)
              setScreen({ name: 'game' })
            }}
          />
        </>
      )
    case 'join':
      return (
        <>
          <TopControls />
          <JoinRoom
            initialCode={screen.code}
            nickname={nickname}
            onNickname={saveNickname}
            onBack={() => goHome()}
            onJoined={openRoom}
          />
        </>
      )
    case 'room':
      return (
        <>
          <TopControls />
          <Room gameId={screen.gameId} voice={voice} onLeave={() => goHome()} onStarted={() => openGame(screen.gameId)} />
        </>
      )
    case 'game':
      return (
        <GameScreen
          game={game}
          voice={voice}
          onExit={() => {
            game.leave()
            goHome()
          }}
        />
      )
  }
}

function GameScreen({ game, voice, onExit }: { game: ReturnType<typeof useGame>; voice: Voice; onExit: () => void }) {
  const { state, roll, endTurn, buy, pass, applyCard, waiting } = game
  const [pinned, setPinned] = useState<number | null>(null)
  const [portfolio, setPortfolio] = useState<number | null>(null)
  const [history, setHistory] = useState(false)
  /** Deal builder: a new offer (optionally to a chosen partner) or a counter-offer */
  const [deal, setDeal] = useState<{ partner?: number; counter?: boolean } | null>(null)
  const [loanOpen, setLoanOpen] = useState(false)
  useGameSounds(state)

  // Chat (online games): a sheet on phones, a sidebar tab on bigger screens
  const me = game.online?.me ?? null
  const chat = useChat(game.online?.gameId ?? null, me)
  const phone = useIsPhone()
  const [chatOpen, setChatOpen] = useState(false)
  const [feedTab, setFeedTab] = useState<FeedTab>('activity')
  const alerts = useChatAlerts(chat, me, phone ? chatOpen : feedTab === 'chat')
  const chatOn = chat.status !== 'off' && chat.status !== 'unavailable'
  const bubbles = useChatBubbles(chat)

  // A deed left open by the previous player shouldn't carry into the next turn
  useEffect(() => setPinned(null), [state.current])

  // Space rolls or ends the turn; B / P buy or pass when a purchase is on the table
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat || e.metaKey || e.ctrlKey || portfolio !== null || history || deal || loanOpen || chatOpen) return
      if (e.key === 'Escape') return setPinned(null)
      if (waiting) return
      if (e.target instanceof HTMLElement && e.target.closest('button, input, textarea')) return
      if (state.pendingPurchase !== null) {
        if (e.key === 'b') buy()
        if (e.key === 'p') pass()
        return
      }
      if (e.code !== 'Space') return
      e.preventDefault()
      if (state.phase === 'idle') roll()
      else if (state.phase === 'card') applyCard()
      else if (state.phase === 'landed') endTurn()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [state.phase, state.pendingPurchase, portfolio, history, deal, loanOpen, chatOpen, waiting, roll, endTurn, buy, pass, applyCard])

  return (
    <main className="app">
      <Board
        game={game}
        pinned={pinned}
        onPin={setPinned}
        onExit={onExit}
        onCounter={() => setDeal({ counter: true })}
      />
      <Sidebar
        game={game}
        voice={voice}
        bubbles={bubbles}
        chat={
          chatOn && !phone
            ? {
                tab: feedTab,
                onTab: setFeedTab,
                unread: alerts.unread,
                thread: <ChatThread chat={chat} players={state.players} me={me} />,
              }
            : undefined
        }
        onOpenPortfolio={setPortfolio}
        onOpenHistory={() => setHistory(true)}
        onOpenTrade={(partner) => setDeal({ partner })}
        onOpenLoan={() => setLoanOpen(true)}
        onExit={onExit}
      />
      {chatOn && phone && (
        <ChatDock
          chat={chat}
          players={state.players}
          me={me}
          open={chatOpen}
          onOpen={() => setChatOpen(true)}
          onClose={() => setChatOpen(false)}
          unread={alerts.unread}
          preview={
            alerts.preview && {
              message: alerts.preview,
              player: state.players.find((p) => p.userId === alerts.preview!.userId),
            }
          }
        />
      )}
      {history && <History state={state} onClose={() => setHistory(false)} />}
      {loanOpen && game.myTurn && <LoanPanel game={game} onClose={() => setLoanOpen(false)} />}
      {deal && (deal.counter ? state.trade : canTrade(game)) && (
        <TradeBuilder
          state={state}
          me={deal.counter ? state.trade!.responder : state.current}
          partner={deal.counter ? state.trade!.proposer : deal.partner}
          // When countering, start from the deal on the table seen from my side
          initial={deal.counter ? { give: state.trade!.get, get: state.trade!.give } : undefined}
          onSend={(to, give, get) => {
            if (deal.counter) game.counterTrade(give, get)
            else game.proposeTrade(to, give, get)
            setDeal(null)
          }}
          onClose={() => setDeal(null)}
        />
      )}
      {portfolio !== null && (
        <Portfolio
          state={state}
          playerId={portfolio}
          canManage={game.myTurn}
          onTrade={
            canTrade(game)
              ? () => {
                  setDeal({ partner: portfolio })
                  setPortfolio(null)
                }
              : undefined
          }
          onClose={() => setPortfolio(null)}
          onOpenDeed={(index) => {
            setPortfolio(null)
            setPinned(index)
          }}
        />
      )}
    </main>
  )
}
