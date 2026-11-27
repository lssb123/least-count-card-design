'use client'

import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery } from 'convex/react'
import { ArrowLeft, ArrowRight, Check, CircleHelp, Clipboard, Crown, Plus, RotateCw, Shield, Users, X } from 'lucide-react'
import { api } from '@/convex/_generated/api'
import { useConvexAvailability } from '@/app/convex-provider'
import {
  beginGame,
  discardCards,
  drawFromClosed,
  drawFromOpen,
  handScore,
  nextRound,
  scoreRound,
  startRound,
  type Card,
  type Game,
  type Player,
} from '@/lib/least-count'

type Screen = 'setup' | 'handoff' | 'table' | 'round' | 'winner'

const redSuit = (suit: Card['suit']) => suit === '♥' || suit === '♦'

function PlayingCard({ card, back = false, selected = false, onClick, className = '', index = 0 }: { card?: Card; back?: boolean; selected?: boolean; onClick?: () => void; className?: string; index?: number }) {
  if (back) return <button type="button" aria-label="Hidden card" className={`playing-card card-back ${className}`} onClick={onClick}><span className="back-pattern" /></button>
  if (!card) return null
  const content = <><span className="corner corner-top">{card.rank === 'JOKER' ? '★' : card.rank}<small>{card.suit}</small></span><span className="card-center">{card.suit}</span><span className="corner corner-bottom">{card.rank === 'JOKER' ? '★' : card.rank}<small>{card.suit}</small></span></>
  return onClick ? <button type="button" aria-label={`${card.rank} of ${card.suit}`} aria-pressed={selected} className={`playing-card face-card ${redSuit(card.suit) ? 'red' : 'black'} ${selected ? 'selected' : ''} ${className}`} style={{ '--card-index': index } as React.CSSProperties} onClick={onClick}>{content}</button> : <div className={`playing-card ${redSuit(card.suit) ? 'red' : 'black'} ${className}`}>{content}</div>
}

function PlayerSetup({ onStart }: { onStart: (names: string[]) => void }) {
  const [names, setNames] = useState(['Player 1', 'Player 2'])
  const [error, setError] = useState('')
  const [showRules, setShowRules] = useState(false)
  const updateName = (index: number, value: string) => setNames((current) => current.map((name, i) => i === index ? value : name))
  return <main className="setup-screen">
    <header className="setup-header"><a className="brand" href="#home"><span className="brand-mark">L<span>♠</span></span><span>LEAST COUNT<small>THE CARD TABLE</small></span></a><span className="setup-local"><Shield size={14} /> LOCAL PASS-AND-PLAY</span></header>
    <section className="setup-content">
      <div className="setup-kicker"><span className="live-dot" /> PRIVATE TABLE · NO SIGN-UP</div>
      <h1>Gather around.<br /><em>Let the cards decide.</em></h1>
      <p className="setup-description">Add your players, pass the device between turns, and play a full round of Least Count together.</p>
      <div className="setup-card">
        <div className="setup-card-heading"><div><span className="eyebrow">NEW GAME</span><h2>Who&apos;s playing?</h2></div><span className="player-count">{names.length} / 8 <Users size={14} /></span></div>
        <div className="player-input-list">{names.map((name, index) => <div className="player-input-row" key={index}><span className={`setup-avatar tone-${index % 4}`}>{name.trim().charAt(0).toUpperCase() || index + 1}</span><label className="sr-only" htmlFor={`player-${index}`}>Player {index + 1} name</label><input id={`player-${index}`} maxLength={20} value={name} onChange={(event) => updateName(index, event.target.value)} placeholder={`Player ${index + 1}`} /><span className="seat-number">SEAT {String(index + 1).padStart(2, '0')}</span>{names.length > 2 && <button className="remove-player" type="button" aria-label={`Remove ${name || `player ${index + 1}`}`} onClick={() => setNames((current) => current.filter((_, i) => i !== index))}><X size={15} /></button>}</div>)}</div>
        <button className="add-player-button" type="button" onClick={() => names.length < 8 && setNames((current) => [...current, `Player ${current.length + 1}`])} disabled={names.length >= 8}><Plus size={15} /> ADD PLAYER <span>{8 - names.length} SEATS LEFT</span></button>
        {error && <p className="setup-error" role="alert">{error}</p>}
        <button className="start-game-button" type="button" onClick={() => { const cleanNames = names.map((name) => name.trim()); if (cleanNames.some((name) => !name)) { setError('Add a name for every seat before starting.'); return } if (new Set(cleanNames.map((name) => name.toLowerCase())).size !== cleanNames.length) { setError('Each player needs a unique name.'); return } onStart(cleanNames) }}>DEAL THE CARDS <ArrowRight size={17} /></button>
        <div className="setup-footnote"><span><Shield size={13} /> Cards stay private between turns</span><span>2–8 PLAYERS</span></div>
      </div>
      <div className="how-to-play"><div className="how-icon"><span>7</span><small>♦</small></div><p><strong>Quick rule</strong><br />Match the open card&apos;s rank to play without drawing. All cards of the round&apos;s wild rank score zero.</p><button type="button" aria-expanded={showRules} onClick={() => setShowRules((current) => !current)}>RULES <CircleHelp size={14} /></button></div>{showRules && <p className="setup-rules-note" role="note">On your turn, choose one card or any number of cards of the same rank. Click the open pile to play a matching rank without drawing. Otherwise, discard and draw from the open pile or closed deck. Wild-rank cards score zero. Keep your hand at five points or less to call Least Count.</p>}
    </section>
  </main>
}

