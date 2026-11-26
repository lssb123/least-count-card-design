'use client'

import { useState } from 'react'
import { Bell, ChevronDown, CircleHelp, Crown, Menu, MoreHorizontal, Volume2 } from 'lucide-react'

type Card = { rank: string; suit: string }
const hand: Card[] = [
  { rank: '4', suit: '♣' }, { rank: 'Q', suit: '♥' }, { rank: '7', suit: '♦' },
  { rank: 'A', suit: '♠' }, { rank: '9', suit: '♣' }, { rank: '3', suit: '♥' }, { rank: 'K', suit: '♦' },
]
const opponents = [
  { name: 'Olivia', score: 18, position: 'seat-top' },
  { name: 'Marcus', score: 24, position: 'seat-right' },
  { name: 'You', score: 12, position: 'seat-bottom' },
  { name: 'Elena', score: 31, position: 'seat-left' },
]

function BackCard({ index, direction }: { index: number; direction: 'top' | 'side' }) {
  const spread = direction === 'top' ? (index - 3) * 8 : (index - 3) * 5
  const rotation = direction === 'top' ? spread : direction === 'side' ? (index - 3) * 4 : 0
  return <span className={`playing-card card-back ${direction}`} style={{ '--tilt': `${rotation}deg`, '--stack': index } as React.CSSProperties} aria-hidden="true"><span className="back-pattern" /></span>
}

function FaceCard({ card, selected, onClick, index }: { card: Card; selected: boolean; onClick: () => void; index: number }) {
  const red = card.suit === '♥' || card.suit === '♦'
  return <button type="button" aria-label={`${card.rank} ${card.suit}`} aria-pressed={selected} onClick={onClick} className={`playing-card face-card ${red ? 'red' : 'black'} ${selected ? 'selected' : ''}`} style={{ '--card-index': index } as React.CSSProperties}>
    <span className="corner corner-top">{card.rank}<small>{card.suit}</small></span>
    <span className="card-center">{card.suit}</span>
    <span className="corner corner-bottom">{card.rank}<small>{card.suit}</small></span>
  </button>
}

