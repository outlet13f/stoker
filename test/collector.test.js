import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { createCollector } from '../src/collector.js'

const SESSION = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'

function entry({ id = 'msg_1', requestId = 'req_1', iso = '2026-08-01T00:00:00.000Z', output = 100 } = {}) {
  return JSON.stringify({
    type: 'assistant',
    timestamp: iso,
    sessionId: SESSION,
    cwd: '/work/app',
    requestId,
    message: {
      id,
      model: 'claude-opus-5',
      usage: { input_tokens: 1, output_tokens: output, cache_read_input_tokens: 10 },
    },
  })
}

async function makeRoot(files) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'cud-collect-'))
  const project = path.join(root, '-work-app')
  await fs.mkdir(path.join(project, SESSION, 'subagents'), { recursive: true })

  for (const [relative, contents] of Object.entries(files)) {
    const target = path.join(project, relative)
    await fs.mkdir(path.dirname(target), { recursive: true })
    await fs.writeFile(target, contents)
  }

  return root
}

test('collect turns transcript lines into usage records', async (t) => {
  // Arrange
  const root = await makeRoot({ [`${SESSION}.jsonl`]: `${entry()}\n${entry({ id: 'msg_2', requestId: 'req_2' })}\n` })
  t.after(() => fs.rm(root, { recursive: true, force: true }))

  // Act
  const { records, stats } = await createCollector({ root }).collect()

  // Assert
  assert.equal(records.length, 2)
  assert.equal(stats.fileCount, 1)
  assert.equal(stats.errors.length, 0)
})

test('collect drops responses duplicated across transcripts', async (t) => {
  // Arrange: 같은 응답이 메인 세션과 서브에이전트 파일에 모두 들어 있다
  const root = await makeRoot({
    [`${SESSION}.jsonl`]: `${entry()}\n`,
    [`${SESSION}/subagents/agent-a.jsonl`]: `${entry()}\n`,
  })
  t.after(() => fs.rm(root, { recursive: true, force: true }))

  // Act
  const { records } = await createCollector({ root }).collect()

  // Assert
  assert.equal(records.length, 1)
})

test('collect tags records with the transcript source kind', async (t) => {
  const root = await makeRoot({
    [`${SESSION}.jsonl`]: `${entry()}\n`,
    [`${SESSION}/subagents/agent-a.jsonl`]: `${entry({ id: 'msg_9', requestId: 'req_9' })}\n`,
  })
  t.after(() => fs.rm(root, { recursive: true, force: true }))

  const { records } = await createCollector({ root }).collect()
  const kinds = records.map((record) => record.sourceKind).sort()

  assert.deepEqual(kinds, ['main', 'subagent'])
})

test('collect reuses cached results for files that have not changed', async (t) => {
  // Arrange
  const root = await makeRoot({ [`${SESSION}.jsonl`]: `${entry()}\n` })
  t.after(() => fs.rm(root, { recursive: true, force: true }))
  const collector = createCollector({ root })

  // Act
  const first = await collector.collect()
  const second = await collector.collect()

  // Assert
  assert.equal(first.stats.reparsedFiles, 1)
  assert.equal(second.stats.reparsedFiles, 0)
  assert.equal(second.records.length, 1)
})

test('collect re-reads a transcript after it grows', async (t) => {
  // Arrange
  const root = await makeRoot({ [`${SESSION}.jsonl`]: `${entry()}\n` })
  t.after(() => fs.rm(root, { recursive: true, force: true }))
  const collector = createCollector({ root })
  await collector.collect()

  // Act: 세션이 계속되어 줄이 추가된 상황
  await fs.appendFile(
    path.join(root, '-work-app', `${SESSION}.jsonl`),
    `${entry({ id: 'msg_2', requestId: 'req_2' })}\n`,
  )
  const second = await collector.collect()

  // Assert
  assert.equal(second.stats.reparsedFiles, 1)
  assert.equal(second.records.length, 2)
})

test('collect forgets transcripts that were deleted', async (t) => {
  // Arrange
  const root = await makeRoot({
    [`${SESSION}.jsonl`]: `${entry()}\n`,
    [`${SESSION}/subagents/agent-a.jsonl`]: `${entry({ id: 'msg_2', requestId: 'req_2' })}\n`,
  })
  t.after(() => fs.rm(root, { recursive: true, force: true }))
  const collector = createCollector({ root })
  await collector.collect()

  // Act
  await fs.rm(path.join(root, '-work-app', SESSION, 'subagents', 'agent-a.jsonl'))
  const second = await collector.collect()

  // Assert
  assert.equal(second.records.length, 1)
  assert.equal(second.stats.fileCount, 1)
})

test('collect skips unparsable lines instead of failing the whole run', async (t) => {
  // Arrange
  const root = await makeRoot({ [`${SESSION}.jsonl`]: `not json\n${entry()}\n\n` })
  t.after(() => fs.rm(root, { recursive: true, force: true }))

  // Act
  const { records, stats } = await createCollector({ root }).collect()

  // Assert
  assert.equal(records.length, 1)
  assert.equal(stats.errors.length, 0)
})
