import test from 'node:test'
import assert from 'node:assert/strict'
import { trayIconFile, notifySettingsHint, windowBackground } from '../electron/platform.js'
import { LIGHT_TOKENS, DARK_TOKENS } from '../src/render/theme.js'

test('trayIconFile uses the template icon on macOS', () => {
  assert.equal(trayIconFile('darwin'), 'trayTemplate.png')
})

test('trayIconFile uses the colored icon where the OS does not invert it', () => {
  // 검정 템플릿 아이콘은 macOS 만 명암에 맞춰 반전한다.
  // 다른 OS 에 그대로 주면 어두운 작업표시줄에서 사라진다.
  assert.equal(trayIconFile('win32'), 'trayColor.png')
  assert.equal(trayIconFile('linux'), 'trayColor.png')
})

test('notifySettingsHint points at the Windows settings path on Windows', () => {
  assert.match(notifySettingsHint('win32'), /설정 > 시스템 > 알림/)
})

test('notifySettingsHint points at the macOS settings path elsewhere', () => {
  assert.match(notifySettingsHint('darwin'), /시스템 설정 > 알림/)
})

test('windowBackground tracks the theme tokens rather than a hardcoded colour', () => {
  // 창 배경이 팔레트와 어긋나면 첫 페인트 전에 없는 색이 번쩍인다
  assert.equal(windowBackground(false), LIGHT_TOKENS.bg)
  assert.equal(windowBackground(true), DARK_TOKENS.bg)
})
