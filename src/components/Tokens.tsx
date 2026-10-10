import { JAIL_INDEX, type Player } from '../game/game'
import { placement } from './BoardTile'
import { TokenDisc } from './Token'

// Board grid is 1.6fr + 9×1fr + 1.6fr on each axis.
const CORNER = 1.6
const TOTAL = CORNER * 2 + 9

function cellStart(n: number) {
  return n === 1 ? 0 : CORNER + (n - 2)
}
function cellSize(n: number) {
  return n === 1 || n === 11 ? CORNER : 1
}
const pct = (units: number) => (units / TOTAL) * 100

/** Where a token sits on a square, in % of the board, nudged away from the colour band. */
function anchor(player: Player): { x: number; y: number } {
  const { position } = player
  if (position === JAIL_INDEX) {
    // In the cell (inner top-right of the corner) or walking past on the outer edge
    return player.inJail
      ? { x: pct(CORNER * 0.64), y: pct(TOTAL - CORNER * 0.64) }
      : { x: pct(CORNER * 0.3), y: pct(TOTAL - CORNER * 0.3) }
  }

  const { row, col, side, corner } = placement(position)
  let x = cellStart(col) + cellSize(col) / 2
  let y = cellStart(row) + cellSize(row) / 2
  if (!corner) {
    const nudge = 0.22
    if (side === 'bottom') y += nudge
    if (side === 'top') y -= nudge
    if (side === 'left') x -= nudge
    if (side === 'right') x += nudge
  }
  return { x: pct(x), y: pct(y) }
}

/**
 * Spread tokens sharing a square so they don't stack exactly.
 * Returns an offset in token-widths and a scale (crowded squares shrink tokens).
 */
function spread(i: number, n: number): [number, number, number] {
  if (n === 1) return [0, 0, 1]
  if (n === 2) return [i === 0 ? -0.32 : 0.32, i === 0 ? -0.18 : 0.18, 1]
  if (n <= 4) {
    const grid: [number, number][] = [
      [-0.32, -0.3],
      [0.32, -0.3],
      [-0.32, 0.3],
      [0.32, 0.3],
    ]
    return [...grid[i], 0.9]
  }
  // 5–8 tokens: up to three per row, smaller
  const cols = 3
  const rows = Math.ceil(n / cols)
  const col = i % cols
  const row = Math.floor(i / cols)
  const inRow = Math.min(cols, n - row * cols)
  return [(col - (inRow - 1) / 2) * 0.62, (row - (rows - 1) / 2) * 0.62, 0.68]
}

export function Tokens({ players, current }: { players: Player[]; current: number }) {
  return (
    <div className="tokens" aria-hidden>
      {players.map((p) => {
        const mates = players.filter((o) => o.position === p.position && o.inJail === p.inJail)
        const [dx, dy, scale] = spread(mates.indexOf(p), mates.length)
        const { x, y } = anchor(p)
        return (
          <div
            key={p.id}
            className={`token${p.id === current ? ' is-current' : ''}`}
            style={{
              left: `${x}%`,
              top: `${y}%`,
              transform: `translate(calc(-50% + ${dx * 100}%), calc(-50% + ${dy * 100}%)) scale(${scale})`,
            }}
          >
            {/* Re-keying on position replays the hop animation on every step */}
            <div key={p.position} className="token__hop">
              <TokenDisc player={p} />
            </div>
          </div>
        )
      })}
    </div>
  )
}
