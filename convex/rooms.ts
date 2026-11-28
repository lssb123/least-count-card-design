import { mutation, query } from './_generated/server'
import { v } from 'convex/values'

const playerArgs = {
  playerId: v.string(),
  playerToken: v.string(),
}

function normalizeCode(code: string) {
  return code.trim().toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8)
}

function getPlayer(room: { players: Array<{ id: string; name: string; token: string; isHost: boolean }> }, token: string) {
  return room.players.find((player) => player.token === token)
}

function nextPlayerAfterLeaving(players: any[], playerId: string) {
  const index = players.findIndex((player) => player.id === playerId)
  for (let offset = 1; offset < players.length; offset++) {
    const candidate = players[(index + offset) % players.length]
    if (!candidate.eliminated && !candidate.left) return candidate.id
  }
  return undefined
}

function validateGame(game: any, players: Array<{ id: string }>) {
  if (!game || typeof game !== 'object' || !Array.isArray(game.players) || !game.hands || typeof game.hands !== 'object') {
    throw new Error('The game state is invalid.')
  }
  if (game.players.length !== players.length || game.players.some((player: any) => !players.some((seat) => seat.id === player.id))) {
    throw new Error('The game seats do not match this room.')
  }
  if (JSON.stringify(game).length > 60000) throw new Error('The game state is too large.')
}

export const createRoom = mutation({
  args: { ...playerArgs, name: v.string() },
  returns: v.string(),
  handler: async (ctx, args) => {
    const name = args.name.trim().slice(0, 20)
    if (!name || args.playerToken.length < 20 || args.playerId.length < 8) throw new Error('Enter a player name to create a room.')

    for (let attempt = 0; attempt < 5; attempt++) {
      const roomCode = Math.random().toString(36).slice(2, 8).toUpperCase()
      const existing = await ctx.db.query('rooms').withIndex('by_room_code', (q) => q.eq('roomCode', roomCode)).unique()
      if (existing) continue
      await ctx.db.insert('rooms', {
        roomCode,
        status: 'lobby',
        players: [{ id: args.playerId, name, token: args.playerToken, isHost: true }],
        revision: 0,
        createdAt: Date.now(),
      })
      return roomCode
    }
    throw new Error('Could not create a unique room. Please try again.')
  },
})

export const getRoom = query({
  args: { roomCode: v.string(), playerToken: v.optional(v.string()) },
  returns: v.any(),
  handler: async (ctx, args) => {
    const roomCode = normalizeCode(args.roomCode)
    if (!roomCode) return null
    const room = await ctx.db.query('rooms').withIndex('by_room_code', (q) => q.eq('roomCode', roomCode)).unique()
    if (!room) return null

    const viewer = args.playerToken ? getPlayer(room, args.playerToken) : undefined
    if (args.playerToken && !viewer) throw new Error('This player link is no longer valid. Rejoin the room.')
    const game = viewer && room.game
      ? {
          ...room.game,
          hands: Object.fromEntries(Object.entries(room.game.hands ?? {}).map(([playerId, hand]: [string, any]) => [
            playerId,
            playerId === viewer.id || room.game.roundResult
              ? hand
              : hand.map((_: unknown, index: number) => ({ id: `hidden-${playerId}-${index}`, rank: '?', suit: '?', deck: 0 })),
          ])),
        }
      : null

    return {
      roomCode: room.roomCode,
      status: room.status,
      players: room.players.map(({ id, name, isHost }) => ({ id, name, isHost })),
      revision: room.revision,
      game,
      viewerId: viewer?.id ?? null,
      isHost: viewer?.isHost ?? false,
    }
  },
})

export const joinRoom = mutation({
  args: { ...playerArgs, roomCode: v.string(), name: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const roomCode = normalizeCode(args.roomCode)
    const room = await ctx.db.query('rooms').withIndex('by_room_code', (q) => q.eq('roomCode', roomCode)).unique()
    if (!room) throw new Error('Room not found. Check the room code and try again.')
    if (room.status === 'ended') throw new Error('This room has ended. Ask the host for a new room code.')
    if (room.status !== 'lobby') throw new Error('This game has already started.')
    if (room.players.length >= 8) throw new Error('This room is full (8 players maximum).')
    if (!args.name.trim() || args.playerToken.length < 20 || args.playerId.length < 8) throw new Error('Enter a player name to join.')
    if (room.players.some((player) => player.token === args.playerToken || player.id === args.playerId)) return null
    if (room.players.some((player) => player.name.toLowerCase() === args.name.trim().toLowerCase())) throw new Error('That name is already taken in this room.')
    await ctx.db.patch(room._id, {
      players: [...room.players, { id: args.playerId, name: args.name.trim().slice(0, 20), token: args.playerToken, isHost: false }],
      revision: room.revision + 1,
    })
    return null
  },
})

export const startGame = mutation({
  args: { roomCode: v.string(), playerToken: v.string(), game: v.any() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const room = await ctx.db.query('rooms').withIndex('by_room_code', (q) => q.eq('roomCode', normalizeCode(args.roomCode))).unique()
    if (!room) throw new Error('Room not found.')
    const player = getPlayer(room, args.playerToken)
    if (!player?.isHost) throw new Error('Only the host can start the game.')
    if (room.status !== 'lobby' || room.players.length < 2) throw new Error('At least two players are needed to start.')
    validateGame(args.game, room.players)
    await ctx.db.patch(room._id, { status: 'playing', game: args.game, revision: room.revision + 1 })
    return null
  },
})

function pointsForHand(hand: any[], wildRank: string) {
  return hand.reduce((total, card) => {
    if (card.rank === 'JOKER' || card.rank === wildRank) return total
    if (card.rank === 'A') return total + 1
    if (card.rank === 'J') return total + 11
    if (card.rank === 'Q') return total + 12
    if (card.rank === 'K') return total + 13
    return total + Number(card.rank)
  }, 0)
}

