import path from 'node:path'

/**
 * 저장 경로 결정. Electron 을 import 하지 않으므로 그대로 테스트한다.
 * 대화상자를 띄우지 않고 바로 저장하므로, 이름이 겹쳐 앞의 리포트를 덮는 일이
 * 없어야 한다.
 */
const MAX_ATTEMPTS = 100

/** 집계 타임존 기준 stoker-YYYY-MM-DD-HHMM.pdf */
export function reportFileName(now, timeZone) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', {
      timeZone,
      hourCycle: 'h23',
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit',
    })
      .formatToParts(new Date(now))
      .map((part) => [part.type, part.value]),
  )

  return `stoker-${parts.year}-${parts.month}-${parts.day}-${parts.hour}${parts.minute}.pdf`
}

/** 겹치면 -2, -3 을 붙인다 */
export function uniquePath(directory, fileName, exists) {
  const extension = path.extname(fileName)
  const base = fileName.slice(0, -extension.length)

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    const candidate = path.join(directory, attempt === 1 ? fileName : `${base}-${attempt}${extension}`)
    if (!exists(candidate)) return candidate
  }

  throw new Error(`저장할 이름을 찾지 못했습니다: ${fileName}`)
}
