import test from 'node:test'
import assert from 'node:assert/strict'
import { fetchLiveUtilization } from '../src/usage-api.js'

const TOKEN = 'sk-ant-oat01-EXAMPLE-TOKEN-VALUE-1234567890'
const credentials = Object.defineProperty({ source: 'env', expiresAt: null }, 'accessToken', {
  value: TOKEN, enumerable: false,
})

const ok = (body) => async () => ({ ok: true, status: 200, json: async () => body })
const payload = { limits: [{ kind: 'session', group: 'session', percent: 53, resets_at: null }] }

test('fetchLiveUtilization calls the endpoint Claude Code uses', async () => {
  // Arrange
  let seen = null
  const fetchImpl = async (url, options) => {
    seen = { url, options }
    return { ok: true, status: 200, json: async () => payload }
  }

  // Act
  await fetchLiveUtilization({ credentials, fetchImpl, now: 1000 })

  // Assert
  assert.equal(seen.url, 'https://api.anthropic.com/api/oauth/usage')
  assert.equal(seen.options.method, 'GET')
  assert.equal(seen.options.headers.Authorization, `Bearer ${TOKEN}`)
  assert.equal(seen.options.headers['Content-Type'], 'application/json')
})

test('fetchLiveUtilization returns the limits and when it read them', async () => {
  // Act
  const result = await fetchLiveUtilization({ credentials, fetchImpl: ok(payload), now: 4242 })

  // Assert
  assert.equal(result.limits.length, 1)
  assert.equal(result.fetchedAt, 4242)
})

test('fetchLiveUtilization also accepts the nested utilization shape', async () => {
  // Act
  const result = await fetchLiveUtilization({
    credentials,
    fetchImpl: ok({ utilization: { limits: [{ kind: 'session', percent: 7 }] } }),
    now: 1,
  })

  // Assert
  assert.equal(result.limits.length, 1)
})

test('fetchLiveUtilization refuses to call without a token', async () => {
  // Assert
  await assert.rejects(() => fetchLiveUtilization({ credentials: null, fetchImpl: ok(payload) }), /토큰/)
})

test('fetchLiveUtilization throws on a server-side failure', async () => {
  // Arrange
  const fetchImpl = async () => ({ ok: false, status: 503, headers: { get: () => null }, json: async () => ({}) })

  // Assert
  await assert.rejects(() => fetchLiveUtilization({ credentials, fetchImpl }), /HTTP 503/)
})

test('fetchLiveUtilization throws when the shape is not what we know', async () => {
  // Assert — 틀린 값을 조용히 보여주는 것이 가장 나쁘다
  await assert.rejects(
    () => fetchLiveUtilization({ credentials, fetchImpl: ok({ something: 'else' }) }),
    /형태가 다릅니다/,
  )
  await assert.rejects(
    () => fetchLiveUtilization({ credentials, fetchImpl: ok({ limits: 'nope' }) }),
    /형태가 다릅니다/,
  )
})

test('fetchLiveUtilization throws when the body is not JSON', async () => {
  // Arrange
  const fetchImpl = async () => ({ ok: true, status: 200, json: async () => { throw new Error('bad json') } })

  // Assert
  await assert.rejects(() => fetchLiveUtilization({ credentials, fetchImpl }), /읽지 못했습니다/)
})

test('fetchLiveUtilization gives up after the timeout', async () => {
  // Arrange
  const fetchImpl = (url, { signal }) =>
    new Promise((resolve, reject) => {
      signal.addEventListener('abort', () => {
        const error = new Error('aborted')
        error.name = 'AbortError'
        reject(error)
      })
    })

  // Assert
  await assert.rejects(
    () => fetchLiveUtilization({ credentials, fetchImpl, timeoutMs: 10 }),
    /안에 응답이 없었습니다/,
  )
})

/* ---------- 유출 방지 ---------- */

test('an error message never carries the token', async () => {
  // Arrange — 서버가 토큰을 되돌려 주는 최악의 경우
  const fetchImpl = async () => { throw new Error(`connect failed for Bearer ${TOKEN}`) }

  // Act
  const error = await fetchLiveUtilization({ credentials, fetchImpl }).catch((e) => e)

  // Assert
  assert.doesNotMatch(error.message, /EXAMPLE-TOKEN/)
  assert.match(error.message, /<redacted>/)
})

