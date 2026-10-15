import { useEffect } from 'react'
import {
  Building2,
  CircleHelp,
  Dices,
  Flag,
  Handshake,
  Keyboard,
  Landmark,
  Lock,
  PiggyBank,
  Trophy,
  X,
} from 'lucide-react'
import { naira, PASS_GO_SALARY } from '../data/board'
import type { GameSettings } from '../game/game'
import { DEFAULT_SETTINGS } from '../game/game'

type Section = { icon: React.ReactNode; title: string; body: React.ReactNode }

function sections(settings: GameSettings): Section[] {
  return [
    {
      icon: <Flag />,
      title: 'The goal',
      body: (
        <p>
          Buy up Lagos, collect rent, and drive everyone else bankrupt. The last player with money standing{' '}
          <b>owns Lagos</b>.
        </p>
      ),
    },
    {
      icon: <Dices />,
      title: 'Your turn',
      body: (
        <ul>
          <li>Roll the dice and your token moves that many squares.</li>
          <li>
            Pass <b>GO</b> and collect your {naira(PASS_GO_SALARY)} salary.
          </li>
          <li>
            Roll <b>doubles</b> and you go again. Three doubles in a row? Straight to Kirikiri.
          </li>
          <li>When you’re done, tap End turn.</li>
        </ul>
      ),
    },
    {
      icon: <Handshake />,
      title: 'Buying & rent',
      body: (
        <ul>
          <li>
            Land on a property nobody owns and you can buy it, or pass.
            {settings.auctions &&
              ' If you pass, it goes to auction: everyone takes turns raising the bid or dropping out, and the last one in wins.'}
          </li>
          <li>Land on someone else’s property and you pay them rent. It happens automatically.</li>
          <li>
            Own a whole colour set and the rent on each property <b>doubles</b>.
          </li>
          <li>Transport hubs pay more the more of them you own. Utilities charge a multiple of the dice.</li>
        </ul>
      ),
    },
    {
      icon: <Building2 />,
      title: 'Houses & hotels',
      body: (
        <ul>
          <li>Once you own a full colour set, tap one of its properties to build houses.</li>
          <li>Four houses, then a hotel. Every building pushes the rent way up.</li>
          {settings.evenBuild && <li>You have to build evenly across the set.</li>}
          <li>
            Build, pay off mortgages and make deals <b>before you roll</b>. Once the dice are thrown, they wait for your
            next turn.
          </li>
          <li>Sell any house or hotel back to the bank for half what you paid, any time on your turn.</li>
        </ul>
      ),
    },
    {
      icon: <Landmark />,
      title: 'Mortgages',
      body: (
        <ul>
          <li>Short of money? Mortgage a property to get half its price from the bank.</li>
          <li>Mortgaged property collects no rent. Pay it off (plus 10%) to bring it back.</li>
          <li>Tap your name, or “Your properties”, to see and manage everything you own.</li>
        </ul>
      ),
    },
    {
      icon: <PiggyBank />,
      title: 'Wahala & Ajo Box',
      body: (
        <p>
          Land on one of these and pick a card. <b>Wahala</b> is chaos: LASTMA, traffic, NEPA. <b>Ajo Box</b> is money:
          payouts, owambes, school fees. Read it and tap “Na so”.
        </p>
      ),
    },
    {
      icon: <Lock />,
      title: 'Kirikiri (jail)',
      body: (
        <ul>
          <li>Land on “Go to Kirikiri”, draw that card, or roll three doubles, and you’re locked up.</li>
          <li>To get out, roll doubles (3 tries), pay {naira(settings.bail)} bail, or use a “You know person” card.</li>
          <li>
            {settings.rentInJail
              ? 'You still collect rent while you’re inside.'
              : 'In this game you collect no rent while you’re inside.'}
          </li>
        </ul>
      ),
    },
    ...(settings.bankLoans
      ? [
          {
            icon: <Landmark />,
            title: 'Bank loans (house rule)',
            body: (
              <ul>
                <li>Borrow up to ₦100M plus half of what your properties are worth (max ₦500M).</li>
                <li>Every time you pass GO, what you owe grows by {settings.loanRate}%.</li>
                <li>On your third pass of GO the bank collects it all. Can’t pay? It’s a debt like any other, and you can’t take a new loan to cover it.</li>
                <li>Pay it back early, in part or in full, any time on your turn.</li>
              </ul>
            ),
          },
        ]
      : []),
    {
      icon: <Trophy />,
      title: 'Money trouble & winning',
      body: (
        <ul>
          <li>If you owe more than you have, sell houses or mortgage property to pay up.</li>
          <li>Can’t raise it? You’re bankrupt, and your property goes to whoever you owe.</li>
          <li>The last player standing wins.</li>
        </ul>
      ),
    },
    {
      icon: <Keyboard />,
      title: 'Shortcuts',
      body: (
        <ul className="htp__keys">
          <li>
            <kbd>Space</kbd> Roll · End turn · Accept card
          </li>
          <li>
            <kbd>B</kbd> Buy &nbsp; <kbd>P</kbd> Pass
          </li>
          <li>
            <kbd>Esc</kbd> Close a deed or panel
          </li>
        </ul>
      ),
    },
  ]
}

export function HowToPlay({ settings = DEFAULT_SETTINGS, onClose }: { settings?: GameSettings; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="htp" role="dialog" aria-label="How to play" onClick={(e) => e.stopPropagation()}>
        <header className="htp__head">
          <CircleHelp size={22} />
          <h2>How to play Èkó</h2>
          <button className="sheet__close" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </header>
        <div className="htp__body">
          {sections(settings).map((s) => (
            <section key={s.title} className="htp__section">
              <span className="htp__icon">{s.icon}</span>
              <div>
                <h3>{s.title}</h3>
                {s.body}
              </div>
            </section>
          ))}
        </div>
      </div>
    </div>
  )
}
