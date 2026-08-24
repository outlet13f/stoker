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

const freshLimits = (percent, over = {}) => ({
  source: 'live',
  isStale: false,
  ageMs: 1000,
  fallbackReason: null,
  entries: [
    { kind: 'session', label: '현재 세션', percent, severity: 'normal', resetsAt: NOW + 125 * 60_000, isActive: true },
    { kind: 'weekly_all', label: '주간 · 모든 모델', percent: 20, severity: 'normal', resetsAt: null, isActive: false },
  ],
  ...over,
})

const NOW = Date.parse('2026-08-24T08:00:00Z')

test('trayTitle shows the real session limit percentage', () => {
  // Act — 환산 추정 금액보다 실제 한도가 사실이다
  const title = trayTitle(activeReport(), freshLimits(71))

  // Assert
  assert.equal(title, '71%')
})

test('trayTitle shows the percentage even when the burn status is calm', () => {
  // Act
  const title = trayTitle(activeReport({ burnStatus: { level: 'ok', rank: 0.1 } }), freshLimits(12))

  // Assert
  assert.equal(title, '12%')
})

test('trayTitle falls back to the block cost when the limit is stale', () => {
  // Act — 낡은 퍼센트를 그냥 띄우면 여유 있다고 오해한다
  const title = trayTitle(activeReport(), freshLimits(17, { isStale: true, source: 'cache' }))

  // Assert
  assert.equal(title, '주의 $261')
})

test('trayTitle falls back to the block cost with no limit reading', () => {
  // Assert
  assert.equal(trayTitle(activeReport(), null), '주의 $261')
  assert.equal(trayTitle(activeReport()), '주의 $261')
})

test('trayTitle falls back when the reading has no session entry', () => {
  // Arrange
  const weeklyOnly = freshLimits(50)
  weeklyOnly.entries = weeklyOnly.entries.filter((e) => e.kind !== 'session')

  // Assert
  assert.equal(trayTitle(activeReport(), weeklyOnly), '주의 $261')
})

test('trayTitle stays short enough for a menu bar', () => {
  // Assert
  assert.ok(trayTitle(activeReport(), freshLimits(100)).length <= 6)
  assert.ok(trayTitle(activeReport({
    activeBlock: { cost: 12345.67, totalTokens: 0, requests: 0 },
    burnStatus: { level: 'crit', rank: 1 },
  })).length <= 14)
})

test('trayTitle shows nothing but the icon when nothing is running', () => {
  // Assert
  assert.equal(trayTitle(idleReport()), '')
})

test('trayTitle survives a report that has not loaded yet', () => {
  // Assert
  assert.match(trayTitle(null), /-/)
  assert.match(trayTitle(undefined, freshLimits(50)), /-/)
})

/* ---------- 툴팁 ---------- */

test('trayTooltip names the status in words, not just a glyph', () => {
  // Act
  const tooltip = trayTooltip(activeReport())

  // Assert
  assert.match(tooltip, /주의/)
  assert.match(tooltip, /Stoker/)
})

test('trayTooltip explains the percentage and when it resets', () => {
  // Act
  const tooltip = trayTooltip(activeReport(), freshLimits(71), NOW)

  // Assert
  assert.match(tooltip, /현재 세션 71%/)
  assert.match(tooltip, /2시간 5분 후 재설정/)
})

test('trayTooltip says the figure is cached when it fell back', () => {
  // Act
  const tooltip = trayTooltip(activeReport(), freshLimits(17, { isStale: true, source: 'cache' }), NOW)

  // Assert
  assert.doesNotMatch(tooltip, /현재 세션 17%/)
  assert.match(tooltip, /주의/)
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

/* ---------- 메뉴에 실제 한도 ---------- */

const limits = (over = {}) => ({
  fetchedAt: 0, ageMs: 60_000, isStale: false,
  entries: [
    { label: '현재 세션', percent: 53, severity: 'normal', resetsAt: null, isActive: true },
    { label: '주간 · 모든 모델', percent: 18, severity: 'normal', resetsAt: null, isActive: false },
  ],
  ...over,
})

test('trayReadouts puts the real limits above the estimated spend', () => {
  // Act
  const lines = trayReadouts(activeReport(), limits())

  // Assert — 환산 추정치보다 실제 한도가 먼저 눈에 와야 한다
  assert.match(lines[0], /현재 세션/)
  assert.match(lines[0], /53%/)
  assert.match(lines[1], /주간 · 모든 모델 +18%/)
  assert.ok(lines.findIndex((l) => /소진 속도/.test(l)) > 1)
})

test('trayReadouts marks a stale limit reading in the menu too', () => {
  // Act
  const joined = trayReadouts(activeReport(), limits({ isStale: true, ageMs: 189 * 60_000 })).join('\n')

  // Assert
  assert.match(joined, /3시간 9분 전/)
})

test('trayReadouts works without any limit reading', () => {
  // Act
  const joined = trayReadouts(activeReport(), null).join('\n')

  // Assert
  assert.doesNotMatch(joined, /현재 세션/)
  assert.match(joined, /소진 속도/)
})
