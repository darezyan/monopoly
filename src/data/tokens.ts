// The 8 playable tokens. Each has its own colour, so picking a token picks your colour.

export type TokenKind = 'danfo' | 'okada' | 'taxi' | 'canoe' | 'jollof' | 'drum' | 'agbada' | 'gen'

export const TOKENS: { kind: TokenKind; label: string; color: string }[] = [
  { kind: 'danfo', label: 'Danfo', color: '#f5c518' },
  { kind: 'okada', label: 'Okada', color: '#d8382b' },
  { kind: 'taxi', label: 'Taxi', color: '#1e9b57' },
  { kind: 'canoe', label: 'Canoe', color: '#3b6fe0' },
  { kind: 'jollof', label: 'Jollof Pot', color: '#f2892a' },
  { kind: 'drum', label: 'Talking Drum', color: '#8b5cf6' },
  { kind: 'agbada', label: 'Agbada', color: '#e0508f' },
  { kind: 'gen', label: 'Generator', color: '#14a8a0' },
]

export const tokenInfo = (kind: TokenKind) => TOKENS.find((t) => t.kind === kind)!

export type RobotLevel = 'easy' | 'normal' | 'sharp'

export const ROBOT_NAMES = [
  'Oga Landlord',
  'Mama Put',
  'Alhaji',
  'Aunty Nkechi',
  'Chief',
  'Bros Kunle',
  'Iya Basira',
  'Area Fada',
]
