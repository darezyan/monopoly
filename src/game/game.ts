import { BOARD, PASS_GO_SALARY, TRANSPORT_RENT, naira, type ColorGroup, type Tile } from '../data/board'
import { DECKS, type Card, type DeckKind } from '../data/cards'
import { tokenInfo, type RobotLevel, type TokenKind } from '../data/tokens'

export const JAIL_INDEX = 10
export const GO_SLOW_INDEX = 20
/** Buildings level on a property: 0–4 houses, 5 = hotel */
export const HOTEL = 5
const BANK_HOUSES = 32
const BANK_HOTELS = 12

export type GameSettings = {
  startingCash: number
  /** Owners still collect rent while they're in Kirikiri */
  rentInJail: boolean
  /** Houses must be built evenly across a colour group (selling is always allowed) */
  evenBuild: boolean
  /** Only 32 houses and 12 hotels exist; when they run out, nobody can build */
  limitedBuildings: boolean
  /** Taxes and fines pile up on Go-Slow; landing there wins the pot */
  goSlowJackpot: boolean
  /** Landing exactly on GO pays double salary */
  doubleGoSalary: boolean
  bail: number
  /** Shuffle who goes first when the game starts */
  shuffleOrder: boolean
  /** House rule: players may borrow from the bank, repaying by their third pass of GO */
  bankLoans: boolean
  /** House rule: a property someone passes on goes to auction */
  auctions: boolean
  /** Interest added to a loan each time its holder passes GO, in percent */
  loanRate: number
}

export const DEFAULT_SETTINGS: GameSettings = {
  startingCash: 1500,
  rentInJail: false,
  evenBuild: true,
  limitedBuildings: true,
  goSlowJackpot: false,
  doubleGoSalary: false,
  bail: 50,
  shuffleOrder: true,
  bankLoans: false,
  auctions: false,
  loanRate: 10,
}

export type Player = {
  id: number
  name: string
  token: TokenKind
  color: string
  /** Robot difficulty, or null for a human */
  robot: RobotLevel | null
  /** The signed-in user playing this seat in an online room (absent offline and for robots) */
  userId?: string | null
  /** A robot's personality, rolled at the start of the game (absent for humans) */
  persona?: Persona
  cash: number
  position: number
  inJail: boolean
  jailTurns: number
  /** Get-out-of-Kirikiri cards held, by the deck each must go back to */
  jailFree: DeckKind[]
  /** Who the player owes while their cash is below zero */
  creditor: number | 'bank' | null
  /** An outstanding bank loan (house rule): what's owed, and how many times GO has been passed since */
  loan?: { balance: number; laps: number } | null
  bankrupt: boolean
}

export type Phase = 'idle' | 'rolling' | 'moving' | 'card' | 'landed' | 'over'

export type GameEvent = {
  id: number
  playerId: number
  text: string
  /** Cash change for this player, if any (shown as a floating +/− on their panel) */
  amount?: number
  /** Which turn of the game this happened on (1 = the first player's first turn) */
  turn?: number
  /** For deal events: the full terms, so the history can show them */
  deal?: DealRecord
}

export type DealOutcome = 'offered' | 'countered' | 'accepted' | 'declined' | 'withdrawn' | 'failed'

export type DealRecord = { proposer: number; responder: number; give: Bundle; get: Bundle; outcome: DealOutcome }

/** Generous cap so even very long games keep their whole story without bloating saves */
const MAX_EVENTS = 2000

export type GameState = {
  settings: GameSettings
  players: Player[]
  current: number
  phase: Phase
  dice: [number, number]
  rollCount: number
  doublesStreak: number
  stepsLeft: number
  /** Whether the current player gets another roll after this one */
  rollAgain: boolean
  /** The current player has rolled this turn: building, paying off mortgages and deals are closed */
  rolledThisTurn: boolean
  /** Third doubles in a row: go to jail once the dice settle */
  jailPending: boolean
  /** Tile index → id of the player who owns it */
  owners: Record<number, number>
  /** Tile index → buildings level (1–4 houses, 5 = hotel); absent means none */
  buildings: Record<number, number>
  /** Tile indexes currently mortgaged */
  mortgaged: Record<number, true>
  /** Houses and hotels the bank still has to sell */
  bank: { houses: number; hotels: number }
  /** Go-Slow jackpot (only grows when that setting is on) */
  jackpot: number
  /** Square the current player may buy; the turn can't end until they decide */
  pendingPurchase: number | null
  /** Draw order of each deck, as indexes into DECKS; the top card is first */
  decks: Record<DeckKind, number[]>
  /** Card on screen, waiting for the player to accept it */
  drawn: { deck: DeckKind; card: number } | null
  /** 1 normally, −1 while a card sends the token backwards */
  moveDir: 1 | -1
  /** Special rent from a "nearest hub / utility" card, applied on the next landing */
  cardRent: 'double' | 'utility10' | null
  winner: number | null
  /** A deal waiting for an answer; play pauses until it's settled */
  trade: Trade | null
  /** A property up for auction; play pauses until it's sold or nobody wants it */
  auction: Auction | null
  /** Player id → turn they last proposed a deal on (robots use it to avoid pestering) */
  proposedOnTurn: Record<number, number>
  /** What each proposer remembers about asking someone for certain properties (see dealKey) */
  dealMemory: Record<string, DealMemory>
  /** Count of player decisions applied so far; online clients use it to stay in step */
  seq: number
  /** Turn number, for grouping the history; goes up each time play passes to the next player */
  turn: number
  events: GameEvent[]
  nextEventId: number
}

export type Action =
  | { type: 'roll'; dice: [number, number] }
  | { type: 'startMove' }
  | { type: 'step' }
  | { type: 'applyCard' }
  | { type: 'payBail' }
  | { type: 'useJailCard' }
  | { type: 'buy' }
  | { type: 'pass' }
  | { type: 'build'; index: number }
  | { type: 'sell'; index: number }
  | { type: 'mortgage'; index: number }
  | { type: 'unmortgage'; index: number }
  | { type: 'declareBankruptcy' }
  | { type: 'endTurn' }
  | { type: 'proposeTrade'; to: number; give: Bundle; get: Bundle }
  | { type: 'counterTrade'; give: Bundle; get: Bundle }
  | { type: 'acceptTrade' }
  | { type: 'declineTrade' }
  | { type: 'cancelTrade' }
  | { type: 'borrow'; amount: number }
  | { type: 'repayLoan'; amount: number }
  | { type: 'bid'; amount: number }
  | { type: 'dropOut' }

