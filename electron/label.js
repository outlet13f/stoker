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

/**
 * 평상시(안정)에는 금액만, 주의·높음일 때만 상태를 글자로 앞에 붙인다.
 * ●▲■ 같은 글리프는 16px 메뉴바에서 앱 아이콘과 뭉개져 구분이 되지 않는다.
 * 조용히 있다가 볼 필요가 있을 때만 눈에 걸리게 하는 것이 목적이다.
 */
export function trayTitle(report) {
  if (!report) return PLACEHOLDER

  const level = levelOf(report)
  if (level === IDLE) return ''

  const amount = wholeCost(report.activeBlock.cost)
  return level === 'ok' ? amount : `${LEVEL_LABELS[level]} ${amount}`
}

export function trayTooltip(report) {
  if (!report) return 'Stoker — 아직 불러오지 않았습니다'

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
