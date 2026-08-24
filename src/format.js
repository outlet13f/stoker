const KILO = 1_000
const MEGA = 1_000_000
const GIGA = 1_000_000_000
const MIN_VISIBLE_COST = 0.01
const MS_PER_MINUTE = 60_000
const MINUTES_PER_HOUR = 60

export function formatCost(value) {
  const amount = Number(value) || 0
  if (amount > 0 && amount < MIN_VISIBLE_COST) return '<$0.01'

  return `$${amount.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`
}

export function formatTokens(value) {
  const amount = Number(value) || 0
  if (amount >= GIGA) return `${(amount / GIGA).toFixed(1)}B`
  if (amount >= MEGA) return `${(amount / MEGA).toFixed(1)}M`
  if (amount >= KILO) return `${(amount / KILO).toFixed(1)}K`

  return String(Math.round(amount))
}

export function formatPercent(ratio, digits = 1) {
  return `${((Number(ratio) || 0) * 100).toFixed(digits)}%`
}

export function formatDelta(ratio) {
  if (ratio === null || ratio === undefined) return '기준 없음'

  const percent = ratio * 100
  const sign = percent >= 0 ? '+' : ''
  return `${sign}${percent.toFixed(1)}%`
}

export function formatDuration(ms) {
  const totalMinutes = Math.max(0, Math.round((Number(ms) || 0) / MS_PER_MINUTE))
  const hours = Math.floor(totalMinutes / MINUTES_PER_HOUR)
  const minutes = totalMinutes % MINUTES_PER_HOUR

  return hours > 0 ? `${hours}시간 ${minutes}분` : `${minutes}분`
}

const NICE_STEPS = [1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10]

/** 축 최댓값을 사람이 읽기 쉬운 눈금으로 올림한다 */
export function niceCeil(value) {
  if (!(value > 0)) return 0

  const magnitude = 10 ** Math.floor(Math.log10(value))
  const normalized = value / magnitude
  const step = NICE_STEPS.find((candidate) => normalized <= candidate + 1e-9) ?? 10

  return step * magnitude
}

/** 축 라벨용 짧은 금액 표기 */
export function formatCostCompact(value) {
  const amount = Number(value) || 0
  if (amount >= KILO) return `$${(amount / KILO).toFixed(1)}K`
  if (amount === 0) return '$0'
  if (amount < 1) return `$${amount.toFixed(2)}`

  return `$${Math.round(amount)}`
}
