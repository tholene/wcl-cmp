import { useQuery } from '@tanstack/react-query'
import { playerAnalysisQueryKeys } from '@/lib/query-keys'

type RecentPlayer = { name: string; className?: string | null }
type RecentPlayersResponse = { players: RecentPlayer[]; generatedAt: number }

const fetchRecentPlayers = async (): Promise<RecentPlayersResponse> => {
  const response = await fetch('/api/players/recent')
  const text = await response.text()
  if (!text.trim()) {
    throw new Error(
      response.status === 502 || response.status === 503
        ? 'The API server may not be running.'
        : `Server returned ${response.status} with no body.`
    )
  }
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    throw new Error('Failed to fetch recent players: invalid server response.')
  }
  if (!response.ok) {
    const data = parsed as { error?: string }
    throw new Error(data.error ?? 'Failed to fetch recent players.')
  }
  return parsed as RecentPlayersResponse
}

export const useRecentPlayers = () =>
  useQuery({
    queryKey: playerAnalysisQueryKeys.recentPlayers(),
    queryFn: fetchRecentPlayers,
  })
