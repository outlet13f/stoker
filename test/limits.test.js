import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import {
  readUsageLimits,
  resolveUsageLimits,
  createLimitsResolver,
  STALE_AFTER_MS,
} from '../src/limits.js'

const NOW = Date.parse('2026-08-24T07:30:00Z')

const utilization = (over = {}) => ({
  fetchedAtMs: NOW - 60_000,
  accountUuid: '71cb63cd-3af3-4de5-812c-e1ff46288410',
  utilization: {
    limits: [
      {
        kind: 'session',
        group: 'session',
        percent: 53,
        severity: 'normal',
        resets_at: '2026-08-24T09:35:00.000000+00:00',
        scope: null,
        is_active: true,
      },
      {
        kind: 'weekly_all',
        group: 'weekly',
        percent: 18,
        severity: 'normal',
        resets_at: '2026-08-25T14:00:00.000000+00:00',
        scope: null,
        is_active: false,
      },
      {
        kind: 'weekly_scoped',
        group: 'weekly',
        percent: 10,
        severity: 'warning',
        resets_at: '2026-08-25T14:00:00.000000+00:00',
        scope: { model: { id: null, display_name: 'Fable' }, surface: null },
        is_active: false,
      },
    ],
    ...over,
  },
})

async function withConfig(contents, run) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'cud-limits-'))
  const file = path.join(dir, '.claude.json')
  await fs.writeFile(file, typeof contents === 'string' ? contents : JSON.stringify(contents))

  try {
    await run(file)
  } finally {
    await fs.rm(dir, { recursive: true, force: true })
  }
}

test('readUsageLimits reads the percentages Claude Code cached', async () => {
  await withConfig({ cachedUsageUtilization: utilization() }, async (configPath) => {
    // Act
    const limits = await readUsageLimits({ configPath, now: NOW })

    // Assert
    assert.equal(limits.entries.length, 3)
    assert.equal(limits.entries[0].percent, 53)
    assert.equal(limits.entries[1].percent, 18)
    assert.equal(limits.entries[2].percent, 10)
  })
})

test('readUsageLimits labels each limit in Korean', async () => {
  await withConfig({ cachedUsageUtilization: utilization() }, async (configPath) => {
    // Act
    const { entries } = await readUsageLimits({ configPath, now: NOW })

    // Assert
    assert.equal(entries[0].label, '현재 세션')
    assert.equal(entries[1].label, '주간 · 모든 모델')
    assert.equal(entries[2].label, '주간 · Fable')
  })
})

test('readUsageLimits keeps the reset time as a timestamp', async () => {
  await withConfig({ cachedUsageUtilization: utilization() }, async (configPath) => {
    // Act
    const { entries } = await readUsageLimits({ configPath, now: NOW })

    // Assert
    assert.equal(entries[0].resetsAt, Date.parse('2026-08-24T09:35:00.000Z'))
    assert.equal(entries[0].isActive, true)
    assert.equal(entries[2].severity, 'warning')
  })
})

test('readUsageLimits reports how old the cached reading is', async () => {
  await withConfig({ cachedUsageUtilization: utilization() }, async (configPath) => {
    // Act
    const limits = await readUsageLimits({ configPath, now: NOW })

    // Assert
    assert.equal(limits.fetchedAt, NOW - 60_000)
    assert.equal(limits.ageMs, 60_000)
    assert.equal(limits.isStale, false)
  })
})

test('readUsageLimits flags a reading that is too old to trust', async () => {
  // Arrange — 세션 한도는 빠르게 움직인다. 오래된 값을 그대로 보여주면 오해가 된다.
  const stale = utilization()
  stale.fetchedAtMs = NOW - STALE_AFTER_MS - 1

  await withConfig({ cachedUsageUtilization: stale }, async (configPath) => {
    // Act
    const limits = await readUsageLimits({ configPath, now: NOW })

    // Assert
    assert.equal(limits.isStale, true)
  })
})

