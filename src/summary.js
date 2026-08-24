import { formatCost, formatTokens, formatPercent, formatDuration } from './format.js'

const COLUMN_GAP = 2

function table(headers, rows) {
  const widths = headers.map((header, index) =>
    Math.max(header.length, ...rows.map((row) => String(row[index]).length)),
  )

  const line = (cells) =>
    cells
      .map((cell, index) => (index === 0 ? String(cell).padEnd(widths[index]) : String(cell).padStart(widths[index])))
      .join(' '.repeat(COLUMN_GAP))

  return [line(headers), line(widths.map((width) => '─'.repeat(width))), ...rows.map(line)].join('\n')
}

/** 터미널에 찍을 요약. 대시보드를 열지 않고도 핵심을 볼 수 있게 한다. */
export function renderSummary(report) {
  const lines = [
    `기간 ${report.rangeDays}일  ·  환산 비용 ${formatCost(report.range.cost)}  ·  ` +
      `토큰 ${formatTokens(report.range.totalTokens)}  ·  요청 ${report.range.requests.toLocaleString('en-US')}건`,
    `누적 전체  ${formatCost(report.allTime.cost)}  ·  캐시 적중률 ${formatPercent(report.cacheHitRate)}` +
      `  ·  캐시 절감 ${formatCost(report.allTime.cacheSavings)}`,
    '',
  ]

  const code = report.code?.range
  if (code && code.edits > 0) {
    lines.push(
      `코드 변경  +${code.linesAdded.toLocaleString('en-US')} / ` +
        `-${code.linesRemoved.toLocaleString('en-US')} 줄  ·  ` +
        `순증 ${code.linesNet >= 0 ? '+' : ''}${code.linesNet.toLocaleString('en-US')}  ·  ` +
        `파일 ${code.files}개  ·  편집 ${code.edits.toLocaleString('en-US')}회`,
      '',
    )
  }

  if (report.activeBlock) {
    lines.push(
      `진행 중 블록  ${formatCost(report.activeBlock.cost)} 사용  ·  ` +
        `${formatCost(report.activeBurn.costPerHour)}/h  ·  ` +
        `예상 총액 ${formatCost(report.activeBurn.projectedCost)}  ·  ` +
        `${formatDuration(report.activeBurn.remainingMs)} 남음  [${report.burnStatus.level.toUpperCase()}]`,
      '',
    )
  } else {
    lines.push('진행 중인 5시간 블록 없음', '')
  }

  lines.push(
    '모델별',
    table(
      ['모델', '비용', '토큰', '요청'],
      report.byModel.map((row) => [row.key, formatCost(row.cost), formatTokens(row.totalTokens), row.requests]),
    ),
    '',
    '프로젝트별 (상위)',
    table(
      ['프로젝트', '비용', '토큰', '요청'],
      report.byProject
        .slice(0, 8)
        .map((row) => [`${row.label}${row.parent ? ` (${row.parent})` : ''}`, formatCost(row.cost), formatTokens(row.totalTokens), row.requests]),
    ),
  )

  return lines.join('\n')
}
