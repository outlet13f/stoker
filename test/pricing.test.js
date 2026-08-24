import test from 'node:test'
import assert from 'node:assert/strict'
import { resolveModelPrice, parseModelId, calculateCost } from '../src/pricing.js'

/* ---------- 모델 ID 해석 ---------- */

test('parseModelId reads family and version from current model ids', () => {
  // Assert
  assert.deepEqual(parseModelId('claude-opus-5'), { family: 'opus', version: 5 })
  assert.deepEqual(parseModelId('claude-opus-4-8'), { family: 'opus', version: 4.8 })
  assert.deepEqual(parseModelId('claude-sonnet-5'), { family: 'sonnet', version: 5 })
  assert.deepEqual(parseModelId('claude-haiku-4-5-20251001'), { family: 'haiku', version: 4.5 })
  assert.deepEqual(parseModelId('claude-fable-5'), { family: 'fable', version: 5 })
})

test('parseModelId does not mistake a trailing date for a version', () => {
  // Assert — claude-3-5-sonnet-20240620 의 20240620 을 버전으로 읽으면 안 된다
  assert.deepEqual(parseModelId('claude-3-5-sonnet-20240620'), { family: 'sonnet', version: 3.5 })
  assert.deepEqual(parseModelId('claude-3-opus-20240229'), { family: 'opus', version: 3 })
})

test('parseModelId reports synthetic messages separately', () => {
  // Assert
  assert.deepEqual(parseModelId('<synthetic>'), { family: 'synthetic', version: null })
})

test('parseModelId gives up cleanly on an unrecognisable id', () => {
  // Assert
  assert.deepEqual(parseModelId('gpt-4o'), { family: null, version: null })
  assert.deepEqual(parseModelId(undefined), { family: null, version: null })
  assert.deepEqual(parseModelId(null), { family: null, version: null })
})

/* ---------- 단가 해석 ---------- */

test('resolveModelPrice uses the published price for each known model', () => {
  // Arrange — https://platform.claude.com/docs/ko/about-claude/pricing
  const cases = [
    ['claude-opus-5', 5, 25],
    ['claude-opus-4-8', 5, 25],
    ['claude-opus-4-5', 5, 25],
    ['claude-opus-4-1', 15, 75],
    ['claude-sonnet-5', 2, 10],
    ['claude-sonnet-4-6', 3, 15],
    ['claude-haiku-4-5-20251001', 1, 5],
    ['claude-fable-5', 10, 50],
  ]

  // Act & Assert
  for (const [model, input, output] of cases) {
    const price = resolveModelPrice(model)
    assert.equal(price.input, input, `${model} input`)
    assert.equal(price.output, output, `${model} output`)
    assert.equal(price.isEstimated, false, `${model} 은 공개 단가다`)
  }
})

test('resolveModelPrice separates Opus generations that are priced differently', () => {
  // Assert — 4.1 은 $15, 4.5 부터 $5. 계열 키워드만 보면 구분할 수 없다.
  assert.equal(resolveModelPrice('claude-opus-4-1').input, 15)
  assert.equal(resolveModelPrice('claude-opus-4-5').input, 5)
})

test('resolveModelPrice derives cache rates from the input rate', () => {
  // Act
  const opus = resolveModelPrice('claude-opus-5')

  // Assert
  assert.equal(opus.cacheWrite5m, 6.25)
  assert.equal(opus.cacheWrite1h, 10)
  assert.equal(opus.cacheRead, 0.5)
})

test('resolveModelPrice estimates an unreleased version from the newest known one', () => {
  // Act
  const future = resolveModelPrice('claude-opus-9')

  // Assert
  assert.equal(future.input, 5, 'Opus 5 단가로 추정')
  assert.equal(future.isEstimated, true)
})

test('resolveModelPrice estimates an unknown family at current Sonnet rates', () => {
  // Act
  const unknown = resolveModelPrice('claude-brandnew-1')

  // Assert
  assert.equal(unknown.input, 2)
  assert.equal(unknown.output, 10)
  assert.equal(unknown.isEstimated, true)
})

test('resolveModelPrice treats a missing model as unknown rather than throwing', () => {
  // Assert
  assert.equal(resolveModelPrice(undefined).isEstimated, true)
  assert.equal(resolveModelPrice(null).isEstimated, true)
})

test('resolveModelPrice keeps synthetic messages free', () => {
  // Act
  const synthetic = resolveModelPrice('<synthetic>')

  // Assert
  assert.equal(synthetic.input, 0)
  assert.equal(synthetic.output, 0)
  assert.equal(synthetic.cacheRead, 0)
  assert.equal(synthetic.isEstimated, false)
})

test('calculateCost prices plain input and output tokens at published rates', () => {
  // Arrange: Opus 5 는 input $5 / output $25
  const usage = { inputTokens: 1_000_000, outputTokens: 1_000_000 }

  // Act
  const cost = calculateCost(usage, 'claude-opus-5')

  // Assert
  assert.equal(cost, 30)
})

test('calculateCost applies the 1.25x and 2x cache write multipliers', () => {
  // Arrange: Opus 5 input is $5/MTok
  const usage = { cacheWrite5mTokens: 1_000_000, cacheWrite1hTokens: 1_000_000 }

  // Act
  const cost = calculateCost(usage, 'claude-opus-5')

  // Assert: 5 * 1.25 + 5 * 2
  assert.equal(cost, 6.25 + 10)
})

test('calculateCost applies the 0.1x cache read multiplier', () => {
  const cost = calculateCost({ cacheReadTokens: 1_000_000 }, 'claude-opus-5')
  assert.equal(cost, 0.5)
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
  // Opus 5 input $5/MTok, 캐시 읽기는 0.1배이므로 0.9배만큼 절약된다
  assert.equal(calculateCacheSavings({ cacheReadTokens: 1_000_000 }, 'claude-opus-5'), 4.5)
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

  assert.equal(parts.inputCost, 5)
  assert.equal(parts.outputCost, 25)
  assert.equal(parts.cacheWrite5mCost, 6.25)
  assert.equal(parts.cacheWrite1hCost, 10)
  assert.equal(parts.cacheReadCost, 0.5)
})

test('calculateCostBreakdown sums back to the total cost', async () => {
  const { calculateCostBreakdown, calculateCost } = await import('../src/pricing.js')
  const usage = { inputTokens: 300, outputTokens: 900, cacheReadTokens: 40_000 }
  const parts = calculateCostBreakdown(usage, 'claude-sonnet-5')
  const summed = Object.values(parts).reduce((a, b) => a + b, 0)

  assert.ok(Math.abs(summed - calculateCost(usage, 'claude-sonnet-5')) < 1e-9)
})
