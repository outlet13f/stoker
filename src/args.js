import {
  DEFAULT_PORT,
  DEFAULT_RANGE_DAYS,
  DEFAULT_REFRESH_SECONDS,
  MIN_REFRESH_SECONDS,
  MAX_REFRESH_SECONDS,
} from './constants.js'

const FLAGS = new Set(['--serve', '--json', '--open', '--help', '-h'])
const VALUE_FLAGS = new Set(['--port', '--days', '--out', '--tz', '--refresh'])

function requireValue(flag, raw) {
  if (raw === undefined || raw.startsWith('-')) {
    throw new Error(`${flag} 에 값이 필요합니다`)
  }
  return raw
}

function requireNumber(flag, raw) {
  const value = Number(raw)
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`${flag} 값이 숫자가 아닙니다: ${raw}`)
  }
  return value
}

/** 0 은 자동 갱신 끔. 그 밖에는 허용 범위를 벗어나면 이유를 밝히고 실패시킨다. */
function requireRefreshSeconds(flag, raw) {
  const value = Number(raw)
  if (!Number.isFinite(value)) {
    throw new Error(`${flag} 값이 숫자가 아닙니다: ${raw}`)
  }
  if (value === 0) return 0
  if (value < MIN_REFRESH_SECONDS) {
    throw new Error(`${flag} 는 ${MIN_REFRESH_SECONDS}초 이상이어야 합니다 (0 은 자동 갱신 끔): ${raw}`)
  }
  if (value > MAX_REFRESH_SECONDS) {
    throw new Error(`${flag} 는 ${MAX_REFRESH_SECONDS}초 이하여야 합니다: ${raw}`)
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
    refreshSeconds: DEFAULT_REFRESH_SECONDS,
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
      const raw = requireValue(token, argv[index + 1])
      index += 1

      if (token === '--port') options.port = requireNumber(token, raw)
      else if (token === '--days') options.days = requireNumber(token, raw)
      else if (token === '--out') options.out = raw
      else if (token === '--tz') options.timeZone = raw
      else if (token === '--refresh') options.refreshSeconds = requireRefreshSeconds(token, raw)
      continue
    }

    throw new Error(`알 수 없는 옵션: ${token}`)
  }

  return options
}
