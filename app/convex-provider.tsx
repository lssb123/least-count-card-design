'use client'

import { ConvexProvider, ConvexReactClient } from 'convex/react'
import { createContext, useContext, useState, type ReactNode } from 'react'

const ConvexAvailability = createContext(false)

export function useConvexAvailability() {
  return useContext(ConvexAvailability)
}

export function ConvexClientProvider({ children }: { children: ReactNode }) {
  const [client] = useState(() => {
    const url = process.env.NEXT_PUBLIC_CONVEX_URL
    return url ? new ConvexReactClient(url) : null
  })

  if (!client) return <ConvexAvailability.Provider value={false}>{children}</ConvexAvailability.Provider>

  return <ConvexAvailability.Provider value><ConvexProvider client={client}>{children}</ConvexProvider></ConvexAvailability.Provider>
}