function PlayerToken({ player, active, count }: { player: Player; active: boolean; count: number }) {
  const tone = player.id.split('-')[1] ?? '0'
  return <div className={`opponent-chip ${active ? 'active-opponent' : ''}`}><span className={`avatar tone-${Number(tone) % 4}`}>{player.name.charAt(0).toUpperCase()}</span><span className="opponent-info"><b>{player.name}</b><small>{player.eliminated ? 'OUT' : `${count} CARDS · ${player.total} PTS`}</small></span>{!player.eliminated && <span className="opponent-card-backs" aria-label={`${count} hidden cards`}>{Array.from({ length: Math.min(count, 3) }, (_, index) => <span key={index} className="playing-card card-back"><span className="back-pattern" /></span>)}</span>}{active && <span className="active-marker">UP</span>}</div>
}

function TurnHandoff({ player, onReady, first }: { player: Player; onReady: () => void; first: boolean }) {
  return <main className="handoff-screen"><div className="handoff-card"><div className="handoff-emblem"><Shield size={25} /></div><span className="eyebrow">{first ? 'ROUND STARTING' : 'PASS THE DEVICE'}</span><h1>{first ? `${player.name}, you lead.` : `Hand it to ${player.name}.`}</h1><p>Keep the cards hidden from the other players. When everyone else has looked away, {first ? 'start your turn' : 'reveal your hand'}.</p><div className="handoff-privacy"><span className="privacy-dot" /> PRIVATE HAND · {player.name.toUpperCase()}</div><button className="start-game-button" type="button" onClick={onReady}>{first ? 'START YOUR TURN' : 'I’M READY'} <ArrowRight size={17} /></button></div><div className="handoff-brand">LEAST COUNT <span>·</span> LOCAL PASS-AND-PLAY</div></main>
}

function RoundSummary({ game, onNext, onExit, exitLabel = 'EXIT TO LOBBY' }: { game: Game; onNext: () => void; onExit: () => void; exitLabel?: string }) {
  const winner = game.players.filter((player) => !player.eliminated).sort((a, b) => a.total - b.total)[0]
  const finished = !winner || game.players.filter((player) => !player.eliminated).length <= 1
  return <main className="summary-screen"><div className="summary-card"><span className="eyebrow">{finished ? 'GAME OVER' : `ROUND ${game.round} COMPLETE`}</span><h1>{finished ? `${winner?.name ?? 'No one'} wins.` : 'Cards on the table.'}</h1><p className="summary-subtitle">{finished ? 'The last player standing takes the table.' : `${game.players.find((player) => player.id === game.roundResult?.declarer)?.name} called Least Count ${game.roundResult?.successful ? 'and got it right.' : 'but missed.'}`}</p><div className="result-table"><div className="result-head"><span>PLAYER</span><span>REVEALED CARDS</span><span>HAND</span><span>ROUND</span><span>TOTAL</span></div>{game.players.map((player) => { const score = game.roundResult?.scores.find((item) => item.playerId === player.id); const revealedHand = game.hands[player.id] ?? []; return <div className={`result-row ${player.eliminated ? 'eliminated-row' : ''}`} key={player.id}><span>{player.name}{player.eliminated && <small> ELIMINATED</small>}</span><span className="revealed-cards">{revealedHand.map((card) => `${card.rank === 'JOKER' ? 'Joker' : card.rank}${card.suit}`).join(' · ') || 'Empty hand'}</span><span>{score?.handScore ?? '—'}</span><span>{score?.roundPoints ?? 0}</span><b>{player.total}</b></div> })}</div><div className="summary-actions"><button className="secondary-action" type="button" onClick={onExit}><ArrowLeft size={15} /> {exitLabel}</button><button className="start-game-button" type="button" onClick={onNext} disabled={finished}>NEXT ROUND <ArrowRight size={16} /></button></div></div></main>
}

