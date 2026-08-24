import test from 'node:test'
import assert from 'node:assert/strict'
import { buildReport } from '../src/report.js'
import { renderSummary } from '../src/summary.js'

const NOW = Date.parse('2026-08-24T10:00:00Z')

const record = (over = {}) => ({
  timestamp: Date.parse('2026-08-24T09:00:00Z'),
  model: 'claude-opus-5',
  sessionId: 's1',
  project: '/work/app',
  sourceKind: 'main',
  inputTokens: 100, outputTokens: 200,
  cacheWrite5mTokens: 0, cacheWrite1hTokens: 0, cacheReadTokens: 1000,
  thinkingTokens: 0, cost: 1.25, cacheSavings: 0.5,
  inputCost: 0.25, outputCost: 1, cacheWrite5mCost: 0, cacheWrite1hCost: 0, cacheReadCost: 0,
  dedupeKey: 'k1', isSidechain: false,
  ...over,
})

test('renderSummary reports totals, the active block, and both breakdowns', () => {
  // Arrange
  const report = buildReport([record()], { now: NOW, timeZone: 'UTC', rangeDays: 30 })

  // Act
  const output = renderSummary(report)

  // Assert
  assert.match(output, /\$1\.25/)
  assert.match(output, /진행 중 블록/)
  assert.match(output, /claude-opus-5/)
  assert.match(output, /app \(work\)/)
})

test('renderSummary says so plainly when no block is running', () => {
  const report = buildReport([record({ timestamp: Date.parse('2026-08-01T00:00:00Z') })], {
    now: NOW, timeZone: 'UTC', rangeDays: 30,
  })
  assert.match(renderSummary(report), /진행 중인 5시간 블록 없음/)
})

test('renderSummary renders an empty history without throwing', () => {
  const report = buildReport([], { now: NOW, timeZone: 'UTC', rangeDays: 30 })
  assert.match(renderSummary(report), /\$0\.00/)
})
