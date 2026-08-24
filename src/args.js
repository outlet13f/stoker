import { DEFAULT_PORT, DEFAULT_RANGE_DAYS } from './constants.js'

const FLAGS = new Set(['--serve', '--json', '--open', '--help', '-h'])
const VALUE_FLAGS = new Set(['--port', '--days', '--out', '--tz'])

function requireNumber(flag, raw) {
  const value = Number(raw)
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`${flag} 값이 숫자가 아닙니다: ${raw}`)
  }
  return value
}

/** CLI 인자를 옵션 객체로 바꾼다. 모르는 옵션은 조용히 넘기지 않고 실패시킨다. */
export function parseArgs(argv) {
  const options = {
    serve: false,
    json: false,
    open: false,
    help: false,
    port: DEFAULT_PORT,
    days: DEFAULT_RANGE_DAYS,
    out: null,
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  }

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index]

    if (FLAGS.has(token)) {
      const key = token.replace(/^-+/, '')
      options[key === 'h' ? 'help' : key] = true
      continue
    }

    if (VALUE_FLAGS.has(token)) {
      const raw = argv[index + 1]
      index += 1

      if (token === '--port') options.port = requireNumber(token, raw)
      else if (token === '--days') options.days = requireNumber(token, raw)
      else if (token === '--out') options.out = raw
      else if (token === '--tz') options.timeZone = raw
      continue
    }

    throw new Error(`알 수 없는 옵션: ${token}`)
  }

  return options
}