function GameTable({ game, onGameChange, onEndRound, onEndGame, onExit, roomCode, error, viewerId, isHost }: { game: Game; onGameChange: (game: Game, handoff: boolean) => void; onEndRound: (game: Game) => void; onEndGame?: () => void; onExit: () => void; roomCode?: string; error?: string; viewerId?: string | null; isHost?: boolean }) {
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [notice, setNotice] = useState('Choose one card, or several cards of the same rank.')
  const [showConfirm, setShowConfirm] = useState(false)
  const [showEndConfirm, setShowEndConfirm] = useState(false)
  const turnPlayer = game.players.find((item) => item.id === game.currentPlayerId)!
  const player = game.players.find((item) => item.id === (viewerId ?? game.currentPlayerId)) ?? turnPlayer
  const isYourTurn = player.id === game.currentPlayerId
  const hand = game.hands[player.id] ?? []
  const selected = hand.filter((card) => selectedIds.includes(card.id))
  const score = handScore(hand, game.jokerRank)
  const openCard = game.discardPile.at(-1)
  const visibleOpponents = game.players.filter((item) => item.id !== player.id)
  const selectedRank = selected[0]?.rank
  const handGroups = useMemo(() => {
    const map = new Map<string, number>()
    hand.forEach((card) => map.set(card.rank, (map.get(card.rank) ?? 0) + 1))
    return map
  }, [hand])

  function toggleCard(card: Card) {
    if (!isYourTurn || game.awaitingDraw) return
    if (selectedIds.includes(card.id)) {
      setSelectedIds((current) => current.filter((id) => id !== card.id))
      setNotice(`${card.rank} deselected.`)
      return
    }
    if (selectedIds.some((id) => hand.find((item) => item.id === id)?.rank !== card.rank)) {
      setNotice('Play cards of one rank together. Deselect the other rank first.')
      return
    }
    setSelectedIds((current) => [...current, card.id])
    setNotice(handGroups.get(card.rank)! > 1 ? `You have ${handGroups.get(card.rank)} ${card.rank}s. Select matching cards together if you wish.` : `${card.rank} selected. Choose the open pile or closed deck.`)
  }

  function choosePile(source: 'open' | 'closed') {
    if (!isYourTurn) return
    if (!selected.length) { setNotice('Select at least one card from your hand first.'); return }
    if (source === 'closed' && openCard?.rank === selected[0].rank) { setNotice('That rank matches the open card. Click the open pile to play it without drawing.'); return }
    let updated = discardCards(game, player.id, selectedIds)
    if (updated === game) { setNotice('That play is not available. Select a valid set of matching cards.'); return }
    const matched = !updated.awaitingDraw
    if (updated.awaitingDraw) updated = source === 'open' ? drawFromOpen(updated, player.id) : drawFromClosed(updated, player.id)
    setSelectedIds([])
    setNotice(matched ? `${selected.length} matching ${selected[0].rank}${selected.length === 1 ? '' : 's'} played. No draw needed.` : source === 'open' ? `You took the previous open card (${game.previousOpenCard?.rank}${game.previousOpenCard?.suit}) into your hand.` : 'You discarded and drew the top card from the closed deck.')
    onGameChange(updated, !updated.awaitingDraw)
  }

  function declareLeastCount() {
    if (roomCode) {
      if (score > 5) { setNotice('Your hand must total 5 points or less before calling Least Count.'); setShowConfirm(false); return }
      setShowConfirm(false)
      onEndRound(game)
      return
    }
    const updated = scoreRound(game, player.id)
    if (!updated.roundResult) { setNotice('Your hand must total 5 points or less before calling Least Count.'); setShowConfirm(false); return }
    setShowConfirm(false)
    onEndRound(updated)
  }

  return <main className="game-shell">
    <div className="landscape-prompt" role="status"><RotateCw className="landscape-icon" aria-hidden="true" /><span className="eyebrow">A LITTLE MORE ROOM</span><h1>Turn your phone sideways</h1><p>Least Count is best played in landscape. Rotate your device to see the full table and your cards.</p></div>
    <header className="topbar"><a className="brand" href="#home" aria-label="Least Count home"><span className="brand-mark">L<span>♠</span></span><span>LEAST COUNT<small>{roomCode ? 'ONLINE TABLE' : 'LOCAL PASS-AND-PLAY'}</small></span></a><div className="room-meta"><span className="live-dot" /> {game.players.length} PLAYERS <b>·</b> <span>ROUND {String(game.round).padStart(2, '0')}</span><span className="room-code">{roomCode ? `ROOM ${roomCode}` : `TABLE ${String(game.startingPlayerIndex + 1).padStart(2, '0')}`}</span></div><button className="exit-game" type="button" onClick={onExit}><ArrowLeft size={14} /> LOBBY</button></header>
    <div className="game-layout"><section className="table-column" aria-label="Game table"><div className="round-strip"><span className="round-pill">ROUND {String(game.round).padStart(2, '0')}</span><span className="round-note">First to 101 is out <span>·</span> Last player standing wins</span><span className="active-turn-label"><span className="pulse-dot" /> {turnPlayer.name.toUpperCase()}’S TURN</span></div>
      <div className="felt-table"><div className="table-inner-line" />
        <div className={`opponent-roster opponent-count-${visibleOpponents.length}`}>{visibleOpponents.map((other, index) => <PlayerToken key={other.id} player={other} active={other.id === game.currentPlayerId} count={game.hands[other.id]?.length ?? 0} />)}</div>
        <div className="table-center"><div className="table-caption" role={error ? 'alert' : 'status'}><span className="pulse-dot" /> {error || (isYourTurn ? notice : `${turnPlayer.name} is playing. Your hand is shown only to you.`)}</div><div className="play-area">
          <button type="button" className={`deck-stack pile-button ${selected.length ? 'pile-ready' : ''}`} aria-label={`Closed deck, ${game.drawPile.length} cards`} onClick={() => choosePile('closed')}><span className="deck-card deck-under" /><span className="deck-card deck-middle" /><span className="playing-card card-back deck-top"><span className="back-pattern" /></span><span className="pile-label">CLOSED DECK <b>{game.drawPile.length}</b></span></button>
          <button type="button" className={`discard-slot pile-button ${selected.length ? 'pile-ready' : ''}`} aria-label={`Open discard pile, ${game.discardPile.length} cards`} onClick={() => choosePile('open')}><PlayingCard card={openCard} className="discard-card" /><span className="pile-label">OPEN PILE <b>{game.discardPile.length}</b></span></button>
        </div><div className="joker-indicator"><span className="joker-label">WILD RANK</span><span className="joker-card">{game.jokerRank === 'JOKER' ? '★' : game.jokerRank}<span>♦</span></span><span className="joker-copy">All {game.jokerRank === 'JOKER' ? 'printed jokers' : `${game.jokerRank}s`} are <b>zero</b></span></div></div>
        <div className="current-seat"><div className="your-tag"><span className="your-live" /> {player.name.toUpperCase()} · {score} POINTS</div><div className="player-heading"><span className="avatar tone-0">{player.name.charAt(0).toUpperCase()}</span><span className="player-name">{player.name} <small>PLAYING</small></span><span className="score-badge">{player.total} total</span></div><div className="hand-fan" aria-label={`${player.name}'s hand, ${hand.length} cards`}>{hand.map((card, index) => <PlayingCard key={card.id} card={card} index={index} selected={selectedIds.includes(card.id)} onClick={() => toggleCard(card)} />)}</div></div>
      </div>
      <div className="action-row"><div className="turn-timer"><span className="timer-icon">◷</span><span>YOUR HAND <b>{score} PTS</b>{selected.length > 0 && <em> · {selected.length} SELECTED{selectedRank ? ` · ${selectedRank}` : ''}</em>}</span></div><div className="action-buttons"><button className="least-button" type="button" onClick={() => setShowConfirm(true)} disabled={!isYourTurn || score > 5 || game.awaitingDraw}><Crown size={16} /> LEAST COUNT <span className="score-chip">≤ 5</span></button></div></div>
    </section><aside className="score-panel"><div className="panel-heading"><div><span className="eyebrow">LIVE TABLE</span><h1>Scoreboard</h1></div><span className="players-total">{visibleOpponents.length + 1} SEATS</span></div><div className="players-head"><span>PLAYER</span><span>CARDS</span><span>TOTAL</span></div><div className="score-list">{game.players.map((item) => <div className={`score-row ${item.id === player.id ? 'is-you' : ''} ${item.eliminated ? 'eliminated-row' : ''}`} key={item.id}><span className={`avatar tone-${Number(item.id.split('-')[1] ?? 0) % 4}`}>{item.name.charAt(0).toUpperCase()}</span><span className="score-name">{item.name}{item.id === game.currentPlayerId && <small>UP NOW</small>}</span><span className="round-score">{game.hands[item.id]?.length ?? 'OUT'}</span><strong>{item.total}</strong></div>)}</div><div className="activity"><div className="activity-title">TURN ORDER <span>ROUND {game.round}</span></div>{game.players.filter((item) => !item.eliminated).map((item, index) => <p key={item.id}><i className={`activity-dot ${item.id === game.currentPlayerId ? 'green' : index === 0 ? 'gold' : 'gray'}`} /> <b>{item.name}</b>{item.id === player.id ? ' is playing now' : ` · ${game.hands[item.id]?.length ?? 0} cards`}</p>)}</div><div className="table-footer"><span>{game.drawPile.length} CARDS LEFT IN DECK</span><span>·</span><button type="button" onClick={roomCode && isHost && onEndGame ? () => setShowEndConfirm(true) : onExit}>{roomCode && !isHost ? 'LEAVE GAME' : 'END GAME'} <span>↗</span></button></div></aside></div>
    {showConfirm && <div className="modal-backdrop" role="presentation"><section className="confirm-dialog" role="dialog" aria-modal="true" aria-labelledby="least-title"><button className="dialog-close" type="button" onClick={() => setShowConfirm(false)} aria-label="Close"><X size={17} /></button><span className="eyebrow">CALL YOUR HAND</span><h2 id="least-title">Declare Least Count?</h2><p>Your hand is worth <strong>{score} points</strong>. Everyone&apos;s cards will be revealed and scored.</p><div className="dialog-actions"><button className="secondary-action" type="button" onClick={() => setShowConfirm(false)}>KEEP PLAYING</button><button className="start-game-button" type="button" onClick={declareLeastCount}>CONFIRM <Check size={15} /></button></div></section></div>}
    {showEndConfirm && <div className="modal-backdrop" role="presentation"><section className="confirm-dialog" role="dialog" aria-modal="true" aria-labelledby="end-game-title"><button className="dialog-close" type="button" onClick={() => setShowEndConfirm(false)} aria-label="Close end game confirmation"><X size={17} /></button><span className="eyebrow">HOST ACTION</span><h2 id="end-game-title">End game for everyone?</h2><p>Every player will leave the active game, and no one will be able to continue this room.</p><div className="dialog-actions"><button className="secondary-action" type="button" onClick={() => setShowEndConfirm(false)}>KEEP PLAYING</button><button className="start-game-button" type="button" onClick={() => { setShowEndConfirm(false); onEndGame?.() }}>END GAME</button></div></section></div>}
  </main>
}

