import { RotateCcw, Trophy } from 'lucide-react'
import { naira } from '../data/board'
import { netWorth } from '../game/game'
import type { Game } from '../game/useGame'
import { TokenDisc } from './Token'

export function GameOver({ game }: { game: Game }) {
  const { state } = game
  const winner = state.players[state.winner!]
  // Winner first, then everyone else by what they were worth (bankrupt players last)
  const standings = [...state.players].sort(
    (a, b) => Number(a.bankrupt) - Number(b.bankrupt) || netWorth(state, b.id) - netWorth(state, a.id),
  )

  return (
    <div className="gameover" style={{ '--token': winner.color } as React.CSSProperties}>
      <div className="gameover__burst" aria-hidden />
      <Trophy className="gameover__trophy" strokeWidth={1.6} />
      <span className="gameover__kicker">Game over</span>
      <h2 className="gameover__title">{winner.name} don own Lagos!</h2>
      <ol className="gameover__list">
        {standings.map((p, i) => (
          <li key={p.id} className={p.bankrupt ? 'is-out' : undefined}>
            <span className="gameover__rank">{i + 1}</span>
            <TokenDisc player={p} className="gameover__token" />
            <span className="gameover__name">{p.name}</span>
            <span className="gameover__worth">{p.bankrupt ? 'Bankrupt' : naira(netWorth(state, p.id))}</span>
          </li>
        ))}
      </ol>
      <button className="reveal__ok gameover__again" onClick={game.newGame}>
        <RotateCcw size={16} /> Play again
      </button>
    </div>
  )
}
