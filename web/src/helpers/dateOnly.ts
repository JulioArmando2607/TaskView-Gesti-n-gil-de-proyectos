/** Parse a YYYY-MM-DD calendar date without interpreting it as UTC. */
export function dateOnlyToLocalDate(value: string): Date {
  const [year, month, day] = value.slice(0, 10).split('-').map(Number)
  return new Date(year, month - 1, day)
}
