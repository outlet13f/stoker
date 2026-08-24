import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { loadCredentials, redact } from '../src/credentials.js'

const TOKEN = 'sk-ant-oat01-EXAMPLE-TOKEN-VALUE-1234567890'
const NOWHERE = '/nonexistent/.credentials.json'

async function withFile(contents, run) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'cud-creds-'))
  const file = path.join(dir, '.credentials.json')
  await fs.writeFile(file, typeof contents === 'string' ? contents : JSON.stringify(contents))

  try {
    await run(file)
  } finally {
    await fs.rm(dir, { recursive: true, force: true })
  }
}

test('loadCredentials prefers an explicit environment token', async () => {
  // Act
  const creds = await loadCredentials({ env: { CLAUDE_CODE_OAUTH_TOKEN: TOKEN }, file: NOWHERE })

  // Assert
  assert.equal(creds.accessToken, TOKEN)
  assert.equal(creds.source, 'env')
})

test('loadCredentials ignores an environment value too short to be a token', async () => {
  // Act
  const creds = await loadCredentials({ env: { CLAUDE_CODE_OAUTH_TOKEN: 'nope' }, file: NOWHERE })

  // Assert — 키체인이 없는 환경에서는 null
  assert.ok(creds === null || creds.source !== 'env')
})

test('loadCredentials finds a token nested in the credentials file', async () => {
  await withFile({ claudeAiOauth: { accessToken: TOKEN, expiresAt: 1787545235216 } }, async (file) => {
    // Act
    const creds = await loadCredentials({ env: {}, file })

    // Assert
    assert.equal(creds.accessToken, TOKEN)
    assert.equal(creds.source, 'file')
    assert.equal(creds.expiresAt, 1787545235216)
  })
})

test('loadCredentials accepts the snake_case spelling too', async () => {
  await withFile({ oauth: { access_token: TOKEN, expires_at: '2026-08-24T04:20:35.216Z' } }, async (file) => {
    // Act
    const creds = await loadCredentials({ env: {}, file })

    // Assert
    assert.equal(creds.accessToken, TOKEN)
    assert.equal(creds.expiresAt, Date.parse('2026-08-24T04:20:35.216Z'))
  })
})

test('loadCredentials returns null rather than throwing on broken JSON', async () => {
  await withFile('{ not json', async (file) => {
    const creds = await loadCredentials({ env: {}, file })
    assert.ok(creds === null || creds.source === 'keychain')
  })
})

test('loadCredentials returns null when the file holds no token', async () => {
  await withFile({ somethingElse: { nested: 'value' } }, async (file) => {
    const creds = await loadCredentials({ env: {}, file })
    assert.ok(creds === null || creds.source === 'keychain')
  })
})

/* ---------- 유출 방지 ---------- */

test('the token does not survive JSON serialisation', async () => {
  // Act
  const creds = await loadCredentials({ env: { CLAUDE_CODE_OAUTH_TOKEN: TOKEN }, file: NOWHERE })

  // Assert — 리포트나 설정에 실수로 섞여도 직렬화되면 사라진다
  assert.doesNotMatch(JSON.stringify(creds), /EXAMPLE-TOKEN/)
  assert.doesNotMatch(JSON.stringify({ config: creds }), /EXAMPLE-TOKEN/)
})

test('the token is not enumerable so spreading drops it', async () => {
  // Act
  const creds = await loadCredentials({ env: { CLAUDE_CODE_OAUTH_TOKEN: TOKEN }, file: NOWHERE })

  // Assert
  assert.equal(Object.keys(creds).includes('accessToken'), false)
  assert.equal({ ...creds }.accessToken, undefined)
})

test('redact removes the token from any string', async () => {
  // Arrange
  const creds = await loadCredentials({ env: { CLAUDE_CODE_OAUTH_TOKEN: TOKEN }, file: NOWHERE })

  // Act
  const cleaned = redact(`request failed with Authorization: Bearer ${TOKEN} at step 2`, creds)

  // Assert
  assert.doesNotMatch(cleaned, /EXAMPLE-TOKEN/)
  assert.match(cleaned, /<redacted>/)
  assert.match(cleaned, /at step 2/)
})

test('redact removes every occurrence', async () => {
  // Arrange
  const creds = await loadCredentials({ env: { CLAUDE_CODE_OAUTH_TOKEN: TOKEN }, file: NOWHERE })

  // Act
  const cleaned = redact(`${TOKEN} and again ${TOKEN}`, creds)

  // Assert
  assert.doesNotMatch(cleaned, /EXAMPLE-TOKEN/)
})

test('redact copes with no credentials and non-strings', () => {
  // Assert
  assert.equal(redact('plain text', null), 'plain text')
  assert.equal(redact(undefined, null), undefined)
  assert.equal(redact(42, null), 42)
})
