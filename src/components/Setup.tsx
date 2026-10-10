import { useEffect, useRef, useState } from 'react'
import { ArrowLeft, Bot, Check, Play, Plus, UserRound, X } from 'lucide-react'
import { ROBOT_NAMES, TOKENS, tokenInfo, type RobotLevel, type TokenKind } from '../data/tokens'
import { naira } from '../data/board'
import { DEFAULT_SETTINGS, type GameSettings, type Seat } from '../game/game'
import type { SetupMode } from './Home'
import { TOKEN_ICONS, TokenDisc } from './Token'

const MAX_PLAYERS = 8

type Props = {
  mode: SetupMode
  nickname: string
  onBack: () => void
  onStart: (seats: Seat[], settings: GameSettings) => void
}

function initialSeats(mode: SetupMode, nickname: string): Seat[] {
  const you: Seat = { name: nickname.trim() || 'You', token: 'danfo', robot: null }
  if (mode === 'local') return [you, { name: 'Player 2', token: 'okada', robot: null }]
  return [
    you,
    { name: ROBOT_NAMES[0], token: 'okada', robot: 'normal' },
    { name: ROBOT_NAMES[1], token: 'taxi', robot: 'normal' },
    { name: ROBOT_NAMES[2], token: 'canoe', robot: 'normal' },
  ]
}

