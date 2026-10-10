import { useState } from 'react'
import { CircleHelp, PiggyBank, X } from 'lucide-react'
import { BOARD, naira } from '../data/board'
import { drawnCard, level, ownsGroup } from '../game/game'
import type { Game } from '../game/useGame'
import { BoardTile } from './BoardTile'
import { CardReveal } from './CardReveal'
import { DeedCard } from './DeedCard'
import { Dice } from './Dice'
import { GameOver } from './GameOver'
import { ManageBar } from './ManageBar'
import { Tokens } from './Tokens'

type Props = {
  game: Game
  /** Deed held open in the centre (lifted so the portfolio panel can open deeds too) */
  pinned: number | null
  onPin: (index: number | null) => void
}

export function Board({ game, pinned, onPin }: Props) {
  const { state } = game
  const [hovered, setHovered] = useState<number | null>(null)
  const shown = hovered ?? pinned ?? state.pendingPurchase
  const landedOn = state.phase === 'landed' ? state.players[state.current].position : null

  const ownerOf = (i: number) => (state.owners[i] === undefined ? undefined : state.players[state.owners[i]])
  const shownTile = shown === null ? null : BOARD[shown]
  // Management buttons only make sense on the current player's own deed, once it's pinned open
  const canManage =
    shown !== null && shown === pinned && state.owners[shown] === state.current && !game.robotTurn

  return (
    <div className="board-wrap">
      <div className="board">
        {BOARD.map((tile, i) => (
          <BoardTile
            key={i}
            tile={tile}
            index={i}
            active={i === shown}
            landed={i === landedOn}
            owner={ownerOf(i)}
            level={level(state, i)}
            mortgaged={!!state.mortgaged[i]}
            onHover={setHovered}
            onSelect={(idx) => onPin(pinned === idx ? null : idx)}
          />
        ))}

        <div className="center">
          <div className="center__deck center__deck--ajo" aria-hidden>
            <PiggyBank strokeWidth={1.5} />
            <span>Ajo Box</span>
          </div>
          <div className="center__deck center__deck--wahala" aria-hidden>
            <CircleHelp strokeWidth={1.5} />
            <span>Wahala</span>
          </div>

          <div className={`center__stage${shown !== null || state.drawn || state.winner !== null ? ' is-dimmed' : ''}`}>
            <div className="logo">
              <span className="logo__kicker">The Lagos property game</span>
              <h1 className="logo__word">
                Èkó<span className="logo__dot">.</span>
              </h1>
              <span className="logo__sub">Buy Lagos, one plot at a time.</span>
            </div>
            <Dice dice={state.dice} rollCount={state.rollCount} rolling={state.phase === 'rolling'} />
            {state.settings.goSlowJackpot && state.jackpot > 0 && (
              <div className="jackpot">Go-Slow pot: {naira(state.jackpot)}</div>
            )}
          </div>

          {state.winner !== null && <GameOver game={game} />}

          {state.drawn && (
            <CardReveal
              key={state.events[0]?.id}
              deck={state.drawn.deck}
              card={drawnCard(state)!}
              onAccept={game.applyCard}
            />
          )}

          {shown !== null && shownTile && !state.drawn && state.winner === null && (
            <div className="center__deed" key={shown}>
              <DeedCard
                tile={shownTile}
                owner={ownerOf(shown)}
                level={level(state, shown)}
                mortgaged={!!state.mortgaged[shown]}
                fullSet={
                  shownTile.kind === 'property' &&
                  state.owners[shown] !== undefined &&
                  ownsGroup(state, state.owners[shown], shownTile.group)
                }
              >
                {canManage && <ManageBar game={game} index={shown} />}
              </DeedCard>
              {pinned !== null && hovered === null && (
                <button className="center__close" onClick={() => onPin(null)} aria-label="Close">
                  <X size={16} />
                </button>
              )}
            </div>
          )}
        </div>

        <Tokens players={state.players.filter((p) => !p.bankrupt)} current={state.current} />
      </div>
    </div>
  )
}
