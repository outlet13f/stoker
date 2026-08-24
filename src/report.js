import {
  MS_PER_DAY,
  MS_PER_HOUR,
  WEEKLY_WINDOW_DAYS,
  TOP_N_PROJECTS,
  TOP_N_SESSIONS,
  DEFAULT_RANGE_DAYS,
  RANGE_PRESETS,
  BURN_WARN_PERCENTILE,
  BURN_CRIT_PERCENTILE,
  BLOCK_TICKS,
} from './constants.js'
import {
  sumUsage,
  groupTotalsBy,
  buildDailySeries,
  buildBlocks,
  buildHourHistogram,
  computeCacheHitRate,
  compareWindows,
  percentile,
} from './aggregate.js'
import { resolveTier } from './pricing.js'
import { describeProjectPath } from './project.js'

/** 블록에서 지금까지의 소진 속도로 블록 종료 시점 총량을 추정한다 */
export function projectBlockBurn(block, now) {
  if (!block) return null

  const elapsedMs = Math.max(now - block.startTime, MS_PER_HOUR / 60)
  const windowMs = block.endTime - block.startTime
  const elapsedHours = elapsedMs / MS_PER_HOUR

  const costPerHour = block.cost / elapsedHours
  const tokensPerHour = block.totalTokens / elapsedHours

  return {
    elapsedRatio: Math.min(elapsedMs / windowMs, 1),
    remainingMs: Math.max(block.endTime - now, 0),
    costPerHour,
    tokensPerHour,
    projectedCost: (costPerHour * windowMs) / MS_PER_HOUR,
    projectedTokens: (tokensPerHour * windowMs) / MS_PER_HOUR,
  }
}

/** 블록을 균등한 눈금으로 잘라 각 구간의 비용을 담는다(계기판 표시용) */
function buildBlockTicks(records, block, tickCount = BLOCK_TICKS) {
  if (!block) return []

  const tickMs = (block.endTime - block.startTime) / tickCount
  const ticks = new Array(tickCount).fill(0)

  for (const record of records) {
    if (record.timestamp < block.startTime || record.timestamp >= block.endTime) continue
    const index = Math.min(tickCount - 1, Math.floor((record.timestamp - block.startTime) / tickMs))
    ticks[index] += record.cost
  }

  return ticks
}

/** 그룹 결과에 대표 레코드의 부가 정보를 붙인다 */
function groupWithMeta(records, keyFn, metaFn) {
  const meta = new Map()
  for (const record of records) {
    const key = keyFn(record)
    if (!meta.has(key)) meta.set(key, metaFn(record))
  }

  return groupTotalsBy(records, keyFn).map((group) => ({ ...group, ...meta.get(group.key) }))
}

function extremum(records, pick) {
  return records.length === 0 ? null : records.reduce(pick)
}

/**
 * 대시보드가 렌더링에 필요한 모든 값을 담은 단일 리포트 객체.
 * 렌더러는 계산을 하지 않고 이 객체만 그린다.
 */
export function buildReport(records, { now = Date.now(), timeZone, rangeDays = DEFAULT_RANGE_DAYS } = {}) {
  const rangeStart = now - rangeDays * MS_PER_DAY
  const inRange = records.filter((record) => record.timestamp > rangeStart)

  const blocks = buildBlocks(records, { now })
  const activeBlock = blocks.find((block) => block.isActive) ?? null
  const activeBurn = projectBlockBurn(activeBlock, now)
  const allTime = sumUsage(records)

  const historyCosts = blocks.filter((block) => !block.isActive).map((block) => block.cost)
  const burnStatus = classifyBurn(activeBurn?.projectedCost ?? 0, historyCosts)

  return {
    generatedAt: now,
    timeZone,
    rangeDays,

    allTime,
    range: sumUsage(inRange),
    cacheHitRate: computeCacheHitRate(allTime),
    rangeCacheHitRate: computeCacheHitRate(sumUsage(inRange)),

    daily: buildDailySeries(records, { days: rangeDays, now, timeZone }),
    hours: buildHourHistogram(inRange, { timeZone }),

    blocks: blocks.slice(-24),
    activeBlock,
    activeBurn,
    burnStatus,
    activeBlockTicks: buildBlockTicks(records, activeBlock),
    blockCostMedian: percentile(historyCosts, 0.5),
    blockCostP90: percentile(historyCosts, BURN_CRIT_PERCENTILE),

    byModel: groupWithMeta(
      inRange,
      (record) => record.model,
      (record) => ({ tier: resolveTier(record.model).label, isEstimated: resolveTier(record.model).isEstimated }),
    ),
    byProject: groupWithMeta(
      inRange,
      (record) => record.project,
      (record) => describeProjectPath(record.project),
    ).slice(0, TOP_N_PROJECTS),
    bySource: groupTotalsBy(inRange, (record) => record.sourceKind ?? 'main'),
    topSessions: groupWithMeta(
      inRange,
      (record) => record.sessionId,
      (record) => ({
        projectLabel: describeProjectPath(record.project).label,
        lastSeen: record.timestamp,
      }),
    ).slice(0, TOP_N_SESSIONS),

    dayOverDay: compareWindows(records, { now, windowMs: MS_PER_DAY }),
    weekOverWeek: compareWindows(records, { now, windowMs: WEEKLY_WINDOW_DAYS * MS_PER_DAY }),

    firstActivity: extremum(records, (a, b) => (a.timestamp <= b.timestamp ? a : b))?.timestamp ?? null,
    lastActivity: extremum(records, (a, b) => (a.timestamp >= b.timestamp ? a : b))?.timestamp ?? null,
  }
}

/**
 * 진행 중 블록의 예상 소진량을 과거 블록 분포와 비교해 상태를 매긴다.
 * 계정마다 한도가 다르므로 절대 기준 대신 사용자 본인의 이력을 기준선으로 쓴다.
 */
export function classifyBurn(projectedCost, historicalCosts) {
  if (historicalCosts.length === 0) return { level: 'ok', rank: null }

  const warnAt = percentile(historicalCosts, BURN_WARN_PERCENTILE)
  const critAt = percentile(historicalCosts, BURN_CRIT_PERCENTILE)

  const belowCount = historicalCosts.filter((cost) => cost <= projectedCost).length
  const rank = belowCount / historicalCosts.length

  const level = projectedCost >= critAt ? 'crit' : projectedCost >= warnAt ? 'warn' : 'ok'
  return { level, rank }
}

/** 선택 가능한 모든 기간의 리포트를 한 번에 만든다(정적 내보내기에서도 기간 전환이 되도록) */
export function buildReportSet(records, { now = Date.now(), timeZone } = {}) {
  const first = records.reduce((min, r) => Math.min(min, r.timestamp), Infinity)
  const allDays = Number.isFinite(first)
    ? Math.max(1, Math.ceil((now - first) / MS_PER_DAY) + 1)
    : DEFAULT_RANGE_DAYS

  const entries = [
    ...RANGE_PRESETS.map((days) => [String(days), days]),
    ['all', allDays],
  ]

  return Object.fromEntries(
    entries.map(([key, days]) => [key, buildReport(records, { now, timeZone, rangeDays: days })]),
  )
}
