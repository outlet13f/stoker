import test from 'node:test'
import assert from 'node:assert/strict'
import { createAlerter } from '../electron/alerts.js'

const MINUTE = 60_000
const NOW = Date.parse('2026-08-24T08:00:00Z')

const limits = (percent, over = {}) => ({
  source: 'live',
  isStale: false,
  ageMs: 1000,
  entries: [
    { kind: 'session', label: '현재 세션', percent, severity: 'normal', resetsAt: NOW + 120 * MINUTE, isActive: true },
    { kind: 'weekly_all', label: '주간 · 모든 모델', percent: 20, severity: 'normal', resetsAt: null, isActive: false },
  ],
  ...over,
})

const report = (level = 'ok', over = {}) => ({
  burnStatus: { level, rank: 0.5 },
  activeBlock: { cost: 42, endTime: NOW + 90 * MINUTE },
  activeBurn: { projectedCost: 100, remainingMs: 90 * MINUTE },
  ...over,
})

/* ---------- 한도 임계값 ---------- */

test('crossing a threshold raises one alert', () => {
  // Arrange
  const alerter = createAlerter({ thresholds: [80, 95] })

  // Act
  const alerts = alerter({ report: report(), limits: limits(81), now: NOW })

  // Assert
  assert.equal(alerts.length, 1)
  assert.match(alerts[0].title, /80%/)
  assert.match(alerts[0].body, /현재 세션 81%/)
})

test('staying above the threshold does not keep alerting', () => {
  // Arrange — 5초마다 폴링하는데 계속 울리면 쓸 수 없다
  const alerter = createAlerter({ thresholds: [80] })
  alerter({ report: report(), limits: limits(81), now: NOW })

  // Act
  const again = alerter({ report: report(), limits: limits(85), now: NOW + MINUTE })

  // Assert
  assert.deepEqual(again, [])
})

test('only the highest newly crossed threshold alerts', () => {
  // Arrange — 한 번에 80 과 95 를 다 넘어도 알림은 하나다
  const alerter = createAlerter({ thresholds: [80, 95] })

  // Act
  const alerts = alerter({ report: report(), limits: limits(96), now: NOW })

  // Assert
  assert.equal(alerts.length, 1)
  assert.match(alerts[0].title, /95%/)
})

test('a higher threshold still alerts after the lower one did', () => {
  // Arrange
  const alerter = createAlerter({ thresholds: [80, 95] })
  alerter({ report: report(), limits: limits(81), now: NOW })

  // Act
  const alerts = alerter({ report: report(), limits: limits(96), now: NOW + MINUTE })

  // Assert
  assert.equal(alerts.length, 1)
  assert.match(alerts[0].title, /95%/)
})

test('dropping back below rearms the threshold', () => {
  // Arrange — 한도가 재설정되면 다시 알려야 한다
  const alerter = createAlerter({ thresholds: [80] })
  alerter({ report: report(), limits: limits(81), now: NOW })
  alerter({ report: report(), limits: limits(3), now: NOW + 120 * MINUTE })

  // Act
  const alerts = alerter({ report: report(), limits: limits(82), now: NOW + 200 * MINUTE })

  // Assert
  assert.equal(alerts.length, 1)
})

test('a stale limit reading never raises an alert', () => {
  // Arrange — 3시간 전 값으로 알리면 거짓 경보이거나 이미 늦은 경보다
  const alerter = createAlerter({ thresholds: [80] })

  // Act
  const alerts = alerter({
    report: report(),
    limits: limits(90, { isStale: true, source: 'cache', ageMs: 189 * MINUTE }),
    now: NOW,
  })

  // Assert
  assert.deepEqual(alerts, [])
})

test('no limit reading at all raises nothing', () => {
  // Arrange
  const alerter = createAlerter({ thresholds: [80] })

  // Assert
  assert.deepEqual(alerter({ report: report(), limits: null, now: NOW }), [])
})

test('the alert says when the limit resets', () => {
  // Arrange
  const alerter = createAlerter({ thresholds: [80] })

  // Act
  const [alert] = alerter({ report: report(), limits: limits(81), now: NOW })

  // Assert
  assert.match(alert.body, /2시간 0분 후 재설정/)
})

/* ---------- 소진 상태 악화 ---------- */