/** One side of a deal */
export type Bundle = { deeds: number[]; cash: number; jailCards: number }

export const EMPTY_BUNDLE: Bundle = { deeds: [], cash: 0, jailCards: 0 }

/**
 * A deal on the table. `proposer` offers `give` in exchange for `get`;
 * `responder` must accept, decline or counter (which swaps the roles).
 */
export type Trade = {
  proposer: number
  responder: number
  give: Bundle
  get: Bundle
  counters: number
  /** Who started this negotiation and which properties they were after (survives counter-offers) */
  /** Who started the negotiation, what they wanted and the cash they first put up (kept through counters) */
  opener?: { proposer: number; responder: number; wanted: number[]; cash?: number }
  /** For a counter-offer: the terms it replaced, seen from this deal's sides, so the card can show what changed */
  previous?: { give: Bundle; get: Bundle }
}

const TRADE_ACTIONS = new Set<Action['type']>(['counterTrade', 'acceptTrade', 'declineTrade', 'cancelTrade'])

/**
 * How a robot plays deals, each trait from 0 to 1. Rolled randomly within a range set by
 * difficulty, so no two robots (or games) behave quite the same.
 */
export type Persona = {
  /** How much they demand for what they own */
  greed: number
  /** How hard they chase what they want */
  eagerness: number
  /** How long they stay on a deal before letting it rest */
  patience: number
  /** How much cash they like to keep in hand */
  caution: number
}

const PERSONA_RANGES: Record<RobotLevel, Record<keyof Persona, [number, number]>> = {
  easy: { greed: [0, 0.35], eagerness: [0.5, 1], patience: [0.1, 0.5], caution: [0, 0.4] },
  normal: { greed: [0.2, 0.6], eagerness: [0.35, 0.8], patience: [0.3, 0.8], caution: [0.25, 0.7] },
  sharp: { greed: [0.5, 0.95], eagerness: [0.3, 0.75], patience: [0.5, 1], caution: [0.35, 0.8] },
}

export function rollPersona(level: RobotLevel): Persona {
  const roll = ([lo, hi]: [number, number]) => Math.round((lo + Math.random() * (hi - lo)) * 100) / 100
  const r = PERSONA_RANGES[level]
  return { greed: roll(r.greed), eagerness: roll(r.eagerness), patience: roll(r.patience), caution: roll(r.caution) }
}

/** A seat at the table, as chosen on the setup screen */
export type Seat = { name: string; token: TokenKind; robot: RobotLevel | null; userId?: string | null }

export const DEFAULT_SEATS: Seat[] = [
  { name: 'Tunde', token: 'danfo', robot: null },
  { name: 'Amaka', token: 'okada', robot: null },
  { name: 'Chidi', token: 'taxi', robot: null },
  { name: 'Zainab', token: 'canoe', robot: null },
]

export function createGame(seats: Seat[] = DEFAULT_SEATS, settings: GameSettings = DEFAULT_SETTINGS): GameState {
  const order = settings.shuffleOrder ? shuffled(seats.length).map((i) => seats[i]) : seats
  return {
    settings,
    players: order.map((seat, id) => ({
      ...seat,
      color: tokenInfo(seat.token).color,
      ...(seat.robot && { persona: rollPersona(seat.robot) }),
      id,
      cash: settings.startingCash,
      position: 0,
      inJail: false,
      jailTurns: 0,
      jailFree: [],
      creditor: null,
      bankrupt: false,
    })),
    current: 0,
    phase: 'idle',
    dice: [5, 2],
    rollCount: 0,
    doublesStreak: 0,
    stepsLeft: 0,
    rollAgain: false,
    rolledThisTurn: false,
    jailPending: false,
    owners: {},
    buildings: {},
    mortgaged: {},
    bank: { houses: BANK_HOUSES, hotels: BANK_HOTELS },
    jackpot: 0,
    pendingPurchase: null,
    decks: { wahala: shuffled(DECKS.wahala.length), ajo: shuffled(DECKS.ajo.length) },
    drawn: null,
    moveDir: 1,
    cardRent: null,
    winner: null,
    trade: null,
    auction: null,
    proposedOnTurn: {},
    dealMemory: {},
    seq: 0,
    turn: 1,
    events: [],
    nextEventId: 1,
  }
}

/**
 * Brings a saved game up to the current shape by filling in fields added since it was saved.
 * Keeps old saves loadable as rules grow, without database migrations for game state.
 */
export function upgradeState(saved: GameState): GameState {
  const base = createGame(saved.players, { ...DEFAULT_SETTINGS, ...saved.settings, shuffleOrder: false })
  return {
    ...base,
    ...saved,
    settings: base.settings,
    // Robots from saves made before personalities existed get one now
    players: saved.players.map((p, i) => ({
      ...base.players[i],
      ...p,
      ...(p.robot && !p.persona && { persona: rollPersona(p.robot) }),
    })),
  }
}

function shuffled(n: number): number[] {
  const order = Array.from({ length: n }, (_, i) => i)
  for (let i = n - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[order[i], order[j]] = [order[j], order[i]]
  }
  return order
}

export const DECK_NAMES: Record<DeckKind, string> = { wahala: 'Wahala', ajo: 'Ajo Box' }

export function drawnCard(state: GameState): Card | null {
  return state.drawn && DECKS[state.drawn.deck][state.drawn.card]
}

export const rollDice = (): [number, number] => [
  1 + Math.floor(Math.random() * 6),
  1 + Math.floor(Math.random() * 6),
]

// ---------- Small state helpers ----------

function log(state: GameState, playerId: number, text: string, amount?: number, deal?: DealRecord): GameState {
  const event: GameEvent = { id: state.nextEventId, playerId, text, amount, turn: state.turn, ...(deal && { deal }) }
  return { ...state, events: [event, ...state.events].slice(0, MAX_EVENTS), nextEventId: state.nextEventId + 1 }
}

function updatePlayer(state: GameState, id: number, patch: Partial<Player>): GameState {
  return { ...state, players: state.players.map((p) => (p.id === id ? { ...p, ...patch } : p)) }
}

function credit(state: GameState, id: number, amount: number): GameState {
  const p = state.players[id]
  const cash = p.cash + amount
  return updatePlayer(state, id, { cash, creditor: cash >= 0 ? null : p.creditor })
}

