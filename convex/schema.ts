import { defineSchema, defineTable } from 'convex/server'
import { v } from 'convex/values'

export default defineSchema({
  rooms: defineTable({
    roomCode: v.string(),
    status: v.union(v.literal('lobby'), v.literal('playing')),
    players: v.array(v.object({
      id: v.string(),
      name: v.string(),
      token: v.string(),
      isHost: v.boolean(),
    })),
    game: v.optional(v.any()),
    revision: v.number(),
    createdAt: v.number(),
  }).index('by_room_code', ['roomCode']),
})
