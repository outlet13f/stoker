import test from 'node:test'
import assert from 'node:assert/strict'
import { buildClientScript } from '../src/render/bundle.js'
import { buildReportSet } from '../src/report.js'

/**
 * 번들된 클라이언트를 최소 DOM 셰임 위에서 실제로 돌린다.
 * 브라우저 없이도 렌더러가 던지는지, 각 컨테이너가 채워지는지 잡아낸다.
 */
const NOW = Date.parse('2026-08-24T10:00:00Z')

const record = (over = {}) => ({
  timestamp: Date.parse('2026-08-24T09:00:00Z'),
  model: 'claude-opus-5',
  sessionId: 'sess-abcdef123',
  project: '/work/app',
  sourceKind: 'main',
  inputTokens: 100, outputTokens: 200,
  cacheWrite5mTokens: 10, cacheWrite1hTokens: 20, cacheReadTokens: 1000,
  thinkingTokens: 5, cost: 1.25, cacheSavings: 0.5,
  inputCost: 0.25, outputCost: 1, cacheWrite5mCost: 0, cacheWrite1hCost: 0, cacheReadCost: 0,
  dedupeKey: 'k1', isSidechain: false,
  ...over,
})

const edit = (over = {}) => ({
  timestamp: Date.parse('2026-08-24T09:00:00Z'),
  linesAdded: 120, linesRemoved: 30,
  filePath: '/work/app/a.js', project: '/work/app',
  sourceKind: 'main', sessionId: 'sess-abcdef123', isCreate: false,
  dedupeKey: 'e1',
  ...over,
})

/** innerHTML 을 기록하는 최소 엘리먼트 */
function fakeElement(id) {
  return {
    id,
    innerHTML: '',
    textContent: '',
    dataset: {},
    style: {},
    hidden: false,
    disabled: false,
    value: '',
    min: '',
    max: '',
    classList: { add() {}, remove() {}, contains: () => false },
    handlers: new Map(),
    addEventListener(type, handler) {
      this.handlers.set(type, handler)
    },
    removeEventListener(type) {
      this.handlers.delete(type)
    },
    async click() {
      await this.handlers.get('click')?.()
    },
    async fire(type) {
      await this.handlers.get(type)?.()
    },
    querySelectorAll: () => [],
    querySelector: () => null,
    focus() {},
    appendChild() {},
    getBoundingClientRect: () => ({ top: 0, left: 0, right: 0, bottom: 0, width: 100, height: 20 }),
  }
}

function makeHarness({ reports, config }) {
  const nodes = new Map()
  const listeners = new Map()

  const document = {
    documentElement: { ...fakeElement('html'), dataset: {} },
    body: fakeElement('body'),
    getElementById(id) {
      if (!nodes.has(id)) nodes.set(id, fakeElement(id))
      return nodes.get(id)
    },
    querySelectorAll: () => [],
    querySelector: () => null,
    addEventListener(type, handler) {
      listeners.set(type, handler)
    },
    createElement: (tag) => fakeElement(tag),
  }

  const store = new Map()
  const window = {
    __REPORTS__: reports,
    __CONFIG__: config,
    addEventListener() {},
    matchMedia: () => ({ matches: false, addEventListener() {} }),
    localStorage: {
      getItem: (key) => (store.has(key) ? store.get(key) : null),
      setItem: (key, value) => store.set(key, value),
    },
  }

  const getComputedStyle = () => ({ getPropertyValue: () => '#000000' })
  const intervals = []
  const cleared = []
  let nextTimerId = 1
  const setInterval = (fn, ms) => {
    const id = nextTimerId++
    intervals.push({ id, ms, fn })
    return id
  }
  const clearInterval = (id) => cleared.push(id)
  const setTimeout = (fn) => { void fn; return 0 }
  const calls = []
  let failure = null
  const fetch = async (url) => {
    calls.push(url)
    if (failure) return { ok: false, status: 400, json: async () => ({ error: failure }) }
    return { ok: true, json: async () => ({ reports: { ...reports, custom: reports['30'] }, config }) }
  }

  return {
    document, window, getComputedStyle, setInterval, clearInterval, setTimeout, fetch,
    nodes, listeners, calls, intervals, cleared, store,
    failWith(message) { failure = message },
  }
}

