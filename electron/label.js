import { formatCost, formatDuration, LEVEL_LABELS } from '../src/format.js'

/**
 * 메뉴바에 올릴 문구. Electron 을 import 하지 않으므로 그대로 테스트할 수 있다.
 * 메뉴바는 폭이 좁아서 한 눈에 읽히는 최소한만 올리고, 나머지는 메뉴로 내린다.
 */
const IDLE = 'idle'
const PLACEHOLDER = '-'

function levelOf(report) {
  if (!report?.activeBlock) return IDLE
  return report.burnStatus?.level ?? 'ok'
}

/** 센트를 버려 폭이 흔들리지 않게 한다($261.22 → $261) */
function wholeCost(amount) {
  return `$${Math.round(Number(amount) || 0).toLocaleString('en-US')}`
}

/** 믿을 수 있는(신선한) 세션 한도만 돌려준다 */
function freshSession(limits) {
  if (!limits || limits.isStale) return null
  return limits.entries?.find((entry) => entry.kind === 'session') ?? null
}

/**
 * 메뉴바에는 실제 세션 한도 퍼센트를 올린다 — 환산 추정 금액보다 이것이 사실이다.
 * 숫자 자체가 신호라서 상태 단어를 덧붙이지 않는다(71% 와 96% 는 읽으면 안다).
 *
 * 한도가 낡았거나 없으면 금액으로 되돌아간다. 낡은 퍼센트를 그냥 띄우면
 * 여유 있다고 오해하게 만들기 때문이다. 그때는 상태 단어를 붙여 주의를 끈다.
 */
export function trayTitle(report, limits = null) {
  if (!report) return PLACEHOLDER

  const session = freshSession(limits)
  if (session) return `${session.percent}%`

  const level = levelOf(report)
  if (level === IDLE) return ''

  const amount = wholeCost(report.activeBlock.cost)
  return level === 'ok' ? amount : `${LEVEL_LABELS[level]} ${amount}`
}

export function trayTooltip(report, limits = null, now = Date.now()) {
  if (!report) return 'Stoker — 아직 불러오지 않았습니다'

  const session = freshSession(limits)
  if (session) {
    const reset = session.resetsAt ? ` · ${formatDuration(session.resetsAt - now)} 후 재설정` : ''
    return `Stoker — ${session.label} ${session.percent}%${reset}`
  }

  const level = levelOf(report)
  if (level === IDLE) return 'Stoker — 진행 중인 블록 없음'

  return `Stoker — ${LEVEL_LABELS[level]} · 블록 ${formatCost(report.activeBlock.cost)} 사용`
}

function signed(value) {
  return `${value >= 0 ? '+' : ''}${value.toLocaleString('en-US')}`
}

/**
 * 메뉴에 비활성 항목으로 얹을 수치들.
 * 실제 계정 한도(있으면)를 맨 위에 둔다 — 환산 추정치보다 이게 사실이다.
 */
export function trayReadouts(report, limits = null) {
  if (!report) return ['불러오는 중…']

  const lines = []

  for (const entry of limits?.entries ?? []) {
    lines.push(`${entry.label.padEnd(12)}${String(entry.percent).padStart(3)}%`)
  }
  if (limits?.entries?.length) {
    if (limits.isStale) lines.push(`(${formatDuration(limits.ageMs)} 전 기준)`)
    lines.push('─────────────')
  }
  const { activeBlock, activeBurn, range, code } = report

  if (activeBlock && activeBurn) {
    lines.push(
      `블록 사용   ${formatCost(activeBlock.cost)}`,
      `소진 속도   ${formatCost(activeBurn.costPerHour)}/h`,
      `예상 총액   ${formatCost(activeBurn.projectedCost)}`,
      `남은 시간   ${formatDuration(activeBurn.remainingMs)}`,
    )
  } else {
    lines.push('진행 중인 블록 없음')
  }

  lines.push(`기간 비용   ${formatCost(range.cost)}`)

  const changed = code?.range
  if (changed && changed.edits > 0) {
    lines.push(`코드 변경   ${signed(changed.linesAdded)} / ${signed(-changed.linesRemoved)} 줄`)
  }

  return lines
}
