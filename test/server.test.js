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

async function withServer(run) {
  const root = await makeRoot()
  const { server } = await startServer({ port: 0, timeZone: 'UTC', root })
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
