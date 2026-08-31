/**
 * Date formatting for the whole app.
 *
 * Every screen was doing its own — some with toLocaleDateString('id-ID'), some
 * slicing the ISO string to `2026-10-29` and showing that to the user. The
 * result was three different date formats visible on one page.
 */

const DAY = new Intl.DateTimeFormat('id-ID', {
  day: 'numeric', month: 'short', year: 'numeric',
})

const DAY_TIME = new Intl.DateTimeFormat('id-ID', {
  day: 'numeric', month: 'short', year: 'numeric',
  hour: '2-digit', minute: '2-digit',
})

/** `29 Okt 2026`, or a dash when there is nothing to show. */
export function formatDate(value?: string | null): string {
  const d = parse(value)
  return d ? DAY.format(d) : '—'
}

/** `29 Okt 2026, 14.30` — for audit rows, where the time is the point. */
export function formatDateTime(value?: string | null): string {
  const d = parse(value)
  return d ? DAY_TIME.format(d) : '—'
}

/**
 * Whole days from now, negative once the date has passed. Used to colour
 * renewal dates, so it counts calendar days rather than 24-hour periods —
 * "expires tomorrow" should not become "today" at 00:01.
 */
export function daysUntil(value?: string | null): number | null {
  const d = parse(value)
  if (!d) return null
  const start = new Date()
  start.setHours(0, 0, 0, 0)
  const target = new Date(d)
  target.setHours(0, 0, 0, 0)
  return Math.round((target.getTime() - start.getTime()) / 86_400_000)
}

function parse(value?: string | null): Date | null {
  if (!value) return null
  const d = new Date(value)
  // An unparseable string is shown as a dash rather than "Invalid Date", which
  // is what a bad row used to put on screen.
  return Number.isNaN(d.getTime()) ? null : d
}
