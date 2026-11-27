export const SUITS = ['♣', '♦', '♥', '♠'] as const
export const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'] as const

export type Suit = (typeof SUITS)[number]
export type Rank = (typeof RANKS)[number] | 'JOKER'
export type Card = { id: string; rank: Rank; suit: Suit | '★'; deck: number }
export type Player = { id: string; name: string; total: number; eliminated: boolean; roundPoints: number; left?: boolean }
export type Game = {
  players: Player[]
  hands: Record<string, Card[]>
  drawPile: Card[]
  discardPile: Card[]
  jokerRank: Rank
  round: number
  startingPlayerIndex: number
  currentPlayerId: string
  awaitingDraw: boolean
  previousOpenCard: Card | null
  roundResult: { declarer: string; successful: boolean; scores: Array<{ playerId: string; handScore: number; roundPoints: number }> } | null
}

let nextId = 0
const newId = () => `card-${++nextId}-${Math.random().toString(36).slice(2, 7)}`

export function createDeck(playerCount: number): Card[] {
  const deckCount = playerCount >= 5 ? 2 : 1
  const cards: Card[] = []
  for (let deck = 0; deck < deckCount; deck++) {
    for (const suit of SUITS) {
      for (const rank of RANKS) cards.push({ id: newId(), rank, suit, deck })
    }
    for (let joker = 0; joker < 2; joker++) cards.push({ id: newId(), rank: 'JOKER', suit: '★', deck })
  }
  for (let i = cards.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[cards[i], cards[j]] = [cards[j], cards[i]]
  }
  return cards
}

export function cardPoints(card: Card, jokerRank: Rank): number {
  if (card.rank === 'JOKER' || card.rank === jokerRank) return 0
  if (card.rank === 'A') return 1
  if (card.rank === 'J') return 11
  if (card.rank === 'Q') return 12
  if (card.rank === 'K') return 13
  return Number(card.rank)
}

export function handScore(hand: Card[], jokerRank: Rank): number {
  return hand.reduce((score, card) => score + cardPoints(card, jokerRank), 0)
}

function activePlayers(players: Player[]) {
  return players.filter((player) => !player.eliminated)
}

function nextActivePlayer(players: Player[], currentId: string): Player {
  const active = activePlayers(players)
  const currentIndex = active.findIndex((player) => player.id === currentId)
  return active[(currentIndex + 1) % active.length]
}

export function startRound(players: Player[], round: number, startingPlayerIndex: number): Game {
  const active = activePlayers(players)
  const deck = createDeck(active.length)
  const jokerCard = deck.pop()!
  const openCard = deck.pop()!
  const hands: Record<string, Card[]> = Object.fromEntries(active.map((player) => [player.id, []]))
  for (let card = 0; card < 7; card++) {
    for (const player of active) hands[player.id].push(deck.pop()!)
  }
  const start = active[startingPlayerIndex % active.length]
  return {
    players: players.map((player) => ({ ...player, roundPoints: 0 })),
    hands,
    drawPile: deck,
    discardPile: [openCard],
    jokerRank: jokerCard.rank,
    round,
    startingPlayerIndex,
    currentPlayerId: start.id,
    awaitingDraw: false,
    previousOpenCard: null,
    roundResult: null,
  }
}

export function beginGame(names: string[]): Game {
  const players = names.map((name, index) => ({
    id: `player-${index}-${Math.random().toString(36).slice(2, 7)}`,
    name: name.trim() || `Player ${index + 1}`,
    total: 0,
    eliminated: false,
    roundPoints: 0,
  }))
  return startRound(players, 1, 0)
}

