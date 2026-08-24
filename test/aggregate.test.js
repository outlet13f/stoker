import test from 'node:test'
import assert from 'node:assert/strict'
import {
  dedupeRecords,
  sumUsage,
  groupTotalsBy,
  buildDailySeries,
  buildBlocks,
  buildHourHistogram,
  computeCacheHitRate,
  compareWindows,
} from '../src/aggregate.js'

const HOUR = 60 * 60 * 1000
const at = (iso, over = {}) => ({
  timestamp: Date.parse(iso),
  model: 'claude-opus-5',
  sessionId: 's1',
  project: '/p',
  inputTokens: 10,
  outputTokens: 20,
  cacheWrite5mTokens: 0,
  cacheWrite1hTokens: 0,
  cacheReadTokens: 0,
  thinkingTokens: 0,
  cost: 1,
  dedupeKey: iso,
  isSidechain: false,
  ...over,
})

test('dedupeRecords drops repeated dedupe keys but keeps distinct ones', () => {
  // Arrange
  const records = [at('2026-08-01T00:00:00Z'), at('2026-08-01T00:00:00Z'), at('2026-08-01T01:00:00Z')]

  // Act
  const result = dedupeRecords(records)

  // Assert
  assert.equal(result.length, 2)
})

test('dedupeRecords does not mutate its input', () => {
  const records = [at('2026-08-01T00:00:00Z'), at('2026-08-01T00:00:00Z')]
  dedupeRecords(records)
  assert.equal(records.length, 2)
})

test('sumUsage totals every token bucket and the cost', () => {
  // Arrange
  const records = [
    at('2026-08-01T00:00:00Z', { inputTokens: 1, outputTokens: 2, cacheReadTokens: 3, cost: 0.5 }),
    at('2026-08-01T01:00:00Z', { inputTokens: 4, outputTokens: 5, cacheReadTokens: 6, cost: 1.5 }),
  ]

  // Act
  const totals = sumUsage(records)

  // Assert
  assert.equal(totals.inputTokens, 5)
  assert.equal(totals.outputTokens, 7)
  assert.equal(totals.cacheReadTokens, 9)
  assert.equal(totals.cost, 2)
  assert.equal(totals.requests, 2)
  assert.equal(totals.totalTokens, 21)
})

test('sumUsage returns a zeroed total for an empty set', () => {
  const totals = sumUsage([])
  assert.equal(totals.totalTokens, 0)
  assert.equal(totals.requests, 0)
  assert.equal(totals.cost, 0)
})

test('groupTotalsBy buckets records by the chosen key, sorted by cost desc', () => {
  // Arrange
  const records = [
    at('2026-08-01T00:00:00Z', { model: 'claude-haiku-4-5', cost: 1 }),
    at('2026-08-01T01:00:00Z', { model: 'claude-opus-5', cost: 9 }),
    at('2026-08-01T02:00:00Z', { model: 'claude-opus-5', cost: 5 }),
  ]

  // Act
  const groups = groupTotalsBy(records, (r) => r.model)

  // Assert
  assert.equal(groups[0].key, 'claude-opus-5')
  assert.equal(groups[0].cost, 14)
  assert.equal(groups[1].key, 'claude-haiku-4-5')
})

test('buildDailySeries fills days that had no activity with zeros', () => {
  // Arrange
  const now = Date.parse('2026-08-03T12:00:00Z')
  const records = [at('2026-08-01T05:00:00Z', { cost: 2 }), at('2026-08-03T05:00:00Z', { cost: 3 })]

  // Act
  const series = buildDailySeries(records, { days: 3, now, timeZone: 'UTC' })

  // Assert
  assert.equal(series.length, 3)
  assert.deepEqual(series.map((d) => d.date), ['2026-08-01', '2026-08-02', '2026-08-03'])
  assert.equal(series[1].cost, 0)
  assert.equal(series[2].cost, 3)
})

test('buildBlocks groups activity into 5-hour windows anchored to the hour', () => {
  // Arrange: 00:30 and 03:00 share a block, 06:00 starts a new one
  const records = [
    at('2026-08-01T00:30:00Z'),
    at('2026-08-01T03:00:00Z'),
    at('2026-08-01T06:00:00Z'),
  ]

  // Act
  const blocks = buildBlocks(records, { now: Date.parse('2026-08-01T07:00:00Z') })

  // Assert
  assert.equal(blocks.length, 2)
  assert.equal(blocks[0].startTime, Date.parse('2026-08-01T00:00:00Z'))
  assert.equal(blocks[0].requests, 2)
  assert.equal(blocks[1].requests, 1)
})