test('readUsageLimits never surfaces the account identifier', async () => {
  await withConfig({ cachedUsageUtilization: utilization() }, async (configPath) => {
    // Act
    const limits = await readUsageLimits({ configPath, now: NOW })

    // Assert — 리포트는 JSON 으로 나가고 공유될 수 있다
    assert.doesNotMatch(JSON.stringify(limits), /71cb63cd/)
    assert.equal('accountUuid' in limits, false)
  })
})

test('readUsageLimits returns null when the config has no cached reading', async () => {
  await withConfig({ numStartups: 3 }, async (configPath) => {
    assert.equal(await readUsageLimits({ configPath, now: NOW }), null)
  })
})

test('readUsageLimits returns null rather than throwing on a missing file', async () => {
  // Act & Assert
  assert.equal(await readUsageLimits({ configPath: '/nope/.claude.json', now: NOW }), null)
})

test('readUsageLimits returns null rather than throwing on broken JSON', async () => {
  await withConfig('{ this is not json', async (configPath) => {
    assert.equal(await readUsageLimits({ configPath, now: NOW }), null)
  })
})

test('readUsageLimits tolerates a limits list that is not an array', async () => {
  await withConfig({ cachedUsageUtilization: utilization({ limits: 'nope' }) }, async (configPath) => {
    // Act
    const limits = await readUsageLimits({ configPath, now: NOW })

    // Assert
    assert.deepEqual(limits.entries, [])
  })
})

test('readUsageLimits skips entries whose percent is unusable', async () => {
  // Arrange
  const broken = utilization({
    limits: [
      { kind: 'session', group: 'session', percent: null, resets_at: null },
      { kind: 'weekly_all', group: 'weekly', percent: 'lots', resets_at: null },
      { kind: 'weekly_all', group: 'weekly', percent: 42, resets_at: null },
      null,
    ],
  })

  await withConfig({ cachedUsageUtilization: broken }, async (configPath) => {
    // Act
    const { entries } = await readUsageLimits({ configPath, now: NOW })

    // Assert
    assert.equal(entries.length, 1)
    assert.equal(entries[0].percent, 42)
  })
})

test('readUsageLimits clamps a percent outside 0-100', async () => {
  // Arrange
  const odd = utilization({
    limits: [
      { kind: 'session', group: 'session', percent: 143, resets_at: null },
      { kind: 'weekly_all', group: 'weekly', percent: -5, resets_at: null },
    ],
  })

  await withConfig({ cachedUsageUtilization: odd }, async (configPath) => {
    // Act
    const { entries } = await readUsageLimits({ configPath, now: NOW })

    // Assert
    assert.equal(entries[0].percent, 100)
    assert.equal(entries[1].percent, 0)
  })
})

test('readUsageLimits falls back to the raw kind for a limit it does not know', async () => {
  // Arrange — 앞으로 새 한도 종류가 생겨도 이름을 지어내지 않는다
  const unknown = utilization({
    limits: [{ kind: 'monthly_something', group: 'monthly', percent: 7, resets_at: null }],
  })

  await withConfig({ cachedUsageUtilization: unknown }, async (configPath) => {
    // Act
    const { entries } = await readUsageLimits({ configPath, now: NOW })

    // Assert
    assert.equal(entries[0].label, 'monthly_something')
  })
})

test('readUsageLimits leaves an unparseable reset time as null', async () => {
  // Arrange
  const odd = utilization({
    limits: [{ kind: 'session', group: 'session', percent: 5, resets_at: 'soon' }],
  })

  await withConfig({ cachedUsageUtilization: odd }, async (configPath) => {
    // Act
    const { entries } = await readUsageLimits({ configPath, now: NOW })

    // Assert
    assert.equal(entries[0].resetsAt, null)
  })
})

/* ---------- 실시간 조회와 캐시 폴백 ---------- */


