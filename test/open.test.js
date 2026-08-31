import test from 'node:test'
import assert from 'node:assert/strict'
import { openCommand } from '../src/open.js'

test('openCommand uses open on macOS', () => {
  assert.deepEqual(openCommand('darwin', 'http://127.0.0.1:7331'), {
    command: 'open',
    args: ['http://127.0.0.1:7331'],
  })
})

test('openCommand uses xdg-open on Linux', () => {
  assert.deepEqual(openCommand('linux', 'http://127.0.0.1:7331'), {
    command: 'xdg-open',
    args: ['http://127.0.0.1:7331'],
  })
})

test('openCommand does not route through cmd.exe on Windows', () => {
  // start 는 cmd 빌트인이라 execFile 로 못 부르고, cmd 를 거치면 경로의
  // & ^ % 가 명령으로 해석된다. rundll32 는 실행 파일이라 그 파싱이 없다.
  const { command, args } = openCommand('win32', 'http://127.0.0.1:7331')
  assert.equal(command, 'rundll32')
  assert.notEqual(command, 'cmd')
  assert.deepEqual(args, ['url.dll,FileProtocolHandler', 'http://127.0.0.1:7331'])
})

test('openCommand passes a Windows path with shell metacharacters through untouched', () => {
  const target = 'C:\\R&D\\100%\\dash.html'
  const { args } = openCommand('win32', target)
  assert.equal(args.at(-1), target)
})
