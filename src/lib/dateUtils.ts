// Util tanggal minimal untuk BE — padanan perilaku dateUtils FE.
import { formatISO as formatISODateFns, subDays as subDaysDateFns } from 'date-fns'

export function formatISODate(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date
  if (Number.isNaN(d.getTime())) {
    throw new Error('Invalid date for formatISO')
  }
  return formatISODateFns(d, { representation: 'date' })
}

export function todayISO(): string {
  return formatISODate(new Date())
}

export function subDaysISO(days: number): string {
  return formatISODate(subDaysDateFns(new Date(), days))
}

export function isValidISODate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const d = new Date(`${value}T00:00:00`)
  return !Number.isNaN(d.getTime()) && formatISODate(d) === value
}
