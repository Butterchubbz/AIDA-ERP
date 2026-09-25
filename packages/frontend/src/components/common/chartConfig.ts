export const chartPalette = {
  primary: '#22d3ee',
  grid: '#334155',
  tooltipBg: '#0f172a',
} as const

export const baseTooltipStyle = {
  backgroundColor: chartPalette.tooltipBg,
  border: `1px solid ${chartPalette.grid}`,
}
