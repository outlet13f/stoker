import test from 'node:test'
import assert from 'node:assert/strict'
import { mapWithLimit } from '../src/concurrency.js'

test('mapWithLimit keeps results in input order', async () => {
  const result = await mapWithLimit([3, 1, 2], 2, async (n) => n * 10)
  assert.deepEqual(result, [30, 10, 20])
})

test('mapWithLimit never runs more than the limit at once', async () => {
  // Arrange
  let active = 0
  let peak = 0

  // Act
  await mapWithLimit([1, 2, 3, 4, 5, 6, 7, 8], 3, async () => {
    active += 1
    peak = Math.max(peak, active)
    await new Promise((resolve) => setImmediate(resolve))
    active -= 1
  })

  // Assert
  assert.ok(peak <= 3, `peak concurrency was ${peak}`)
})

test('mapWithLimit handles an empty list', async () => {
  assert.deepEqual(await mapWithLimit([], 4, async (n) => n), [])
})

test('mapWithLimit propagates the first rejection', async () => {
  await assert.rejects(
    () => mapWithLimit([1, 2], 2, async (n) => { if (n === 2) throw new Error('boom') }),
    /boom/,
  )
})