/**
 * Takes money from a player. They may go below zero; they then owe `to`
 * and must raise money or go bankrupt before their turn can continue.
 * Money paid to 'pot' feeds the Go-Slow jackpot when that setting is on.
 */
function charge(state: GameState, id: number, amount: number, to: number | 'bank' | 'pot'): GameState {
  const p = state.players[id]
  const cash = p.cash - amount
  state = updatePlayer(state, id, { cash, creditor: cash < 0 ? (to === 'pot' ? 'bank' : to) : null })
  if (typeof to === 'number') state = credit(state, to, amount)
  if (to === 'pot' && state.settings.goSlowJackpot) state = { ...state, jackpot: state.jackpot + amount }
  return state
}

function sendToJail(state: GameState, id: number, reason: string): GameState {
  state = updatePlayer(state, id, { position: JAIL_INDEX, inJail: true, jailTurns: 0 })
  state = log(state, id, reason)
  return { ...state, phase: 'landed', stepsLeft: 0, rollAgain: false, moveDir: 1 }
}

const activePlayers = (state: GameState) => state.players.filter((p) => !p.bankrupt)

function nextPlayerId(state: GameState): number {
  const n = state.players.length
  for (let i = 1; i <= n; i++) {
    const id = (state.current + i) % n
    if (!state.players[id].bankrupt) return id
  }
  return state.current
}

// ---------- Property rules ----------

export type BuyableTile = Extract<Tile, { kind: 'property' | 'transport' | 'utility' }>

export function isBuyable(tile: Tile): tile is BuyableTile {
  return tile.kind === 'property' || tile.kind === 'transport' || tile.kind === 'utility'
}

/** Board indexes of every property in a colour group */
export function groupIndexes(group: ColorGroup): number[] {
  return BOARD.flatMap((t, i) => (t.kind === 'property' && t.group === group ? [i] : []))
}

export function ownsGroup(state: GameState, owner: number, group: ColorGroup): boolean {
  return groupIndexes(group).every((i) => state.owners[i] === owner)
}

export const level = (state: GameState, index: number) => state.buildings[index] ?? 0

/** Mortgage value plus 10% interest (integer maths: 0.5 × 1.1 = 11/20) */
export const unmortgageCost = (tile: BuyableTile) => Math.ceil((tile.price * 11) / 20)

/** Rent owed for landing on an owned square. */
export function rentFor(state: GameState, index: number): number {
  const tile = BOARD[index]
  const owner = state.owners[index]
  if (owner === undefined || !isBuyable(tile) || state.mortgaged[index]) return 0

  const ownedOfKind = BOARD.filter((t, i) => state.owners[i] === owner && t.kind === tile.kind)

  switch (tile.kind) {
    case 'property': {
      const built = level(state, index)
      if (built > 0) return tile.rent[built]
      return ownsGroup(state, owner, tile.group) ? tile.rent[0] * 2 : tile.rent[0]
    }
    case 'transport':
      return TRANSPORT_RENT[ownedOfKind.length - 1] * (state.cardRent === 'double' ? 2 : 1)
    case 'utility': {
      const multiplier = state.cardRent === 'utility10' || ownedOfKind.length === 2 ? 10 : 4
      return (state.dice[0] + state.dice[1]) * multiplier
    }
  }
}

/** The seats a finished game was played with, for a rematch */
export function seatsOf(state: GameState): Seat[] {
  return [...state.players]
    .sort((a, b) => a.id - b.id)
    .map(({ name, token, robot, userId }) => ({ name, token, robot, userId }))
}

/** Timer-driven steps that follow automatically from a player's decision */
export const isTick = (a: Action) => a.type === 'startMove' || a.type === 'step'

/** Applies an action and, for player decisions, counts it in `seq`. */
export function applyAction(state: GameState, action: Action): GameState {
  const next = reducer(state, action)
  return next === state || isTick(action) ? next : { ...next, seq: state.seq + 1 }
}

/** Whether the current player may manage their properties right now. */
function canManage(state: GameState, index: number): string | null {
  if (state.owners[index] !== state.current) return 'Not your property'
  if (state.phase !== 'idle' && state.phase !== 'landed') return 'Wait for your move to finish'
  return null
}

/** Null if allowed, otherwise the reason it isn't. */
export function buildBlocker(state: GameState, index: number): string | null {
  const tile = BOARD[index]
  if (tile.kind !== 'property') return 'Only properties take houses'
  const manage = canManage(state, index)
  if (manage) return manage
  if (state.rolledThisTurn) return 'Build before you roll. Next turn!'
  if (!ownsGroup(state, state.current, tile.group)) return 'Own the whole colour set first'
  const group = groupIndexes(tile.group)
  if (group.some((i) => state.mortgaged[i])) return 'Pay off mortgages in this set first'
  const built = level(state, index)
  if (built === HOTEL) return 'Already has a hotel'
  if (state.settings.evenBuild && built > Math.min(...group.map((i) => level(state, i))))
    return 'Build evenly across the set'
  if (state.players[state.current].cash < tile.houseCost) return 'Not enough money'
  if (state.settings.limitedBuildings) {
    if (built < 4 && state.bank.houses === 0) return 'The bank has no houses left'
    if (built === 4 && state.bank.hotels === 0) return 'The bank has no hotels left'
  }
  return null
}

export function sellBlocker(state: GameState, index: number): string | null {
  const tile = BOARD[index]
  if (tile.kind !== 'property') return 'Nothing to sell'
  const manage = canManage(state, index)
  if (manage) return manage
  // Any house or hotel can be sold back for half price at any point in your turn; "build evenly"
  // only governs building.
  if (level(state, index) === 0) return 'No buildings here'
  return null
}

export function mortgageBlocker(state: GameState, index: number): string | null {
  const tile = BOARD[index]
  if (!isBuyable(tile)) return 'Can’t mortgage this'
  const manage = canManage(state, index)
  if (manage) return manage
  if (state.mortgaged[index]) return 'Already mortgaged'
  if (tile.kind === 'property' && groupIndexes(tile.group).some((i) => level(state, i) > 0))
    return 'Sell the buildings in this set first'
  return null
}

export function unmortgageBlocker(state: GameState, index: number): string | null {
  const tile = BOARD[index]
  if (!isBuyable(tile)) return 'Can’t mortgage this'
  const manage = canManage(state, index)
  if (manage) return manage
  if (!state.mortgaged[index]) return 'Not mortgaged'
  if (state.rolledThisTurn) return 'Pay off mortgages before you roll'
  if (state.players[state.current].cash < unmortgageCost(tile)) return 'Not enough money'
  return null
}

