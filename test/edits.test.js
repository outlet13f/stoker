import test from 'node:test'
import assert from 'node:assert/strict'
import {
  parseEditLine,
  dedupeEdits,
  sumEdits,
  buildEditDailySeries,
  groupEditsBy,
} from '../src/edits.js'

const editLine = (overrides = {}) =>
  JSON.stringify({
    type: 'user',
    uuid: 'edit-1',
    timestamp: '2026-08-24T04:18:09.176Z',
    sessionId: 'sess-1',
    cwd: '/Users/duksang/claudeWorkspace/demo',
    gitBranch: 'main',
    isSidechain: false,
    message: { role: 'user', content: [{ type: 'tool_result' }] },
    toolUseResult: {
      filePath: '/Users/duksang/claudeWorkspace/demo/src/a.js',
      oldString: 'x',
      newString: 'y',
      replaceAll: false,
      userModified: false,
      structuredPatch: [
        {
          oldStart: 3,
          oldLines: 4,
          newStart: 3,
          newLines: 5,
          lines: [' const keep = 1', '-const gone = 2', '-const alsoGone = 3', '+const fresh = 4'],
        },
      ],
      ...overrides,
    },
  })

test('parseEditLine counts added and removed lines from patch hunks', () => {
  // Act
  const edit = parseEditLine(editLine())

  // Assert
  assert.equal(edit.linesAdded, 1)
  assert.equal(edit.linesRemoved, 2)
})

test('parseEditLine sums every hunk in a multi-hunk patch', () => {
  // Arrange
  const line = editLine({
    structuredPatch: [
      { lines: ['+a', '+b', ' ctx'] },
      { lines: ['-c', '+d'] },
    ],
  })

  // Act
  const edit = parseEditLine(line)

  // Assert
  assert.equal(edit.linesAdded, 3)
  assert.equal(edit.linesRemoved, 1)
})

test('parseEditLine ignores context lines and the no-newline marker', () => {
  // Arrange
  const line = editLine({
    structuredPatch: [{ lines: [' kept', '\\ No newline at end of file', '+added'] }],
  })

  // Act
  const edit = parseEditLine(line)

  // Assert
  assert.equal(edit.linesAdded, 1)
  assert.equal(edit.linesRemoved, 0)
})

test('parseEditLine counts a created file from its content when the patch is empty', () => {
  // Arrange — Write 로 새 파일을 만들면 patch 가 비고 content 만 남는다
  const line = editLine({ type: 'create', content: 'one\ntwo\nthree', structuredPatch: [] })

  // Act
  const edit = parseEditLine(line)

  // Assert
  assert.equal(edit.linesAdded, 3)
  assert.equal(edit.linesRemoved, 0)
  assert.equal(edit.isCreate, true)
})

test('parseEditLine does not count a phantom trailing line from a final newline', () => {
  // Arrange
  const line = editLine({ type: 'create', content: 'one\ntwo\n', structuredPatch: [] })

  // Act
  const edit = parseEditLine(line)

  // Assert
  assert.equal(edit.linesAdded, 2)
})

test('parseEditLine treats empty created content as zero lines', () => {
  // Arrange
  const line = editLine({ type: 'create', content: '', structuredPatch: [] })

  // Act
  const edit = parseEditLine(line)

  // Assert
  assert.equal(edit.linesAdded, 0)
})

test('parseEditLine carries the fields aggregation needs', () => {
  // Act
  const edit = parseEditLine(editLine())

  // Assert
  assert.equal(edit.timestamp, Date.parse('2026-08-24T04:18:09.176Z'))
  assert.equal(edit.sessionId, 'sess-1')
  assert.equal(edit.cwd, '/Users/duksang/claudeWorkspace/demo')
  assert.equal(edit.filePath, '/Users/duksang/claudeWorkspace/demo/src/a.js')
  assert.equal(edit.isSidechain, false)
  assert.equal(edit.dedupeKey, 'edit-1')
})

