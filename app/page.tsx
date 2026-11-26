import { LeastCountGame } from '@/components/least-count-game'

export default async function Page({ searchParams }: { searchParams: Promise<{ room?: string }> }) {
  const { room } = await searchParams
  return <LeastCountGame initialRoomCode={room ?? ''} />
}
