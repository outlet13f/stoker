import { getTimeZoneOffsetMs } from './timezone.js'
import { MS_PER_DAY } from './constants.js'

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/

/** 사용자가 고른 날짜는 집계 타임존 기준이므로 경계도 그 타임존으로 잡는다 */
function localDayStart(date, timeZone) {
  const asUtcMidnight = Date.parse(`${date}T00:00:00.000Z`)
  return asUtcMidnight - getTimeZoneOffsetMs(timeZone, asUtcMidnight)
}

/** 'YYYY-MM-DD' 가 실제로 존재하는 날짜인지(2026-02-30 같은 값 걸러내기) */
function isRealCalendarDate(date) {
  const parsed = new Date(`${date}T00:00:00.000Z`)
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === date
}

function requireDate(label, value) {
  if (!DATE_PATTERN.test(value)) {
    throw new Error(`${label} 는 YYYY-MM-DD 형식이어야 합니다: ${value}`)
  }
  if (!isRealCalendarDate(value)) {
    throw new Error(`${label} 는 존재하지 않는 날짜입니다: ${value}`)
  }
}

/**
 * from/to 질의 문자열을 집계용 타임스탬프 창으로 바꾼다.
 * 두 값이 모두 없으면 null(프리셋 기간을 그대로 쓴다는 뜻).
 * 잘못된 입력은 사용자에게 그대로 보여줄 메시지와 함께 던진다.
 */
export function parseDateRange({ from, to }, timeZone) {
  if (from == null && to == null) return null

  if (from == null || to == null) {
    throw new Error('from 과 to 는 함께 지정해야 합니다')
  }

  requireDate('from', from)
  requireDate('to', to)

  const start = localDayStart(from, timeZone)
  // to 로 고른 날 하루 전체를 포함해야 하므로 다음 날 0시 직전까지 늘린다
  const end = localDayStart(to, timeZone) + MS_PER_DAY - 1

  if (start > end) {
    throw new Error(`from 이 to 보다 뒤입니다: ${from} > ${to}`)
  }

  return { from: start, to: end, fromDate: from, toDate: to }
}