function LocalLeastCountGame() {
  const [screen, setScreen] = useState<Screen>('setup')
  const [game, setGame] = useState<Game | null>(null)
  const [firstHandoff, setFirstHandoff] = useState(true)
  const activePlayer = game?.players.find((player) => player.id === game.currentPlayerId)

  function start(names: string[]) {
    setGame(beginGame(names))
    setFirstHandoff(true)
    setScreen('handoff')
  }
  function updateGame(next: Game, handoff: boolean) {
    setGame(next)
    setFirstHandoff(false)
    setScreen(handoff ? 'handoff' : 'table')
  }
  function closeRound(next: Game) { setGame(next); setScreen('round') }
  function beginNextRound() {
    if (!game) return
    const next = nextRound(game)
    if (!next) { setScreen('winner'); return }
    setGame(next)
    setFirstHandoff(true)
    setScreen('handoff')
  }
  function returnToSetup() { setGame(null); setScreen('setup'); setFirstHandoff(true) }

  if (screen === 'setup' || !game) return <PlayerSetup onStart={start} />
  if ((screen === 'handoff' || screen === 'winner') && activePlayer && !game.roundResult) return <TurnHandoff player={activePlayer} first={firstHandoff} onReady={() => { setFirstHandoff(false); setScreen('table') }} />
  if (screen === 'round' || screen === 'winner' || game.roundResult) return <RoundSummary game={game} onNext={beginNextRound} onExit={returnToSetup} />
  if (screen === 'handoff' && activePlayer) return <TurnHandoff player={activePlayer} first={firstHandoff} onReady={() => { setFirstHandoff(false); setScreen('table') }} />
  return <GameTable game={game} onGameChange={updateGame} onEndRound={closeRound} onExit={returnToSetup} />
}