test('parseEditLine returns null for lines that carry no file edit', () => {
  // Assert
  assert.equal(parseEditLine(''), null)
  assert.equal(parseEditLine('not json'), null)
  assert.equal(parseEditLine(JSON.stringify({ type: 'user', toolUseResult: { stdout: 'ls' } })), null)
  assert.equal(
    parseEditLine(JSON.stringify({ type: 'assistant', message: { usage: { input_tokens: 1 } } })),
    null,
  )
})

test('parseEditLine returns null when the timestamp is unusable', () => {
  // Arrange
  const line = JSON.stringify({
    type: 'user',
    uuid: 'e',
    timestamp: 'nonsense',
    toolUseResult: { filePath: '/a', structuredPatch: [{ lines: ['+a'] }] },
  })

  // Assert
  assert.equal(parseEditLine(line), null)
})

test('parseEditLine survives a patch whose hunks are malformed', () => {
  // Arrange
  const line = editLine({ structuredPatch: [{ lines: null }, null, { nope: true }] })

  // Act
  const edit = parseEditLine(line)

  // Assert
  assert.equal(edit.linesAdded, 0)
  assert.equal(edit.linesRemoved, 0)
})

test('dedupeEdits drops the same edit replicated across transcripts', () => {
  // Arrange
  const edits = [
    { dedupeKey: 'a', linesAdded: 1 },
    { dedupeKey: 'a', linesAdded: 1 },
    { dedupeKey: 'b', linesAdded: 2 },
  ]

  // Act
  const unique = dedupeEdits(edits)

  // Assert
  assert.equal(unique.length, 2)
})

test('sumEdits totals lines, edit count and distinct files', () => {
  // Arrange
  const edits = [
    { linesAdded: 10, linesRemoved: 2, filePath: '/a.js' },
    { linesAdded: 5, linesRemoved: 1, filePath: '/a.js' },
    { linesAdded: 0, linesRemoved: 7, filePath: '/b.js' },
  ]

  // Act
  const totals = sumEdits(edits)

  // Assert
  assert.equal(totals.linesAdded, 15)
  assert.equal(totals.linesRemoved, 10)
  assert.equal(totals.linesNet, 5)
  assert.equal(totals.edits, 3)
  assert.equal(totals.files, 2)
})

test('sumEdits returns zeroes for no edits', () => {
  // Act
  const totals = sumEdits([])

  // Assert
  assert.deepEqual(totals, { linesAdded: 0, linesRemoved: 0, linesNet: 0, edits: 0, files: 0 })
})

test('buildEditDailySeries fills days without edits with zeroes', () => {
  // Arrange
  const now = Date.parse('2026-08-24T12:00:00Z')
  const edits = [{ timestamp: now, linesAdded: 4, linesRemoved: 1, filePath: '/a.js' }]

  // Act
  const series = buildEditDailySeries(edits, { days: 3, now, timeZone: 'UTC' })

  // Assert
  assert.equal(series.length, 3)
  assert.equal(series[0].linesAdded, 0)
  assert.equal(series[2].linesAdded, 4)
  assert.equal(series[2].linesRemoved, 1)
  assert.equal(series[2].date, '2026-08-24')
})

test('groupEditsBy ranks groups by total lines changed', () => {
  // Arrange
  const edits = [
    { cwd: '/big', linesAdded: 100, linesRemoved: 0, filePath: '/big/a.js' },
    { cwd: '/small', linesAdded: 1, linesRemoved: 1, filePath: '/small/a.js' },
    { cwd: '/big', linesAdded: 0, linesRemoved: 50, filePath: '/big/b.js' },
  ]

  // Act
  const groups = groupEditsBy(edits, (edit) => edit.cwd)

  // Assert
  assert.equal(groups[0].key, '/big')
  assert.equal(groups[0].linesAdded, 100)
  assert.equal(groups[0].linesRemoved, 50)
  assert.equal(groups[0].files, 2)
  assert.equal(groups[1].key, '/small')
})