test('buildBlocks starts a new block after a gap longer than the window', () => {
  const records = [at('2026-08-01T00:00:00Z'), at('2026-08-01T09:00:00Z')]
  const blocks = buildBlocks(records, { now: Date.parse('2026-08-01T10:00:00Z') })
  assert.equal(blocks.length, 2)
})

test('buildBlocks marks only the window containing now as active', () => {
  // Arrange
  const now = Date.parse('2026-08-01T08:00:00Z')
  const records = [at('2026-08-01T00:00:00Z'), at('2026-08-01T06:30:00Z')]

  // Act
  const blocks = buildBlocks(records, { now })

  // Assert
  assert.equal(blocks[0].isActive, false)
  assert.equal(blocks.at(-1).isActive, true)
  assert.equal(blocks.at(-1).endTime, Date.parse('2026-08-01T11:00:00Z'))
})

test('buildBlocks returns an empty list when there is no activity', () => {
  assert.deepEqual(buildBlocks([], { now: Date.now() }), [])
})

test('buildHourHistogram returns 24 buckets covering the whole day', () => {
  // Arrange
  const records = [at('2026-08-01T00:30:00Z'), at('2026-08-01T00:45:00Z'), at('2026-08-01T13:00:00Z')]

  // Act
  const hours = buildHourHistogram(records, { timeZone: 'UTC' })

  // Assert
  assert.equal(hours.length, 24)
  assert.equal(hours[0].requests, 2)
  assert.equal(hours[13].requests, 1)
  assert.equal(hours[5].requests, 0)
})

test('computeCacheHitRate measures reads against all cache-eligible input', () => {
  // Arrange: 900 read vs 100 written
  const totals = { cacheReadTokens: 900, cacheWrite5mTokens: 100, cacheWrite1hTokens: 0, inputTokens: 0 }

  // Act & Assert
  assert.equal(computeCacheHitRate(totals), 0.9)
})

test('computeCacheHitRate returns zero when nothing was cached', () => {
  const totals = { cacheReadTokens: 0, cacheWrite5mTokens: 0, cacheWrite1hTokens: 0, inputTokens: 50 }
  assert.equal(computeCacheHitRate(totals), 0)
})

test('compareWindows reports the change between the current and prior period', () => {
  // Arrange
  const now = Date.parse('2026-08-08T00:00:00Z')
  const records = [
    at('2026-08-06T00:00:00Z', { cost: 10 }), // current 7d
    at('2026-07-30T00:00:00Z', { cost: 5 }), // prior 7d
  ]

  // Act
  const delta = compareWindows(records, { now, windowMs: 7 * 24 * HOUR })

  // Assert
  assert.equal(delta.current.cost, 10)
  assert.equal(delta.previous.cost, 5)
  assert.equal(delta.costChangeRatio, 1)
})

test('compareWindows reports null change when the prior period was empty', () => {
  const now = Date.parse('2026-08-08T00:00:00Z')
  const delta = compareWindows([at('2026-08-06T00:00:00Z', { cost: 10 })], { now, windowMs: 7 * 24 * HOUR })
  assert.equal(delta.costChangeRatio, null)
})

test('percentile interpolates between the surrounding samples', async () => {
  const { percentile } = await import('../src/aggregate.js')
  assert.equal(percentile([1, 2, 3, 4], 0.5), 2.5)
  assert.equal(percentile([10], 0.9), 10)
})

test('percentile returns zero for an empty sample', async () => {
  const { percentile } = await import('../src/aggregate.js')
  assert.equal(percentile([], 0.5), 0)
})

test('percentile is order-independent', async () => {
  const { percentile } = await import('../src/aggregate.js')
  assert.equal(percentile([4, 1, 3, 2], 0.5), 2.5)
})

test('sumUsage accumulates cache savings alongside cost', () => {
  const records = [
    at('2026-08-01T00:00:00Z', { cacheSavings: 1.5 }),
    at('2026-08-01T01:00:00Z', { cacheSavings: 2.5 }),
  ]
  assert.equal(sumUsage(records).cacheSavings, 4)
})
