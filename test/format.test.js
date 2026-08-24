import test from 'node:test'
import assert from 'node:assert/strict'
import {
  formatCost,
  formatTokens,
  formatPercent,
  formatDelta,
  formatDuration,
} from '../src/format.js'

test('formatCost shows cents for everyday amounts', () => {
  assert.equal(formatCost(1234.5), '$1,234.50')
  assert.equal(formatCost(0.42), '$0.42')
  assert.equal(formatCost(0), '$0.00')
})

test('formatCost keeps very small amounts visible instead of rounding to zero', () => {
  assert.equal(formatCost(0.0004), '<$0.01')
})

test('formatTokens abbreviates with one decimal at each magnitude', () => {
  assert.equal(formatTokens(842), '842')
  assert.equal(formatTokens(12_300), '12.3K')
  assert.equal(formatTokens(1_200_000), '1.2M')
  assert.equal(formatTokens(3_851_601_334), '3.9B')
})

test('formatTokens handles zero and missing values', () => {
  assert.equal(formatTokens(0), '0')
  assert.equal(formatTokens(undefined), '0')
})

test('formatPercent renders a ratio with one decimal', () => {
  assert.equal(formatPercent(0.624), '62.4%')
  assert.equal(formatPercent(1), '100.0%')
})

test('formatDelta signs the change and marks an unknown baseline', () => {
  assert.equal(formatDelta(0.182), '+18.2%')
  assert.equal(formatDelta(-0.05), '-5.0%')
  assert.equal(formatDelta(null), '기준 없음')
})

test('formatDuration renders hours and minutes in Korean', () => {
  assert.equal(formatDuration(2 * 3600_000 + 14 * 60_000), '2시간 14분')
  assert.equal(formatDuration(45 * 60_000), '45분')
  assert.equal(formatDuration(0), '0분')
})

test('niceCeil rounds an axis maximum up to a readable step', async () => {
  const { niceCeil } = await import('../src/format.js')
  assert.equal(niceCeil(587.03), 600)
  assert.equal(niceCeil(1.7), 2)
  assert.equal(niceCeil(23), 25)
  assert.equal(niceCeil(4200), 5000)
})

test('niceCeil leaves an already round value alone', async () => {
  const { niceCeil } = await import('../src/format.js')
  assert.equal(niceCeil(500), 500)
})

test('niceCeil returns zero for non-positive input', async () => {
  const { niceCeil } = await import('../src/format.js')
  assert.equal(niceCeil(0), 0)
  assert.equal(niceCeil(-5), 0)
})

test('formatCostCompact keeps axis labels short', async () => {
  const { formatCostCompact } = await import('../src/format.js')
  assert.equal(formatCostCompact(0), '$0')
  assert.equal(formatCostCompact(150), '$150')
  assert.equal(formatCostCompact(1000), '$1.0K')
  assert.equal(formatCostCompact(12_400), '$12.4K')
})

test('formatCostCompact keeps sub-dollar values readable', async () => {
  const { formatCostCompact } = await import('../src/format.js')
  assert.equal(formatCostCompact(0.5), '$0.50')
})
