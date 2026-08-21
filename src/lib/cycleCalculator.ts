// Port 1:1 dari selada-ops/src/lib/cycleCalculator.ts.
import {
  addDays,
  differenceInCalendarDays,
  formatISO as formatISODateFns,
} from 'date-fns'
import {
  CHEMICAL_SPRAY_STOP_HSS,
  CYCLE_EVENTS,
  CYCLE_PHASE_RANGES,
  CYCLE_TOTAL_DAYS,
} from '../domain/constants.js'
import type {
  CycleEventSchedule,
  CyclePhase,
  NextCycleEvent,
} from '../domain/types.js'

export function getHssFromSowingDate(
  sowingDate: string | Date | null,
  today: Date = new Date(),
): number | null {
  if (!sowingDate) return null
  const sowing = typeof sowingDate === 'string' ? new Date(sowingDate) : sowingDate
  if (Number.isNaN(sowing.getTime())) return null

  const diff = differenceInCalendarDays(today, sowing)
  if (diff < 0) return null
  return Math.min(diff, CYCLE_TOTAL_DAYS)
}

export function getCyclePhase(hss: number | null): CyclePhase {
  if (hss === null || hss < 0) return 'Belum Mulai'

  for (const range of CYCLE_PHASE_RANGES) {
    if (hss >= range.startHss && hss <= range.endHss) {
      return range.phase
    }
  }
  return 'Belum Mulai'
}

export function isChemicalSprayAllowed(hss: number | null): boolean {
  if (hss === null) return false
  return hss < CHEMICAL_SPRAY_STOP_HSS
}

export function generateCycleEvents(
  sowingDate: string | Date | null,
  today: Date = new Date(),
): CycleEventSchedule[] {
  if (!sowingDate) return []
  const sowing = typeof sowingDate === 'string' ? new Date(sowingDate) : sowingDate
  if (Number.isNaN(sowing.getTime())) return []

  const currentHss = getHssFromSowingDate(sowing, today) ?? -1

  return CYCLE_EVENTS.map((ev) => {
    const eventDate = addDays(sowing, ev.hss)
    let status: CycleEventSchedule['status']
    if (ev.hss < currentHss) {
      status = 'past'
    } else if (ev.hss === currentHss) {
      status = 'current'
    } else {
      status = 'upcoming'
    }

    return {
      type: ev.type,
      hss: ev.hss,
      date: formatISODateFns(eventDate, { representation: 'date' }),
      label: ev.label,
      icon: ev.icon,
      tone: ev.tone,
      status,
    }
  })
}

export function getDaysUntilNextEvent(
  sowingDate: string | Date | null,
  today: Date = new Date(),
): NextCycleEvent | null {
  const events = generateCycleEvents(sowingDate, today)
  const upcoming = events.find((e) => e.status === 'upcoming' || e.status === 'current')
  if (!upcoming) return null

  const todayOnly = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  const eventDate = new Date(upcoming.date)
  const daysRemaining = differenceInCalendarDays(eventDate, todayOnly)

  return {
    event: upcoming,
    daysRemaining: Math.max(0, daysRemaining),
  }
}

export function getCycleProgressPercent(hss: number | null): number {
  if (hss === null || hss < 0) return 0
  return Math.min(100, (hss / CYCLE_TOTAL_DAYS) * 100)
}
