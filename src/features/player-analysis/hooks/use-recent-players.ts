import { useQuery } from '@tanstack/react-query'
import { playerAnalysisQueryKeys } from '@/lib/query-keys'

type RecentPlayer = { name: string; className?: string | null }
type RecentPlayersResponse = { players: RecentPlayer[]; generatedAt: number }

const fetchRecentPlayers = async (): Promise<RecentPlayersResponse> => {
  const response = await fetch('/api/players/recent')
  if (!response.ok) {
    const data = (await response.json()) as { error?: string }
    throw new Error(data.error ?? 'Failed to fetch recent players.')
  }
  return (await response.json()) as RecentPlayersResponse
}

export const useRecentPlayers = () =>
  useQuery({
    queryKey: playerAnalysisQueryKeys.recentPlayers(),
    queryFn: fetchRecentPlayers,
  })
