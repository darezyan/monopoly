// All money is in millions of naira (₦M).

export type ColorGroup =
  | 'brown'
  | 'lightblue'
  | 'pink'
  | 'orange'
  | 'red'
  | 'yellow'
  | 'green'
  | 'darkblue'

export const GROUP_COLORS: Record<ColorGroup, string> = {
  brown: '#8a5a3b',
  lightblue: '#6cc3e0',
  pink: '#e0508f',
  orange: '#f2892a',
  red: '#d8382b',
  yellow: '#f5c518',
  green: '#1e9b57',
  darkblue: '#23398f',
}

export type TransportKind = 'brt' | 'rail' | 'air' | 'ferry'
export type UtilityKind = 'power' | 'water'

export type Tile =
  | {
      kind: 'property'
      name: string
      tagline: string
      group: ColorGroup
      price: number
      houseCost: number
      /** base, 1–4 houses, hotel */
      rent: [number, number, number, number, number, number]
    }
  | { kind: 'transport'; name: string; tagline: string; transport: TransportKind; price: number }
  | { kind: 'utility'; name: string; tagline: string; utility: UtilityKind; price: number }
  | { kind: 'tax'; name: string; tagline: string; amount: number }
  | { kind: 'wahala'; name: string; tagline: string }
  | { kind: 'ajo'; name: string; tagline: string }
  | { kind: 'go'; name: string; tagline: string }
  | { kind: 'jail'; name: string; tagline: string }
  | { kind: 'goslow'; name: string; tagline: string }
  | { kind: 'gotojail'; name: string; tagline: string }

export type PropertyTile = Extract<Tile, { kind: 'property' }>

export const TRANSPORT_RENT = [25, 50, 100, 200]
export const PASS_GO_SALARY = 200

const wahala = (): Tile => ({
  kind: 'wahala',
  name: 'Wahala',
  tagline: 'Anything fit happen for Lagos. Pick a card.',
})
const ajo = (): Tile => ({
  kind: 'ajo',
  name: 'Ajo Box',
  tagline: 'Your turn don reach for the contribution. Pick a card.',
})

