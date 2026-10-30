// Util tanggal minimal untuk BE — padanan perilaku dateUtils FE.
import {
  addDays as addDaysDateFns,
  formatISO as formatISODateFns,
  subDays as subDaysDateFns,
} from 'date-fns'

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

/** Geser tanggal ISO sebanyak `days` (bisa negatif) — murni pada tanggal, tanpa zona waktu. */
export function addDaysToISO(date: string, days: number): string {
  return formatISODate(addDaysDateFns(new Date(`${date}T00:00:00`), days))
}

export function isValidISODate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const d = new Date(`${value}T00:00:00`)
  return !Number.isNaN(d.getTime()) && formatISODate(d) === value
}