const TOKEN = 'sk-ant-oat01-EXAMPLE-TOKEN-VALUE-1234567890'
const fakeCreds = () =>
  Object.defineProperty({ source: 'env', expiresAt: null }, 'accessToken', { value: TOKEN, enumerable: false })

const liveBody = {
  limits: [
    { kind: 'session', group: 'session', percent: 53, severity: 'normal', resets_at: null, is_active: true },
  ],
}

test('resolveUsageLimits prefers the live reading', async () => {
  await withConfig({ cachedUsageUtilization: utilization() }, async (configPath) => {
    // Act
    const limits = await resolveUsageLimits({
      configPath, now: NOW,
      loadCredentialsImpl: async () => fakeCreds(),
      fetchImpl: async () => ({ ok: true, status: 200, json: async () => liveBody }),
    })

    // Assert
    assert.equal(limits.source, 'live')
    assert.equal(limits.entries.length, 1)
    assert.equal(limits.entries[0].percent, 53)
    assert.equal(limits.isStale, false)
    assert.equal(limits.fallbackReason, null)
  })
})

test('resolveUsageLimits falls back to the cache and says why', async () => {
  await withConfig({ cachedUsageUtilization: utilization() }, async (configPath) => {
    // Act
    const limits = await resolveUsageLimits({
      configPath, now: NOW,
      loadCredentialsImpl: async () => fakeCreds(),
      fetchImpl: async () => ({ ok: false, status: 401, json: async () => ({}) }),
    })

    // Assert — 조용히 낡은 값을 보여주면 실시간인 줄 오해한다
    assert.equal(limits.source, 'cache')
    assert.match(limits.fallbackReason, /HTTP 401/)
    assert.equal(limits.entries.length, 3)
  })
})

test('resolveUsageLimits falls back when no token can be found', async () => {
  await withConfig({ cachedUsageUtilization: utilization() }, async (configPath) => {
    // Act
    const limits = await resolveUsageLimits({
      configPath, now: NOW,
      loadCredentialsImpl: async () => null,
      fetchImpl: async () => { throw new Error('should not be called') },
    })

    // Assert
    assert.equal(limits.source, 'cache')
    assert.match(limits.fallbackReason, /토큰/)
  })
})

test('resolveUsageLimits skips the network entirely when asked', async () => {
  await withConfig({ cachedUsageUtilization: utilization() }, async (configPath) => {
    // Arrange
    let called = false

    // Act
    const limits = await resolveUsageLimits({
      configPath, now: NOW, live: false,
      loadCredentialsImpl: async () => { called = true; return fakeCreds() },
    })

    // Assert
    assert.equal(called, false, '--no-live-limits 면 자격증명도 읽지 않는다')
    assert.equal(limits.source, 'cache')
  })
})

test('resolveUsageLimits returns null when live fails and there is no cache', async () => {
  await withConfig({ numStartups: 1 }, async (configPath) => {
    // Act
    const limits = await resolveUsageLimits({
      configPath, now: NOW,
      loadCredentialsImpl: async () => null,
    })

    // Assert
    assert.equal(limits, null)
  })
})

test('the token never reaches the reading, even in a fallback reason', async () => {
  await withConfig({ cachedUsageUtilization: utilization() }, async (configPath) => {
    // Arrange — 서버가 토큰을 되돌려 주는 최악의 경우
    const limits = await resolveUsageLimits({
      configPath, now: NOW,
      loadCredentialsImpl: async () => fakeCreds(),
      fetchImpl: async () => { throw new Error(`upstream said Bearer ${TOKEN}`) },
    })

    // Assert
    assert.doesNotMatch(JSON.stringify(limits), /EXAMPLE-TOKEN/)
    assert.match(limits.fallbackReason, /<redacted>/)
  })
})

/* ---------- 스로틀과 백오프 ---------- */

