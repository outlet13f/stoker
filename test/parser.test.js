import test from 'node:test'
import assert from 'node:assert/strict'
import { parseLine, buildDedupeKey } from '../src/parser.js'

const ASSISTANT_LINE = JSON.stringify({
  type: 'assistant',
  isSidechain: false,
  requestId: 'req_abc',
  timestamp: '2026-08-24T04:18:09.176Z',
  sessionId: 'sess-1',
  cwd: '/Users/duksang/IdeaProjects/BDMIRAE',
  gitBranch: 'main',
  version: '2.1.241',
  effort: 'high',
  message: {
    id: 'msg_1',
    model: 'claude-opus-5',
    role: 'assistant',
    usage: {
      input_tokens: 2,
      output_tokens: 242,
      cache_creation_input_tokens: 45036,
      cache_read_input_tokens: 27120,
      output_tokens_details: { thinking_tokens: 110 },
      cache_creation: { ephemeral_1h_input_tokens: 45036, ephemeral_5m_input_tokens: 0 },
    },
  },
})

test('parseLine extracts token counts from an assistant entry', () => {
  // Act
  const record = parseLine(ASSISTANT_LINE)

  // Assert
  assert.equal(record.inputTokens, 2)
  assert.equal(record.outputTokens, 242)
  assert.equal(record.cacheWrite1hTokens, 45036)
  assert.equal(record.cacheWrite5mTokens, 0)
  assert.equal(record.cacheReadTokens, 27120)
  assert.equal(record.thinkingTokens, 110)
})

test('parseLine carries session, model, and context metadata', () => {
  const record = parseLine(ASSISTANT_LINE)
  assert.equal(record.model, 'claude-opus-5')
  assert.equal(record.sessionId, 'sess-1')
  assert.equal(record.cwd, '/Users/duksang/IdeaProjects/BDMIRAE')
  assert.equal(record.gitBranch, 'main')
  assert.equal(record.version, '2.1.241')
  assert.equal(record.effort, 'high')
  assert.equal(record.isSidechain, false)
  assert.equal(record.timestamp, Date.parse('2026-08-24T04:18:09.176Z'))
})

test('parseLine computes cost eagerly so aggregation stays cheap', () => {
  const record = parseLine(ASSISTANT_LINE)
  assert.ok(record.cost > 0, 'cost should be positive')
})

test('parseLine returns null for entries without usage data', () => {
  assert.equal(parseLine(JSON.stringify({ type: 'user', message: { content: 'hi' } })), null)
  assert.equal(parseLine(JSON.stringify({ type: 'assistant', message: { model: 'x' } })), null)
})

test('parseLine returns null instead of throwing on malformed JSON', () => {
  assert.equal(parseLine('{not json'), null)
  assert.equal(parseLine(''), null)
  assert.equal(parseLine('   '), null)
})

test('parseLine skips entries whose timestamp is unusable', () => {
  const line = JSON.stringify({
    type: 'assistant',
    timestamp: 'not-a-date',
    message: { id: 'm', model: 'claude-opus-5', usage: { output_tokens: 10 } },
  })
  assert.equal(parseLine(line), null)
})

test('parseLine derives cacheWrite5m when only the total is reported', () => {
  // 구버전 로그: cache_creation 상세 없이 총합만 있는 경우 5m 로 간주
  const line = JSON.stringify({
    type: 'assistant',
    timestamp: '2026-08-01T00:00:00.000Z',
    message: { id: 'm', model: 'claude-opus-5', usage: { cache_creation_input_tokens: 1000, output_tokens: 1 } },
  })
  const record = parseLine(line)
  assert.equal(record.cacheWrite5mTokens, 1000)
  assert.equal(record.cacheWrite1hTokens, 0)
})

test('buildDedupeKey combines message id and request id', () => {
  assert.equal(buildDedupeKey({ messageId: 'msg_1', requestId: 'req_abc' }), 'msg_1:req_abc')
})

test('buildDedupeKey stays unique when a request id is missing', () => {
  const a = buildDedupeKey({ messageId: 'msg_1', requestId: undefined })
  const b = buildDedupeKey({ messageId: 'msg_2', requestId: undefined })
  assert.notEqual(a, b)
})