type RoomPlayer = { id: string; name: string; isHost: boolean }
type OnlineRoom = { roomCode: string; status: 'lobby' | 'playing' | 'ended'; players: RoomPlayer[]; revision: number; game: Game | null; viewerId: string | null; isHost: boolean }

function createPlayerCredentials() {
  const token = crypto.randomUUID()
  return { playerToken: token, playerId: `player-${crypto.randomUUID()}` }
}

function getRoomErrorMessage(reason: unknown, fallback: string) {
  if (!(reason instanceof Error)) return fallback
  return reason.message.match(/Uncaught Error:\s*(.*?)(?:\s+at handler|$)/)?.[1]?.trim() || reason.message
}

function OnlineSetup({
  initialRoomCode,
  onCreate,
  onJoin,
  onLocal,
  players,
  joiningStarted,
  error,
}: {
  initialRoomCode: string
  onCreate: (name: string) => Promise<void>
  onJoin: (name: string, code: string) => Promise<void>
  onLocal: () => void
  players?: RoomPlayer[]
  joiningStarted?: boolean
  error: string
}) {
  const [name, setName] = useState('')
  const [code, setCode] = useState(initialRoomCode)
  const [busy, setBusy] = useState(false)
  const [localError, setLocalError] = useState('')
  async function submit(action: 'create' | 'join') {
    if (busy) return
    if (!name.trim()) { setLocalError('Enter your name first.'); return }
    setLocalError('')
    setBusy(true)
    try {
      if (action === 'create') await onCreate(name.trim())
      else await onJoin(name.trim(), code)
    } finally {
      setBusy(false)
    }
  }
  return <main className="setup-screen">
    <header className="setup-header"><a className="brand" href="#home"><span className="brand-mark">L<span>♠</span></span><span>LEAST COUNT<small>THE CARD TABLE</small></span></a><span className="setup-local"><span className="live-dot" /> ONLINE ROOMS</span></header>
    <section className="setup-content online-setup-content">
      <div className="setup-kicker"><span className="live-dot" /> PLAY TOGETHER · SHARE A ROOM LINK</div>
      <h1>Same table.<br /><em>Different places.</em></h1>
      <p className="setup-description">Create a private room or join one with your friend&apos;s code.</p>
      <div className="setup-card online-card">
        <span className="eyebrow">{joiningStarted ? 'JOIN YOUR FRIEND' : initialRoomCode ? 'ROOM INVITATION' : 'START A MULTIPLAYER TABLE'}</span>
        <h2>{joiningStarted ? 'You’re almost at the table.' : initialRoomCode ? `Room ${initialRoomCode}` : 'What should we call you?'}</h2>
        <label className="online-field-label" htmlFor="online-name">YOUR NAME</label>
        <input className="online-field" id="online-name" maxLength={20} value={name} onChange={(event) => setName(event.target.value)} placeholder="Enter your name" autoComplete="nickname" />
        {joiningStarted && <div className="room-player-preview" aria-live="polite">{players?.map((player) => <span key={player.id}>{player.name}{player.isHost ? ' · HOST' : ''}</span>)}</div>}
        {(initialRoomCode || !joiningStarted) && <><label className="online-field-label" htmlFor="room-code">ROOM CODE</label><input className="online-field room-id-field" id="room-code" maxLength={8} value={code} onChange={(event) => setCode(event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))} autoCapitalize="characters" autoComplete="off" placeholder="Enter room code" /></>}
        {(error || localError) && <p className="setup-error" role="alert">{localError || error}</p>}
        {!joiningStarted && !initialRoomCode && <div className="room-action-row"><button className="start-game-button online-primary-button" type="button" disabled={busy} onClick={() => void submit('create')}>CREATE ROOM <ArrowRight size={17} /></button><button className="secondary-action code-join-button" type="button" disabled={busy} onClick={() => void submit('join')}>{busy ? 'JOINING…' : 'JOIN WITH CODE'} <ArrowRight size={15} /></button></div>}
        {(initialRoomCode || joiningStarted) && <button className="start-game-button online-primary-button" type="button" disabled={busy || Boolean(joiningStarted && players?.length === 8)} onClick={() => void submit('join')}>{busy ? 'JOINING…' : 'JOIN ROOM'} <ArrowRight size={17} /></button>}
        {!joiningStarted && !initialRoomCode && <div className="setup-footnote"><span><Shield size={13} /> No account needed</span><span>2–8 PLAYERS</span></div>}
      </div>
      <button type="button" className="local-mode-link" onClick={onLocal}>Or play on one device with pass-and-play</button>
    </section>
  </main>
}