test('a schema error never carries the token either', async () => {
  // Arrange
  const fetchImpl = ok({ echo: `Bearer ${TOKEN}` })

  // Act
  const error = await fetchLiveUtilization({ credentials, fetchImpl }).catch((e) => e)

  // Assert
  assert.doesNotMatch(error.message, /EXAMPLE-TOKEN/)
})

/* ---------- 레이트 리밋 ---------- */

test('fetchLiveUtilization surfaces the Retry-After the server sent', async () => {
  // Arrange — 이 엔드포인트는 실제로 429 와 retry-after 를 돌려준다
  const fetchImpl = async () => ({
    ok: false, status: 429,
    headers: { get: (name) => (name === 'retry-after' ? '203' : null) },
    json: async () => ({}),
  })

  // Act
  const error = await fetchLiveUtilization({ credentials, fetchImpl }).catch((e) => e)

  // Assert
  assert.equal(error.status, 429)
  assert.equal(error.retryAfterMs, 203_000)
})

test('fetchLiveUtilization copes with a missing or unusable Retry-After', async () => {
  // Arrange
  const make = (value) => async () => ({
    ok: false, status: 429,
    headers: { get: () => value },
    json: async () => ({}),
  })

  // Assert
  assert.equal((await fetchLiveUtilization({ credentials, fetchImpl: make(null) }).catch((e) => e)).retryAfterMs, null)
  assert.equal((await fetchLiveUtilization({ credentials, fetchImpl: make('soon') }).catch((e) => e)).retryAfterMs, null)
})

/* ---------- 스키마 드리프트 ---------- */

test('fetchLiveUtilization rejects a list whose entries it cannot read', async () => {
  // Arrange — percent 가 pct 로 바뀐 상황. 그냥 통과시키면 "실시간 성공,
  // 항목 0개" 가 되어 화면에는 아무것도 안 나오면서 실시간인 줄 알게 된다.
  const drifted = { limits: [{ kind: 'session', group: 'session', pct: 71, resets_at: null }] }

  // Assert
  await assert.rejects(
    () => fetchLiveUtilization({ credentials, fetchImpl: ok(drifted) }),
    /형태가 다릅니다/,
  )
})

test('fetchLiveUtilization accepts a list where at least one entry is readable', async () => {
  // Arrange — 새 종류가 섞여 들어와도 아는 것이 하나라도 있으면 쓴다
  const mixed = {
    limits: [
      { kind: 'brand_new', something: 'else' },
      { kind: 'session', group: 'session', percent: 71, resets_at: null },
    ],
  }

  // Act
  const result = await fetchLiveUtilization({ credentials, fetchImpl: ok(mixed), now: 1 })

  // Assert
  assert.equal(result.limits.length, 2)
})

test('fetchLiveUtilization accepts a genuinely empty list', async () => {
  // Arrange — 한도가 하나도 설정되지 않은 계정은 빈 배열이 정상이다
  const result = await fetchLiveUtilization({ credentials, fetchImpl: ok({ limits: [] }), now: 1 })

  // Assert
  assert.deepEqual(result.limits, [])
})

/* ---------- 토큰 만료 ---------- */

test('fetchLiveUtilization does not bother calling with an expired token', async () => {
  // Arrange
  const expired = Object.defineProperty({ source: 'file', expiresAt: 1000 }, 'accessToken', {
    value: TOKEN, enumerable: false,
  })
  let called = false

  // Act
  const error = await fetchLiveUtilization({
    credentials: expired,
    fetchImpl: async () => { called = true; return ok({ limits: [] })() },
    now: 2000,
  }).catch((e) => e)

  // Assert
  assert.equal(called, false, '만료된 토큰으로 쓸데없이 호출하지 않는다')
  assert.match(error.message, /만료/)
  assert.match(error.message, /Claude Code/)
})

test('fetchLiveUtilization explains a 401 in terms the user can act on', async () => {
  // Arrange
  const fetchImpl = async () => ({ ok: false, status: 401, headers: { get: () => null }, json: async () => ({}) })

  // Act
  const error = await fetchLiveUtilization({ credentials, fetchImpl }).catch((e) => e)

  // Assert
  assert.match(error.message, /만료/)
  assert.match(error.message, /Claude Code/)
})

test('fetchLiveUtilization still calls when the token has no known expiry', async () => {
  // Arrange
  let called = false
  const fetchImpl = async () => { called = true; return { ok: true, status: 200, json: async () => payload } }

  // Act
  await fetchLiveUtilization({ credentials, fetchImpl, now: Date.now() })

  // Assert
  assert.equal(called, true)
})