export function Setup({ mode, nickname, onBack, onStart }: Props) {
  const [seats, setSeats] = useState<Seat[]>(() => initialSeats(mode, nickname))
  const [settings, setSettings] = useState<GameSettings>(DEFAULT_SETTINGS)
  const [picking, setPicking] = useState<number | null>(null)

  const freeToken = () => TOKENS.find((t) => !seats.some((s) => s.token === t.kind))!.kind
  const update = (i: number, patch: Partial<Seat>) =>
    setSeats((all) => all.map((s, j) => (j === i ? { ...s, ...patch } : s)))

  const addSeat = (robot: boolean) => {
    if (seats.length >= MAX_PLAYERS) return
    const robotName = ROBOT_NAMES.find((n) => !seats.some((s) => s.name === n)) ?? 'Robot'
    const humans = seats.filter((s) => !s.robot).length
    setSeats([
      ...seats,
      robot
        ? { name: robotName, token: freeToken(), robot: 'normal' }
        : { name: `Player ${humans + 1}`, token: freeToken(), robot: null },
    ])
  }

  const humans = seats.filter((s) => !s.robot).length
  const names = seats.map((s) => s.name.trim().toLowerCase())
  const problem =
    seats.length < 2
      ? 'Add at least one more player'
      : humans === 0
        ? 'At least one human must play'
        : names.some((n) => !n)
          ? 'Every player needs a name'
          : new Set(names).size !== names.length
            ? 'Two players have the same name'
            : null

  return (
    <div className="setup">
      <header className="setup__head">
        <button className="icon-btn" onClick={onBack} aria-label="Back">
          <ArrowLeft size={20} />
        </button>
        <div>
          <h1 className="setup__title">{mode === 'robots' ? 'Play vs Robots' : 'Pass & Play'}</h1>
          <p className="setup__sub">
            {mode === 'robots' ? 'Choose your token and your opponents.' : 'Everyone picks a token. Pass the phone on your turn.'}
          </p>
        </div>
      </header>

      <section className="panel">
        <div className="panel__head">
          <h2>Players</h2>
          <span className="panel__count">
            {seats.length}/{MAX_PLAYERS}
          </span>
        </div>

        <ul className="seats">
          {seats.map((seat, i) => (
            <li key={i} className="seat">
              <div className="seat__token">
                <button
                  className="seat__token-btn"
                  onClick={() => setPicking(picking === i ? null : i)}
                  aria-label={`Change token (${tokenInfo(seat.token).label})`}
                  aria-expanded={picking === i}
                >
                  <TokenDisc player={{ token: seat.token, color: tokenInfo(seat.token).color }} />
                </button>
                {picking === i && (
                  <TokenPicker
                    current={seat.token}
                    taken={seats.filter((_, j) => j !== i).map((s) => s.token)}
                    onPick={(token) => {
                      update(i, { token })
                      setPicking(null)
                    }}
                    onClose={() => setPicking(null)}
                  />
                )}
              </div>

              <div className="seat__main">
                <div className="seat__name-row">
                  <input
                    className="seat__name"
                    value={seat.name}
                    maxLength={16}
                    onChange={(e) => update(i, { name: e.target.value })}
                    aria-label="Player name"
                  />
                  <span className={`seat__kind${seat.robot ? ' is-robot' : ''}`}>
                    {seat.robot ? <Bot size={13} /> : <UserRound size={13} />}
                    {seat.robot ? 'Robot' : i === 0 ? 'You' : 'Friend'}
                  </span>
                </div>
                <span className="seat__token-label">{tokenInfo(seat.token).label}</span>
                {seat.robot && (
                  <div className="segmented segmented--sm" role="radiogroup" aria-label="Robot level">
                    {(['easy', 'normal', 'sharp'] as RobotLevel[]).map((lvl) => (
                      <button
                        key={lvl}
                        role="radio"
                        aria-checked={seat.robot === lvl}
                        className={seat.robot === lvl ? 'is-on' : undefined}
                        onClick={() => update(i, { robot: lvl })}
                      >
                        {lvl[0].toUpperCase() + lvl.slice(1)}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {i > 0 && (
                <button
                  className="icon-btn icon-btn--sm"
                  onClick={() => setSeats(seats.filter((_, j) => j !== i))}
                  aria-label={`Remove ${seat.name}`}
                >
                  <X size={16} />
                </button>
              )}
            </li>
          ))}
        </ul>

        <div className="seats__add">
          {mode === 'local' && (
            <button className="add-btn" onClick={() => addSeat(false)} disabled={seats.length >= MAX_PLAYERS}>
              <Plus size={16} /> Add friend
            </button>
          )}
          <button className="add-btn" onClick={() => addSeat(true)} disabled={seats.length >= MAX_PLAYERS}>
            <Bot size={16} /> Add robot
          </button>
        </div>
      </section>

      <SettingsPanel settings={settings} onChange={setSettings} />

      <div className="setup__bar">
        {problem && <p className="setup__problem">{problem}</p>}
        <button
          className="turn__btn setup__start"
          disabled={!!problem}
          onClick={() => onStart(seats.map((s) => ({ ...s, name: s.name.trim() })), settings)}
        >
          <Play size={20} /> Start game
        </button>
      </div>
    </div>
  )
}

export function TokenPicker({
  current,
  taken,
  onPick,
  onClose,
}: {
  current: TokenKind
  taken: TokenKind[]
  onPick: (t: TokenKind) => void
  onClose: () => void
}) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const onDown = (e: PointerEvent) => {
      if (ref.current && !ref.current.parentElement!.contains(e.target as Node)) onClose()
    }
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('pointerdown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [onClose])

  return (
    <div className="picker" ref={ref} role="listbox" aria-label="Choose a token">
      {TOKENS.map((t) => {
        const Icon = TOKEN_ICONS[t.kind]
        const isTaken = taken.includes(t.kind)
        return (
          <button
            key={t.kind}
            role="option"
            aria-selected={t.kind === current}
            className={`picker__opt${t.kind === current ? ' is-current' : ''}`}
            disabled={isTaken}
            onClick={() => onPick(t.kind)}
            style={{ '--token': t.color } as React.CSSProperties}
          >
            <span className="picker__disc">
              <Icon size={18} strokeWidth={2.2} />
              {t.kind === current && <Check className="picker__check" size={12} strokeWidth={3} />}
            </span>
            <span className="picker__label">{isTaken ? 'Taken' : t.label}</span>
          </button>
        )
      })}
    </div>
  )
}

type ToggleKey = 'rentInJail' | 'evenBuild' | 'limitedBuildings' | 'goSlowJackpot' | 'doubleGoSalary' | 'shuffleOrder'

const TOGGLES: { key: ToggleKey; title: string; text: string }[] = [
  { key: 'rentInJail', title: 'Collect rent in Kirikiri', text: 'Owners still get paid while they’re locked up.' },
  {
    key: 'evenBuild',
    title: 'Build evenly',
    text: 'No second house on a property until every property in its set has one, and so on.',
  },
  {
    key: 'limitedBuildings',
    title: 'Limited houses',
    text: 'The bank only has 32 houses and 12 hotels. When they run out, nobody can build.',
  },
  { key: 'goSlowJackpot', title: 'Go-Slow jackpot', text: 'Taxes and fines pile up. Land on Go-Slow to win the pot.' },
  { key: 'doubleGoSalary', title: 'Double salary on GO', text: 'Land exactly on GO to collect ₦400M.' },
  { key: 'shuffleOrder', title: 'Random turn order', text: 'Shuffle who goes first.' },
]

export function SettingsPanel({
  settings,
  onChange,
  readOnly = false,
}: {
  settings: GameSettings
  onChange: (s: GameSettings) => void
  /** Show the rules without letting this person change them (non-hosts in a room) */
  readOnly?: boolean
}) {
  return (
    <section className="panel">
      <div className="panel__head">
        <h2>House rules</h2>
        {readOnly ? (
          <span className="panel__count">Host decides</span>
        ) : (
          <button className="panel__reset" onClick={() => onChange(DEFAULT_SETTINGS)}>
            Reset
          </button>
        )}
      </div>

      <div className="rule">
        <div className="rule__text">
          <span className="rule__title">Starting cash</span>
          <span className="rule__desc">What everyone begins with.</span>
        </div>
        <div className="segmented" role="radiogroup" aria-label="Starting cash">
          {[1000, 1500, 2000].map((cash) => (
            <button
              key={cash}
              role="radio"
              aria-checked={settings.startingCash === cash}
              className={settings.startingCash === cash ? 'is-on' : undefined}
              disabled={readOnly && settings.startingCash !== cash}
              onClick={() => onChange({ ...settings, startingCash: cash })}
            >
              {naira(cash)}
            </button>
          ))}
        </div>
      </div>

      {TOGGLES.map((t) => (
        <label key={t.key} className="rule">
          <span className="rule__text">
            <span className="rule__title">{t.title}</span>
            <span className="rule__desc">{t.text}</span>
          </span>
          <input
            type="checkbox"
            className="switch"
            checked={settings[t.key]}
            disabled={readOnly}
            onChange={(e) => onChange({ ...settings, [t.key]: e.target.checked })}
          />
        </label>
      ))}

      <label className="rule">
        <span className="rule__text">
          <span className="rule__title">Bank loans</span>
          <span className="rule__desc">
            Borrow up to ₦500M. It grows each time you pass GO and the bank collects it on your third pass.
          </span>
        </span>
        <input
          type="checkbox"
          className="switch"
          checked={settings.bankLoans}
          disabled={readOnly}
          onChange={(e) => onChange({ ...settings, bankLoans: e.target.checked })}
        />
      </label>
      {settings.bankLoans && (
        <div className="rule rule--sub">
          <div className="rule__text">
            <span className="rule__title">Loan interest</span>
            <span className="rule__desc">Added each time you pass GO.</span>
          </div>
          <div className="segmented" role="radiogroup" aria-label="Loan interest">
            {[5, 10, 15, 20, 25].map((rate) => (
              <button
                key={rate}
                role="radio"
                aria-checked={settings.loanRate === rate}
                className={settings.loanRate === rate ? 'is-on' : undefined}
                disabled={readOnly && settings.loanRate !== rate}
                onClick={() => onChange({ ...settings, loanRate: rate })}
              >
                {rate}%
              </button>
            ))}
          </div>
        </div>
      )}

      <label className="rule">
        <span className="rule__text">
          <span className="rule__title">Auctions</span>
          <span className="rule__desc">When someone passes on a property, everyone bids for it. Highest bid wins.</span>
        </span>
        <input
          type="checkbox"
          className="switch"
          checked={settings.auctions}
          disabled={readOnly}
          onChange={(e) => onChange({ ...settings, auctions: e.target.checked })}
        />
      </label>
    </section>
  )
}
