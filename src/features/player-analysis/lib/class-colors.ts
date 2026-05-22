export const CLASS_COLORS: Record<string, string> = {
  'Death Knight': '#C41E3A',
  'Demon Hunter': '#A330C9',
  'Druid':        '#FF7C0A',
  'Evoker':       '#33937F',
  'Hunter':       '#AAD372',
  'Mage':         '#3FC7EB',
  'Monk':         '#00FF98',
  'Paladin':      '#F48CBA',
  'Priest':       '#FFFFFF',
  'Rogue':        '#FFF468',
  'Shaman':       '#0070DD',
  'Warlock':      '#8788EE',
  'Warrior':      '#C69B6D',
}

export function classColor(name: string | null | undefined): string {
  return (name && CLASS_COLORS[name]) ?? '#b5bac1'
}

export function parseColor(percentile: number): string {
  if (percentile >= 99) return '#e268a8'
  if (percentile >= 95) return '#ff8000'
  if (percentile >= 75) return '#a335ee'
  if (percentile >= 50) return '#0070dd'
  if (percentile >= 25) return '#1eff00'
  return '#666666'
}