/** Houses and hotels a player owns */
export function buildingsOf(state: GameState, playerId: number) {
  let houses = 0
  let hotels = 0
  for (const [i, built] of Object.entries(state.buildings)) {
    if (state.owners[+i] !== playerId) continue
    if (built === HOTEL) hotels++
    else houses += built
  }
  return { houses, hotels }
}

// ---------- Bank loans (house rule) ----------

/** Loans fall due on this pass of GO */
export const LOAN_LAPS = 3
const LOAN_BASE = 100
const LOAN_CAP = 500

/** What a player's properties are worth to the bank as security (mortgaged ones count for nothing) */
function collateral(state: GameState, playerId: number): number {
  let value = 0
  BOARD.forEach((tile, i) => {
    if (state.owners[i] !== playerId || !isBuyable(tile) || state.mortgaged[i]) return
    value += tile.price
    if (tile.kind === 'property') value += level(state, i) * tile.houseCost
  })
  return value
}

/** Most a player may owe the bank: ₦100M plus half their property's worth, up to ₦500M */
export function loanLimit(state: GameState, playerId: number): number {
  return Math.min(LOAN_CAP, Math.floor((LOAN_BASE + collateral(state, playerId) / 2) / 10) * 10)
}

/** How much more this player could borrow right now (0 if loans are off) */
export function loanHeadroom(state: GameState, playerId: number): number {
  if (!state.settings.bankLoans) return 0
  return Math.max(0, loanLimit(state, playerId) - (state.players[playerId].loan?.balance ?? 0))
}

/** Why the current player can't borrow or repay right now, or null if they can */
export function loanBlocker(state: GameState): string | null {
  if (!state.settings.bankLoans) return 'Bank loans are off in this game'
  if (state.trade) return 'Finish the deal first'
  if (state.phase !== 'idle' && state.phase !== 'landed') return 'Wait for your move to finish'
  return null
}

/** On passing GO: the loan grows by the interest rate, and on the third pass the bank collects it all. */
function loanOnGo(state: GameState, playerId: number): GameState {
  const loan = state.players[playerId].loan
  if (!loan) return state
  const interest = Math.ceil((loan.balance * state.settings.loanRate) / 100)
  const balance = loan.balance + interest
  const laps = loan.laps + 1
  state = log(state, playerId, `owes ${naira(interest)} more in loan interest`)
  if (laps < LOAN_LAPS) return updatePlayer(state, playerId, { loan: { balance, laps } })
  // Due: the bank takes the full balance; if that leaves them short, the usual debt rules apply
  state = updatePlayer(state, playerId, { loan: null })
  state = charge(state, playerId, balance, 'bank')
  return log(state, playerId, 'had their bank loan called in', -balance)
}

/** Cash plus what everything they own is worth (mortgaged deeds at half), less any loan. */
export function netWorth(state: GameState, playerId: number): number {
  let worth = state.players[playerId].cash - (state.players[playerId].loan?.balance ?? 0)
  BOARD.forEach((tile, i) => {
    if (state.owners[i] !== playerId || !isBuyable(tile)) return
    worth += state.mortgaged[i] ? tile.price / 2 : tile.price
    if (tile.kind === 'property') worth += level(state, i) * tile.houseCost
  })
  return worth
}

// ---------- Turn flow ----------

/** Apply whatever the square the current player just stopped on does. */
function resolveLanding(state: GameState): GameState {
  const player = state.players[state.current]
  const tile = BOARD[player.position]
  state = { ...state, moveDir: 1 }

  if (isBuyable(tile)) {
    // A card's special rent only applies to the landing it caused
    const settled = { ...state, cardRent: null }
    const owner = state.owners[player.position]
    if (owner === undefined) {
      return { ...log(settled, player.id, `landed on ${tile.name}`), phase: 'landed', pendingPurchase: player.position }
    }
    if (owner === player.id) {
      return { ...log(settled, player.id, `dey house for ${tile.name}`), phase: 'landed' }
    }
    const landlord = state.players[owner]
    if (state.mortgaged[player.position]) {
      return { ...log(settled, player.id, `landed on ${tile.name}. E dey mortgage, no rent`), phase: 'landed' }
    }
    if (landlord.inJail && !state.settings.rentInJail) {
      return { ...log(settled, player.id, `landed on ${tile.name}. ${landlord.name} dey Kirikiri, no rent`), phase: 'landed' }
    }
    const rent = rentFor(state, player.position)
    state = charge(settled, player.id, rent, owner)
    state = log(state, owner, `collected rent from ${player.name}`, rent)
    state = log(state, player.id, `paid ${landlord.name} rent for ${tile.name}`, -rent)
    return { ...state, phase: 'landed' }
  }

  state = { ...state, cardRent: null }
  switch (tile.kind) {
    case 'wahala':
    case 'ajo':
      return drawCard(state, tile.kind)
    case 'gotojail':
      return sendToJail(state, player.id, 'was carried to Kirikiri')
    case 'tax':
      state = charge(state, player.id, tile.amount, 'pot')
      return { ...log(state, player.id, `paid ${tile.name}`, -tile.amount), phase: 'landed' }
    case 'goslow':
      if (state.jackpot > 0) {
        const pot = state.jackpot
        state = credit({ ...state, jackpot: 0 }, player.id, pot)
        return { ...log(state, player.id, `hit the Go-Slow jackpot!`, pot), phase: 'landed' }
      }
      return { ...log(state, player.id, `landed on ${tile.name}`), phase: 'landed' }
    default:
      return { ...log(state, player.id, `landed on ${tile.name}`), phase: 'landed' }
  }
}

function drawCard(state: GameState, deck: DeckKind): GameState {
  const [top, ...rest] = state.decks[deck]
  const card = DECKS[deck][top]
  // Cards go to the bottom of the pile, except jail-free cards, which the player keeps until used
  const order = card.effect.type === 'jailFree' ? rest : [...rest, top]
  state = { ...state, decks: { ...state.decks, [deck]: order }, drawn: { deck, card: top }, phase: 'card' }
  return log(state, state.current, `picked ${DECK_NAMES[deck]}: ${card.title}`)
}

/** Move the current player `steps` squares in `dir`, hopping like a normal move. */
function startCardMove(state: GameState, steps: number, dir: 1 | -1): GameState {
  return { ...state, phase: 'moving', stepsLeft: steps, moveDir: dir }
}