function resolverHarness({ responses, configPath, minIntervalMs = 300_000 }) {
  let index = 0
  const calls = []
  const resolve = createLimitsResolver({
    configPath,
    minIntervalMs,
    loadCredentialsImpl: async () => fakeCreds(),
    fetchImpl: async () => {
      calls.push(index)
      const next = responses[Math.min(index, responses.length - 1)]
      index += 1
      return next()
    },
  })
  return { resolve, calls }
}

const okOnce = () => ({ ok: true, status: 200, json: async () => liveBody })
const tooMany = (retryAfter) => () => ({
  ok: false, status: 429,
  headers: { get: (n) => (n === 'retry-after' ? retryAfter : null) },
  json: async () => ({}),
})

test('the resolver does not call again inside the minimum interval', async () => {
  await withConfig({ cachedUsageUtilization: utilization() }, async (configPath) => {
    // Arrange
    const { resolve, calls } = resolverHarness({ responses: [okOnce], configPath })

    // Act — 폴링 주기가 5초여도 서버를 다시 두드리지 않아야 한다
    await resolve({ now: NOW })
    const second = await resolve({ now: NOW + 5_000 })

    // Assert
    assert.equal(calls.length, 1)
    assert.equal(second.source, 'live', '마지막 성공값을 재사용한다')
  })
})

test('the resolver calls again once the interval has passed', async () => {
  await withConfig({ cachedUsageUtilization: utilization() }, async (configPath) => {
    // Arrange
    const { resolve, calls } = resolverHarness({ responses: [okOnce], configPath })

    // Act
    await resolve({ now: NOW })
    await resolve({ now: NOW + 300_001 })

    // Assert
    assert.equal(calls.length, 2)
  })
})

test('the resolver rests for as long as the server asked', async () => {
  await withConfig({ cachedUsageUtilization: utilization() }, async (configPath) => {
    // Arrange — 자체 최소 간격을 짧게 둬서 retry-after 가 결정하게 한다
    const { resolve, calls } = resolverHarness({
      responses: [tooMany('203')], configPath, minIntervalMs: 10_000,
    })

    // Act
    const first = await resolve({ now: NOW })
    await resolve({ now: NOW + 202_000 })
    await resolve({ now: NOW + 204_000 })

    // Assert
    assert.match(first.fallbackReason, /HTTP 429/)
    assert.equal(calls.length, 2, '203초가 지나기 전에는 다시 부르지 않는다')
  })
})

test('the resolver keeps its own floor when it is longer than Retry-After', async () => {
  await withConfig({ cachedUsageUtilization: utilization() }, async (configPath) => {
    // Arrange — 서버가 203초라 해도 우리 하한이 300초면 더 긴 쪽을 지킨다
    const { resolve, calls } = resolverHarness({
      responses: [tooMany('203')], configPath, minIntervalMs: 300_000,
    })

    // Act
    await resolve({ now: NOW })
    await resolve({ now: NOW + 204_000 })
    await resolve({ now: NOW + 301_000 })

    // Assert
    assert.equal(calls.length, 2)
  })
})

test('a throttled reading says how long until the next try', async () => {
  await withConfig({ cachedUsageUtilization: utilization() }, async (configPath) => {
    // Arrange
    const { resolve } = resolverHarness({ responses: [tooMany('203')], configPath })

    // Act
    await resolve({ now: NOW })
    const during = await resolve({ now: NOW + 3_000 })

    // Assert
    assert.match(during.fallbackReason, /200초 후 재시도/)
  })
})

test('the resolver never calls at all when live is off', async () => {
  await withConfig({ cachedUsageUtilization: utilization() }, async (configPath) => {
    // Arrange
    let called = false
    const resolve = createLimitsResolver({
      configPath, live: false,
      loadCredentialsImpl: async () => { called = true; return fakeCreds() },
    })

    // Act
    const limits = await resolve({ now: NOW })

    // Assert
    assert.equal(called, false)
    assert.equal(limits.source, 'cache')
  })
})
