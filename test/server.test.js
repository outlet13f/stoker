import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { startServer } from '../src/server.js'

const SESSION = 'ffffffff-1111-2222-3333-444444444444'

/** 실제 홈 디렉터리를 읽지 않도록 임시 트랜스크립트를 만들어 쓴다 */
async function makeRoot() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'cud-server-'))
  const project = path.join(root, '-work-app')
  await fs.mkdir(project, { recursive: true })

  const line = JSON.stringify({
    type: 'assistant',
    timestamp: new Date().toISOString(),
    sessionId: SESSION,
    cwd: '/work/app',
    requestId: 'req_1',
    message: { id: 'msg_1', model: 'claude-opus-5', usage: { input_tokens: 5, output_tokens: 50 } },
  })

  await fs.writeFile(path.join(project, `${SESSION}.jsonl`), `${line}\n`)
  return root
}

async function withServer(run, serverOptions = {}) {
  const root = await makeRoot()
  const { server } = await startServer({ port: 0, timeZone: 'UTC', root, ...serverOptions })
  const { port } = server.address()

  try {
    await run(`http://127.0.0.1:${port}`)
  } finally {
    await new Promise((resolve) => server.close(resolve))
    await fs.rm(root, { recursive: true, force: true })
  }
}

test('the dashboard route returns a full HTML document', async () => {
  await withServer(async (base) => {
    const response = await fetch(base)
    const body = await response.text()

    assert.equal(response.status, 200)
    assert.match(response.headers.get('content-type'), /text\/html/)
    assert.match(body, /<!doctype html>/)
    assert.match(body, /사용량 콘솔/)
  })
})

test('the report API returns every selectable range', async () => {
  await withServer(async (base) => {
    const response = await fetch(`${base}/api/report`)
    const payload = await response.json()

    assert.equal(response.status, 200)
    assert.deepEqual(Object.keys(payload.reports), ['7', '30', '90', 'all'])
    assert.equal(payload.config.live, true)
  })
})

test('the report API reports the timezone it aggregated with', async () => {
  await withServer(async (base) => {
    const { config } = await (await fetch(`${base}/api/report`)).json()
    assert.equal(config.timeZone, 'UTC')
  })
})

test('an unknown path returns a JSON 404 rather than an HTML error page', async () => {
  await withServer(async (base) => {
    const response = await fetch(`${base}/nope`)
    assert.equal(response.status, 404)
    assert.deepEqual(await response.json(), { error: 'not found' })
  })
})

/* ---------- 사용자 지정 날짜 구간 ---------- */

test('the report API adds a custom report when from/to are given', async () => {
  await withServer(async (base) => {
    const response = await fetch(`${base}/api/report?from=2026-01-01&to=2026-12-31`)
    const payload = await response.json()

    assert.equal(response.status, 200)
    assert.ok(payload.reports.custom, 'custom 리포트가 있어야 한다')
    assert.deepEqual(Object.keys(payload.reports), ['7', '30', '90', 'all', 'custom'])
    assert.equal(payload.config.customWindow.from, '2026-01-01')
    assert.equal(payload.config.customWindow.to, '2026-12-31')
  })
})

test('the custom report covers the whole to-day, not just its midnight', async () => {
  await withServer(async (base) => {
    // 오늘 활동이 하나 있고 to 를 오늘로 잡으면 그 활동이 포함돼야 한다
    const today = new Date().toISOString().slice(0, 10)
    const { reports } = await (await fetch(`${base}/api/report?from=${today}&to=${today}`)).json()

    assert.equal(reports.custom.range.requests, 1)
  })
})

test('the report API rejects a malformed date', async () => {
  await withServer(async (base) => {
    const response = await fetch(`${base}/api/report?from=8/1/2026&to=2026-08-02`)

    assert.equal(response.status, 400)
    assert.match((await response.json()).error, /YYYY-MM-DD/)
  })
})

test('the report API rejects a reversed range', async () => {
  await withServer(async (base) => {
    const response = await fetch(`${base}/api/report?from=2026-08-10&to=2026-08-01`)

    assert.equal(response.status, 400)
    assert.match((await response.json()).error, /from/)
  })
})

test('the report API rejects a half-specified range', async () => {
  await withServer(async (base) => {
    const response = await fetch(`${base}/api/report?from=2026-08-01`)

    assert.equal(response.status, 400)
    assert.match((await response.json()).error, /함께/)
  })
})

test('the report API rejects an impossible calendar date', async () => {
  await withServer(async (base) => {
    const response = await fetch(`${base}/api/report?from=2026-02-30&to=2026-03-01`)

    assert.equal(response.status, 400)
  })
})

/* ---------- 갱신 주기 ---------- */

test('the report API tells the client the default refresh interval', async () => {
  await withServer(async (base) => {
    const { config } = await (await fetch(`${base}/api/report`)).json()
    assert.equal(config.refreshSeconds, 30)
  })
})

test('the report API passes through a configured refresh interval', async () => {
  await withServer(async (base) => {
    const { config } = await (await fetch(`${base}/api/report`)).json()
    assert.equal(config.refreshSeconds, 10)
  }, { refreshSeconds: 10 })
})

test('the report API can advertise auto refresh being off', async () => {
  await withServer(async (base) => {
    const { config } = await (await fetch(`${base}/api/report`)).json()
    assert.equal(config.refreshSeconds, 0)
  }, { refreshSeconds: 0 })
})

test('the report API offers preset refresh intervals as suggestions', async () => {
  await withServer(async (base) => {
    const { config } = await (await fetch(`${base}/api/report`)).json()
    assert.deepEqual(config.refreshChoices, [0, 5, 10, 30, 60, 300])
  })
})

test('the report API sends the bounds the CLI validates against', async () => {
  await withServer(async (base) => {
    const { config } = await (await fetch(`${base}/api/report`)).json()
    assert.deepEqual(config.refreshBounds, { min: 5, max: 3600 })
  })
})

/* ---------- 실제로 바인딩된 포트 ---------- */

test('startServer reports the port the OS actually assigned', async () => {
  // Arrange — 0 은 "빈 포트를 골라 달라"는 뜻이다
  const root = await makeRoot()
  const { server, url, port } = await startServer({ port: 0, timeZone: 'UTC', root })

  try {
    // Assert
    const bound = server.address().port
    assert.ok(bound > 0, 'OS 가 포트를 배정해야 한다')
    assert.equal(port, bound)
    assert.equal(url, `http://127.0.0.1:${bound}`)
    assert.doesNotMatch(url, /:0$/, '요청값 0 이 URL 에 그대로 남으면 안 된다')
  } finally {
    await new Promise((resolve) => server.close(resolve))
    await fs.rm(root, { recursive: true, force: true })
  }
})

test('the reported url is actually reachable', async () => {
  // Arrange
  const root = await makeRoot()
  const { server, url } = await startServer({ port: 0, timeZone: 'UTC', root })

  try {
    // Act
    const response = await fetch(`${url}/api/report`)

    // Assert
    assert.equal(response.status, 200)
  } finally {
    await new Promise((resolve) => server.close(resolve))
    await fs.rm(root, { recursive: true, force: true })
  }
})
