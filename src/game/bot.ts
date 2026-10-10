import { BOARD } from '../data/board'
import type { RobotLevel } from '../data/tokens'
import {
  actingPlayer,
  buildBlocker,
  dealKey,
  deedTradeBlocker,
  groupIndexes,
  isBuyable,
  level,
  MIN_RAISE,
  loanBlocker,
  loanHeadroom,
  LOAN_LAPS,
  mortgageBlocker,
  ownsGroup,
  rollDice,
  sellBlocker,
  tradeProblem,
  unmortgageBlocker,
  unmortgageCost,
  type Action,
  type Bundle,
  type BuyableTile,
  type GameState,
  type Persona,
} from './game'

/** Cash a robot tries to keep in hand after buying or building. */
const RESERVE: Record<RobotLevel, number> = { easy: 0, normal: 150, sharp: 60 }

/**
 * The next move for the current player if they're a robot, or null when there's
 * nothing for them to do (not their turn, or the board is still animating).
 */
export function robotMove(state: GameState): Action | null {
  // An auction comes first: bid or drop out when it's our go
  if (state.auction) {
    const bidder = state.players[actingPlayer(state)]
    return bidder.robot ? auctionMove(state, bidder.id) : null
  }

  // A deal on the table comes next, whoever's turn it is
  if (state.trade) {
    const responder = state.players[actingPlayer(state)]
    if (!responder.robot) return null
    return respondToDeal(state, responder.id)
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

  // Before rolling, look for a deal that completes one of our colour sets
  if (state.phase === 'idle' && !state.rolledThisTurn) {
    const deal = pickDeal(state, me.id)
    if (deal) return deal
  }

  // Pay a bank loan back when comfortable, more urgently as the deadline nears
  if (me.loan && !loanBlocker(state)) {
    const urgent = me.loan.laps >= LOAN_LAPS - 1
    const keep = urgent ? 0 : reserve + 100
    const amount = Math.floor(Math.min(me.loan.balance, me.cash - keep) / 10) * 10
    if (amount > 0 && (urgent || amount === me.loan.balance)) return { type: 'repayLoan', amount }
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

  // Last resort before bankruptcy: borrow from the bank, if that house rule is on
  const headroom = loanHeadroom(state, me.id)
  if (headroom > 0 && !loanBlocker(state)) {
    const needed = Math.ceil(-me.cash / 10) * 10
    if (needed > 0 && needed <= headroom) return { type: 'borrow', amount: needed }
  }

  return null
}

// ---------- Deals ----------
// Robots value properties by what they'd do for them, carry a personality rolled at the start
// of the game, and add a little randomness, so their dealing feels human rather than scripted.

const JAIL_CARD_VALUE = 50
/** Most counter-offers a robot will make in one negotiation before walking away */
const MAX_COUNTERS = 5

/** How erratic each difficulty is: easy robots are all over the place, sharp ones steady */
const NOISE: Record<RobotLevel, number> = { easy: 0.22, normal: 0.12, sharp: 0.06 }

const MID_PERSONA: Record<RobotLevel, Persona> = {
  easy: { greed: 0.2, eagerness: 0.75, patience: 0.3, caution: 0.2 },
  normal: { greed: 0.4, eagerness: 0.55, patience: 0.55, caution: 0.45 },
  sharp: { greed: 0.7, eagerness: 0.5, patience: 0.75, caution: 0.55 },
}

const personaOf = (state: GameState, id: number): Persona => {
  const p = state.players[id]
  return p.persona ?? MID_PERSONA[p.robot ?? 'normal']
}

/** A random factor around 1, e.g. jitter(0.1) is somewhere between 0.9 and 1.1 */
const jitter = (spread: number) => 1 + (Math.random() * 2 - 1) * spread
const roundTo10 = (n: number) => Math.max(0, Math.round(n / 10) * 10)

/**
 * What a deed is worth to `holder` if the board were owned as in `owners`:
 * a set-completer is worth far more than its price, and so is one that blocks a rival's set.
 */
function valueTo(state: GameState, index: number, holder: number, owners: Record<number, number>): number {
  const tile = BOARD[index] as BuyableTile
  const base = state.mortgaged[index] ? tile.price / 2 : tile.price
  if (tile.kind === 'property') {
    const group = groupIndexes(tile.group)
    const mine = group.filter((i) => owners[i] === holder).length
    // Full set: rent doubles and houses become possible, so it's worth a lot (more for big rents)
    if (mine === group.length) return base * (2.2 + tile.rent[3] / tile.price / 4)
    if (mine >= 2) return base * 1.4
    const others = group.filter((i) => i !== index && owners[i] !== undefined && owners[i] !== holder)
    const oneRival = others.length === group.length - 1 && new Set(others.map((i) => owners[i])).size === 1
    // Holding the last piece of someone else's set has value of its own
    return oneRival ? base * 1.5 : base
  }
  const same = BOARD.filter((t, i) => t.kind === tile.kind && owners[i] === holder).length
  return tile.kind === 'transport' ? base * (1 + 0.3 * (same - 1)) : same === 2 ? base * 1.3 : base
}

function bundleValue(state: GameState, b: Bundle, to: number, owners: Record<number, number>): number {
  return b.deeds.reduce((sum, i) => sum + valueTo(state, i, to, owners), 0) + b.cash + b.jailCards * JAIL_CARD_VALUE
}

/** How robot `me` sees the deal on the table: what it gains and what it gives up, by its own lights. */
function appraise(state: GameState, me: number): { gain: number; loss: number } {
  const t = state.trade!
  const other = t.proposer
  const gets = t.give
  const gives = t.get
  const after = { ...state.owners }
  for (const i of gets.deeds) after[i] = me
  for (const i of gives.deeds) after[i] = other

  const gain = bundleValue(state, gets, me, after)
  const ownLoss = bundleValue(state, gives, me, state.owners)
  // Handing a rival their set is a cost in itself; greedy robots charge more for it
  const theirGain = gives.deeds.reduce((sum, i) => sum + valueTo(state, i, other, after), 0)
  const empowering = Math.max(0, theirGain - gives.deeds.reduce((sum, i) => sum + valueTo(state, i, me, state.owners), 0))
  return { gain, loss: ownLoss + empowering * (0.3 + personaOf(state, me).greed * 0.7) }
}

/** A robot's answer to the deal it's been offered: accept, haggle, or walk away. */
function respondToDeal(state: GameState, me: number): Action {
  const t = state.trade!
  const robot = state.players[me]
  const persona = personaOf(state, me)
  const noise = NOISE[robot.robot ?? 'normal']
  if (robot.cash - t.get.cash < 0) return { type: 'declineTrade' }

  const { gain, loss } = appraise(state, me)
  // Short of cash, a robot takes money more readily
  const desperate = robot.cash < 150 && t.give.cash > 0
  const bar = (1 + persona.greed * 0.35 - (desperate ? 0.2 : 0)) * jitter(noise)
  if (gain >= loss * bar) return { type: 'acceptTrade' }

  // Close enough to haggle? Ask for the gap to be (mostly) closed with cash.
  const close = gain >= loss * (0.5 + persona.greed * 0.15)
  if (close && t.counters < MAX_COUNTERS) {
    const shortfall = loss * bar - gain
    const ask = roundTo10(shortfall * (0.55 + Math.random() * 0.45))
    if (ask > 0) {
      // Pay less first if we were paying; otherwise ask them for more
      const ourCash = Math.max(0, t.get.cash - ask)
      const extra = ask - (t.get.cash - ourCash)
      const theirCash = Math.min(state.players[t.proposer].cash, t.give.cash + extra)
      const give = { ...t.get, cash: ourCash }
      const get = { ...t.give, cash: Math.max(0, theirCash) }
      const changed = give.cash !== t.get.cash || get.cash !== t.give.cash
      if (changed && !tradeProblem(state, me, t.proposer, give, get)) return { type: 'counterTrade', give, get }
    }
  }
  return { type: 'declineTrade' }
}

/**
 * Maybe propose a deal this turn. The robot looks for properties that would complete (or nearly
 * complete) one of its sets, all held by one player, and decides how keen it is, what it can
 * spare, and what to offer, possibly sweetening it with a property the other side needs.
 */
function pickDeal(state: GameState, me: number): Action | null {
  const robot = state.players[me]
  const persona = personaOf(state, me)
  const noise = NOISE[robot.robot ?? 'normal']
  const active = state.players.filter((p) => !p.bankrupt).length

  // Not every turn, and not twice in one round: eager robots try more often
  const last = state.proposedOnTurn[me]
  if (last !== undefined && state.turn - last < active) return null
  if (Math.random() > 0.15 + persona.eagerness * 0.55) return null

  const reserve = 40 + persona.caution * 260
  const spare = robot.cash - reserve
  const candidates: { action: Action; appeal: number }[] = []

  const seen = new Set<string>()
  for (const tile of BOARD) {
    if (tile.kind !== 'property' || seen.has(tile.group)) continue
    seen.add(tile.group)
    const group = groupIndexes(tile.group)
    const mine = group.filter((i) => state.owners[i] === me)
    const missing = group.filter((i) => state.owners[i] !== me)
    if (mine.length === 0 || missing.length === 0 || missing.length > 2) continue
    const holders = new Set(missing.map((i) => state.owners[i]))
    if (holders.size !== 1) continue
    const holder = [...holders][0]
    if (holder === undefined || state.players[holder].bankrupt) continue
    if (missing.some((i) => deedTradeBlocker(state, i))) continue

    const theirCash = state.players[holder].cash
    const struggling = theirCash < 150
    const memory = state.dealMemory[dealKey(me, holder, missing)]
    if (memory) {
      // After being turned down, wait for a reason to try again: they're short of money,
      // we're richer than last time, or enough time has passed (patient robots wait longer)
      const fedUp = memory.refusals >= 1 + Math.round(persona.patience * 3)
      const longAgo = state.turn - memory.turn > active * (2 + Math.round(persona.patience * 4))
      const richer = spare > memory.lastCash * 1.5
      if (fedUp && !struggling && !longAgo && !richer) continue
    }

    const after = { ...state.owners }
    for (const i of missing) after[i] = me
    const worthToMe = missing.reduce((sum, i) => sum + valueTo(state, i, me, after), 0)
    const price = missing.reduce((sum, i) => sum + (BOARD[i] as BuyableTile).price, 0)
    // The most this robot would ever pay, by need and keenness
    const ceiling = Math.min(spare, worthToMe * (0.5 + persona.eagerness * 0.45))

    // Open somewhere above face value; come back higher than last time; lowball someone struggling
    let offer = price * (1.05 + persona.eagerness * 0.35) * jitter(noise)
    if (memory) offer = Math.max(offer, memory.lastCash * (1.1 + Math.random() * 0.2))
    if (struggling && persona.greed > 0.5) offer *= 0.85

    // Sweetener: a property of ours that helps them more than it helps us
    let sweetener: number | null = null
    let sweetValue = 0
    for (let i = 0; i < BOARD.length; i++) {
      const t = BOARD[i]
      if (state.owners[i] !== me || !isBuyable(t) || deedTradeBlocker(state, i) || group.includes(i)) continue
      if (t.kind === 'property' && ownsGroup(state, me, t.group)) continue
      const theirs = { ...after, [i]: holder }
      const helpsThem = valueTo(state, i, holder, theirs)
      const costsUs = valueTo(state, i, me, state.owners)
      if (helpsThem > costsUs * 1.2 && helpsThem - costsUs > sweetValue) {
        sweetener = i
        sweetValue = helpsThem - costsUs
      }
    }
    if (sweetener !== null && (offer > ceiling || Math.random() < 0.4)) offer -= sweetValue * 0.6

    offer = roundTo10(Math.min(offer, ceiling))
    // The sweetener only goes in when cash alone falls short of the price
    const sweetened = sweetener !== null && offer < price
    const total = offer + (sweetened ? sweetValue : 0)
    // Coming back after a refusal means putting more cash on the table, never the same offer again
    if (memory && offer <= memory.lastCash) continue
    const credible = offer >= price * 0.6 || (sweetened && total >= price * 0.8)
    if (!credible) continue

    const give = { deeds: sweetened ? [sweetener!] : [], cash: offer, jailCards: 0 }
    const get = { deeds: missing, cash: 0, jailCards: 0 }
    if (tradeProblem(state, me, holder, give, get)) continue
    candidates.push({ action: { type: 'proposeTrade', to: holder, give, get }, appeal: worthToMe - offer })
  }

  if (candidates.length === 0) return null
  // Usually go for the most appealing deal, sometimes another one
  candidates.sort((a, b) => b.appeal - a.appeal)
  return candidates[Math.random() < 0.75 ? 0 : Math.floor(Math.random() * candidates.length)].action
}

/**
 * Bid in an auction: the robot sets itself a ceiling from how much it needs the property
 * and its personality, raises in steps that suit its style, and drops out past the ceiling.
 */
function auctionMove(state: GameState, me: number): Action {
  const a = state.auction!
  const robot = state.players[me]
  const persona = personaOf(state, me)
  const noise = NOISE[robot.robot ?? 'normal']
  const after = { ...state.owners, [a.index]: me }
  const worth = valueTo(state, a.index, me, after)
  // Completing a set is worth dipping into reserves for; anything else, keep a cushion
  const completes = worth > (BOARD[a.index] as BuyableTile).price * 2
  const cushion = completes ? 20 : 40 + persona.caution * 200
  const ceiling = Math.min(robot.cash - cushion, worth * (0.55 + persona.eagerness * 0.45) * jitter(noise))
  const minimum = a.bid + MIN_RAISE
  if (minimum > ceiling) return { type: 'dropOut' }
  // Eager robots jump in big steps; careful ones nudge the price up
  const step = MIN_RAISE * (1 + Math.floor(Math.random() * (2 + persona.eagerness * 6)))
  return { type: 'bid', amount: Math.max(minimum, Math.min(roundTo10(ceiling), a.bid + step)) }
}
