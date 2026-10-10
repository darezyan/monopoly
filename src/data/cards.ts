// Wahala (≈ Chance) and Ajo Box (≈ Community Chest).
// One card for each card in the classic deck, rewritten for Lagos. Money is in ₦M.

export type DeckKind = 'wahala' | 'ajo'

export type CardEffect =
  | { type: 'collect'; amount: number }
  | { type: 'pay'; amount: number }
  /** Move forward to a square, collecting salary if passing GO */
  | { type: 'advanceTo'; index: number }
  | { type: 'back'; steps: number }
  /** Move to the next transport hub (owner gets double rent) or utility (owner gets 10× dice) */
  | { type: 'nearest'; kind: 'transport' | 'utility' }
  | { type: 'jail' }
  | { type: 'jailFree' }
  | { type: 'repairs'; perHouse: number; perHotel: number }
  | { type: 'payEach'; amount: number }
  | { type: 'collectEach'; amount: number }

export type Card = {
  /** Short label for the activity feed */
  title: string
  text: string
  effect: CardEffect
}

export const WAHALA: Card[] = [
  {
    title: 'Oga for Banana Island',
    text: 'Your oga don call meeting for Banana Island. Carry yourself go there now now.',
    effect: { type: 'advanceTo', index: 39 },
  },
  {
    title: 'Salary don land',
    text: 'Alert don enter! Advance to GO and collect your ₦200M salary.',
    effect: { type: 'advanceTo', index: 0 },
  },
  {
    title: 'Housewarming for Ikeja GRA',
    text: 'Your in-law dey do housewarming for Ikeja GRA. Advance there. If you pass GO, collect ₦200M.',
    effect: { type: 'advanceTo', index: 24 },
  },
  {
    title: 'Mama dey call',
    text: 'Mama call say make you come Isolo sharp sharp. Advance to Isolo. If you pass GO, collect ₦200M.',
    effect: { type: 'advanceTo', index: 11 },
  },
  {
    title: 'Third Mainland don lock',
    text: 'Third Mainland Bridge don lock. Advance to the nearest transport hub. If nobody owns it, you fit buy am. If e get owner, pay double rent.',
    effect: { type: 'nearest', kind: 'transport' },
  },
  {
    title: 'Car battery don die',
    text: 'Your car battery don die for road. Advance to the nearest transport hub. If nobody owns it, you fit buy am. If e get owner, pay double rent.',
    effect: { type: 'nearest', kind: 'transport' },
  },
  {
    title: 'NEPA don take light',
    text: 'NEPA don take light again. Advance to the nearest utility. If nobody owns it, you fit buy am. If e get owner, pay 10× your dice.',
    effect: { type: 'nearest', kind: 'utility' },
  },
  {
    title: 'Savings interest',
    text: 'Your savings app paid interest this month. Collect ₦50M.',
    effect: { type: 'collect', amount: 50 },
  },
  {
    title: 'You know person',
    text: 'You know person for Alausa. Keep this card: e go bring you out of Kirikiri free.',
    effect: { type: 'jailFree' },
  },
  {
    title: 'Conductor no get change',
    text: 'Danfo conductor no get change, e drop you for wrong bus stop. Go back 3 spaces.',
    effect: { type: 'back', steps: 3 },
  },
  {
    title: 'LASTMA catch you',
    text: 'LASTMA catch you for one-way. Go straight to Kirikiri. No pass GO, no collect ₦200M.',
    effect: { type: 'jail' },
  },
  {
    title: 'Generator don knock',
    text: 'Generator don knock for all your buildings. Pay ₦25M for each house and ₦100M for each hotel.',
    effect: { type: 'repairs', perHouse: 25, perHotel: 100 },
  },
  {
    title: 'Agbero settlement',
    text: 'Agbero say you park for wrong place. Pay ₦15M “settlement”.',
    effect: { type: 'pay', amount: 15 },
  },
  {
    title: 'Ride the BRT',
    text: 'Leave your car for house today. Advance to CMS BRT. If you pass GO, collect ₦200M.',
    effect: { type: 'advanceTo', index: 5 },
  },
  {
    title: 'Landlord Association chairman',
    text: 'Dem make you Chairman of the Landlord Association. Pay each player ₦50M for “refreshment”.',
    effect: { type: 'payEach', amount: 50 },
  },
  {
    title: 'Cooperative loan matured',
    text: 'Your cooperative loan don mature. Collect ₦150M.',
    effect: { type: 'collect', amount: 150 },
  },
]

export const AJO: Card[] = [
  {
    title: 'Ajo turn reach',
    text: 'Your ajo turn reach early! Advance to GO and collect ₦200M.',
    effect: { type: 'advanceTo', index: 0 },
  },
  {
    title: 'Bank app glitch',
    text: 'Bank app glitch credit your account. Collect ₦200M before dem reverse am.',
    effect: { type: 'collect', amount: 200 },
  },
  {
    title: 'Malaria',
    text: 'Malaria catch you. Pay ₦50M for doctor and drugs.',
    effect: { type: 'pay', amount: 50 },
  },
  {
    title: 'Sold your shares',
    text: 'You sell your shares at the right time. Collect ₦50M.',
    effect: { type: 'collect', amount: 50 },
  },
  {
    title: 'Uncle for Ikoyi',
    text: 'Your uncle na big man for Ikoyi. Keep this card: e go bring you out of Kirikiri free.',
    effect: { type: 'jailFree' },
  },
  {
    title: 'Landlord report you',
    text: 'Your landlord report you over unpaid service charge. Go straight to Kirikiri. No pass GO, no collect ₦200M.',
    effect: { type: 'jail' },
  },
  {
    title: 'December savings',
    text: 'Your December savings don mature. Collect ₦100M.',
    effect: { type: 'collect', amount: 100 },
  },
  {
    title: 'Tax refund',
    text: 'LIRS refund the extra tax wey you pay. Collect ₦20M.',
    effect: { type: 'collect', amount: 20 },
  },
  {
    title: 'Na your birthday',
    text: 'Na your birthday! Every player must spray you ₦10M.',
    effect: { type: 'collectEach', amount: 10 },
  },
  {
    title: 'Insurance matured',
    text: 'Your insurance policy don mature. Collect ₦100M.',
    effect: { type: 'collect', amount: 100 },
  },
  {
    title: 'Hospital bill',
    text: 'Your cousin wife don born. Na you go pay hospital bill: ₦100M.',
    effect: { type: 'pay', amount: 100 },
  },
  {
    title: 'School fees',
    text: 'School fees don reach. Pay ₦50M.',
    effect: { type: 'pay', amount: 50 },
  },
  {
    title: 'Weekend hustle',
    text: 'You fix client website for weekend. Collect ₦25M consulting fee.',
    effect: { type: 'collect', amount: 25 },
  },
  {
    title: 'Flood for your street',
    text: 'Flood don wash your street. Pay ₦40M for each house and ₦115M for each hotel for drainage.',
    effect: { type: 'repairs', perHouse: 40, perHotel: 115 },
  },
  {
    title: 'Best dressed (2nd)',
    text: 'You come second for Best Dressed at the owambe. Collect ₦10M.',
    effect: { type: 'collect', amount: 10 },
  },
  {
    title: 'Village inheritance',
    text: 'Your village uncle leave something for you. Inherit ₦100M.',
    effect: { type: 'collect', amount: 100 },
  },
]

export const DECKS: Record<DeckKind, Card[]> = { wahala: WAHALA, ajo: AJO }
