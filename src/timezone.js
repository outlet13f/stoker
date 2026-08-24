import { MS_PER_DAY, MS_PER_HOUR } from './constants.js'

/**
 * 지정한 타임존의 UTC 오프셋(ms)을 구한다. 레코드마다 Intl 포매터를 돌리면
 * 수십만 건에서 느려지므로, 오프셋을 한 번만 구해 산술 연산으로 처리한다.
 */
export function getTimeZoneOffsetMs(timeZone, referenceTs = Date.now()) {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })

  const parts = Object.fromEntries(
    formatter.formatToParts(new Date(referenceTs)).map((part) => [part.type, part.value]),
  )

  const asUtc = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour),
    Number(parts.minute),
    Number(parts.second),
  )

  return asUtc - Math.floor(referenceTs / 1000) * 1000
}

/** 오프셋이 적용된 로컬 기준 YYYY-MM-DD */
export function toDateKey(timestamp, offsetMs) {
  return new Date(timestamp + offsetMs).toISOString().slice(0, 10)
}

/** 오프셋이 적용된 로컬 기준 0-23 시 */
export function toLocalHour(timestamp, offsetMs) {
  return Math.floor(((timestamp + offsetMs) % MS_PER_DAY) / MS_PER_HOUR)
}