async function boot({ withEdits = true, live = true, config: extraConfig = {}, stored = null, withRecords = true } = {}) {
  const reports = buildReportSet(withRecords ? [record()] : [], {
    now: NOW,
    timeZone: 'UTC',
    edits: withEdits ? [edit()] : [],
  })
  const config = {
    live,
    refreshSeconds: 30,
    refreshChoices: [0, 5, 10, 30, 60, 300],
    timeZone: 'UTC',
    fileCount: 3,
    ...extraConfig,
  }
  const harness = makeHarness({ reports, config })
  if (stored !== null) harness.store.set('claude-usage-dashboard.refreshSeconds', String(stored))
  const script = await buildClientScript()

  const run = new Function(
    'window', 'document', 'getComputedStyle', 'setInterval', 'clearInterval', 'setTimeout', 'fetch',
    script,
  )
  run(
    harness.window, harness.document, harness.getComputedStyle,
    harness.setInterval, harness.clearInterval, harness.setTimeout, harness.fetch,
  )

  const domReady = harness.listeners.get('DOMContentLoaded')
  assert.ok(domReady, 'DOMContentLoaded 핸들러가 등록되어야 한다')
  domReady()

  return harness
}

test('the bundled client boots and fills every band without throwing', async () => {
  // Act
  const { nodes } = await boot()

  // Assert
  for (const id of ['gauge', 'tiles', 'daily-chart', 'models', 'projects', 'sources', 'sessions', 'filters']) {
    assert.notEqual(nodes.get(id)?.innerHTML, '', `${id} 가 채워져야 한다`)
  }
})

test('the client renders the code-change band from report.code', async () => {
  // Act
  const { nodes } = await boot()

  // Assert
  const tiles = nodes.get('code-tiles').innerHTML
  assert.match(tiles, /추가된 줄/)
  assert.match(tiles, /\+120/)
  assert.match(tiles, /-30/)
  assert.match(nodes.get('code-chart').innerHTML, /<svg/)
  assert.match(nodes.get('code-projects').innerHTML, /app/)
  assert.match(nodes.get('code-note').textContent, /\+120/)
})

test('the code chart draws both directions with distinct fills', async () => {
  // Act
  const { nodes } = await boot()

  // Assert
  const svg = nodes.get('code-chart').innerHTML
  assert.match(svg, /fill="var\(--ok\)"/)
  assert.match(svg, /fill="var\(--crit\)"/)
})

test('the code band says so plainly when nothing was edited', async () => {
  // Act
  const { nodes } = await boot({ withEdits: false })

  // Assert
  assert.match(nodes.get('code-chart').innerHTML, /기록된 코드 변경이 없습니다/)
  assert.match(nodes.get('code-note').textContent, /없습니다/)
})

test('the date picker is offered while serving live', async () => {
  // Act
  const { nodes } = await boot({ live: true })

  // Assert
  assert.equal(nodes.get('date-from').disabled, false)
  assert.equal(nodes.get('date-apply').disabled, false)
})

test('the date picker is disabled with a reason in a static export', async () => {
  // Act
  const { nodes } = await boot({ live: false })

  // Assert
  assert.equal(nodes.get('date-from').disabled, true)
  assert.equal(nodes.get('date-to').disabled, true)
  assert.equal(nodes.get('date-apply').disabled, true)
  assert.match(nodes.get('date-message').textContent, /--serve/)
})

test('the date inputs are bounded by the recorded activity span', async () => {
  // Act
  const { nodes } = await boot({ live: true })

  // Assert
  assert.equal(nodes.get('date-from').min, '2026-08-24')
  assert.equal(nodes.get('date-to').max, '2026-08-24')
})

test('the filter row offers a chip per available report', async () => {
  // Act
  const { nodes } = await boot()

  // Assert
  const chips = nodes.get('filters').innerHTML
  for (const label of ['7일', '30일', '90일', '전체']) {
    assert.match(chips, new RegExp(label))
  }
  assert.match(chips, /aria-pressed="true"/)
})

/* ---------- 날짜 적용 흐름 ---------- */

test('applying a date range asks the server for that exact window', async () => {
  // Arrange
  const harness = await boot({ live: true })
  harness.nodes.get('date-from').value = '2026-08-01'
  harness.nodes.get('date-to').value = '2026-08-10'

  // Act
  await harness.nodes.get('date-apply').click()

  // Assert
  const requested = harness.calls.at(-1)
  assert.match(requested, /from=2026-08-01/)
  assert.match(requested, /to=2026-08-10/)
  assert.match(harness.nodes.get('date-message').textContent, /2026-08-01/)
})

