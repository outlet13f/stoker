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

/* ---------- 코드 변경량 ---------- */

const edit = (over = {}) => ({
  timestamp: Date.parse('2026-08-24T09:00:00Z'),
  linesAdded: 1234,
  linesRemoved: 567,
  filePath: '/work/app/a.js',
  project: '/work/app',
  sourceKind: 'main',
  sessionId: 's1',
  isCreate: false,
  dedupeKey: 'e1',
  ...over,
})

test('renderSummary reports code change volume for the range', () => {
  // Arrange
  const report = buildReport([record()], {
    now: NOW, timeZone: 'UTC', rangeDays: 30, edits: [edit()],
  })

  // Act
  const output = renderSummary(report)

  // Assert
  assert.match(output, /코드 변경/)
  assert.match(output, /\+1,234/)
  assert.match(output, /-567/)
  assert.match(output, /파일 1개/)
})

test('renderSummary counts distinct files touched, not edit calls', () => {
  // Arrange
  const report = buildReport([record()], {
    now: NOW, timeZone: 'UTC', rangeDays: 30,
    edits: [
      edit({ dedupeKey: 'e1', filePath: '/work/app/a.js' }),
      edit({ dedupeKey: 'e2', filePath: '/work/app/a.js' }),
      edit({ dedupeKey: 'e3', filePath: '/work/app/b.js' }),
    ],
  })

  // Assert
  assert.match(renderSummary(report), /파일 2개/)
})

test('renderSummary omits the code line when nothing was edited', () => {
  // Arrange
  const report = buildReport([record()], { now: NOW, timeZone: 'UTC', rangeDays: 30 })

  // Assert
  assert.doesNotMatch(renderSummary(report), /코드 변경/)
})

test('renderSummary tolerates a report built without code metrics', () => {
  // Arrange
  const report = buildReport([record()], { now: NOW, timeZone: 'UTC', rangeDays: 30 })
  const legacy = { ...report, code: undefined }

  // Act & Assert — 예전 리포트 객체로도 죽지 않아야 한다
  assert.doesNotThrow(() => renderSummary(legacy))
})
