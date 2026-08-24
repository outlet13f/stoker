import test from 'node:test'
import assert from 'node:assert/strict'
import { trayTitle, trayTooltip, trayReadouts } from '../electron/label.js'

const activeReport = (over = {}) => ({
  activeBlock: { cost: 261.22, totalTokens: 127_300_000, requests: 823 },
  activeBurn: { costPerHour: 58.59, projectedCost: 292.94, remainingMs: 32 * 60 * 1000 },
  burnStatus: { level: 'warn', rank: 0.81 },
  range: { cost: 3648.48, requests: 6024 },
  allTime: { cost: 10043.71 },
  code: { range: { linesAdded: 4562, linesRemoved: 327, files: 53, edits: 75 } },
  ...over,
})

const idleReport = () => ({
  activeBlock: null,
  activeBurn: null,
  burnStatus: { level: 'ok', rank: null },
  range: { cost: 12.5, requests: 40 },
  allTime: { cost: 900 },
  code: { range: { linesAdded: 0, linesRemoved: 0, files: 0, edits: 0 } },
})

/* ---------- 메뉴바 제목 ---------- */

test('trayTitle shows only the amount while the burn is normal', () => {
  // Arrange — 평상시에는 조용해야 한다. 아이콘이 이미 앱을 알려 준다.
  const report = activeReport({ burnStatus: { level: 'ok', rank: 0.2 } })

  // Act & Assert
  assert.equal(trayTitle(report), '$261')
})

test('trayTitle spells out the status when it needs attention', () => {
  // Act & Assert — 글리프는 16px 에서 아이콘과 뭉개져 구분이 안 된다
  assert.equal(trayTitle(activeReport({ burnStatus: { level: 'warn', rank: 0.8 } })), '주의 $261')
  assert.equal(trayTitle(activeReport({ burnStatus: { level: 'crit', rank: 0.95 } })), '높음 $261')
})

test('trayTitle stays short enough for a menu bar', () => {
  // Act
  const title = trayTitle(activeReport({
    activeBlock: { cost: 12345.67, totalTokens: 0, requests: 0 },
    burnStatus: { level: 'crit', rank: 1 },
  }))

  // Assert — 메뉴바는 폭이 좁다. 길어지면 다른 아이콘을 밀어낸다.
  assert.ok(title.length <= 14, `너무 김: ${title} (${title.length}자)`)
})

test('trayTitle drops the cents so the width does not jitter', () => {
  // Act & Assert — $261.22 → $261 처럼 폭이 흔들리지 않아야 한다
  assert.doesNotMatch(trayTitle(activeReport()), /\./)
})

test('trayTitle shows nothing but the icon when no block is running', () => {
  // Act & Assert — 쓰는 중이 아니면 보고할 것이 없다
  assert.equal(trayTitle(idleReport()), '')
})

test('trayTitle survives a report that has not loaded yet', () => {
  // Assert
  assert.equal(typeof trayTitle(null), 'string')
  assert.equal(typeof trayTitle(undefined), 'string')
  assert.match(trayTitle(null), /-/)
})

/* ---------- 툴팁 ---------- */

test('trayTooltip names the status in words, not just a glyph', () => {
  // Act
  const tooltip = trayTooltip(activeReport())

  // Assert
  assert.match(tooltip, /주의/)
  assert.match(tooltip, /Stoker/)
})

test('trayTooltip says plainly when nothing is running', () => {
  // Assert
  assert.match(trayTooltip(idleReport()), /진행 중인 블록 없음/)
})

/* ---------- 메뉴 안의 수치 ---------- */

test('trayReadouts lists the numbers worth glancing at', () => {
  // Act
  const lines = trayReadouts(activeReport())

  // Assert
  const joined = lines.join('\n')
  assert.match(joined, /소진 속도/)
  assert.match(joined, /\$58\.59\/h/)
  assert.match(joined, /예상 총액/)
  assert.match(joined, /\$292\.94/)
  assert.match(joined, /남은 시간/)
  assert.match(joined, /32분/)
})

test('trayReadouts includes the range spend and code volume', () => {
  // Act
  const joined = trayReadouts(activeReport()).join('\n')

  // Assert
  assert.match(joined, /\$3,648\.48/)
  assert.match(joined, /\+4,562/)
  assert.match(joined, /-327/)
})

test('trayReadouts omits the block rows when no block is running', () => {
  // Act
  const joined = trayReadouts(idleReport()).join('\n')

  // Assert
  assert.doesNotMatch(joined, /소진 속도/)
  assert.match(joined, /\$12\.50/)
})

test('trayReadouts returns a usable line before any report arrives', () => {
  // Act
  const lines = trayReadouts(null)

  // Assert
  assert.ok(lines.length >= 1)
  assert.match(lines.join('\n'), /불러오는 중|아직/)
})

test('trayReadouts omits the code row when nothing was edited', () => {
  // Arrange
  const report = activeReport({ code: { range: { linesAdded: 0, linesRemoved: 0, files: 0, edits: 0 } } })

  // Act
  const joined = trayReadouts(report).join('\n')

  // Assert
  assert.doesNotMatch(joined, /코드 변경/)
})
