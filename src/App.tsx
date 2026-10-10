import { useEffect, useState } from 'react'
import { Board } from './components/Board'
import { Portfolio } from './components/Portfolio'
import { Sidebar } from './components/Sidebar'
import { useGame } from './game/useGame'

export function App() {
  const game = useGame()
  const { state, roll, endTurn, buy, pass, applyCard } = game
  const [pinned, setPinned] = useState<number | null>(null)
  const [portfolio, setPortfolio] = useState<number | null>(null)

  // A deed left open by the previous player shouldn't carry into the next turn
  useEffect(() => setPinned(null), [state.current])

  // Space rolls or ends the turn; B / P buy or pass when a purchase is on the table
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat || e.metaKey || e.ctrlKey || portfolio !== null) return
      if (e.key === 'Escape') return setPinned(null)
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
  }, [state.phase, state.pendingPurchase, portfolio, roll, endTurn, buy, pass, applyCard])

  return (
    <main className="app">
      <Board game={game} pinned={pinned} onPin={setPinned} />
      <Sidebar game={game} onOpenPortfolio={setPortfolio} />
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
