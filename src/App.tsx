import { useEffect, useState } from 'react'
import { installAudioUnlock, startMusic } from './audio/sound'
import { useGameSounds } from './audio/useGameSounds'
import { Board } from './components/Board'
import { Home, type SetupMode } from './components/Home'
import { Portfolio } from './components/Portfolio'
import { Setup } from './components/Setup'
import { Sidebar } from './components/Sidebar'
import { TopControls } from './components/TopControls'
import { useGame } from './game/useGame'

type Screen = { name: 'home' } | { name: 'setup'; mode: SetupMode } | { name: 'game' } | { name: 'loading' }

const NICKNAME_KEY = 'eko:nickname'

function readNickname() {
  try {
    return localStorage.getItem(NICKNAME_KEY) ?? ''
  } catch {
    return ''
  }
}

export function App() {
  const game = useGame()
  const linked = new URLSearchParams(location.search).get('game')
  const [screen, setScreen] = useState<Screen>(linked ? { name: 'loading' } : { name: 'home' })
  const [notice, setNotice] = useState<string | null>(null)
  const [nickname, setNickname] = useState(readNickname)

  const saveNickname = (name: string) => {
    setNickname(name)
    try {
      localStorage.setItem(NICKNAME_KEY, name)
    } catch {
      // Storage can be unavailable (private mode); the name just won't be remembered
    }
  }

  const openGame = async (id: string) => {
    setScreen({ name: 'loading' })
    const ok = await game.open(id)
    if (ok) return setScreen({ name: 'game' })
    setNotice('That game couldn’t be found. It may belong to another device.')
    setScreen({ name: 'home' })
  }

  // A ?game=… link opens that game straight away
  useEffect(() => {
    if (linked) openGame(linked)
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
          <p>Loading your game…</p>
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
    case 'game':
      return (
        <GameScreen
          game={game}
          onExit={() => {
            game.leave()
            setScreen({ name: 'home' })
          }}
        />
      )
  }
}

function GameScreen({ game, onExit }: { game: ReturnType<typeof useGame>; onExit: () => void }) {
  const { state, roll, endTurn, buy, pass, applyCard, robotTurn } = game
  const [pinned, setPinned] = useState<number | null>(null)
  const [portfolio, setPortfolio] = useState<number | null>(null)
  useGameSounds(state)

  // A deed left open by the previous player shouldn't carry into the next turn
  useEffect(() => setPinned(null), [state.current])

  // Space rolls or ends the turn; B / P buy or pass when a purchase is on the table
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat || e.metaKey || e.ctrlKey || portfolio !== null) return
      if (e.key === 'Escape') return setPinned(null)
      if (robotTurn) return
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
  }, [state.phase, state.pendingPurchase, portfolio, robotTurn, roll, endTurn, buy, pass, applyCard])

  return (
    <main className="app">
      <Board game={game} pinned={pinned} onPin={setPinned} />
      <Sidebar game={game} onOpenPortfolio={setPortfolio} onExit={onExit} />
      {portfolio !== null && (
        <Portfolio
          state={state}
          playerId={portfolio}
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