test('applying a date range refuses a half-filled form without calling the server', async () => {
  // Arrange
  const harness = await boot({ live: true })
  harness.nodes.get('date-from').value = '2026-08-01'
  harness.nodes.get('date-to').value = ''
  const before = harness.calls.length

  // Act
  await harness.nodes.get('date-apply').click()

  // Assert
  assert.equal(harness.calls.length, before)
  assert.match(harness.nodes.get('date-message').textContent, /모두 고르세요/)
  assert.equal(harness.nodes.get('date-message').dataset.state, 'error')
})

test('a rejected date range surfaces the server message and keeps the old window', async () => {
  // Arrange
  const harness = await boot({ live: true })
  harness.nodes.get('date-from').value = '2026-08-10'
  harness.nodes.get('date-to').value = '2026-08-01'
  harness.failWith('from 이 to 보다 뒤입니다')

  // Act
  await harness.nodes.get('date-apply').click()

  // Assert
  assert.match(harness.nodes.get('date-message').textContent, /뒤입니다/)
  assert.equal(harness.nodes.get('date-message').dataset.state, 'error')
})

test('clearing a date range returns to the 30-day preset', async () => {
  // Arrange
  const harness = await boot({ live: true })
  harness.nodes.get('date-from').value = '2026-08-01'
  harness.nodes.get('date-to').value = '2026-08-10'
  await harness.nodes.get('date-apply').click()

  // Act
  await harness.nodes.get('date-clear').click()

  // Assert
  assert.equal(harness.nodes.get('date-from').value, '')
  assert.equal(harness.nodes.get('date-to').value, '')
  assert.equal(harness.calls.at(-1), './api/report')
})

test('the polling refresh keeps requesting the chosen custom window', async () => {
  // Arrange
  const harness = await boot({ live: true })
  harness.nodes.get('date-from').value = '2026-08-01'
  harness.nodes.get('date-to').value = '2026-08-10'
  await harness.nodes.get('date-apply').click()

  // Act — visibilitychange 는 폴링과 같은 refresh 경로를 탄다
  await harness.listeners.get('visibilitychange')?.()

  // Assert
  assert.match(harness.calls.at(-1), /from=2026-08-01/)
})

/* ---------- 자동 갱신 주기 ---------- */

async function setInterval_(harness, raw) {
  const input = harness.nodes.get('refresh-input')
  input.value = String(raw)
  await input.fire('change')
  return input
}

test('the client schedules polling at the interval the server advertised', async () => {
  // Act
  const harness = await boot({ config: { refreshSeconds: 10 } })

  // Assert
  assert.equal(harness.intervals.at(-1).ms, 10_000)
  assert.equal(harness.nodes.get('refresh-input').value, '10')
})

test('the user can type an interval that is not one of the presets', async () => {
  // Arrange
  const harness = await boot({ config: { refreshSeconds: 30 } })
  const first = harness.intervals.at(-1).id

  // Act
  await setInterval_(harness, 12)

  // Assert
  assert.ok(harness.cleared.includes(first), '이전 타이머를 해제해야 한다')
  assert.equal(harness.intervals.at(-1).ms, 12_000)
  assert.equal(harness.store.get('claude-usage-dashboard.refreshSeconds'), '12')
})

test('the user can type the maximum interval', async () => {
  // Arrange
  const harness = await boot()

  // Act
  await setInterval_(harness, 3600)

  // Assert
  assert.equal(harness.intervals.at(-1).ms, 3_600_000)
})

test('typing zero pauses refreshing altogether', async () => {
  // Arrange
  const harness = await boot({ config: { refreshSeconds: 30 } })
  const before = harness.intervals.length

  // Act
  await setInterval_(harness, 0)

  // Assert
  assert.equal(harness.intervals.length, before, '새 타이머를 걸지 않아야 한다')
  assert.match(harness.nodes.get('refresh-message').textContent, /멈춤/)
})

test('a paused dashboard does not refresh when the tab regains focus', async () => {
  // Arrange
  const harness = await boot({ config: { refreshSeconds: 30 } })
  await setInterval_(harness, 0)
  const before = harness.calls.length

  // Act
  await harness.listeners.get('visibilitychange')?.()

  // Assert
  assert.equal(harness.calls.length, before)
})

test('an interval below the floor is refused and the old one kept', async () => {
  // Arrange
  const harness = await boot({ config: { refreshSeconds: 30 } })
  const before = harness.intervals.length

  // Act
  await setInterval_(harness, 3)

  // Assert
  assert.equal(harness.intervals.length, before, '타이머를 다시 걸지 않아야 한다')
  assert.match(harness.nodes.get('refresh-message').textContent, /5/)
  assert.equal(harness.nodes.get('refresh-message').dataset.state, 'error')
  assert.equal(harness.nodes.get('refresh-input').value, '30', '거부되면 이전 값으로 되돌린다')
})

