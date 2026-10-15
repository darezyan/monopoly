import type { RobotLevel } from '../data/tokens'

const BARS: Record<RobotLevel, number> = { easy: 1, normal: 2, sharp: 3 }

/** A robot's level as 1–3 rising bars, readable even where there's no room for the word. */
export function RobotMeter({ level }: { level: RobotLevel }) {
  return (
    <span className="robot-meter" role="img" aria-label={`${level} robot`}>
      {[1, 2, 3].map((n) => (
        <span key={n} className={`robot-meter__bar${n <= BARS[level] ? ' is-on' : ''}`} />
      ))}
    </span>
  )
}
