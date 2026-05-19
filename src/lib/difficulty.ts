export function getDifficultyLabel(difficulty?: number | null): string {
  switch (difficulty) {
    case 3:
      return 'Normal'
    case 4:
      return 'Heroic'
    case 5:
      return 'Mythic'
    default:
      return difficulty ? `Difficulty ${difficulty}` : 'Unknown'
  }
}