export const BOARD: Tile[] = [
  { kind: 'go', name: 'GO', tagline: `Collect ₦${PASS_GO_SALARY}M salary as you pass.` },
  { kind: 'property', name: 'Makoko', tagline: 'The city on water', group: 'brown', price: 60, houseCost: 50, rent: [2, 10, 30, 90, 160, 250] },
  ajo(),
  { kind: 'property', name: 'Ajegunle', tagline: 'Jungle city, home of stars', group: 'brown', price: 60, houseCost: 50, rent: [4, 20, 60, 180, 320, 450] },
  { kind: 'tax', name: 'Agbero Levy', tagline: 'Touts at the park want their own share.', amount: 200 },
  { kind: 'transport', name: 'CMS BRT', tagline: 'Blue bus, dedicated lane', transport: 'brt', price: 200 },
  { kind: 'property', name: 'Mushin', tagline: 'Gritty, loud, alive', group: 'lightblue', price: 100, houseCost: 50, rent: [6, 30, 90, 270, 400, 550] },
  wahala(),
  { kind: 'property', name: 'Oshodi', tagline: 'Under the bridge, everything dey', group: 'lightblue', price: 100, houseCost: 50, rent: [6, 30, 90, 270, 400, 550] },
  { kind: 'property', name: 'Agege', tagline: 'Bread capital of Lagos', group: 'lightblue', price: 120, houseCost: 50, rent: [8, 40, 100, 300, 450, 600] },
  { kind: 'jail', name: 'Kirikiri', tagline: 'Just visiting… for now.' },

  { kind: 'property', name: 'Isolo', tagline: 'Quiet streets, loud parties', group: 'pink', price: 140, houseCost: 100, rent: [10, 50, 150, 450, 625, 750] },
  { kind: 'utility', name: 'NEPA Light', tagline: 'Up NEPA! When it shows…', utility: 'power', price: 150 },
  { kind: 'property', name: 'Surulere', tagline: 'Stadium and street football', group: 'pink', price: 140, houseCost: 100, rent: [10, 50, 150, 450, 625, 750] },
  { kind: 'property', name: 'Yaba', tagline: 'Tech hub of the mainland', group: 'pink', price: 160, houseCost: 100, rent: [12, 60, 180, 500, 700, 900] },
  { kind: 'transport', name: 'Red Line', tagline: 'Rail from Agbado to Oyingbo', transport: 'rail', price: 200 },
  { kind: 'property', name: 'Festac', tagline: 'Built for the festival', group: 'orange', price: 180, houseCost: 100, rent: [14, 70, 200, 550, 750, 950] },
  ajo(),
  { kind: 'property', name: 'Gbagada', tagline: 'Between the mainland and the bridge', group: 'orange', price: 180, houseCost: 100, rent: [14, 70, 200, 550, 750, 950] },
  { kind: 'property', name: 'Magodo', tagline: 'Gated and green', group: 'orange', price: 200, houseCost: 100, rent: [16, 80, 220, 600, 800, 1000] },
  { kind: 'goslow', name: 'Third Mainland Go-Slow', tagline: 'Stuck in traffic. Relax, nothing happens here.' },

  { kind: 'property', name: 'Ajah', tagline: 'Where the expressway ends', group: 'red', price: 220, houseCost: 150, rent: [18, 90, 250, 700, 875, 1050] },
  wahala(),
  { kind: 'property', name: 'Allen Avenue', tagline: 'Ikeja after dark', group: 'red', price: 220, houseCost: 150, rent: [18, 90, 250, 700, 875, 1050] },
  { kind: 'property', name: 'Ikeja GRA', tagline: 'Old money on the mainland', group: 'red', price: 240, houseCost: 150, rent: [20, 100, 300, 750, 925, 1100] },
  { kind: 'transport', name: 'MMIA Airport', tagline: 'Gateway to the world', transport: 'air', price: 200 },
  { kind: 'property', name: 'Lekki Phase 1', tagline: 'Admiralty Way energy', group: 'yellow', price: 260, houseCost: 150, rent: [22, 110, 330, 800, 975, 1150] },
  { kind: 'property', name: 'Oniru', tagline: 'Beachfront and brunch', group: 'yellow', price: 260, houseCost: 150, rent: [22, 110, 330, 800, 975, 1150] },
  { kind: 'utility', name: 'Borehole', tagline: 'Your own water, your own wahala', utility: 'water', price: 150 },
  { kind: 'property', name: 'Victoria Island', tagline: 'Where the money sleeps', group: 'yellow', price: 280, houseCost: 150, rent: [24, 120, 360, 850, 1025, 1200] },
  { kind: 'gotojail', name: 'Go to Kirikiri', tagline: 'Straight to Kirikiri. Do not pass GO.' },

  { kind: 'property', name: 'Parkview', tagline: 'Ikoyi’s quiet corner', group: 'green', price: 300, houseCost: 200, rent: [26, 130, 390, 900, 1100, 1275] },
  { kind: 'property', name: 'Old Ikoyi', tagline: 'Colonial roots, new money', group: 'green', price: 300, houseCost: 200, rent: [26, 130, 390, 900, 1100, 1275] },
  ajo(),
  { kind: 'property', name: 'Osborne', tagline: 'Towers over the lagoon', group: 'green', price: 320, houseCost: 200, rent: [28, 150, 450, 1000, 1200, 1400] },
  { kind: 'transport', name: 'Five Cowries Ferry', tagline: 'Beat traffic on the water', transport: 'ferry', price: 200 },
  wahala(),
  { kind: 'property', name: 'Eko Atlantic', tagline: 'A city rising from the sea', group: 'darkblue', price: 350, houseCost: 200, rent: [35, 175, 500, 1100, 1300, 1500] },
  { kind: 'tax', name: 'Owambe Spray', tagline: 'You must spray the celebrant. Na culture.', amount: 100 },
  { kind: 'property', name: 'Banana Island', tagline: 'The most exclusive address in Africa', group: 'darkblue', price: 400, houseCost: 200, rent: [50, 200, 600, 1400, 1700, 2000] },
]

export const naira = (m: number) => `${m < 0 ? '−' : ''}₦${Math.abs(m).toLocaleString()}M`
