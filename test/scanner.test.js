import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { listTranscripts, classifyTranscript, projectLabelFromDir } from '../src/scanner.js'

const SESSION = '11111111-2222-3333-4444-555555555555'

async function makeFixture() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'cud-scan-'))
  const project = path.join(root, '-Users-me-work-myapp')
  const workflowDir = path.join(project, SESSION, 'subagents', 'workflows', 'wf_abc')

  await fs.mkdir(path.join(project, SESSION, 'subagents'), { recursive: true })
  await fs.mkdir(workflowDir, { recursive: true })
  await fs.writeFile(path.join(project, `${SESSION}.jsonl`), '')
  await fs.writeFile(path.join(project, SESSION, 'subagents', 'agent-a1.jsonl'), '')
  await fs.writeFile(path.join(workflowDir, 'agent-b2.jsonl'), '')
  await fs.writeFile(path.join(project, 'notes.txt'), 'ignore me')

  return root
}

test('listTranscripts finds nested subagent and workflow transcripts', async (t) => {
  // Arrange
  const root = await makeFixture()
  t.after(() => fs.rm(root, { recursive: true, force: true }))

  // Act
  const files = await listTranscripts(root)

  // Assert
  assert.equal(files.length, 3, 'main + subagent + workflow transcripts')
  assert.ok(files.every((f) => f.projectDir === '-Users-me-work-myapp'))
})

test('listTranscripts ignores non-jsonl files', async (t) => {
  const root = await makeFixture()
  t.after(() => fs.rm(root, { recursive: true, force: true }))

  const files = await listTranscripts(root)
  assert.ok(files.every((f) => f.path.endsWith('.jsonl')))
})

test('listTranscripts rejects with a clear message when the root is missing', async () => {
  await assert.rejects(
    () => listTranscripts('/definitely/not/here'),
    /트랜스크립트 디렉터리를 읽을 수 없습니다/,
  )
})

test('classifyTranscript labels main, subagent, and workflow transcripts', () => {
  // Arrange
  const base = ['-Users-me-work-myapp']

  // Act & Assert
  assert.equal(classifyTranscript([...base, `${SESSION}.jsonl`]).sourceKind, 'main')
  assert.equal(
    classifyTranscript([...base, SESSION, 'subagents', 'agent-a1.jsonl']).sourceKind,
    'subagent',
  )
  assert.equal(
    classifyTranscript([...base, SESSION, 'subagents', 'workflows', 'wf_abc', 'agent-b2.jsonl'])
      .sourceKind,
    'workflow',
  )
})

test('classifyTranscript attributes nested transcripts to their parent session', () => {
  const info = classifyTranscript([
    '-Users-me-work-myapp',
    SESSION,
    'subagents',
    'agent-a1.jsonl',
  ])
  assert.equal(info.parentSessionId, SESSION)
})

test('projectLabelFromDir shortens the encoded directory to its last segment', () => {
  assert.equal(projectLabelFromDir('-Users-me-work-myapp'), 'myapp')
  assert.equal(projectLabelFromDir(''), '')
})
