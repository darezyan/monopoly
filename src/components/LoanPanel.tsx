import { useEffect, useState } from 'react'
import { Landmark, Minus, Plus, X } from 'lucide-react'
import { naira } from '../data/board'
import { LOAN_LAPS, loanBlocker, loanHeadroom, loanLimit } from '../game/game'
import type { Game } from '../game/useGame'

/** Borrow from the bank or pay a loan back (the "Bank loans" house rule). */
export function LoanPanel({ game, onClose }: { game: Game; onClose: () => void }) {
  const { state } = game
  const me = state.players[state.current]
  const loan = me.loan
  const headroom = loanHeadroom(state, me.id)
  const blocked = loanBlocker(state)
  const maxRepay = Math.max(0, Math.min(loan?.balance ?? 0, me.cash))
  // Default the borrow box to what clears a debt, else a round ₦100M
  const [borrow, setBorrow] = useState(() => Math.min(headroom, me.cash < 0 ? Math.ceil(-me.cash / 10) * 10 : 100))
  const [repay, setRepay] = useState(() => Math.floor(maxRepay / 10) * 10)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const passesLeft = loan ? LOAN_LAPS - loan.laps : LOAN_LAPS
  const nextOwed = loan ? loan.balance + Math.ceil((loan.balance * state.settings.loanRate) / 100) : 0

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="loan" role="dialog" aria-label="Bank loan" onClick={(e) => e.stopPropagation()}>
        <header className="deal__head">
          <Landmark size={22} />
          <h2>Bank loan</h2>
          <button className="sheet__close" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </header>

        <div className="loan__body">
          <dl className="sheet__stats loan__stats">
            <div>
              <dt>You owe</dt>
              <dd className={loan ? 'is-broke' : undefined}>{naira(loan?.balance ?? 0)}</dd>
            </div>
            <div>
              <dt>Limit</dt>
              <dd>{naira(loanLimit(state, me.id))}</dd>
            </div>
            <div>
              <dt>Interest</dt>
              <dd>{state.settings.loanRate}%</dd>
            </div>
          </dl>

          <p className="loan__terms">
            {loan ? (
              <>
                Every time you pass GO the loan grows by {state.settings.loanRate}%. Next pass you’ll owe{' '}
                <b>{naira(nextOwed)}</b>.{' '}
                {passesLeft === 1 ? (
                  <b className="loan__warn">The bank collects it all next time you pass GO.</b>
                ) : (
                  <>The bank collects it all on your {passesLeft === 2 ? 'next-but-one' : 'third'} pass of GO.</>
                )}
              </>
            ) : (
              <>
                Borrow up to {naira(headroom)}. It grows by {state.settings.loanRate}% each time you pass GO, and the
                bank collects it all on your third pass. Can’t pay then? You’re in debt like any other bill.
              </>
            )}
          </p>

          {blocked && <p className="deal__problem">{blocked}</p>}

          <section className="loan__row">
            <span className="deal__label">Borrow</span>
            <Stepper value={borrow} max={headroom} onChange={setBorrow} label="Amount to borrow" />
            <button
              className="turn__btn loan__btn"
              disabled={!!blocked || borrow <= 0 || borrow > headroom}
              onClick={() => {
                game.borrow(borrow)
                onClose()
              }}
            >
              Borrow
            </button>
          </section>
          <span className="deal__hint loan__hint">You can borrow {naira(headroom)} more</span>

          {loan && (
            <section className="loan__row">
              <span className="deal__label">Repay</span>
              <Stepper value={repay} max={maxRepay} onChange={setRepay} label="Amount to repay" />
              <button
                className="offer__pass loan__btn"
                disabled={!!blocked || repay <= 0 || repay > maxRepay}
                onClick={() => {
                  game.repayLoan(repay)
                  onClose()
                }}
              >
                {repay === loan.balance ? 'Pay it all' : 'Repay'}
              </button>
            </section>
          )}
        </div>
      </div>
    </div>
  )
}

function Stepper({
  value,
  max,
  onChange,
  label,
}: {
  value: number
  max: number
  onChange: (n: number) => void
  label: string
}) {
  const set = (n: number) => onChange(Math.max(0, Math.min(max, Math.round(n / 10) * 10)))
  return (
    <div className="deal__stepper">
      <button onClick={() => set(value - 50)} disabled={value <= 0} aria-label="Less">
        <Minus size={16} />
      </button>
      <input
        type="number"
        inputMode="numeric"
        min={0}
        max={max}
        step={10}
        value={value || ''}
        placeholder="0"
        onChange={(e) => set(Number(e.target.value))}
        aria-label={`${label}, in millions of naira`}
      />
      <button onClick={() => set(value + 50)} disabled={value >= max} aria-label="More">
        <Plus size={16} />
      </button>
    </div>
  )
}