function RoomLobby({ room, inviteLink, onStart, onLeave, onCopy, error }: { room: OnlineRoom; inviteLink: string; onStart: () => void; onLeave: () => void; onCopy: () => void; error: string }) {
  return <main className="setup-screen"><header className="setup-header"><a className="brand" href="#home"><span className="brand-mark">L<span>♠</span></span><span>LEAST COUNT<small>ONLINE LOBBY</small></span></a><span className="setup-local"><span className="live-dot" /> ROOM OPEN</span></header>
    <section className="setup-content online-setup-content"><div className="setup-kicker"><span className="live-dot" /> ROOM {room.roomCode} · {room.players.length} / 8 PLAYERS</div><h1>Invite your<br /><em>tablemates.</em></h1><p className="setup-description">Send this link to your friend. Their seat will appear here as soon as they join.</p>
      <div className="setup-card online-card"><div className="setup-card-heading"><div><span className="eyebrow">ROOM {room.roomCode}</span><h2>{room.players.length === 1 ? 'Waiting for players' : 'Ready to deal?'}</h2></div><span className="player-count"><Users size={14} /> {room.players.length} / 8</span></div>
        <div className="lobby-player-list">{room.players.map((player, index) => <div className="lobby-player" key={player.id}><span className={`setup-avatar tone-${index % 4}`}>{player.name.charAt(0).toUpperCase()}</span><span>{player.name}<small>{player.isHost ? 'HOST' : 'JOINED'}</small></span><span className="lobby-connected"><i /> CONNECTED</span></div>)}</div>
        {error && <p className="setup-error" role="alert">{error}</p>}
        <label className="online-field-label" htmlFor="invite-url">INVITE LINK</label><div className="invite-link-row"><input id="invite-url" className="online-field" readOnly value={inviteLink} onFocus={(event) => event.currentTarget.select()} /><button className="copy-invite-button" type="button" onClick={onCopy}><Clipboard size={15} /> COPY</button></div>
        {room.isHost && <button className="start-game-button online-primary-button" type="button" onClick={onStart} disabled={room.players.length < 2}>DEAL THE CARDS <ArrowRight size={17} /></button>}
        {!room.isHost && <p className="waiting-copy" aria-live="polite">Waiting for {room.players.find((player) => player.isHost)?.name ?? 'the host'} to start the game…</p>}
        <button className="local-mode-link lobby-leave" type="button" onClick={onLeave}>Leave room</button>
      </div>
    </section></main>
}