export function discardCards(game: Game, playerId: string, cardIds: string[]) {
  if (game.roundResult || game.awaitingDraw || game.currentPlayerId !== playerId || cardIds.length === 0) return game
  const hand = game.hands[playerId]
  const selected = hand.filter((card) => cardIds.includes(card.id))
  if (selected.length !== cardIds.length || selected.some((card) => card.rank !== selected[0].rank)) return game

  const previousOpenCard = game.discardPile.at(-1) ?? null
  const newHand = hand.filter((card) => !cardIds.includes(card.id))
  const discardPile = [...game.discardPile, ...selected]
  const matchingOpen = previousOpenCard?.rank === selected[0].rank
  const hands = { ...game.hands, [playerId]: newHand }

  if (matchingOpen) {
    return { ...game, hands, discardPile, currentPlayerId: nextActivePlayer(game.players, playerId).id }
  }

  return { ...game, hands, discardPile, awaitingDraw: true, previousOpenCard }
}

export function drawFromClosed(game: Game, playerId: string): Game {
  if (!game.awaitingDraw || game.currentPlayerId !== playerId) return game
  let drawPile = [...game.drawPile]
  let discardPile = [...game.discardPile]
  if (!drawPile.length && discardPile.length > 1) {
    const top = discardPile.pop()!
    drawPile = discardPile
    for (let i = drawPile.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[drawPile[i], drawPile[j]] = [drawPile[j], drawPile[i]]
    }
    discardPile = [top]
  }
  if (!drawPile.length) return finishTurn({ ...game, awaitingDraw: false, previousOpenCard: null, discardPile })
  const card = drawPile.pop()!
  const hands = { ...game.hands, [playerId]: [...game.hands[playerId], card] }
  return finishTurn({ ...game, hands, drawPile, discardPile, awaitingDraw: false, previousOpenCard: null })
}

export function drawFromOpen(game: Game, playerId: string): Game {
  if (!game.awaitingDraw || game.currentPlayerId !== playerId || !game.previousOpenCard) return game
  const previousIndex = game.discardPile.findIndex((card) => card.id === game.previousOpenCard?.id)
  if (previousIndex < 0) return game
  const discardPile = game.discardPile.filter((card) => card.id !== game.previousOpenCard?.id)
  const hands = { ...game.hands, [playerId]: [...game.hands[playerId], game.previousOpenCard] }
  return finishTurn({ ...game, hands, discardPile, awaitingDraw: false, previousOpenCard: null })
}

function finishTurn(game: Game): Game {
  return { ...game, currentPlayerId: nextActivePlayer(game.players, game.currentPlayerId).id }
}

export function scoreRound(game: Game, declarerId: string): Game {
  if (game.roundResult || game.awaitingDraw || game.currentPlayerId !== declarerId) return game
  const declarerHand = game.hands[declarerId] ?? []
  const declarerScore = handScore(declarerHand, game.jokerRank)
  if (declarerScore > 5) return game
  const active = activePlayers(game.players)
  const handScores = active.map((player) => ({ playerId: player.id, handScore: handScore(game.hands[player.id] ?? [], game.jokerRank) }))
  const lowerThanAll = handScores.every((score) => score.playerId === declarerId || score.handScore > declarerScore)
  const lowest = Math.min(...handScores.map((score) => score.handScore))
  const scores = handScores.map((score) => ({
    ...score,
    roundPoints: lowerThanAll && score.playerId === declarerId ? 0 : !lowerThanAll && score.playerId === declarerId ? 40 : !lowerThanAll && score.handScore === lowest ? 0 : score.handScore,
  }))
  const players = game.players.map((player) => {
    const result = scores.find((score) => score.playerId === player.id)
    const total = player.total + (result?.roundPoints ?? 0)
    return { ...player, total, roundPoints: result?.roundPoints ?? 0, eliminated: player.eliminated || total >= 101 }
  })
  return { ...game, players, roundResult: { declarer: declarerId, successful: lowerThanAll, scores } }
}

export function nextRound(game: Game): Game | null {
  const active = activePlayers(game.players)
  if (active.length <= 1) return null
  const start = (game.startingPlayerIndex + 1) % active.length
  return startRound(game.players, game.round + 1, start)
}
