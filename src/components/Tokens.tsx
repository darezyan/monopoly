import { JAIL_INDEX, type Player } from '../game/game'
import { placement } from './BoardTile'
import { TokenDisc } from './Token'

// Board grid is corner + 9 squares + corner on each axis. The corner size comes from CSS
// (--corner, slimmer on small boards), so positions are worked out in CSS too:
// a length is `c` corners plus `k` squares.
type Units = { c: number; k: number }

function cellStart(n: number): Units {
  return n === 1 ? { c: 0, k: 0 } : { c: 1, k: n - 2 }
}
function cellSize(n: number): Units {
  return n === 1 || n === 11 ? { c: 1, k: 0 } : { c: 0, k: 1 }
}
const centre = (n: number): Units => {
  const start = cellStart(n)
  const size = cellSize(n)
  return { c: start.c + size.c / 2, k: start.k + size.k / 2 }
}
/** A CSS percentage of the board for a length in corner/square units. */
const pct = ({ c, k }: Units) => `calc((${c} * var(--corner) + ${k}) / (2 * var(--corner) + 9) * 100%)`

/** Where a token sits on a square, nudged away from the colour band. */
function anchor(player: Player): { x: Units; y: Units } {
  const { position } = player
  if (position === JAIL_INDEX) {
    // In the cell (inner top-right of the corner) or walking past on the outer edge
    return player.inJail
      ? { x: { c: 0.64, k: 0 }, y: { c: 2 - 0.64, k: 9 } }
      : { x: { c: 0.3, k: 0 }, y: { c: 2 - 0.3, k: 9 } }
  }

  const { row, col, side, corner } = placement(position)
  const x = centre(col)
  const y = centre(row)
  if (!corner) {
    const nudge = 0.22
    if (side === 'bottom') y.k += nudge
    if (side === 'top') y.k -= nudge
    if (side === 'left') x.k -= nudge
    if (side === 'right') x.k += nudge
  }
  return { x, y }
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
              left: pct(x),
              top: pct(y),
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
