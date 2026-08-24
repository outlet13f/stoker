import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { readUsageLimits, STALE_AFTER_MS } from '../src/limits.js'

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
