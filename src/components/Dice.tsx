/** Rotation that brings each face to the front (1 front, 6 back, 3 right, 4 left, 5 top, 2 bottom). */
const FACE_ROTATION: Record<number, [number, number]> = {
  1: [0, 0],
  6: [0, 180],
  3: [0, -90],
  4: [0, 90],
  5: [-90, 0],
  2: [90, 0],
}

/** Which cells of a 3×3 grid hold a pip for each value */
const PIPS: Record<number, number[]> = {
  1: [4],
  2: [2, 6],
  3: [2, 4, 6],
  4: [0, 2, 6, 8],
  5: [0, 2, 4, 6, 8],
  6: [0, 2, 3, 5, 6, 8],
}

const FACES = [
  { value: 1, cls: 'front' },
  { value: 6, cls: 'back' },
  { value: 3, cls: 'right' },
  { value: 4, cls: 'left' },
  { value: 5, cls: 'top' },
  { value: 2, cls: 'bottom' },
]

function Die({ value, spins, tilt }: { value: number; spins: number; tilt: number }) {
  const [x, y] = FACE_ROTATION[value]
  // Each roll adds full turns so the cube visibly tumbles before settling.
  // The tilt goes first so it spins the die flat on the table rather than tipping it.
  const transform = `rotateZ(${tilt}deg) rotateX(${x + spins * 720}deg) rotateY(${y + spins * 360}deg)`

  return (
    <div className="die">
      <div className="die__cube" style={{ transform }}>
        {FACES.map((f) => (
          <div key={f.cls} className={`die__face die__face--${f.cls}`}>
            {Array.from({ length: 9 }, (_, i) => (
              <span key={i} className={PIPS[f.value].includes(i) ? 'pip' : undefined} />
            ))}
          </div>
        ))}
      </div>
      <div className="die__shadow" />
    </div>
  )
}

export function Dice({ dice, rollCount, rolling }: { dice: [number, number]; rollCount: number; rolling: boolean }) {
  return (
    <div className={`dice${rolling ? ' is-rolling' : ''}`} aria-label={`Dice show ${dice[0]} and ${dice[1]}`}>
      <Die value={dice[0]} spins={rollCount} tilt={-8} />
      <Die value={dice[1]} spins={rollCount * 2} tilt={6} />
    </div>
  )
}
