import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import path from 'node:path'
import { scrubSecrets } from '../src/credentials.js'

const ROOTS = ['src', 'electron']

async function sourceFiles(dir, found = []) {
  for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) await sourceFiles(full, found)
    else if (entry.name.endsWith('.js') || entry.name.endsWith('.mjs')) found.push(full)
  }
  return found
}

async function allSources() {
  const files = []
  for (const root of ROOTS) files.push(...(await sourceFiles(root)))
  return Promise.all(files.map(async (file) => ({ file, text: await fs.readFile(file, 'utf8') })))
}

/* ---------- 토큰을 만질 수 있는 곳을 제한한다 ---------- */

test('only the two modules that must touch the token reference it', async () => {
  // Arrange — 이 리포지토리는 public 이다. 토큰 취급 지점을 좁게 유지한다.
  const ALLOWED = new Set(['src/credentials.js', 'src/usage-api.js'])

  // Act
  const offenders = (await allSources())
    .filter(({ text }) => /accessToken/.test(text))
    .map(({ file }) => file)
    .filter((file) => !ALLOWED.has(file))

  // Assert
  assert.deepEqual(offenders, [], `토큰을 만지는 파일이 늘었습니다: ${offenders.join(', ')}`)
})

test('no source file prints anything to the console', async () => {
  // Arrange — cli.js 는 사용자에게 보고하는 것이 일이라 예외다
  const ALLOWED = new Set(['src/cli.js', 'electron/main.js', 'build/make-tray-icon.mjs'])

  // Act
  const offenders = (await allSources())
    .filter(({ file, text }) => !ALLOWED.has(file) && /console\.(log|error|warn|info)\s*\(/.test(text))
    .map(({ file }) => file)

  // Assert — 실수로 자격증명이 로그로 새는 경로를 아예 없앤다
  assert.deepEqual(offenders, [], `console 출력이 있는 파일: ${offenders.join(', ')}`)
})

test('nothing serialises a credentials object wholesale', async () => {
  // Act
  const offenders = (await allSources())
    .filter(({ text }) => /JSON\.stringify\s*\(\s*credentials/.test(text))
    .map(({ file }) => file)

  // Assert
  assert.deepEqual(offenders, [])
})

/* ---------- 경계에서 한 번 더 지운다 ---------- */

test('scrubSecrets removes token-shaped strings without knowing the token', async () => {
  // Act & Assert — 정확한 결과를 본다. <redacted> 포함 여부만 보면
  // 치환이 엉뚱한 문자를 남겨도 통과한다(실제로 그런 버그가 있었다).
  assert.equal(
    scrubSecrets('failed: sk-ant-oat01-ABCDEFGHIJKLMNOPQRSTUV leaked'),
    'failed: <redacted> leaked',
  )
  assert.equal(
    scrubSecrets('hdr Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9'),
    'hdr Authorization: Bearer <redacted>',
  )
})

test('scrubSecrets does not leave stray characters behind', () => {
  // Assert — 캡처 그룹이 없는 패턴에서 매치 위치가 새어 나오면 안 된다
  assert.doesNotMatch(scrubSecrets('x sk-ant-oat01-ABCDEFGHIJKLMNOP y'), /\d/)
})

test('scrubSecrets leaves ordinary messages alone', () => {
  // Assert
  assert.equal(scrubSecrets('한도 조회 실패: HTTP 429'), '한도 조회 실패: HTTP 429')
  assert.equal(scrubSecrets('레이트 리밋 — 76초 후 재시도'), '레이트 리밋 — 76초 후 재시도')
})

test('scrubSecrets copes with non-strings', () => {
  // Assert
  assert.equal(scrubSecrets(null), null)
  assert.equal(scrubSecrets(42), 42)
})