export const endRound = mutation({
  args: { roomCode: v.string(), playerToken: v.string(), expectedRevision: v.number() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const room = await ctx.db.query('rooms').withIndex('by_room_code', (q) => q.eq('roomCode', normalizeCode(args.roomCode))).unique()
    if (!room || room.status !== 'playing' || !room.game) throw new Error('This game is not active.')
    const player = getPlayer(room, args.playerToken)
    if (!player || player.id !== room.game.currentPlayerId) throw new Error('It is not your turn.')
    if (room.revision !== args.expectedRevision) throw new Error('The table changed. Your game will sync automatically.')
    if (room.game.roundResult || room.game.awaitingDraw) throw new Error('Least Count cannot be called right now.')

    const declarerScore = pointsForHand(room.game.hands[player.id] ?? [], room.game.jokerRank)
    if (declarerScore > 5) throw new Error('Your hand must total 5 points or less before calling Least Count.')
    const active = room.game.players.filter((seat: any) => !seat.eliminated)
    const handScores = active.map((seat: any) => ({ playerId: seat.id, handScore: pointsForHand(room.game.hands[seat.id] ?? [], room.game.jokerRank) }))
    const lowerThanAll = handScores.every((score: any) => score.playerId === player.id || score.handScore > declarerScore)
    const lowest = Math.min(...handScores.map((score: any) => score.handScore))
    const scores = handScores.map((score: any) => ({
      ...score,
      roundPoints: lowerThanAll && score.playerId === player.id ? 0 : !lowerThanAll && score.playerId === player.id ? 40 : !lowerThanAll && score.handScore === lowest ? 0 : score.handScore,
    }))
    const players = room.game.players.map((seat: any) => {
      const result = scores.find((score: any) => score.playerId === seat.id)
      const total = seat.total + (result?.roundPoints ?? 0)
      return { ...seat, total, roundPoints: result?.roundPoints ?? 0, eliminated: seat.eliminated || total >= 101 }
    })
    const game = { ...room.game, players, roundResult: { declarer: player.id, successful: lowerThanAll, scores } }
    await ctx.db.patch(room._id, { game, revision: room.revision + 1 })
    return null
  },
})

export const leaveGame = mutation({
  args: { roomCode: v.string(), playerToken: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const room = await ctx.db.query('rooms').withIndex('by_room_code', (q) => q.eq('roomCode', normalizeCode(args.roomCode))).unique()
    if (!room) return null
    const leavingPlayer = getPlayer(room, args.playerToken)
    if (!leavingPlayer || room.status !== 'playing' || !room.game) return null
    const gamePlayer = room.game.players.find((player: any) => player.id === leavingPlayer.id)
    if (!gamePlayer || gamePlayer.left) return null

    const players = room.game.players.map((player: any) => player.id === leavingPlayer.id
      ? { ...player, left: true, eliminated: true }
      : player)
    const currentPlayerLeaving = room.game.currentPlayerId === leavingPlayer.id
    const nextPlayerId = currentPlayerLeaving ? nextPlayerAfterLeaving(players, leavingPlayer.id) : room.game.currentPlayerId
    const remainingPlayers = players.filter((player: any) => !player.eliminated && !player.left)
    const game = {
      ...room.game,
      players,
      currentPlayerId: nextPlayerId ?? room.game.currentPlayerId,
      awaitingDraw: currentPlayerLeaving ? false : room.game.awaitingDraw,
      previousOpenCard: currentPlayerLeaving ? null : room.game.previousOpenCard,
    }
    const roomPlayers = leavingPlayer.isHost && nextPlayerId
      ? room.players.map((player) => ({ ...player, isHost: player.id === nextPlayerId }))
      : room.players
    await ctx.db.patch(room._id, {
      players: roomPlayers,
      game,
      status: remainingPlayers.length ? 'playing' : 'ended',
      revision: room.revision + 1,
    })
    return null
  },
})

export const endGame = mutation({
  args: { roomCode: v.string(), playerToken: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const room = await ctx.db.query('rooms').withIndex('by_room_code', (q) => q.eq('roomCode', normalizeCode(args.roomCode))).unique()
    if (!room || room.status === 'ended') throw new Error('This game has already ended.')
    const player = getPlayer(room, args.playerToken)
    if (!player?.isHost) throw new Error('Only the host can end this game.')
    await ctx.db.patch(room._id, { status: 'ended', game: undefined, revision: room.revision + 1 })
    return null
  },
})

export const updateGame = mutation({
  args: { roomCode: v.string(), playerToken: v.string(), expectedRevision: v.number(), game: v.any() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const room = await ctx.db.query('rooms').withIndex('by_room_code', (q) => q.eq('roomCode', normalizeCode(args.roomCode))).unique()
    if (!room || room.status !== 'playing' || !room.game) throw new Error('This game is not active.')
    const player = getPlayer(room, args.playerToken)
    if (!player) throw new Error('Rejoin the room before playing.')
    if (room.revision !== args.expectedRevision) throw new Error('The table changed. Your game will sync automatically.')
    const currentPlayerId = room.game.currentPlayerId
    if (currentPlayerId !== player.id && !room.game.roundResult) throw new Error('It is not your turn.')
    if (!room.game.roundResult && args.game.roundResult) throw new Error('The server must score the round.')
    const game = room.game.roundResult
      ? args.game
      : { ...args.game, players: room.game.players, hands: { ...room.game.hands, [player.id]: args.game.hands?.[player.id] } }
    validateGame(game, room.players)
    await ctx.db.patch(room._id, { game, revision: room.revision + 1 })
    return null
  },
})
