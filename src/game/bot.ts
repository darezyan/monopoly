import { BOARD } from '../data/board'
import type { RobotLevel } from '../data/tokens'
import {
  actingPlayer,
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
  type Bundle,
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
  // A deal on the table comes first, whoever's turn it is
  if (state.trade) {
    const responder = state.players[actingPlayer(state)]
    if (!responder.robot) return null
    return judgeTrade(state, responder.id, responder.robot) ? { type: 'acceptTrade' } : { type: 'declineTrade' }
  }

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

/** How much better than even a deal must look before a robot says yes */
const TRADE_BAR: Record<RobotLevel, number> = { easy: 0.9, normal: 1.1, sharp: 1.25 }
const JAIL_CARD_VALUE = 50

/** What a deed is worth to `holder`: its price, plus a lot more if it completes their colour set. */
function deedWorth(state: GameState, index: number, holder: number, owningAfter: Record<number, number>): number {
  const tile = BOARD[index] as BuyableTile
  let worth = state.mortgaged[index] ? tile.price / 2 : tile.price
  if (tile.kind === 'property') {
    const group = groupIndexes(tile.group)
    const owned = group.filter((i) => owningAfter[i] === holder).length
    if (owned === group.length) worth *= 2.5
    else if (owned > 1) worth *= 1.3
  }
  return worth
}

function bundleWorth(state: GameState, b: Bundle, to: number, owningAfter: Record<number, number>): number {
  return b.deeds.reduce((sum, i) => sum + deedWorth(state, i, to, owningAfter), 0) + b.cash + b.jailCards * JAIL_CARD_VALUE
}

/** Whether robot `me` should accept the deal on the table. */
function judgeTrade(state: GameState, me: number, skill: RobotLevel): boolean {
  const t = state.trade!
  // From the robot's side: what it gets and what it gives
  const gets = t.give
  const gives = t.get
  const other = t.proposer
  const after = { ...state.owners }
  for (const i of gets.deeds) after[i] = me
  for (const i of gives.deeds) after[i] = other

  const gain = bundleWorth(state, gets, me, after)
  // What we hand over is worth what it does for them (completing their set costs us dearly)
  const loss = bundleWorth(state, gives, other, after)
  if (state.players[me].cash - gives.cash < 0) return false
  if (skill === 'easy') return gain >= loss * TRADE_BAR.easy || Math.random() < 0.15
  return gain >= loss * TRADE_BAR[skill]
}