function applyCard(state: GameState): GameState {
  const card = drawnCard(state)
  if (!card) return state
  const deck = state.drawn!.deck
  const player = state.players[state.current]
  const others = activePlayers(state).filter((p) => p.id !== player.id)
  state = { ...state, drawn: null }
  const done = (s: GameState): GameState => ({ ...s, phase: 'landed' })

  const effect = card.effect
  switch (effect.type) {
    case 'collect':
      state = credit(state, player.id, effect.amount)
      return done(log(state, player.id, `collected ${naira(effect.amount)}`, effect.amount))

    case 'pay':
      state = charge(state, player.id, effect.amount, 'pot')
      return done(log(state, player.id, `paid ${naira(effect.amount)}`, -effect.amount))

    case 'payEach':
    case 'collectEach': {
      const paying = effect.type === 'payEach'
      for (const other of others) {
        state = paying
          ? charge(state, player.id, effect.amount, other.id)
          : charge(state, other.id, effect.amount, player.id)
        state = log(
          state,
          other.id,
          paying ? `got ${naira(effect.amount)} from ${player.name}` : `sprayed ${player.name}`,
          paying ? effect.amount : -effect.amount,
        )
      }
      const total = effect.amount * others.length
      return done(
        log(
          state,
          player.id,
          paying ? `paid everybody ${naira(effect.amount)}` : `collected ${naira(effect.amount)} from everybody`,
          paying ? -total : total,
        ),
      )
    }

    case 'repairs': {
      const { houses, hotels } = buildingsOf(state, player.id)
      const cost = houses * effect.perHouse + hotels * effect.perHotel
      if (cost === 0) return done(log(state, player.id, 'had no buildings to fix. Lucky!'))
      state = charge(state, player.id, cost, 'pot')
      return done(log(state, player.id, `paid ${naira(cost)} for repairs`, -cost))
    }

    case 'advanceTo': {
      const steps = (effect.index - player.position + BOARD.length) % BOARD.length
      return startCardMove(state, steps, 1)
    }

    case 'back':
      return startCardMove(state, effect.steps, -1)

    case 'nearest': {
      let steps = 1
      while (BOARD[(player.position + steps) % BOARD.length].kind !== effect.kind) steps++
      state = { ...state, cardRent: effect.kind === 'transport' ? 'double' : 'utility10' }
      return startCardMove(state, steps, 1)
    }

    case 'jail':
      return sendToJail(state, player.id, 'was carried to Kirikiri')

    case 'jailFree':
      state = updatePlayer(state, player.id, { jailFree: [...player.jailFree, deck] })
      return done(log(state, player.id, 'is keeping the card for later'))
  }
}

/** Put a jail-free card back under the deck it came from. */
function returnJailCard(state: GameState, deck: DeckKind): GameState {
  const card = DECKS[deck].findIndex((c) => c.effect.type === 'jailFree')
  return { ...state, decks: { ...state.decks, [deck]: [...state.decks[deck], card] } }
}

function declareBankruptcy(state: GameState): GameState {
  const player = state.players[state.current]
  const creditor = player.creditor ?? 'bank'
  const owned = BOARD.flatMap((_, i) => (state.owners[i] === player.id ? [i] : []))

  // Buildings go back to the bank at half price; that money goes to whoever is owed.
  let salvage = 0
  const bank = { ...state.bank }
  const buildings = { ...state.buildings }
  for (const i of owned) {
    const built = buildings[i] ?? 0
    const tile = BOARD[i]
    if (built === 0 || tile.kind !== 'property') continue
    salvage += (built * tile.houseCost) / 2
    if (state.settings.limitedBuildings) {
      if (built === HOTEL) bank.hotels++
      else bank.houses += built
    }
    delete buildings[i]
  }
  state = { ...state, bank, buildings }

  const owners = { ...state.owners }
  const mortgaged = { ...state.mortgaged }
  if (creditor === 'bank') {
    for (const i of owned) {
      delete owners[i]
      delete mortgaged[i]
    }
    for (const deck of player.jailFree) state = returnJailCard(state, deck)
  } else {
    for (const i of owned) owners[i] = creditor
    // The creditor already received the full debt; they only keep what the player could actually pay.
    state = credit(state, creditor, player.cash + salvage)
    const heir = state.players[creditor]
    state = updatePlayer(state, creditor, { jailFree: [...heir.jailFree, ...player.jailFree] })
  }
  state = { ...state, owners, mortgaged }
  state = updatePlayer(state, player.id, {
    bankrupt: true,
    cash: 0,
    creditor: null,
    loan: null,
    inJail: false,
    jailFree: [],
  })
  const to = creditor === 'bank' ? 'the bank' : state.players[creditor].name
  state = log(state, player.id, `went bankrupt. Everything goes to ${to}`)

  const left = activePlayers(state)
  if (left.length === 1) {
    state = log(state, left[0].id, 'don own Lagos! 🏆')
    return { ...state, phase: 'over', winner: left[0].id, pendingPurchase: null, drawn: null }
  }
  return {
    ...state,
    phase: 'idle',
    pendingPurchase: null,
    rollAgain: false,
    doublesStreak: 0,
    moveDir: 1,
    current: nextPlayerId(state),
    turn: state.turn + 1,
    rolledThisTurn: false,
  }
}

// ---------- Trading ----------

/** The player whose decision the game is waiting on: the bidder up in an auction, a deal's responder, or whoever's turn it is */
export function actingPlayer(state: GameState): number {
  if (state.auction) return state.auction.bidders[state.auction.turn]
  return state.trade ? state.trade.responder : state.current
}

// ---------- Auctions (house rule) ----------

/**
 * Bidding goes round the table: on your go you raise the high bid or drop out.
 * The last bidder left with the high bid wins; if everyone drops out with no bids, it stays unsold.
 */
export type Auction = {
  index: number
  /** Highest bid so far (0 before anyone bids) */
  bid: number
  /** Who holds the highest bid */
  leader: number | null
  /** Players still in, in bidding order */
  bidders: number[]
  /** Position in `bidders` of whoever bids next */
  turn: number
}

/** Bids go up in steps of at least ₦10M */
export const MIN_RAISE = 10

const AUCTION_ACTIONS = new Set<Action['type']>(['bid', 'dropOut'])