function MultiplayerGame({ initialRoomCode, onPlayLocal }: { initialRoomCode: string; onPlayLocal: () => void }) {
  const [roomCode, setRoomCode] = useState(initialRoomCode.trim().toUpperCase())
  const [playerToken, setPlayerToken] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)
  const [origin, setOrigin] = useState('')
  const room = useQuery(api.rooms.getRoom, roomCode ? { roomCode, playerToken: playerToken ?? undefined } : 'skip') as OnlineRoom | null | undefined
  const createRoom = useMutation(api.rooms.createRoom)
  const joinRoom = useMutation(api.rooms.joinRoom)
  const startGame = useMutation(api.rooms.startGame)
  const updateGame = useMutation(api.rooms.updateGame)
  const endRound = useMutation(api.rooms.endRound)
  const endGame = useMutation(api.rooms.endGame)

  useEffect(() => {
    setOrigin(window.location.origin)
    if (!initialRoomCode) return
    const token = window.sessionStorage.getItem(`least-count:${initialRoomCode.toUpperCase()}`)
    if (token) setPlayerToken(token)
  }, [initialRoomCode])

  function savePlayer(code: string, token: string) {
    window.sessionStorage.setItem(`least-count:${code}`, token)
    setPlayerToken(token)
    setRoomCode(code)
    window.history.replaceState(null, '', `/?room=${encodeURIComponent(code)}`)
  }

  async function handleCreate(name: string) {
    setError('')
    const credentials = createPlayerCredentials()
    try {
      const code = await createRoom({ ...credentials, name })
      savePlayer(code, credentials.playerToken)
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not create the room. Try again.') }
  }

  async function handleJoin(name: string, code: string) {
    setError('')
    if (!code.trim()) { setError('Enter a room ID or open your friend’s invite link.'); return }
    const normalizedCode = code.trim().toUpperCase()
    const credentials = createPlayerCredentials()
    try {
      await joinRoom({ ...credentials, name, roomCode: normalizedCode })
      savePlayer(normalizedCode, credentials.playerToken)
    } catch (reason) { setError(getRoomErrorMessage(reason, 'Could not join the room. Try again.')) }
  }

  async function handleEndGame() {
    if (!room || !playerToken) return
    setError('')
    try { await endGame({ roomCode: room.roomCode, playerToken }) }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not end the game for everyone.') }
  }

  async function handleStart() {
    if (!room || !room.isHost || room.players.length < 2) return
    setError('')
    const game = startRound(room.players.map((player) => ({ id: player.id, name: player.name, total: 0, eliminated: false, roundPoints: 0 })), 1, 0)
    try { await startGame({ roomCode: room.roomCode, playerToken: playerToken!, game }) }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not start the game.') }
  }

  async function commitGame(game: Game) {
    if (!room || !playerToken) return
    try { await updateGame({ roomCode: room.roomCode, playerToken, expectedRevision: room.revision, game }) }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'The game did not sync. Try that move again.') }
  }

  function leaveRoom() {
    if (roomCode) window.sessionStorage.removeItem(`least-count:${roomCode}`)
    setRoomCode('')
    setPlayerToken(null)
    setError('')
    window.history.replaceState(null, '', '/')
  }

  if (!roomCode) return <OnlineSetup initialRoomCode="" onCreate={handleCreate} onJoin={handleJoin} onLocal={onPlayLocal} error={error} />
  if (room === undefined) return <main className="handoff-screen"><div className="handoff-card"><span className="eyebrow">CONNECTING TO ROOM</span><h1>Finding your table…</h1><p>Syncing room and player seats.</p></div></main>
  if (!room) return <OnlineSetup initialRoomCode={roomCode} onCreate={handleCreate} onJoin={handleJoin} onLocal={onPlayLocal} error={error || 'Room not found. Check the room ID and try again.'} />
  if (room.status === 'ended') return <main className="handoff-screen"><div className="handoff-card" role="status" aria-live="polite"><span className="eyebrow">ROOM CLOSED</span><h1>The host ended this game.</h1><p>This table is closed for every player. Start a new room to play again.</p><button className="secondary-action" type="button" onClick={leaveRoom}><ArrowLeft size={15} /> RETURN TO HOME</button></div></main>
  if (!room.viewerId) {
    if (room.status === 'playing') return <main className="handoff-screen"><div className="handoff-card"><span className="eyebrow">GAME IN PROGRESS</span><h1>This table is already playing.</h1><p>New seats can only join before the host deals the cards.</p><button className="secondary-action" type="button" onClick={leaveRoom}><ArrowLeft size={15} /> BACK TO LOBBY</button></div></main>
    return <OnlineSetup initialRoomCode={room.roomCode} onCreate={handleCreate} onJoin={handleJoin} onLocal={onPlayLocal} players={room.players} joiningStarted error={error} />
  }
  if (room.status === 'lobby' || !room.game) return <RoomLobby room={room} inviteLink={`${origin}/?room=${room.roomCode}`}  onStart={handleStart} onLeave={leaveRoom} onCopy={() => { void navigator.clipboard.writeText(`${window.location.origin}/?room=${room.roomCode}`).then(() => { setCopied(true); window.setTimeout(() => setCopied(false), 1600) }) }} error={copied ? 'Invite link copied.' : error} />

  const game = room.game
  const activePlayer = game.players.find((player) => player.id === game.currentPlayerId)
  if (!activePlayer) return <main className="handoff-screen"><div className="handoff-card"><span className="eyebrow">ROOM ERROR</span><h1>Couldn’t load this game.</h1><button className="secondary-action" type="button" onClick={leaveRoom}>RETURN TO LOBBY</button></div></main>
  if (game.roundResult) return <RoundSummary game={game} onNext={() => {
    const next = nextRound(game)
    if (next) void commitGame(next)
  }} onExit={() => { if (room.isHost) void handleEndGame(); else leaveRoom() }} exitLabel={room.isHost ? 'END GAME FOR EVERYONE' : 'EXIT TO LOBBY'} />
  return <GameTable game={game} viewerId={room.viewerId} roomCode={room.roomCode} isHost={room.isHost} onGameChange={(next) => void commitGame(next)} onEndRound={() => { void endRound({ roomCode: room.roomCode, playerToken: playerToken!, expectedRevision: room.revision }).catch((reason) => setError(reason instanceof Error ? reason.message : 'Could not score the round.')) }} onEndGame={() => void handleEndGame()} onExit={leaveRoom} error={error} />
}

export function LeastCountGame({ initialRoomCode = '' }: { initialRoomCode?: string }) {
  const convexAvailable = useConvexAvailability()
  const [playLocal, setPlayLocal] = useState(false)
  if (!convexAvailable || playLocal) return <LocalLeastCountGame />
  return <MultiplayerGame initialRoomCode={initialRoomCode} onPlayLocal={() => setPlayLocal(true)} />
}
