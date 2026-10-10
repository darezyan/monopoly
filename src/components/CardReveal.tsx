import { CircleHelp, PiggyBank } from 'lucide-react'
import { BOARD, naira } from '../data/board'
import type { Card, CardEffect, DeckKind } from '../data/cards'
import { DECK_NAMES } from '../game/game'

const DECK_ICON = { wahala: CircleHelp, ajo: PiggyBank }

function effectLabel(effect: CardEffect): string {
  switch (effect.type) {
    case 'collect':
      return `+${naira(effect.amount)}`
    case 'pay':
      return `−${naira(effect.amount)}`
    case 'advanceTo':
      return `Go to ${BOARD[effect.index].name}`
    case 'back':
      return `Back ${effect.steps} spaces`
    case 'nearest':
      return effect.kind === 'transport' ? 'Nearest hub · double rent' : 'Nearest utility · 10× dice'
    case 'jail':
      return 'Go to Kirikiri'
    case 'jailFree':
      return 'Keep this card'
    case 'repairs':
      return `${naira(effect.perHouse)}/house · ${naira(effect.perHotel)}/hotel`
    case 'payEach':
      return `−${naira(effect.amount)} to each player`
    case 'collectEach':
      return `+${naira(effect.amount)} from each player`
  }
}

export function CardReveal({ deck, card, onAccept }: { deck: DeckKind; card: Card; onAccept: () => void }) {
  const Icon = DECK_ICON[deck]
  const good = card.effect.type === 'collect' || card.effect.type === 'collectEach' || card.effect.type === 'jailFree'

  return (
    <div className={`reveal reveal--${deck}`}>
      <div className="reveal__card">
        <div className="reveal__back" aria-hidden>
          <Icon strokeWidth={1.5} />
          <span>{DECK_NAMES[deck]}</span>
        </div>
        <div className="reveal__front">
          <header className="reveal__head">
            <Icon size={18} strokeWidth={2} />
            {DECK_NAMES[deck]}
          </header>
          <div className="reveal__body">
            <h3 className="reveal__title">{card.title}</h3>
            <p className="reveal__text">{card.text}</p>
            <div className="reveal__foot">
              <span className={`reveal__effect${good ? ' is-good' : ''}`}>{effectLabel(card.effect)}</span>
              <button className="reveal__ok" onClick={onAccept}>
                Na so
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
