const currency = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
})

const currencyCents = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
})

const weekday = new Intl.DateTimeFormat('en-US', {
  weekday: 'short',
  month: 'short',
  day: 'numeric',
})

const longDate = new Intl.DateTimeFormat('en-US', {
  weekday: 'long',
  month: 'long',
  day: 'numeric',
  year: 'numeric',
})

export function useFormat() {
  const money = (n: number, cents = false) =>
    (cents ? currencyCents : currency).format(Number.isFinite(n) ? n : 0)

  const shortDate = (d: Date | null | undefined) =>
    d ? weekday.format(d) : 'Date TBD'

  const fullDate = (d: Date | null | undefined) =>
    d ? longDate.format(d) : 'Date to be decided'

  const duration = (mins: number | null | undefined) => {
    if (!mins || mins <= 0) return '—'
    const h = Math.floor(mins / 60)
    const m = mins % 60
    if (!h) return `${m}m`
    if (!m) return `${h}h`
    return `${h}h ${m}m`
  }

  const time12 = (t: string | null | undefined) => {
    if (!t) return ''
    const [hRaw, mRaw] = t.split(':')
    const h = Number(hRaw)
    if (Number.isNaN(h)) return t
    const suffix = h >= 12 ? 'PM' : 'AM'
    const h12 = h % 12 === 0 ? 12 : h % 12
    return `${h12}:${mRaw ?? '00'} ${suffix}`
  }

  return { money, shortDate, fullDate, duration, time12 }
}