/** Start an auction for a property the current player passed on: everyone still in the game may bid. */
function startAuction(state: GameState, index: number): GameState {
  const n = state.players.length
  // Bidding starts with the player after the one who passed, and comes round to them last
  const bidders = Array.from({ length: n }, (_, k) => (state.current + 1 + k) % n).filter(
    (id) => !state.players[id].bankrupt,
  )
  state = { ...state, pendingPurchase: null, auction: { index, bid: 0, leader: null, bidders, turn: 0 } }
  return log(state, state.current, `put ${BOARD[index].name} up for auction`)
}

/** Settle the auction if it's over: one bidder left holding the high bid, or nobody left at all. */
function settleAuction(state: GameState): GameState {
  const a = state.auction!
  const tile = BOARD[a.index] as BuyableTile
  if (a.bidders.length === 0) {
    return log({ ...state, auction: null }, state.current, `got no bids. ${tile.name} stays with the bank`)
  }
  if (a.bidders.length === 1 && a.leader === a.bidders[0]) {
    const winner = a.leader
    let next: GameState = { ...state, auction: null, owners: { ...state.owners, [a.index]: winner } }
    next = charge(next, winner, a.bid, 'bank')
    return log(next, winner, `won ${tile.name} at auction`, -a.bid)
  }
  return state
}

function auctionReducer(state: GameState, action: Action): GameState {
  const a = state.auction
  if (!a) return state
  const bidder = a.bidders[a.turn]
  switch (action.type) {
    case 'bid': {
      const cash = state.players[bidder].cash
      if (!Number.isInteger(action.amount) || action.amount < a.bid + MIN_RAISE || action.amount > cash) return state
      const auction = { ...a, bid: action.amount, leader: bidder, turn: (a.turn + 1) % a.bidders.length }
      return settleAuction(log({ ...state, auction }, bidder, `bid ${naira(action.amount)}`))
    }
    case 'dropOut': {
      const bidders = a.bidders.filter((_, k) => k !== a.turn)
      const turn = bidders.length === 0 ? 0 : a.turn % bidders.length
      const auction = { ...a, bidders, turn }
      return settleAuction(log({ ...state, auction }, bidder, 'dropped out of the auction'))
    }
    default:
      return state
  }
}

const isEmptyBundle = (b: Bundle) => b.deeds.length === 0 && b.cash === 0 && b.jailCards === 0

/** Why a deed can't change hands right now, or null if it can. */
export function deedTradeBlocker(state: GameState, index: number): string | null {
  const tile = BOARD[index]
  if (tile.kind === 'property' && groupIndexes(tile.group).some((i) => level(state, i) > 0))
    return 'Sell the houses on this colour set first'
  return null
}

/** Why a deal isn't valid, or null if it is. Checked when proposed and again when accepted. */
export function tradeProblem(state: GameState, proposer: number, responder: number, give: Bundle, get: Bundle): string | null {
  const a = state.players[proposer]
  const b = state.players[responder]
  if (!a || !b || proposer === responder) return 'Pick someone to trade with'
  if (a.bankrupt || b.bankrupt) return 'That player is out of the game'
  if (isEmptyBundle(give) && isEmptyBundle(get)) return 'Add something to the deal'
  for (const [side, owner] of [
    [give, a],
    [get, b],
  ] as const) {
    if (new Set(side.deeds).size !== side.deeds.length) return 'A property is listed twice'
    for (const i of side.deeds) {
      if (state.owners[i] !== owner.id) return `${owner.name} doesn’t own ${BOARD[i].name}`
      const blocker = deedTradeBlocker(state, i)
      if (blocker) return `${BOARD[i].name}: ${blocker.toLowerCase()}`
    }
    if (!Number.isInteger(side.cash) || side.cash < 0) return 'Cash must be a whole amount'
    if (side.cash > Math.max(0, owner.cash)) return `${owner.name} doesn’t have ${naira(side.cash)}`
    if (side.jailCards < 0 || side.jailCards > owner.jailFree.length) return `${owner.name} doesn’t have that many jail cards`
  }
  return null
}

/** Mortgaged deeds that change hands cost the new owner 10% interest to the bank. */
export const tradeInterest = (deeds: number[], state: GameState) =>
  deeds
    .filter((i) => state.mortgaged[i])
    .reduce((sum, i) => sum + Math.ceil((BOARD[i] as BuyableTile).price / 20), 0)

const dealTerms = (t: Trade) => ({ proposer: t.proposer, responder: t.responder, give: t.give, get: t.get })

/** Identifies "the same deal" across attempts: who asks whom, for which properties */
/** Refusals so far, the last cash offered, and when, for one proposer → responder → properties pairing */
export type DealMemory = { refusals: number; lastCash: number; turn: number }

export const dealKey = (proposer: number, responder: number, wanted: number[]) =>
  `${proposer}>${responder}:${[...wanted].sort((a, b) => a - b).join(',')}`

function describeBundle(b: Bundle): string {
  const parts = b.deeds.map((i) => BOARD[i].name)
  if (b.cash > 0) parts.push(naira(b.cash))
  if (b.jailCards > 0) parts.push(b.jailCards === 1 ? 'a jail card' : `${b.jailCards} jail cards`)
  return parts.length ? parts.join(', ') : 'nothing'
}

function executeTrade(state: GameState, t: Trade): GameState {
  const { proposer: a, responder: b, give, get } = t
  const owners = { ...state.owners }
  for (const i of give.deeds) owners[i] = b
  for (const i of get.deeds) owners[i] = a
  state = { ...state, owners }

  if (give.cash > 0) state = charge(state, a, give.cash, b)
  if (get.cash > 0) state = charge(state, b, get.cash, a)

  // Jail cards keep track of which deck they return to
  const pa = state.players[a]
  const pb = state.players[b]
  const fromA = pa.jailFree.slice(0, give.jailCards)
  const fromB = pb.jailFree.slice(0, get.jailCards)
  state = updatePlayer(state, a, { jailFree: [...pa.jailFree.slice(give.jailCards), ...fromB] })
  state = updatePlayer(state, b, { jailFree: [...pb.jailFree.slice(get.jailCards), ...fromA] })

  const nameB = state.players[b].name
  state = log(state, a, `traded with ${nameB}: gave ${describeBundle(give)}, got ${describeBundle(get)}`, undefined, {
    ...dealTerms(t),
    outcome: 'accepted',
  })

  // Interest on mortgaged deeds received
  const interestA = tradeInterest(get.deeds, state)
  const interestB = tradeInterest(give.deeds, state)
  if (interestA > 0) state = log(charge(state, a, interestA, 'bank'), a, 'paid interest on mortgaged deeds', -interestA)
  if (interestB > 0) state = log(charge(state, b, interestB, 'bank'), b, 'paid interest on mortgaged deeds', -interestB)
  return state
}