test('a worsening burn status alerts', () => {
  // Arrange
  const alerter = createAlerter({ thresholds: [80] })
  alerter({ report: report('ok'), limits: limits(10), now: NOW })

  // Act
  const alerts = alerter({ report: report('warn'), limits: limits(10), now: NOW + MINUTE })

  // Assert
  assert.equal(alerts.length, 1)
  assert.match(alerts[0].title, /주의/)
})

test('an improving burn status stays quiet', () => {
  // Arrange
  const alerter = createAlerter({ thresholds: [80] })
  alerter({ report: report('crit'), limits: limits(10), now: NOW })

  // Act
  const alerts = alerter({ report: report('ok'), limits: limits(10), now: NOW + MINUTE })

  // Assert
  assert.deepEqual(alerts, [])
})

test('the same status does not alert twice', () => {
  // Arrange
  const alerter = createAlerter({ thresholds: [80] })
  alerter({ report: report('warn'), limits: limits(10), now: NOW })

  // Act
  const alerts = alerter({ report: report('warn'), limits: limits(10), now: NOW + MINUTE })

  // Assert
  assert.deepEqual(alerts, [])
})

test('the very first reading does not alert on status alone', () => {
  // Arrange — 앱을 켠 순간 이미 warn 이라고 놀래킬 이유는 없다
  const alerter = createAlerter({ thresholds: [80] })

  // Act
  const alerts = alerter({ report: report('warn'), limits: limits(10), now: NOW })

  // Assert
  assert.deepEqual(alerts, [])
})

/* ---------- 재설정 임박 ---------- */

test('an imminent reset alerts when the limit is meaningfully used', () => {
  // Arrange
  const alerter = createAlerter({ thresholds: [80], resetWarningMs: 10 * MINUTE })
  const soon = limits(60)
  soon.entries[0].resetsAt = NOW + 8 * MINUTE

  // Act
  const alerts = alerter({ report: report(), limits: soon, now: NOW })

  // Assert
  assert.equal(alerts.length, 1)
  assert.match(alerts[0].title, /재설정/)
})

test('an imminent reset stays quiet when barely anything was used', () => {
  // Arrange — 5% 쓰고 있는데 재설정을 알리는 것은 소음이다
  const alerter = createAlerter({ thresholds: [80], resetWarningMs: 10 * MINUTE })
  const soon = limits(5)
  soon.entries[0].resetsAt = NOW + 8 * MINUTE

  // Assert
  assert.deepEqual(alerter({ report: report(), limits: soon, now: NOW }), [])
})

test('the reset alert fires once per window', () => {
  // Arrange
  const alerter = createAlerter({ thresholds: [80], resetWarningMs: 10 * MINUTE })
  const soon = limits(60)
  soon.entries[0].resetsAt = NOW + 8 * MINUTE
  alerter({ report: report(), limits: soon, now: NOW })

  // Act
  const again = alerter({ report: report(), limits: soon, now: NOW + MINUTE })

  // Assert
  assert.deepEqual(again, [])
})

test('a new window can warn again', () => {
  // Arrange
  const alerter = createAlerter({ thresholds: [80], resetWarningMs: 10 * MINUTE })
  const first = limits(60)
  first.entries[0].resetsAt = NOW + 8 * MINUTE
  alerter({ report: report(), limits: first, now: NOW })

  // Act — 다음 5시간 창
  const next = limits(70)
  next.entries[0].resetsAt = NOW + 308 * MINUTE
  const alerts = alerter({ report: report(), limits: next, now: NOW + 300 * MINUTE })

  // Assert
  assert.equal(alerts.length, 1)
})

/* ---------- 꺼진 상태 ---------- */

test('a disabled alerter never returns anything', () => {
  // Arrange
  const alerter = createAlerter({ enabled: false, thresholds: [80] })

  // Act & Assert
  assert.deepEqual(alerter({ report: report('crit'), limits: limits(99), now: NOW }), [])
})

test('every alert carries a stable id so it can be deduped downstream', () => {
  // Arrange
  const alerter = createAlerter({ thresholds: [80] })

  // Act
  const [alert] = alerter({ report: report(), limits: limits(81), now: NOW })

  // Assert
  assert.equal(typeof alert.id, 'string')
  assert.ok(alert.id.length > 0)
})
