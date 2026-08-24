import test from 'node:test'
import assert from 'node:assert/strict'
import { resolveTier, calculateCost } from '../src/pricing.js'

test('resolveTier maps every known model family to its tier', () => {
  // Arrange
  const cases = [
    ['claude-opus-5', 'opus'],
    ['claude-opus-4-8', 'opus'],
    ['claude-sonnet-5', 'sonnet'],
    ['claude-haiku-4-5-20251001', 'haiku'],
    ['claude-fable-5', 'fable'],
    ['<synthetic>', 'synthetic'],
  ]

  // Act & Assert
  for (const [model, expected] of cases) {
    assert.equal(resolveTier(model).id, expected, `${model} should map to ${expected}`)
  }
})

test('resolveTier falls back to the default tier for unknown models', () => {
  const tier = resolveTier('claude-something-new-9')
  assert.equal(tier.id, 'sonnet')
  assert.equal(tier.isEstimated, true)
})

test('resolveTier treats a missing model as unknown rather than throwing', () => {
  assert.equal(resolveTier(undefined).id, 'sonnet')
  assert.equal(resolveTier(null).isEstimated, true)
})

test('calculateCost prices plain input and output tokens at tier rates', () => {
  // Arrange: 1M input + 1M output on Opus = 15 + 75
  const usage = { inputTokens: 1_000_000, outputTokens: 1_000_000 }

  // Act
  const cost = calculateCost(usage, 'claude-opus-5')

  // Assert
  assert.equal(cost, 90)
})

test('calculateCost applies the 1.25x and 2x cache write multipliers', () => {
  // Arrange: Opus input is $15/MTok
  const usage = { cacheWrite5mTokens: 1_000_000, cacheWrite1hTokens: 1_000_000 }

  // Act
  const cost = calculateCost(usage, 'claude-opus-5')

  // Assert: 15 * 1.25 + 15 * 2
  assert.equal(cost, 18.75 + 30)
})

test('calculateCost applies the 0.1x cache read multiplier', () => {
  const cost = calculateCost({ cacheReadTokens: 1_000_000 }, 'claude-opus-5')
  assert.equal(cost, 1.5)
})

test('calculateCost returns zero for synthetic messages', () => {
  const usage = { inputTokens: 5_000_000, outputTokens: 5_000_000 }
  assert.equal(calculateCost(usage, '<synthetic>'), 0)
})

test('calculateCost treats absent token fields as zero', () => {
  assert.equal(calculateCost({}, 'claude-opus-5'), 0)
})

test('calculateCacheSavings values cache reads against the full input price', async () => {
  const { calculateCacheSavings } = await import('../src/pricing.js')
  // Opus input $15/MTok, 캐시 읽기는 0.1배이므로 0.9배만큼 절약된다
  assert.equal(calculateCacheSavings({ cacheReadTokens: 1_000_000 }, 'claude-opus-5'), 13.5)
})

test('calculateCacheSavings is zero without cache reads', async () => {
  const { calculateCacheSavings } = await import('../src/pricing.js')
  assert.equal(calculateCacheSavings({ inputTokens: 500 }, 'claude-opus-5'), 0)
})

test('calculateCostBreakdown splits the cost across token buckets', async () => {
  const { calculateCostBreakdown, calculateCost } = await import('../src/pricing.js')
  const usage = {
    inputTokens: 1_000_000,
    outputTokens: 1_000_000,
    cacheWrite5mTokens: 1_000_000,
    cacheWrite1hTokens: 1_000_000,
    cacheReadTokens: 1_000_000,
  }

  const parts = calculateCostBreakdown(usage, 'claude-opus-5')

  assert.equal(parts.inputCost, 15)
  assert.equal(parts.outputCost, 75)
  assert.equal(parts.cacheWrite5mCost, 18.75)
  assert.equal(parts.cacheWrite1hCost, 30)
  assert.equal(parts.cacheReadCost, 1.5)
})

test('calculateCostBreakdown sums back to the total cost', async () => {
  const { calculateCostBreakdown, calculateCost } = await import('../src/pricing.js')
  const usage = { inputTokens: 300, outputTokens: 900, cacheReadTokens: 40_000 }
  const parts = calculateCostBreakdown(usage, 'claude-sonnet-5')
  const summed = Object.values(parts).reduce((a, b) => a + b, 0)

  assert.ok(Math.abs(summed - calculateCost(usage, 'claude-sonnet-5')) < 1e-9)
})
