import test from 'node:test'
import assert from 'node:assert/strict'
import { buildReport, projectBlockBurn } from '../src/report.js'

const HOUR = 60 * 60 * 1000
const record = (iso, over = {}) => ({
  timestamp: Date.parse(iso),
  model: 'claude-opus-5',
  sessionId: 's1',
  project: '/work/app',
  projectLabel: 'app',
  sourceKind: 'main',
  inputTokens: 100,
  outputTokens: 200,
  cacheWrite5mTokens: 0,
  cacheWrite1hTokens: 0,
  cacheReadTokens: 1000,
  thinkingTokens: 0,
  cost: 1,
  dedupeKey: iso + (over.sessionId ?? ''),
  isSidechain: false,
  ...over,
})

const NOW = Date.parse('2026-08-24T10:00:00Z')
const OPTIONS = { now: NOW, timeZone: 'UTC', rangeDays: 30 }

test('buildReport separates all-time totals from the selected range', () => {
  // Arrange
  const records = [record('2026-01-01T00:00:00Z'), record('2026-08-24T09:00:00Z')]

  // Act
  const report = buildReport(records, OPTIONS)

  // Assert
  assert.equal(report.allTime.requests, 2)
  assert.equal(report.range.requests, 1)
})

test('buildReport breaks usage down by model, project, source, and session', () => {
  // Arrange
  const records = [
    record('2026-08-24T09:00:00Z'),
    record('2026-08-24T09:30:00Z', { model: 'claude-haiku-4-5', sourceKind: 'subagent', sessionId: 's2' }),
  ]

  // Act
  const report = buildReport(records, OPTIONS)

  // Assert
  assert.equal(report.byModel.length, 2)
  assert.equal(report.byProject.length, 1)
  assert.equal(report.bySource.length, 2)
  assert.equal(report.topSessions.length, 2)
})

test('buildReport labels each session group with its project', () => {
  const report = buildReport([record('2026-08-24T09:00:00Z')], OPTIONS)
  assert.equal(report.topSessions[0].projectLabel, 'app')
})

test('buildReport surfaces the in-progress 5-hour block', () => {
  // Arrange: 09:00 활동 → 블록 09:00~14:00, now 10:00 이므로 진행 중
  const report = buildReport([record('2026-08-24T09:00:00Z')], OPTIONS)

  // Assert
  assert.ok(report.activeBlock, 'active block should exist')
  assert.equal(report.activeBlock.startTime, Date.parse('2026-08-24T09:00:00Z'))
})

test('buildReport reports no active block when the last activity is old', () => {
  const report = buildReport([record('2026-08-20T09:00:00Z')], OPTIONS)
  assert.equal(report.activeBlock, null)
})

test('buildReport handles an empty history without throwing', () => {
  // Act
  const report = buildReport([], OPTIONS)

  // Assert
  assert.equal(report.allTime.requests, 0)
  assert.equal(report.activeBlock, null)
  assert.equal(report.daily.length, 30)
  assert.equal(report.firstActivity, null)
})

test('buildReport records the first and last activity timestamps', () => {
  const report = buildReport(
    [record('2026-08-24T09:00:00Z'), record('2026-01-01T00:00:00Z')],
    OPTIONS,
  )
  assert.equal(report.firstActivity, Date.parse('2026-01-01T00:00:00Z'))
  assert.equal(report.lastActivity, Date.parse('2026-08-24T09:00:00Z'))
})

test('projectBlockBurn extrapolates the block total from the burn so far', () => {
  // Arrange: 5시간 블록에서 1시간 동안 $10 사용
  const block = {
    startTime: Date.parse('2026-08-24T09:00:00Z'),
    endTime: Date.parse('2026-08-24T14:00:00Z'),
    cost: 10,
    totalTokens: 1000,
  }

  // Act
  const burn = projectBlockBurn(block, Date.parse('2026-08-24T10:00:00Z'))

  // Assert
  assert.equal(burn.costPerHour, 10)
  assert.equal(burn.projectedCost, 50)
  assert.equal(burn.elapsedRatio, 0.2)
})

test('projectBlockBurn avoids dividing by zero at the very start of a block', () => {
  const block = { startTime: NOW, endTime: NOW + 5 * HOUR, cost: 3, totalTokens: 10 }
  const burn = projectBlockBurn(block, NOW)
  assert.ok(Number.isFinite(burn.costPerHour))
  assert.ok(Number.isFinite(burn.projectedCost))
})

test('projectBlockBurn returns nulls when there is no block', () => {
  assert.equal(projectBlockBurn(null, NOW), null)
})

test('classifyBurn calls a projection below the median safe', async () => {
  const { classifyBurn } = await import('../src/report.js')
  const history = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
  assert.equal(classifyBurn(2, history).level, 'ok')
})

test('classifyBurn warns between the median and the 90th percentile', async () => {
  const { classifyBurn } = await import('../src/report.js')
  assert.equal(classifyBurn(7, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]).level, 'warn')
})

test('classifyBurn escalates at or above the 90th percentile', async () => {
  const { classifyBurn } = await import('../src/report.js')
  assert.equal(classifyBurn(20, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]).level, 'crit')
})

test('classifyBurn reports the projection rank among past blocks', async () => {
  const { classifyBurn } = await import('../src/report.js')
  const result = classifyBurn(6, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10])
  assert.equal(result.rank, 0.6)
})

test('classifyBurn stays safe when there is no history to compare against', async () => {
  const { classifyBurn } = await import('../src/report.js')
  const result = classifyBurn(5, [])
  assert.equal(result.level, 'ok')
  assert.equal(result.rank, null)
})

test('buildReportSet produces one report per selectable range', async () => {
  const { buildReportSet } = await import('../src/report.js')
  const records = [record('2026-08-24T09:00:00Z'), record('2026-02-01T09:00:00Z')]

  const set = buildReportSet(records, { now: NOW, timeZone: 'UTC' })

  assert.deepEqual(Object.keys(set), ['7', '30', '90', 'all'])
  assert.equal(set['7'].range.requests, 1)
  assert.equal(set.all.range.requests, 2)
})

test('buildReportSet keeps the all-range span covering the first activity', async () => {
  const { buildReportSet } = await import('../src/report.js')
  const set = buildReportSet([record('2026-08-01T00:00:00Z')], { now: NOW, timeZone: 'UTC' })
  assert.ok(set.all.rangeDays >= 23, 'all range should reach back to the first record')
})

test('buildReport slices the active block into instrument ticks', () => {
  // Arrange: 09:00 블록, 09:00 과 11:30 에 활동
  const records = [record('2026-08-24T09:00:00Z'), record('2026-08-24T09:00:00Z', { sessionId: 'b' })]

  // Act
  const report = buildReport(records, OPTIONS)

  // Assert: 5시간을 60틱으로 나누면 틱당 5분, 두 요청 모두 첫 틱
  assert.equal(report.activeBlockTicks.length, 60)
  assert.equal(report.activeBlockTicks[0], 2)
  assert.equal(report.activeBlockTicks[59], 0)
})

test('buildReport returns no ticks when no block is active', () => {
  const report = buildReport([record('2026-08-20T09:00:00Z')], OPTIONS)
  assert.deepEqual(report.activeBlockTicks, [])
})
