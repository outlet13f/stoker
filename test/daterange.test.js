import test from 'node:test'
import assert from 'node:assert/strict'
import { parseDateRange } from '../src/daterange.js'

const MS_PER_DAY = 24 * 60 * 60 * 1000

test('parseDateRange returns null when neither bound is given', () => {
  // Assert
  assert.equal(parseDateRange({}, 'UTC'), null)
  assert.equal(parseDateRange({ from: null, to: null }, 'UTC'), null)
})

test('parseDateRange spans from local midnight to the end of the to-day', () => {
  // Act
  const range = parseDateRange({ from: '2026-08-01', to: '2026-08-01' }, 'UTC')

  // Assert
  assert.equal(range.from, Date.parse('2026-08-01T00:00:00.000Z'))
  assert.equal(range.to, Date.parse('2026-08-01T23:59:59.999Z'))
})

test('parseDateRange anchors the window in the aggregation timezone', () => {
  // Act — KST 자정은 UTC 로 전날 15시다
  const range = parseDateRange({ from: '2026-08-01', to: '2026-08-01' }, 'Asia/Seoul')

  // Assert
  assert.equal(range.from, Date.parse('2026-07-31T15:00:00.000Z'))
  assert.equal(range.to, range.from + MS_PER_DAY - 1)
})

test('parseDateRange keeps the chosen dates for display', () => {
  // Act
  const range = parseDateRange({ from: '2026-08-01', to: '2026-08-09' }, 'UTC')

  // Assert
  assert.equal(range.fromDate, '2026-08-01')
  assert.equal(range.toDate, '2026-08-09')
})

test('parseDateRange rejects a half-specified range', () => {
  // Assert
  assert.throws(() => parseDateRange({ from: '2026-08-01' }, 'UTC'), /함께/)
  assert.throws(() => parseDateRange({ to: '2026-08-01' }, 'UTC'), /함께/)
})

test('parseDateRange rejects a non ISO date shape', () => {
  // Assert
  assert.throws(() => parseDateRange({ from: '8/1/2026', to: '2026-08-02' }, 'UTC'), /YYYY-MM-DD/)
  assert.throws(() => parseDateRange({ from: '2026-8-1', to: '2026-08-02' }, 'UTC'), /YYYY-MM-DD/)
})

test('parseDateRange rejects a date that does not exist on the calendar', () => {
  // Assert
  assert.throws(() => parseDateRange({ from: '2026-02-30', to: '2026-03-01' }, 'UTC'), /존재하지 않는/)
  assert.throws(() => parseDateRange({ from: '2026-13-01', to: '2026-13-02' }, 'UTC'), /존재하지 않는/)
})

test('parseDateRange rejects a reversed range', () => {
  // Assert
  assert.throws(() => parseDateRange({ from: '2026-08-10', to: '2026-08-01' }, 'UTC'), /from/)
})

test('parseDateRange accepts a single-day range', () => {
  // Act
  const range = parseDateRange({ from: '2026-08-05', to: '2026-08-05' }, 'UTC')

  // Assert
  assert.equal(range.to - range.from, MS_PER_DAY - 1)
})
