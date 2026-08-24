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