export default function Page() {
  const [selected, setSelected] = useState<number | null>(null)
  const [message, setMessage] = useState('Your turn — choose a card to discard')
  const [discard, setDiscard] = useState<Card>({ rank: '8', suit: '♠' })
  const [cards, setCards] = useState(hand)
  const [scoreOpen, setScoreOpen] = useState(false)

  function playCard() {
    if (selected === null) return
    const played = cards[selected]
    setDiscard(played)
    setCards((current) => current.filter((_, i) => i !== selected))
    setSelected(null)
    setMessage(`${played.rank}${played.suit} discarded · draw a card to finish your turn`)
    window.setTimeout(() => setMessage('Olivia is thinking…'), 1400)
  }

  return <main className="game-shell">
    <header className="topbar">
      <a className="brand" href="#home" aria-label="Least Count home"><span className="brand-mark">L<span>♠</span></span><span>LEAST COUNT<small>THE CARD TABLE</small></span></a>
      <div className="room-meta"><span className="live-dot" /> FRIENDS ROOM <b>·</b> <span>ROUND 03</span><span className="room-code">H7K2Q <ChevronDown size={13} /></span></div>
      <div className="top-actions"><button aria-label="Toggle sound"><Volume2 /></button><button aria-label="Notifications"><Bell /></button><button className="profile"><span className="avatar avatar-you">J</span><span>Jordan</span><ChevronDown size={14} /></button><button className="mobile-menu" aria-label="Menu"><Menu /></button></div>
    </header>

    <div className="game-layout">
      <section className="table-column" aria-label="Game table">
        <div className="round-strip"><span className="round-pill">ROUND 03</span><span className="round-note">First to 101 is out <span>·</span> Last player standing wins</span><button aria-label="Game rules"><CircleHelp size={17} /></button></div>
        <div className="felt-table">
          <div className="table-inner-line" />
          <div className="seat seat-top"><div className="player-heading"><span className="avatar avatar-olivia">O</span><span className="player-name">Olivia <small>HOST</small></span><span className="score-badge">18 pts</span></div><div className="opponent-fan top-fan">{Array.from({ length: 7 }, (_, i) => <BackCard key={i} index={i} direction="top" />)}</div></div>
          <div className="seat seat-right"><div className="player-heading vertical-heading"><span className="avatar avatar-marcus">M</span><span className="player-name">Marcus</span><span className="score-badge">24 pts</span></div><div className="opponent-fan side-fan right-fan">{Array.from({ length: 7 }, (_, i) => <BackCard key={i} index={i} direction="side" />)}</div></div>
          <div className="seat seat-left"><div className="player-heading vertical-heading"><span className="avatar avatar-elena">E</span><span className="player-name">Elena</span><span className="score-badge">31 pts</span></div><div className="opponent-fan side-fan left-fan">{Array.from({ length: 7 }, (_, i) => <BackCard key={i} index={i} direction="side" />)}</div></div>
          <div className="table-center">
            <div className="table-caption"><span className="pulse-dot" /> {message}</div>
            <div className="play-area">
              <div className="deck-stack" aria-label="Closed deck, 38 cards"><div className="deck-card deck-under" /><div className="deck-card deck-middle" /><button className="playing-card card-back deck-top" onClick={() => setMessage('You drew from the deck. Choose a card to discard.')} aria-label="Draw from closed deck"><span className="back-pattern" /></button><span className="pile-label">DRAW PILE <b>38</b></span></div>
              <div className="discard-slot"><div className={`playing-card discard-card ${(discard.suit === '♥' || discard.suit === '♦') ? 'red' : 'black'}`}><span className="corner corner-top">{discard.rank}<small>{discard.suit}</small></span><span className="card-center">{discard.suit}</span><span className="corner corner-bottom">{discard.rank}<small>{discard.suit}</small></span></div><span className="pile-label">DISCARD</span></div>
            </div>
            <div className="joker-indicator"><span className="joker-label">WILD RANK</span><span className="joker-card">7<span>♦</span></span><span className="joker-copy">All sevens are <b>zero</b></span></div>
          </div>
          <div className="seat seat-bottom"><div className="your-tag"><span className="your-live" /> YOUR TURN</div><div className="player-heading"><span className="avatar avatar-you">J</span><span className="player-name">Jordan <small>YOU</small></span><span className="score-badge">12 pts</span></div><div className="hand-fan" aria-label="Your hand, seven cards">{cards.map((card, i) => <FaceCard key={`${card.rank}${card.suit}-${i}`} card={card} index={i} selected={selected === i} onClick={() => setSelected(i)} />)}</div></div>
        </div>
        <div className="action-row"><div className="turn-timer"><span className="timer-icon">◷</span><span>YOUR MOVE <b>00:24</b></span></div><div className="action-buttons"><button className="least-button" onClick={() => setMessage('Your hand must be 5 points or less to declare Least Count.')}><Crown size={16} /> LEAST COUNT <span className="score-chip">≤ 5</span></button><button className="discard-button" onClick={playCard} disabled={selected === null}>DISCARD SELECTED <span>↗</span></button></div></div>
      </section>

      <aside className={`score-panel ${scoreOpen ? 'score-open' : ''}`}>
        <div className="panel-heading"><div><span className="eyebrow">THE TABLE</span><h1>Scoreboard</h1></div><button aria-label="More scoreboard options"><MoreHorizontal /></button></div>
        <div className="leader-card"><div className="leader-top"><span>LOWEST SCORE</span><Crown size={17} /></div><div className="leader-player"><span className="avatar avatar-you">J</span><strong>Jordan</strong><span className="leader-score">12</span></div><div className="leader-progress"><span /></div><small>89 points until elimination</small></div>
        <div className="players-head"><span>PLAYER</span><span>R3</span><span>TOTAL</span></div>
        <div className="score-list">{opponents.map((player, i) => <div className={`score-row ${i === 2 ? 'is-you' : ''}`} key={player.name}><span className={`avatar avatar-${player.name.toLowerCase()}`}>{player.name[0]}</span><span className="score-name">{player.name}{i === 2 && <small>YOU</small>}</span><span className="round-score">{[6, 8, 4, 11][i]}</span><strong>{player.score}</strong></div>)}</div>
        <button className="full-score-btn" onClick={() => setScoreOpen((v) => !v)}>{scoreOpen ? 'HIDE FULL SCORECARD' : 'VIEW FULL SCORECARD'} <span>↗</span></button>
        {scoreOpen && <div className="scorecard-extra"><span>Round 1 <b>8 · 12 · 4 · 10</b></span><span>Round 2 <b>4 · 4 · 4 · 10</b></span></div>}
        <div className="activity"><div className="activity-title">TABLE ACTIVITY <span>LIVE</span></div><p><i className="activity-dot green" /> <b>Olivia</b> drew from the deck <time>12s</time></p><p><i className="activity-dot gold" /> <b>Marcus</b> discarded a card <time>28s</time></p><p><i className="activity-dot gray" /> Round 3 began <time>1m</time></p></div>
        <div className="table-footer"><span>ROOM H7K2Q</span><span>·</span><button>INVITE PLAYERS <span>↗</span></button></div>
      </aside>
    </div>
    <footer className="page-footer"><span>LEAST COUNT <b>·</b> A little luck. A little nerve.</span><div><button>RULES</button><button>SETTINGS</button></div></footer>
  </main>
}