function tradeReducer(state: GameState, action: Action): GameState {
  const t = state.trade
  switch (action.type) {
    case 'proposeTrade': {
      // Deals are made before rolling; once the dice are thrown they're closed until next turn
      if (t || state.phase !== 'idle' || state.rolledThisTurn || state.drawn) return state
      if (tradeProblem(state, state.current, action.to, action.give, action.get)) return state
      const trade: Trade = {
        proposer: state.current,
        responder: action.to,
        give: action.give,
        get: action.get,
        counters: 0,
        opener: { proposer: state.current, responder: action.to, wanted: action.get.deeds, cash: action.give.cash },
      }
      const proposedOnTurn = { ...state.proposedOnTurn, [state.current]: state.turn }
      return log({ ...state, trade, proposedOnTurn }, state.current, `offered ${state.players[action.to].name} a deal`, undefined, {
        ...dealTerms(trade),
        outcome: 'offered',
      })
    }
    case 'counterTrade': {
      if (!t || t.counters >= 6) return state
      // The responder becomes the proposer: they now give what they're offering back
      if (tradeProblem(state, t.responder, t.proposer, action.give, action.get)) return state
      const trade: Trade = {
        proposer: t.responder,
        responder: t.proposer,
        give: action.give,
        get: action.get,
        counters: t.counters + 1,
        opener: t.opener,
        previous: { give: t.get, get: t.give },
      }
      return log({ ...state, trade }, t.responder, `came back with a counter-offer`, undefined, {
        ...dealTerms(trade),
        outcome: 'countered',
      })
    }
    case 'acceptTrade': {
      if (!t) return state
      if (tradeProblem(state, t.proposer, t.responder, t.give, t.get)) {
        return log({ ...state, trade: null }, t.responder, 'couldn’t accept: the deal is no longer valid', undefined, {
          ...dealTerms(t),
          outcome: 'failed',
        })
      }
      return executeTrade({ ...state, trade: null }, t)
    }
    case 'declineTrade': {
      if (!t) return state
      // Remember the refusal against whoever started the negotiation, even after counter-offers
      const opener = t.opener ?? { proposer: t.proposer, responder: t.responder, wanted: t.get.deeds }
      const key = dealKey(opener.proposer, opener.responder, opener.wanted)
      const before = state.dealMemory[key]
      const openerCash = t.proposer === opener.proposer ? t.give.cash : t.get.cash
      const dealMemory = {
        ...state.dealMemory,
        [key]: {
          refusals: (before?.refusals ?? 0) + 1,
          // The most the opener put up at any point, so a fresh offer has to beat their first one too
          lastCash: Math.max(openerCash, opener.cash ?? 0, before?.lastCash ?? 0),
          turn: state.turn,
        },
      }
      return log({ ...state, trade: null, dealMemory }, t.responder, `turned down ${state.players[t.proposer].name}’s deal`, undefined, {
        ...dealTerms(t),
        outcome: 'declined',
      })
    }
    case 'cancelTrade':
      if (!t) return state
      return log({ ...state, trade: null }, t.proposer, 'withdrew the offer', undefined, { ...dealTerms(t), outcome: 'withdrawn' })
    default:
      return state
  }
}

