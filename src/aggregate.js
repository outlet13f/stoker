import { BLOCK_DURATION_HOURS, MS_PER_HOUR, HEATMAP_HOURS, MS_PER_DAY } from './constants.js'
import { getTimeZoneOffsetMs, toDateKey, toLocalHour } from './timezone.js'

const BLOCK_DURATION_MS = BLOCK_DURATION_HOURS * MS_PER_HOUR

/** 레코드에서 그대로 더해 나가는 숫자 필드들 */
const SUMMED_FIELDS = [
  'inputCost',
  'outputCost',
  'cacheWrite5mCost',
  'cacheWrite1hCost',
  'cacheReadCost',
  'inputTokens',
  'outputTokens',
  'cacheWrite5mTokens',
  'cacheWrite1hTokens',
  'cacheReadTokens',
  'thinkingTokens',
]

/** 모든 합계 필드가 0 인 새 누적기 */
function emptyTotals() {
  const totals = { requests: 0, cost: 0, cacheSavings: 0, totalTokens: 0 }
  for (const field of SUMMED_FIELDS) totals[field] = 0
  return totals
}

/** 누적기에 레코드 하나를 더한 새 값을 만든다(원본 불변) */
function addRecord(totals, record) {
  const next = {
    ...totals,
    requests: totals.requests + 1,
    cost: totals.cost + record.cost,
    cacheSavings: totals.cacheSavings + (record.cacheSavings || 0),
  }

  for (const field of SUMMED_FIELDS) {
    next[field] = totals[field] + (record[field] || 0)
  }

  // thinking 토큰은 output 에 이미 포함되므로 총합에서는 제외한다
  next.totalTokens =
    next.inputTokens +
    next.outputTokens +
    next.cacheWrite5mTokens +
    next.cacheWrite1hTokens +
    next.cacheReadTokens

  return next
}

export function sumUsage(records) {
  return records.reduce(addRecord, emptyTotals())
}

/** 같은 응답이 여러 트랜스크립트에 복제되는 경우를 제거한다 */
export function dedupeRecords(records) {
  const seen = new Set()

  return records.filter((record) => {
    if (seen.has(record.dedupeKey)) return false
    seen.add(record.dedupeKey)
    return true
  })
}

/** keyFn 으로 묶어 비용 내림차순으로 정렬한 합계 목록 */
export function groupTotalsBy(records, keyFn) {
  const buckets = new Map()

  for (const record of records) {
    const key = keyFn(record)
    buckets.set(key, addRecord(buckets.get(key) ?? emptyTotals(), record))
  }

  return [...buckets.entries()]
    .map(([key, totals]) => ({ key, ...totals }))
    .sort((a, b) => b.cost - a.cost)
}

/** 최근 days 일의 일별 시계열. 활동이 없는 날도 0 으로 채운다. */
export function buildDailySeries(records, { days, now = Date.now(), timeZone }) {
  const offsetMs = getTimeZoneOffsetMs(timeZone, now)

  const keys = Array.from({ length: days }, (_, index) =>
    toDateKey(now - (days - 1 - index) * MS_PER_DAY, offsetMs),
  )
  const wanted = new Set(keys)

  const buckets = new Map(keys.map((key) => [key, emptyTotals()]))
  for (const record of records) {
    const key = toDateKey(record.timestamp, offsetMs)
    if (wanted.has(key)) buckets.set(key, addRecord(buckets.get(key), record))
  }

  return keys.map((date) => ({ date, ...buckets.get(date) }))
}

/**
 * 사용 한도가 리셋되는 5시간 롤링 블록으로 묶는다.
 * 블록은 정시에 앵커되고, 5시간 이상 공백이 생기면 새 블록이 시작된다.
 */
export function buildBlocks(records, { now = Date.now() } = {}) {
  const sorted = [...records].sort((a, b) => a.timestamp - b.timestamp)
  const blocks = []

  let current = null
  let lastTimestamp = 0

  for (const record of sorted) {
    const isNewBlock =
      !current ||
      record.timestamp - current.startTime >= BLOCK_DURATION_MS ||
      record.timestamp - lastTimestamp >= BLOCK_DURATION_MS

    if (isNewBlock) {
      const startTime = record.timestamp - (record.timestamp % MS_PER_HOUR)
      current = { startTime, endTime: startTime + BLOCK_DURATION_MS, totals: emptyTotals() }
      blocks.push(current)
    }

    current.totals = addRecord(current.totals, record)
    current.lastActivity = record.timestamp
    lastTimestamp = record.timestamp
  }

  return blocks.map(({ startTime, endTime, totals, lastActivity }) => ({
    startTime,
    endTime,
    lastActivity,
    isActive: now >= startTime && now < endTime,
    ...totals,
  }))
}

/** 하루 24시간 각 시간대의 사용량(활동 패턴 파악용) */
export function buildHourHistogram(records, { timeZone } = {}) {
  const offsetMs = getTimeZoneOffsetMs(timeZone)
  const buckets = Array.from({ length: HEATMAP_HOURS }, () => emptyTotals())

  const filled = records.reduce((acc, record) => {
    const hour = toLocalHour(record.timestamp, offsetMs)
    acc[hour] = addRecord(acc[hour], record)
    return acc
  }, buckets)

  return filled.map((totals, hour) => ({ hour, ...totals }))
}

/** 캐시 재사용 비율. 높을수록 같은 컨텍스트를 싸게 재활용하고 있다는 뜻. */
export function computeCacheHitRate(totals) {
  const written = totals.cacheWrite5mTokens + totals.cacheWrite1hTokens
  const eligible = totals.cacheReadTokens + written

  return eligible === 0 ? 0 : totals.cacheReadTokens / eligible
}

/** 현재 구간과 직전 동일 길이 구간을 비교한다 */
export function compareWindows(records, { now = Date.now(), windowMs }) {
  const currentStart = now - windowMs
  const previousStart = currentStart - windowMs

  const current = sumUsage(records.filter((r) => r.timestamp > currentStart))
  const previous = sumUsage(
    records.filter((r) => r.timestamp > previousStart && r.timestamp <= currentStart),
  )

  return {
    current,
    previous,
    costChangeRatio: previous.cost > 0 ? (current.cost - previous.cost) / previous.cost : null,
  }
}

/** 선형 보간 백분위. 임계값을 사용자 본인의 과거 분포에서 뽑을 때 쓴다. */
export function percentile(values, ratio) {
  if (values.length === 0) return 0

  const sorted = [...values].sort((a, b) => a - b)
  const position = (sorted.length - 1) * ratio
  const lower = Math.floor(position)
  const upper = Math.ceil(position)

  if (lower === upper) return sorted[lower]
  return sorted[lower] + (sorted[upper] - sorted[lower]) * (position - lower)
}
