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
  /** Houses must be built and sold evenly across a colour group */
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
}

export const DEFAULT_SETTINGS: GameSettings = {
  startingCash: 1500,
  rentInJail: true,
  evenBuild: true,
  limitedBuildings: true,
  goSlowJackpot: false,
  doubleGoSalary: false,
  bail: 50,
  shuffleOrder: true,
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
  cash: number
  position: number
  inJail: boolean
  jailTurns: number
  /** Get-out-of-Kirikiri cards held, by the deck each must go back to */
  jailFree: DeckKind[]
  /** Who the player owes while their cash is below zero */
  creditor: number | 'bank' | null
  bankrupt: boolean
}

export type Phase = 'idle' | 'rolling' | 'moving' | 'card' | 'landed' | 'over'

export type GameEvent = {
  id: number
  playerId: number
  text: string
  /** Cash change for this player, if any (shown as a floating +/− on their panel) */
  amount?: number
}

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
  /** Count of player decisions applied so far; online clients use it to stay in step */
  seq: number
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
    seq: 0,
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
    players: saved.players.map((p, i) => ({ ...base.players[i], ...p })),
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

function log(state: GameState, playerId: number, text: string, amount?: number): GameState {
  const event = { id: state.nextEventId, playerId, text, amount }
  return { ...state, events: [event, ...state.events].slice(0, 30), nextEventId: state.nextEventId + 1 }
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
  const built = level(state, index)
  if (built === 0) return 'No buildings here'
  const group = groupIndexes(tile.group)
  if (state.settings.evenBuild && built < Math.max(...group.map((i) => level(state, i))))
    return 'Sell evenly across the set'
  if (built === HOTEL && state.settings.limitedBuildings && state.bank.houses < 4)
    return 'The bank needs 4 houses to swap for the hotel'
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

/** Cash plus what everything they own is worth (mortgaged deeds at half). */
export function netWorth(state: GameState, playerId: number): number {
  let worth = state.players[playerId].cash
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
  }
}

export function reducer(state: GameState, action: Action): GameState {
  if (state.phase === 'over') return state
  const player = state.players[state.current]

  switch (action.type) {
    case 'roll': {
      if (state.phase !== 'idle' || player.cash < 0) return state
      const [a, b] = action.dice
      const doubles = a === b
      const next = { ...state, dice: action.dice, rollCount: state.rollCount + 1, phase: 'rolling' as const }

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
      return { ...log(state, player.id, `passed on ${tile.name}`), pendingPurchase: null }
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
      const bank = !state.settings.limitedBuildings
        ? state.bank
        : built === HOTEL
          ? { houses: state.bank.houses - 4, hotels: state.bank.hotels + 1 }
          : { ...state.bank, houses: state.bank.houses + 1 }
      const buildings = { ...state.buildings, [index]: built - 1 }
      if (built - 1 === 0) delete buildings[index]
      const refund = tile.houseCost / 2
      const next = credit({ ...state, bank, buildings }, player.id, refund)
      return log(next, player.id, built === HOTEL ? `sold the hotel on ${tile.name}` : `sold a house on ${tile.name}`, refund)
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
      }
    }
  }
}