export function reducer(state: GameState, action: Action): GameState {
  if (state.phase === 'over') return state
  // An auction in progress takes priority over everything
  if (state.auction) return AUCTION_ACTIONS.has(action.type) ? auctionReducer(state, action) : state
  if (action.type === 'proposeTrade' || TRADE_ACTIONS.has(action.type)) return tradeReducer(state, action)
  // Everything else waits while a deal is on the table
  if (state.trade) return state
  const player = state.players[state.current]

  switch (action.type) {
    case 'roll': {
      if (state.phase !== 'idle' || player.cash < 0) return state
      const [a, b] = action.dice
      const doubles = a === b
      const next = {
        ...state,
        dice: action.dice,
        rollCount: state.rollCount + 1,
        phase: 'rolling' as const,
        rolledThisTurn: true,
      }

      if (player.inJail) {
        if (doubles) {
          const freed = updatePlayer(next, player.id, { inJail: false, jailTurns: 0 })
          return { ...log(freed, player.id, `rolled doubles and walked out of Kirikiri`), stepsLeft: a + b, rollAgain: false }
        }
        if (player.jailTurns >= 2) {
          let paid = updatePlayer(next, player.id, { inJail: false, jailTurns: 0 })
          paid = charge(paid, player.id, state.settings.bail, 'pot')
          return { ...log(paid, player.id, `paid bail after three tries`, -state.settings.bail), stepsLeft: a + b, rollAgain: false }
        }
        const stuck = updatePlayer(next, player.id, { jailTurns: player.jailTurns + 1 })
        return { ...log(stuck, player.id, `no doubles, still in Kirikiri`), stepsLeft: 0, rollAgain: false }
      }

      const streak = doubles ? state.doublesStreak + 1 : 0
      if (streak === 3) {
        return { ...next, doublesStreak: 0, stepsLeft: 0, rollAgain: false, jailPending: true }
      }
      return { ...next, doublesStreak: streak, stepsLeft: a + b, rollAgain: doubles }
    }

    case 'startMove': {
      if (state.phase !== 'rolling') return state
      if (state.jailPending) {
        return sendToJail({ ...state, jailPending: false }, player.id, 'rolled three doubles. Police don catch am!')
      }
      if (state.stepsLeft === 0) return { ...state, phase: 'landed' }
      return { ...state, phase: 'moving' }
    }

    case 'step': {
      if (state.phase !== 'moving' || state.stepsLeft === 0) return state
      const position = (player.position + state.moveDir + BOARD.length) % BOARD.length
      const stepsLeft = state.stepsLeft - 1
      let next = updatePlayer(state, player.id, { position })
      if (position === 0 && state.moveDir === 1) {
        const exact = stepsLeft === 0 && state.settings.doubleGoSalary
        const salary = exact ? PASS_GO_SALARY * 2 : PASS_GO_SALARY
        next = credit(next, player.id, salary)
        next = log(next, player.id, exact ? `landed on GO: double salary!` : `passed GO and collected ${naira(salary)}`, salary)
        if (state.settings.bankLoans) next = loanOnGo(next, player.id)
      }
      next = { ...next, stepsLeft }
      return stepsLeft === 0 ? resolveLanding(next) : next
    }

    case 'applyCard':
      return state.phase === 'card' ? applyCard(state) : state

    case 'payBail': {
      const { bail } = state.settings
      if (state.phase !== 'idle' || !player.inJail || player.cash < bail) return state
      let paid = updatePlayer(state, player.id, { inJail: false, jailTurns: 0 })
      paid = charge(paid, player.id, bail, 'pot')
      return log(paid, player.id, 'paid bail and left Kirikiri', -bail)
    }

    case 'useJailCard': {
      if (state.phase !== 'idle' || !player.inJail || player.jailFree.length === 0) return state
      const [deck, ...kept] = player.jailFree
      let next = updatePlayer(state, player.id, { inJail: false, jailTurns: 0, jailFree: kept })
      next = returnJailCard(next, deck)
      return log(next, player.id, 'used their connection and left Kirikiri')
    }

    case 'buy': {
      const index = state.pendingPurchase
      if (index === null) return state
      const tile = BOARD[index] as BuyableTile
      if (player.cash < tile.price) return state
      let next = charge(state, player.id, tile.price, 'bank')
      next = { ...next, owners: { ...next.owners, [index]: player.id }, pendingPurchase: null }
      return log(next, player.id, `bought ${tile.name}`, -tile.price)
    }

    case 'pass': {
      if (state.pendingPurchase === null) return state
      const tile = BOARD[state.pendingPurchase]
      const passed = { ...log(state, player.id, `passed on ${tile.name}`), pendingPurchase: null }
      return state.settings.auctions ? startAuction(passed, state.pendingPurchase) : passed
    }

    case 'build': {
      const { index } = action
      if (buildBlocker(state, index)) return state
      const tile = BOARD[index] as Extract<Tile, { kind: 'property' }>
      const built = level(state, index) + 1
      // The bank's stock only matters (and only changes) when buildings are limited
      const bank = !state.settings.limitedBuildings
        ? state.bank
        : built === HOTEL
          ? { houses: state.bank.houses + 4, hotels: state.bank.hotels - 1 }
          : { ...state.bank, houses: state.bank.houses - 1 }
      let next = charge(state, player.id, tile.houseCost, 'bank')
      next = { ...next, bank, buildings: { ...next.buildings, [index]: built } }
      return log(next, player.id, built === HOTEL ? `built a hotel on ${tile.name}` : `built a house on ${tile.name}`, -tile.houseCost)
    }

    case 'sell': {
      const { index } = action
      if (sellBlocker(state, index)) return state
      const tile = BOARD[index] as Extract<Tile, { kind: 'property' }>
      const built = level(state, index)
      const limited = state.settings.limitedBuildings
      // A hotel normally swaps back for 4 houses. If the bank is short, the property drops to
      // however many houses it can supply, and the owner is paid for the rest (official rule).
      const after = built === HOTEL ? (limited ? Math.min(4, state.bank.houses) : 4) : built - 1
      const bank = !limited
        ? state.bank
        : built === HOTEL
          ? { houses: state.bank.houses - after, hotels: state.bank.hotels + 1 }
          : { ...state.bank, houses: state.bank.houses + 1 }
      const buildings = { ...state.buildings, [index]: after }
      if (after === 0) delete buildings[index]
      const refund = ((built - after) * tile.houseCost) / 2
      const next = credit({ ...state, bank, buildings }, player.id, refund)
      const text =
        built !== HOTEL
          ? `sold a house on ${tile.name}`
          : after === 4
            ? `sold the hotel on ${tile.name}`
            : `sold the hotel on ${tile.name} (the bank only had ${after} house${after === 1 ? '' : 's'} to give back)`
      return log(next, player.id, text, refund)
    }

    case 'mortgage': {
      const { index } = action
      if (mortgageBlocker(state, index)) return state
      const tile = BOARD[index] as BuyableTile
      const value = tile.price / 2
      const next = credit({ ...state, mortgaged: { ...state.mortgaged, [index]: true } }, player.id, value)
      return log(next, player.id, `mortgaged ${tile.name}`, value)
    }

    case 'unmortgage': {
      const { index } = action
      if (unmortgageBlocker(state, index)) return state
      const tile = BOARD[index] as BuyableTile
      const cost = unmortgageCost(tile)
      const mortgaged = { ...state.mortgaged }
      delete mortgaged[index]
      const next = charge({ ...state, mortgaged }, player.id, cost, 'bank')
      return log(next, player.id, `paid off the mortgage on ${tile.name}`, -cost)
    }

    case 'borrow': {
      const amount = action.amount
      if (loanBlocker(state) || !Number.isInteger(amount) || amount <= 0) return state
      if (amount > loanHeadroom(state, player.id)) return state
      const loan = player.loan ?? { balance: 0, laps: 0 }
      let next = updatePlayer(state, player.id, { loan: { ...loan, balance: loan.balance + amount } })
      next = credit(next, player.id, amount)
      return log(next, player.id, `borrowed ${naira(amount)} from the bank`, amount)
    }

    case 'repayLoan': {
      const amount = action.amount
      const loan = player.loan
      if (loanBlocker(state) || !loan || !Number.isInteger(amount) || amount <= 0) return state
      if (amount > loan.balance || amount > player.cash) return state
      const balance = loan.balance - amount
      let next = updatePlayer(state, player.id, { loan: balance > 0 ? { ...loan, balance } : null })
      next = charge(next, player.id, amount, 'bank')
      return log(next, player.id, balance > 0 ? `paid back ${naira(amount)} of their loan` : 'cleared their bank loan', -amount)
    }

    case 'declareBankruptcy': {
      if (player.cash >= 0 || (state.phase !== 'idle' && state.phase !== 'landed')) return state
      return declareBankruptcy(state)
    }

    case 'endTurn': {
      if (state.phase !== 'landed' || state.pendingPurchase !== null || player.cash < 0) return state
      if (state.rollAgain && !player.inJail) return { ...state, phase: 'idle', rollAgain: false }
      return {
        ...state,
        phase: 'idle',
        rollAgain: false,
        doublesStreak: 0,
        moveDir: 1,
        current: nextPlayerId(state),
        turn: state.turn + 1,
        rolledThisTurn: false,
      }
    }

    default:
      // Trade actions are handled by tradeReducer above
      return state
  }
}
