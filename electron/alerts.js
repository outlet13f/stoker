import { formatDuration, LEVEL_LABELS } from '../src/format.js'
import { NOTIFY_THRESHOLDS, RESET_WARNING_MS, RESET_ALERT_MIN_PERCENT } from '../src/constants.js'

/**
 * 무엇을 알릴지 결정한다. Electron 을 import 하지 않으므로 그대로 테스트한다.
 *
 * 가장 중요한 성질은 **중복 억제**다. 메뉴바는 수십 초마다 폴링하므로
 * "80% 를 넘은 상태" 를 조건으로 삼으면 계속 울린다. 그래서 조건이 아니라
 * **전이** 를 본다 — 넘는 순간에만 한 번 울리고, 아래로 내려가면 재무장한다.
 */
const SEVERITY_ORDER = { ok: 0, warn: 1, crit: 2 }

/** 세션 한도가 우리가 지켜보는 대상이다(주간은 천천히 움직여 알림 가치가 낮다) */
function sessionEntry(limits) {
  return limits?.entries?.find((entry) => entry.kind === 'session') ?? null
}

function resetSuffix(entry, now) {
  if (!entry.resetsAt) return ''
  return ` · ${formatDuration(entry.resetsAt - now)} 후 재설정`
}

export function createAlerter({
  enabled = true,
  thresholds = NOTIFY_THRESHOLDS,
  resetWarningMs = RESET_WARNING_MS,
} = {}) {
  // 낮은 값부터 넘어가도록 오름차순으로 본다
  const ladder = [...thresholds].sort((a, b) => a - b)

  const crossed = new Set()
  let lastLevel = null
  let warnedResetAt = null

  /** 임계값 통과. 한 번에 여러 개를 넘었으면 가장 높은 것만 알린다. */
  function thresholdAlerts(entry, now) {
    const newly = ladder.filter((mark) => entry.percent >= mark && !crossed.has(mark))

    // 아래로 내려간 임계값은 다시 알릴 수 있게 풀어 준다
    for (const mark of ladder) {
      if (entry.percent < mark) crossed.delete(mark)
    }
    for (const mark of newly) crossed.add(mark)

    if (newly.length === 0) return []

    const mark = newly.at(-1)
    return [{
      id: `threshold:${mark}`,
      title: `사용 한도 ${mark}% 넘음`,
      body: `${entry.label} ${entry.percent}%${resetSuffix(entry, now)}`,
    }]
  }

  /** 상태 악화만 알린다. 좋아지는 것은 알릴 이유가 없다. */
  function levelAlerts(report) {
    const level = report?.burnStatus?.level ?? null
    if (!level) return []

    const previous = lastLevel
    lastLevel = level

    // 첫 관측은 비교 대상이 없다 — 켠 순간 놀래키지 않는다
    if (previous === null) return []
    if ((SEVERITY_ORDER[level] ?? 0) <= (SEVERITY_ORDER[previous] ?? 0)) return []

    return [{
      id: `level:${previous}->${level}`,
      title: `소진 상태 ${LEVEL_LABELS[level] ?? level}`,
      body: `${LEVEL_LABELS[previous] ?? previous} 에서 올라갔습니다`,
    }]
  }

  /** 재설정 임박. 거의 안 썼으면 알릴 가치가 없다. */
  function resetAlerts(entry, now) {
    if (!entry.resetsAt) return []
    if (entry.percent < RESET_ALERT_MIN_PERCENT) return []

    const remaining = entry.resetsAt - now
    if (remaining < 0 || remaining > resetWarningMs) return []
    if (warnedResetAt === entry.resetsAt) return []

    warnedResetAt = entry.resetsAt
    return [{
      id: `reset:${entry.resetsAt}`,
      title: '한도 재설정 임박',
      body: `${formatDuration(remaining)} 후 재설정 · 현재 ${entry.percent}%`,
    }]
  }

  return function evaluate({ report, limits, now = Date.now() } = {}) {
    if (!enabled) return []

    const alerts = [...levelAlerts(report)]

    // 낡은 값으로 알리면 거짓 경보이거나 이미 늦은 경보다
    const entry = limits && !limits.isStale ? sessionEntry(limits) : null
    if (entry) alerts.push(...thresholdAlerts(entry, now), ...resetAlerts(entry, now))

    return alerts
  }
}