test('an interval above the ceiling is refused', async () => {
  // Arrange
  const harness = await boot({ config: { refreshSeconds: 30 } })

  // Act
  await setInterval_(harness, 99999)

  // Assert
  assert.match(harness.nodes.get('refresh-message').textContent, /3600/)
  assert.equal(harness.nodes.get('refresh-input').value, '30')
})

test('a non-numeric interval is refused', async () => {
  // Arrange
  const harness = await boot({ config: { refreshSeconds: 30 } })

  // Act
  await setInterval_(harness, 'often')

  // Assert
  assert.match(harness.nodes.get('refresh-message').textContent, /숫자/)
  assert.equal(harness.nodes.get('refresh-input').value, '30')
})

test('a fractional interval is refused rather than silently rounded', async () => {
  // Arrange
  const harness = await boot({ config: { refreshSeconds: 30 } })

  // Act
  await setInterval_(harness, 12.5)

  // Assert
  assert.match(harness.nodes.get('refresh-message').textContent, /정수/)
  assert.equal(harness.nodes.get('refresh-input').value, '30')
})

test('the input validates against the bounds the server sent', async () => {
  // Arrange — 서버가 하한을 60 으로 알려주면 그 기준으로 거부한다
  const harness = await boot({ config: { refreshSeconds: 60, refreshBounds: { min: 60, max: 120 } } })

  // Act
  await setInterval_(harness, 30)

  // Assert
  assert.match(harness.nodes.get('refresh-message').textContent, /60/)
})

test('presets are offered as suggestions without limiting what can be typed', async () => {
  // Act
  const { nodes } = await boot()

  // Assert
  const options = nodes.get('refresh-presets').innerHTML
  for (const seconds of [5, 10, 30, 60, 300]) {
    assert.match(options, new RegExp(`value="${seconds}"`))
  }
})

test('any remembered interval wins over the server default', async () => {
  // Act — 프리셋에 없는 값이어도 기억한다
  const harness = await boot({ config: { refreshSeconds: 30 }, stored: 42 })

  // Assert
  assert.equal(harness.intervals.at(-1).ms, 42_000)
  assert.equal(harness.nodes.get('refresh-input').value, '42')
})

test('a remembered interval outside the bounds falls back to the server default', async () => {
  // Act
  const harness = await boot({ config: { refreshSeconds: 30 }, stored: 2 })

  // Assert
  assert.equal(harness.intervals.at(-1).ms, 30_000)
})

test('the refresh input is disabled in a static export', async () => {
  // Act
  const { nodes } = await boot({ live: false, config: { refreshSeconds: 0 } })

  // Assert
  assert.equal(nodes.get('refresh-input').disabled, true)
  assert.match(nodes.get('refresh-message').textContent, /자동 갱신이 없습니다/)
})

test('a static export schedules no polling at all', async () => {
  // Act
  const harness = await boot({ live: false, config: { refreshSeconds: 0 } })

  // Assert
  assert.equal(harness.intervals.length, 0)
})

/* ---------- 단가표 ---------- */

test('the footer renders a rate card for the model that was used', async () => {
  // Act
  const { nodes } = await boot()

  // Assert
  const html = nodes.get('rate-card').innerHTML
  assert.match(html, /claude-opus-5/)
  assert.match(html, /Opus 5/)
  assert.match(html, /캐시 읽기/)
})

test('the rate card shows the published Opus 5 rates', async () => {
  // Act
  const { nodes } = await boot()

  // Assert — input $5 / output $25 / 5m $6.25 / 1h $10 / read $0.50
  const html = nodes.get('rate-card').innerHTML
  for (const amount of ['\\$5\\.00', '\\$25\\.00', '\\$6\\.25', '\\$10\\.00', '\\$0\\.50']) {
    assert.match(html, new RegExp(amount))
  }
})

test('the rate card says so plainly when no model was recorded', async () => {
  // Act
  const { nodes } = await boot({ withRecords: false, withEdits: false })

  // Assert
  assert.match(nodes.get('rate-card').innerHTML, /기록된 모델이 없습니다/)
})

test('the rate card marks a model whose price was guessed', async () => {
  // Act
  const { nodes } = await boot()

  // Assert — claude-opus-5 는 공개 단가라 추정 표시가 없어야 한다
  assert.doesNotMatch(nodes.get('rate-card').innerHTML, /단가 추정/)
})
