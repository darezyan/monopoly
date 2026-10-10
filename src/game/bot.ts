import { BOARD } from '../data/board'
import type { RobotLevel } from '../data/tokens'
import {
  buildBlocker,
  groupIndexes,
  isBuyable,
  level,
  mortgageBlocker,
  ownsGroup,
  rollDice,
  sellBlocker,
  unmortgageBlocker,
  unmortgageCost,
  type Action,
  type BuyableTile,
  type GameState,
} from './game'

/** Cash a robot tries to keep in hand after buying or building. */
const RESERVE: Record<RobotLevel, number> = { easy: 0, normal: 150, sharp: 60 }

/**
 * The next move for the current player if they're a robot, or null when there's
 * nothing for them to do (not their turn, or the board is still animating).
 */
export function robotMove(state: GameState): Action | null {
  const me = state.players[state.current]
  if (!me.robot || me.bankrupt) return null
  const skill = me.robot
  const reserve = RESERVE[skill]

  if (state.phase === 'card') return { type: 'applyCard' }
  if (state.phase !== 'idle' && state.phase !== 'landed') return null

  // Debts come first: sell, then mortgage, then give up.
  if (me.cash < 0) return raiseMoney(state) ?? { type: 'declareBankruptcy' }

  if (state.pendingPurchase !== null) {
    return wantsToBuy(state, state.pendingPurchase, skill, reserve) ? { type: 'buy' } : { type: 'pass' }
  }

  if (skill !== 'easy') {
    const build = pickBuild(state, reserve)
    if (build !== null) return { type: 'build', index: build }
  }
  if (skill === 'sharp') {
    const redeem = pickUnmortgage(state, reserve * 2)
    if (redeem !== null) return { type: 'unmortgage', index: redeem }
  }

  if (state.phase === 'idle') {
    if (me.inJail) {
      // Early on, getting out to buy property is worth it; later, jail is a safe place to sit.
      const unowned = BOARD.filter((t, i) => isBuyable(t) && state.owners[i] === undefined).length
      const earlyGame = unowned > 10
      if (earlyGame && me.jailFree.length > 0) return { type: 'useJailCard' }
      if (earlyGame && me.cash - state.settings.bail >= reserve) return { type: 'payBail' }
    }
    return { type: 'roll', dice: rollDice() }
  }

  return { type: 'endTurn' }
}

function wantsToBuy(state: GameState, index: number, skill: RobotLevel, reserve: number): boolean {
  const me = state.players[state.current]
  const tile = BOARD[index] as BuyableTile
  if (me.cash < tile.price) return false
  const left = me.cash - tile.price

  if (skill === 'easy') return Math.random() < 0.75

  if (tile.kind === 'property') {
    const group = groupIndexes(tile.group)
    const others = group.filter((i) => i !== index)
    // Completing a set, or stopping someone else completing theirs, is worth dipping into reserves.
    const completes = others.every((i) => state.owners[i] === me.id)
    const blocks = others.length > 0 && others.every((i) => state.owners[i] !== undefined && state.owners[i] === state.owners[others[0]] && state.owners[i] !== me.id)
    if ((completes || (skill === 'sharp' && blocks)) && left >= 0) return true
  }
  return left >= reserve
}

/** Cheapest property where another house is allowed and affordable. */
function pickBuild(state: GameState, reserve: number): number | null {
  const me = state.players[state.current]
  let best: number | null = null
  let bestCost = Infinity
  BOARD.forEach((tile, i) => {
    if (tile.kind !== 'property' || state.owners[i] !== me.id) return
    if (!ownsGroup(state, me.id, tile.group) || buildBlocker(state, i)) return
    if (me.cash - tile.houseCost < reserve) return
    if (tile.houseCost < bestCost) {
      best = i
      bestCost = tile.houseCost
    }
  })
  return best
}

function pickUnmortgage(state: GameState, keep: number): number | null {
  const me = state.players[state.current]
  for (let i = 0; i < BOARD.length; i++) {
    const tile = BOARD[i]
    if (!isBuyable(tile) || state.owners[i] !== me.id || !state.mortgaged[i]) continue
    if (unmortgageBlocker(state, i) === null && me.cash - unmortgageCost(tile) >= keep) return i
  }
  return null
}

/** One step of raising money: sell a building, else mortgage the least valuable deed. */
function raiseMoney(state: GameState): Action | null {
  const me = state.players[state.current]
  const mine = BOARD.flatMap((_, i) => (state.owners[i] === me.id ? [i] : []))

  const sellable = mine.filter((i) => level(state, i) > 0 && sellBlocker(state, i) === null)
  if (sellable.length > 0) return { type: 'sell', index: sellable[0] }

  const mortgageable = mine
    .filter((i) => mortgageBlocker(state, i) === null)
    .sort((a, b) => (BOARD[a] as BuyableTile).price - (BOARD[b] as BuyableTile).price)
  if (mortgageable.length > 0) return { type: 'mortgage', index: mortgageable[0] }

  return null
}
