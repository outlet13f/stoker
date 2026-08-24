import test from 'node:test'
import assert from 'node:assert/strict'
import { parseArgs } from '../src/args.js'

test('parseArgs defaults to a static build of the 30 day range', () => {
  const options = parseArgs([])
  assert.equal(options.serve, false)
  assert.equal(options.days, 30)
  assert.equal(options.json, false)
})

test('parseArgs enables the live server and accepts a port', () => {
  const options = parseArgs(['--serve', '--port', '9000'])
  assert.equal(options.serve, true)
  assert.equal(options.port, 9000)
})

test('parseArgs reads the range, output path, and timezone', () => {
  const options = parseArgs(['--days', '90', '--out', '/tmp/x.html', '--tz', 'UTC'])
  assert.equal(options.days, 90)
  assert.equal(options.out, '/tmp/x.html')
  assert.equal(options.timeZone, 'UTC')
})

test('parseArgs rejects a non-numeric port instead of silently defaulting', () => {
  assert.throws(() => parseArgs(['--port', 'abc']), /--port/)
})

test('parseArgs rejects an unknown flag so typos are not ignored', () => {
  assert.throws(() => parseArgs(['--nope']), /알 수 없는 옵션/)
})

test('parseArgs recognises the json, open, and help switches', () => {
  const options = parseArgs(['--json', '--open', '--help'])
  assert.equal(options.json, true)
  assert.equal(options.open, true)
  assert.equal(options.help, true)
})

test('parseArgs rejects a value flag with nothing after it', () => {
  assert.throws(() => parseArgs(['--out']), /--out/)
  assert.throws(() => parseArgs(['--tz']), /--tz/)
})

test('parseArgs rejects a value flag followed by another flag', () => {
  assert.throws(() => parseArgs(['--out', '--serve']), /--out/)
})

/* ---------- 갱신 주기 ---------- */

test('parseArgs defaults the refresh interval', () => {
  // Act
  const options = parseArgs([])

  // Assert
  assert.equal(options.refreshSeconds, 30)
})

test('parseArgs reads a refresh interval in seconds', () => {
  // Act & Assert
  assert.equal(parseArgs(['--refresh', '10']).refreshSeconds, 10)
  assert.equal(parseArgs(['--refresh', '300']).refreshSeconds, 300)
})

test('parseArgs treats a zero refresh interval as no auto refresh', () => {
  // Act
  const options = parseArgs(['--refresh', '0'])

  // Assert
  assert.equal(options.refreshSeconds, 0)
})

test('parseArgs rejects a refresh interval that would hammer the collector', () => {
  // Assert
  assert.throws(() => parseArgs(['--refresh', '1']), /5초/)
  assert.throws(() => parseArgs(['--refresh', '4.9']), /5초/)
})

test('parseArgs treats a leading-dash value as a missing value, not a number', () => {
  // Assert — '--refresh --serve' 같은 오타를 숫자로 오해하지 않는다
  assert.throws(() => parseArgs(['--refresh', '-3']), /값이 필요합니다/)
  assert.throws(() => parseArgs(['--refresh', '--serve']), /값이 필요합니다/)
})

test('parseArgs rejects an absurdly long refresh interval', () => {
  // Assert
  assert.throws(() => parseArgs(['--refresh', '99999']), /3600/)
})

test('parseArgs rejects a non-numeric refresh interval', () => {
  // Assert
  assert.throws(() => parseArgs(['--refresh', 'often']), /숫자/)
})

/* ---------- 실시간 한도 조회 ---------- */

test('parseArgs asks for live limits by default', () => {
  assert.equal(parseArgs([]).liveLimits, true)
})

test('parseArgs can turn the network call off', () => {
  // Act & Assert — 인증된 외부 요청을 끄고 캐시만 쓰는 선택
  assert.equal(parseArgs(['--no-live-limits']).liveLimits, false)
})

test('parseArgs keeps --no-live-limits out of the flag name mangling', () => {
  // Assert — '--no-live-limits' 가 options["no-live-limits"] 로 새지 않아야 한다
  const options = parseArgs(['--no-live-limits'])
  assert.equal('no-live-limits' in options, false)
})

/* ---------- 알림 ---------- */

test('parseArgs enables notifications by default with sane thresholds', () => {
  // Act
  const options = parseArgs([])

  // Assert
  assert.equal(options.notify, true)
  assert.deepEqual(options.notifyAt, [80, 95])
})

test('parseArgs can turn notifications off', () => {
  assert.equal(parseArgs(['--no-notify']).notify, false)
})

test('parseArgs reads custom thresholds', () => {
  // Act & Assert
  assert.deepEqual(parseArgs(['--notify-at', '70,90']).notifyAt, [70, 90])
  assert.deepEqual(parseArgs(['--notify-at', '50']).notifyAt, [50])
})

test('parseArgs sorts and dedupes thresholds', () => {
  assert.deepEqual(parseArgs(['--notify-at', '95,80,95']).notifyAt, [80, 95])
})

test('parseArgs rejects thresholds outside 1-100', () => {
  assert.throws(() => parseArgs(['--notify-at', '0,80']), /1~100/)
  assert.throws(() => parseArgs(['--notify-at', '80,120']), /1~100/)
})

test('parseArgs rejects non-integer thresholds', () => {
  assert.throws(() => parseArgs(['--notify-at', '80.5']), /1~100/)
  assert.throws(() => parseArgs(['--notify-at', 'high']), /1~100/)
})

test('parseArgs keeps --no-notify out of the flag name mangling', () => {
  assert.equal('no-notify' in parseArgs(['--no-notify']), false)
})
