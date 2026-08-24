/* eslint-env browser */
/* 이 파일은 번들러가 format.js 와 이어붙여 페이지에 인라인한다(모듈 문법 없음). */

const RANGE_LABELS = { 7: '7일', 30: '30일', 90: '90일', all: '전체' }
const SOURCE_LABELS = { main: '메인 세션', subagent: '서브에이전트', workflow: '워크플로' }
const SOURCE_VARS = { main: '--cat-1', subagent: '--cat-2', workflow: '--cat-3' }
const LEVEL_LABELS = { ok: '안정', warn: '주의', crit: '높음', idle: '유휴' }
const LEVEL_GLYPHS = { ok: '●', warn: '▲', crit: '■', idle: '○' }

const TOKEN_BUCKETS = [
  { field: 'cacheReadTokens', costField: 'cacheReadCost', label: '캐시 읽기', varName: '--seq-1', note: 'input 단가의 0.1배' },
  { field: 'inputTokens', costField: 'inputCost', label: '신규 입력', varName: '--seq-2', note: 'input 정가' },
  { field: 'cacheWrite5mTokens', costField: 'cacheWrite5mCost', label: '캐시 쓰기 5m', varName: '--seq-3', note: 'input 단가의 1.25배' },
  { field: 'cacheWrite1hTokens', costField: 'cacheWrite1hCost', label: '캐시 쓰기 1h', varName: '--seq-4', note: 'input 단가의 2배' },
  { field: 'outputTokens', costField: 'outputCost', label: '출력', varName: '--seq-5', note: 'output 정가' },
]

/** 비율이 아무리 작아도 눈에 보이고 hover 가능하도록 남기는 최소 폭(1000 기준) */
const MIN_SEGMENT_WIDTH = 2

const state = {
  reports: window.__REPORTS__ || {},
  config: window.__CONFIG__ || { live: false, refreshSeconds: 30, timeZone: 'UTC' },
  range: '30',
  connection: 'static',
}

/* ---------- 유틸 ---------- */
const $ = (id) => document.getElementById(id)
const cssVar = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim()

function esc(value) {
  return String(value).replace(/[&<>"']/g, (ch) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[ch])
}

function currentReport() {
  return state.reports[state.range] || state.reports['30'] || Object.values(state.reports)[0]
}

function clockAt(ts) {
  return new Intl.DateTimeFormat('ko-KR', {
    timeZone: state.config.timeZone, hour: '2-digit', minute: '2-digit', hour12: false,
  }).format(new Date(ts))
}

function dateAt(ts) {
  return new Intl.DateTimeFormat('ko-KR', {
    timeZone: state.config.timeZone, month: 'numeric', day: 'numeric',
  }).format(new Date(ts))
}

function shortDate(isoDate) {
  const [, month, day] = isoDate.split('-')
  return `${Number(month)}/${Number(day)}`
}

function deltaClass(ratio) {
  if (ratio === null || ratio === undefined) return ''
  return ratio > 0 ? 'up' : ratio < 0 ? 'down' : ''
}

/** 비교 대상 구간이 비어 있으면 퍼센트 대신 그 사실을 말한다 */
function deltaNote(baselineLabel, ratio) {
  if (ratio === null || ratio === undefined) return `${baselineLabel} 사용 없음`
  return `${baselineLabel} 대비 <span class="${deltaClass(ratio)}">${formatDelta(ratio)}</span>`
}

/* ---------- 툴팁 ---------- */
const tooltip = { node: null }

function showTip(event, title, lines) {
  if (!tooltip.node) return
  tooltip.node.innerHTML =
    `<span class="tooltip-title">${esc(title)}</span>${lines.map((l) => esc(l)).join('<br>')}`
  tooltip.node.style.left = `${event.clientX}px`
  tooltip.node.style.top = `${event.clientY}px`
  tooltip.node.dataset.open = 'true'
}

function hideTip() {
  if (tooltip.node) tooltip.node.dataset.open = 'false'
}

/** SVG 막대에 hover 툴팁을 붙인다(마크보다 넓은 히트 영역 사용) */
function bindTips(root) {
  root.querySelectorAll('[data-tip-title]').forEach((node) => {
    const title = node.dataset.tipTitle
    const lines = JSON.parse(node.dataset.tipLines)
    node.addEventListener('mousemove', (event) => showTip(event, title, lines))
    node.addEventListener('mouseleave', hideTip)
  })
}

/* ---------- 헤더 ---------- */
function renderMasthead(report) {
  const stateText = { live: '실시간', static: '스냅샷', stale: '갱신 지연', error: '연결 끊김' }
  const liveState = state.connection === 'live' ? 'live' : state.connection

  $('live').dataset.state = liveState
  $('live-text').textContent = stateText[liveState] || '스냅샷'
  $('generated').textContent = `${dateAt(report.generatedAt)} ${clockAt(report.generatedAt)}`
  $('req-count').textContent = report.allTime.requests.toLocaleString('en-US')
  $('span-text').textContent = report.firstActivity
    ? `${dateAt(report.firstActivity)} – ${dateAt(report.lastActivity)}`
    : '기록 없음'
}

/* ---------- 밴드 1: 진행 중 블록 계기 ---------- */
function renderGauge(report) {
  const { activeBlock, activeBurn, burnStatus } = report

  if (!activeBlock) {
    $('gauge').innerHTML = `
      <div class="gauge-top">
        <div class="hero">
          <span class="pill" data-level="idle"><span class="pill-glyph">${LEVEL_GLYPHS.idle}</span>${LEVEL_LABELS.idle}</span>
          <span class="hero-value">—</span>
          <span class="hero-note">${report.lastActivity
            ? `마지막 활동 ${dateAt(report.lastActivity)} ${clockAt(report.lastActivity)} · 5시간 창이 이미 닫혔습니다`
            : '기록된 활동이 없습니다'}</span>
        </div>
        <dl class="readouts">
          ${readout('과거 블록 중앙값', formatCost(report.blockCostMedian))}
          ${readout('과거 블록 상위 10%', formatCost(report.blockCostP90))}
          ${readout('집계된 블록 수', String(report.blocks.length))}
        </dl>
      </div>`
    return
  }

  const level = burnStatus.level
  const rankNote = burnStatus.rank === null
    ? '비교할 과거 블록이 없습니다'
    : `예상 총액이 과거 블록의 상위 ${formatPercent(1 - burnStatus.rank, 0)} 수준`

  $('gauge').innerHTML = `
    <div class="gauge-top">
      <div class="hero">
        <span class="pill" data-level="${level}"><span class="pill-glyph">${LEVEL_GLYPHS[level]}</span>${LEVEL_LABELS[level]}</span>
        <span class="hero-value">${formatCost(activeBlock.cost)}</span>
        <span class="hero-note">${esc(rankNote)}</span>
      </div>
      <dl class="readouts">
        ${readout('소진 속도', `${formatCost(activeBurn.costPerHour)}/h`)}
        ${readout('블록 예상 총액', formatCost(activeBurn.projectedCost))}
        ${readout('남은 시간', formatDuration(activeBurn.remainingMs))}
        ${readout('토큰', formatTokens(activeBlock.totalTokens))}
        ${readout('요청', activeBlock.requests.toLocaleString('en-US'))}
      </dl>
    </div>
    <div class="gauge-face">
      ${tickFace(report)}
      <div class="gauge-scale">
        <span>${clockAt(activeBlock.startTime)} 블록 시작</span>
        <span>지금 ${clockAt(report.generatedAt)}</span>
        <span>${clockAt(activeBlock.endTime)} 리셋</span>
      </div>
    </div>`

  bindTips($('gauge'))
}

function readout(label, value) {
  return `<div class="readout"><dt>${esc(label)}</dt><dd>${esc(value)}</dd></div>`
}

/**
 * 5분 눈금 60개로 만든 계기면.
 * 눈금 높이 = 그 5분 동안 쓴 비용, 흐린 눈금 = 아직 오지 않은 시간.
 */
function tickFace(report) {
  const ticks = report.activeBlockTicks
  const peak = Math.max(...ticks, 0.0001)
  const elapsed = report.activeBurn.elapsedRatio
  const width = 1000
  const height = 96
  const gap = 2
  const slot = width / ticks.length

  const bars = ticks.map((cost, index) => {
    const isPast = index / ticks.length < elapsed
    const barHeight = cost > 0 ? Math.max(3, (cost / peak) * (height - 10)) : 2
    const x = index * slot
    const fill = cost > 0 ? `var(${statusVar(report.burnStatus.level)})` : 'var(--line)'
    const opacity = cost > 0 ? 1 : isPast ? 0.9 : 0.35
    const from = clockAt(report.activeBlock.startTime + index * ((report.activeBlock.endTime - report.activeBlock.startTime) / ticks.length))

    return `<rect class="bar" x="${x.toFixed(2)}" y="${(height - barHeight).toFixed(2)}"
      width="${(slot - gap).toFixed(2)}" height="${barHeight.toFixed(2)}" rx="2"
      fill="${fill}" opacity="${opacity}"
      data-tip-title="${from} 부터 5분"
      data-tip-lines='${esc(JSON.stringify([formatCost(cost)]))}'></rect>`
  }).join('')

  const marker = elapsed * width

  return `<div class="chart-wrap"><svg class="chart" viewBox="0 0 ${width} ${height}" role="img"
      aria-label="진행 중 5시간 블록의 5분 단위 소진 계기">
      <line class="grid-line" x1="0" y1="${height}" x2="${width}" y2="${height}"></line>
      ${bars}
      <line x1="${marker.toFixed(2)}" y1="0" x2="${marker.toFixed(2)}" y2="${height}"
        stroke="var(--ink)" stroke-width="2"></line>
    </svg></div>`
}

function statusVar(level) {
  return level === 'crit' ? '--crit' : level === 'warn' ? '--warn' : '--ok'
}

/* ---------- 밴드 2: 통계 타일 ---------- */
function renderTiles(report) {
  const { dayOverDay, weekOverWeek } = report
  const savedShare = report.range.cost + report.range.cacheSavings

  $('tiles').innerHTML = [
    tile('선택 기간 비용', formatCost(report.range.cost), `${report.range.requests.toLocaleString('en-US')}건 요청`),
    tile('오늘 (24시간)', formatCost(dayOverDay.current.cost),
      deltaNote('어제', dayOverDay.costChangeRatio)),
    tile('최근 7일', formatCost(weekOverWeek.current.cost),
      deltaNote('직전 7일', weekOverWeek.costChangeRatio)),
    tile('캐시 적중률', formatPercent(report.rangeCacheHitRate),
      `캐시가 없었다면 ${formatCost(savedShare)}`),
    tile('캐시 절감액', formatCost(report.range.cacheSavings), '읽기를 정가 입력으로 환산한 차액'),
    tile('누적 전체', formatCost(report.allTime.cost), `${formatTokens(report.allTime.totalTokens)} 토큰`),
  ].join('')
}

function tile(label, value, note) {
  return `<div class="tile">
    <span class="tile-label">${esc(label)}</span>
    <span class="tile-value">${esc(value)}</span>
    <span class="tile-note">${note}</span>
  </div>`
}

/* ---------- 세로 막대 차트(일별·시간대 공용) ---------- */
function verticalBars({ rows, ariaLabel, labelEvery, emphasizeLast }) {
  if (rows.every((row) => row.value === 0)) {
    return `<p class="empty">이 기간에는 기록된 사용량이 없습니다.</p>`
  }

  const width = 1000
  const padTop = 16
  const plotHeight = 200
  const axisWidth = 58
  const labelHeight = 26
  const height = padTop + plotHeight + labelHeight
  const baseline = padTop + plotHeight
  const peak = niceCeil(Math.max(...rows.map((row) => row.value)))
  const slot = (width - axisWidth) / rows.length
  const gap = Math.min(4, slot * 0.22)

  const ticks = [0, 0.25, 0.5, 0.75, 1].map((ratio) => {
    const y = baseline - ratio * plotHeight
    return `<line class="grid-line" x1="${axisWidth}" y1="${y}" x2="${width}" y2="${y}"></line>
      <text class="axis-text" x="${axisWidth - 8}" y="${y + 3}" text-anchor="end">${esc(formatCostCompact(peak * ratio))}</text>`
  }).join('')

  // 마지막 눈금이 정규 눈금과 겹치면 그리지 않는다
  const lastIndex = rows.length - 1
  const previousLabelled = Math.floor(lastIndex / labelEvery) * labelEvery
  const showLast = emphasizeLast && lastIndex % labelEvery !== 0 && lastIndex - previousLabelled >= 2

  const bars = rows.map((row, index) => {
    const barHeight = row.value > 0 ? Math.max(2, (row.value / peak) * plotHeight) : 0
    const x = axisWidth + index * slot
    const isLast = emphasizeLast && index === lastIndex
    const wantsLabel = index % labelEvery === 0 || (isLast && showLast)

    const label = wantsLabel
      ? `<text class="axis-text" x="${(x + (slot - gap) / 2).toFixed(2)}" y="${baseline + 16}" text-anchor="middle">${esc(row.label)}</text>`
      : ''

    const bar = barHeight === 0 ? '' : `<rect class="bar" x="${x.toFixed(2)}" y="${(baseline - barHeight).toFixed(2)}"
      width="${(slot - gap).toFixed(2)}" height="${barHeight.toFixed(2)}" rx="2"
      fill="var(--accent)" opacity="${isLast ? 1 : 0.82}"
      data-tip-title="${esc(row.tipTitle)}" data-tip-lines='${esc(JSON.stringify(row.tipLines))}'></rect>`

    return bar + label
  }).join('')

  return `<div class="chart-wrap"><svg class="chart" viewBox="0 0 ${width} ${height}"
    role="img" aria-label="${esc(ariaLabel)}">${ticks}${bars}</svg></div>`
}

/* ---------- 밴드 2: 일별 추세 ---------- */
function renderDaily(report) {
  const rows = report.daily.map((day) => ({
    value: day.cost,
    label: shortDate(day.date),
    tipTitle: day.date,
    tipLines: [formatCost(day.cost), `${formatTokens(day.totalTokens)} 토큰`, `${day.requests}건`],
  }))

  $('daily-chart').innerHTML = verticalBars({
    rows,
    ariaLabel: `최근 ${report.rangeDays}일 일별 비용`,
    labelEvery: Math.max(1, Math.ceil(rows.length / 15)),
    emphasizeLast: true,
  })
  bindTips($('daily-chart'))

  $('daily-table').innerHTML = dataTable(
    ['날짜', '비용', '토큰', '요청'],
    report.daily.filter((day) => day.requests > 0).reverse().map((day) => [
      day.date, formatCost(day.cost), formatTokens(day.totalTokens), String(day.requests),
    ]),
  )
}

/* ---------- 밴드 5: 시간대 패턴 ---------- */
function renderHours(report) {
  const rows = report.hours.map((slot) => ({
    value: slot.cost,
    label: String(slot.hour).padStart(2, '0'),
    tipTitle: `${String(slot.hour).padStart(2, '0')}시대`,
    tipLines: [formatCost(slot.cost), `${formatTokens(slot.totalTokens)} 토큰`, `${slot.requests}건`],
  }))

  $('hours-chart').innerHTML = verticalBars({
    rows, ariaLabel: '시간대별 비용 분포', labelEvery: 2, emphasizeLast: false,
  })
  bindTips($('hours-chart'))

  const busiest = [...report.hours].sort((a, b) => b.cost - a.cost)[0]
  $('hours-note').textContent = busiest && busiest.cost > 0
    ? `가장 무거운 시간대는 ${String(busiest.hour).padStart(2, '0')}시대 (${formatCost(busiest.cost)})`
    : '기록된 사용량이 없습니다'
}

function dataTable(headers, rows) {
  if (rows.length === 0) return '<p class="empty">표시할 데이터가 없습니다.</p>'

  return `<div class="table-scroll"><table>
    <thead><tr>${headers.map((h) => `<th>${esc(h)}</th>`).join('')}</tr></thead>
    <tbody>${rows.map((cells) => `<tr>${cells.map((c) => `<td>${esc(c)}</td>`).join('')}</tr>`).join('')}</tbody>
  </table></div>`
}

/* ---------- 밴드 3: 비용을 먹는 주체 ---------- */
function rankTable({ rows, nameOf, subOf, swatchOf, total }) {
  if (rows.length === 0) return '<p class="empty">표시할 데이터가 없습니다.</p>'

  const peak = Math.max(...rows.map((row) => row.cost), 0.0001)

  const body = rows.map((row) => {
    const share = total > 0 ? row.cost / total : 0
    const swatch = swatchOf
      ? `<span class="swatch" style="background:var(${swatchOf(row)})"></span>`
      : ''
    const sub = subOf(row)

    return `<tr>
      <td>
        <div class="rank-name">
          <span class="rank-label">${swatch}<span class="rank-text">${esc(nameOf(row))}</span>${sub ? `<span class="tag">${esc(sub)}</span>` : ''}</span>
          <span class="rank-bar"><span class="rank-fill" style="width:${((row.cost / peak) * 100).toFixed(1)}%"></span></span>
        </div>
      </td>
      <td>${esc(formatCost(row.cost))}</td>
      <td>${esc(formatPercent(share))}</td>
      <td>${esc(formatTokens(row.totalTokens))}</td>
      <td>${row.requests.toLocaleString('en-US')}</td>
    </tr>`
  }).join('')

  return `<div class="scroll-x"><table>
    <thead><tr><th>이름</th><th>비용</th><th>비중</th><th>토큰</th><th>요청</th></tr></thead>
    <tbody>${body}</tbody>
  </table></div>`
}

function renderBreakdowns(report) {
  const total = report.range.cost

  $('models').innerHTML = rankTable({
    rows: report.byModel,
    total,
    nameOf: (row) => row.key,
    subOf: (row) => (row.isEstimated ? '단가 추정' : ''),
  })

  $('projects').innerHTML = rankTable({
    rows: report.byProject,
    total,
    nameOf: (row) => row.label || row.key,
    subOf: (row) => row.parent,
  })

  $('sources').innerHTML = rankTable({
    rows: report.bySource,
    total,
    nameOf: (row) => SOURCE_LABELS[row.key] || row.key,
    subOf: (row) => '',
    swatchOf: (row) => SOURCE_VARS[row.key] || '--ink-faint',
  })

  $('sources-legend').innerHTML = report.bySource.map((row) => `
    <span class="legend-item">
      <span class="swatch" style="background:var(${SOURCE_VARS[row.key] || '--ink-faint'})"></span>
      ${esc(SOURCE_LABELS[row.key] || row.key)} <b>${esc(formatCost(row.cost))}</b>
    </span>`).join('')

  const top = report.byProject[0]
  $('breakdown-note').textContent = top
    ? `${top.label || top.key} 하나가 기간 비용의 ${formatPercent(top.cost / (total || 1))}를 차지합니다`
    : '기록된 사용량이 없습니다'
}

/* ---------- 밴드 4: 토큰 흐름 ---------- */

/**
 * 구성 띠 하나. 실제 비율대로 그리되, 0 이 아닌 조각은
 * 최소 폭을 남겨 사라지지 않게 한다.
 */
function compositionBar(totals, field, valueFormat) {
  const sum = TOKEN_BUCKETS.reduce((acc, bucket) => acc + totals[bucket[field]], 0)
  if (sum === 0) return { svg: '<p class="empty">데이터가 없습니다.</p>', sum }

  const width = 1000
  const height = 40
  const gap = 2
  let cursor = 0

  const segments = TOKEN_BUCKETS.map((bucket) => {
    const value = totals[bucket[field]]
    if (value <= 0) return ''

    const segWidth = Math.max(MIN_SEGMENT_WIDTH, (value / sum) * width)
    const x = cursor
    cursor += segWidth

    return `<rect class="bar" x="${x.toFixed(2)}" y="0" width="${Math.max(MIN_SEGMENT_WIDTH, segWidth - gap).toFixed(2)}"
      height="${height}" rx="2" fill="var(${bucket.varName})"
      data-tip-title="${esc(bucket.label)}"
      data-tip-lines='${esc(JSON.stringify([valueFormat(value), formatPercent(value / sum), bucket.note]))}'></rect>`
  }).join('')

  return {
    svg: `<div class="chart-wrap"><svg class="chart" viewBox="0 0 ${width} ${height}" role="img"
      aria-label="토큰 종류별 구성">${segments}</svg></div>`,
    sum,
  }
}

function compositionLegend(totals, field, valueFormat, sum) {
  return TOKEN_BUCKETS.map((bucket) => `
    <span class="legend-item">
      <span class="swatch" style="background:var(${bucket.varName})"></span>
      ${esc(bucket.label)} <b>${esc(valueFormat(totals[bucket[field]]))}</b>
      <span class="rank-sub">${esc(formatPercent(totals[bucket[field]] / sum))}</span>
    </span>`).join('')
}

function renderTokenFlow(report) {
  const totals = report.range

  const volume = compositionBar(totals, 'field', formatTokens)
  const spend = compositionBar(totals, 'costField', formatCost)

  if (volume.sum === 0) {
    $('flow-volume').innerHTML = '<p class="empty">이 기간에는 토큰 사용이 없습니다.</p>'
    $('flow-spend').innerHTML = ''
    $('flow-volume-legend').innerHTML = ''
    $('flow-spend-legend').innerHTML = ''
    $('flow-note').textContent = ''
    return
  }

  $('flow-volume').innerHTML = volume.svg
  $('flow-spend').innerHTML = spend.svg
  $('flow-volume-legend').innerHTML = compositionLegend(totals, 'field', formatTokens, volume.sum)
  $('flow-spend-legend').innerHTML = compositionLegend(totals, 'costField', formatCost, spend.sum)
  bindTips($('flow-volume'))
  bindTips($('flow-spend'))

  const topCost = [...TOKEN_BUCKETS].sort((a, b) => totals[b.costField] - totals[a.costField])[0]
  $('flow-note').textContent =
    `토큰의 ${formatPercent(totals.cacheReadTokens / volume.sum)}는 캐시 읽기지만, ` +
    `비용은 ${topCost.label}가 ${formatPercent(totals[topCost.costField] / spend.sum)}로 가장 큽니다.`

  $('flow-table').innerHTML = dataTable(
    ['종류', '토큰', '토큰 비중', '비용', '비용 비중', '단가 배수'],
    TOKEN_BUCKETS.map((bucket) => [
      bucket.label,
      formatTokens(totals[bucket.field]),
      formatPercent(totals[bucket.field] / volume.sum),
      formatCost(totals[bucket.costField]),
      formatPercent(totals[bucket.costField] / spend.sum),
      bucket.note,
    ]),
  )
}

/* ---------- 밴드 6: 세션 ---------- */
function renderSessions(report) {
  if (report.topSessions.length === 0) {
    $('sessions').innerHTML = '<p class="empty">표시할 세션이 없습니다.</p>'
    return
  }

  $('sessions').innerHTML = `<div class="scroll-x"><table>
    <thead><tr><th>세션</th><th>프로젝트</th><th>마지막 활동</th><th>비용</th><th>토큰</th><th>요청</th></tr></thead>
    <tbody>${report.topSessions.map((session) => `<tr>
      <td><span class="rank-sub">${esc(session.key.slice(0, 8))}</span></td>
      <td>${esc(session.projectLabel || '-')}</td>
      <td>${esc(`${dateAt(session.lastSeen)} ${clockAt(session.lastSeen)}`)}</td>
      <td>${esc(formatCost(session.cost))}</td>
      <td>${esc(formatTokens(session.totalTokens))}</td>
      <td>${session.requests.toLocaleString('en-US')}</td>
    </tr>`).join('')}</tbody>
  </table></div>`
}

/* ---------- 푸터 ---------- */
function renderColophon(report) {
  const estimated = report.byModel.filter((row) => row.isEstimated).map((row) => row.key)

  $('colophon-stats').innerHTML = `
    <li>집계 대상: <code>~/.claude/projects</code> 아래 트랜스크립트 ${state.config.fileCount ?? '-'}개,
      중복 제거 후 ${report.allTime.requests.toLocaleString('en-US')}건의 어시스턴트 응답</li>
    <li>금액은 <strong>공개 API 단가로 환산한 참고값</strong>입니다. 구독 요금제라면 실제 청구액이 아니라
      "같은 작업을 API로 했다면" 값으로 읽으세요.</li>
    <li>5시간 블록은 첫 활동을 정시에 앵커해 계산하며, 5시간 이상 공백이 생기면 새 블록으로 셉니다.</li>
    ${estimated.length ? `<li>단가가 공개되지 않은 모델(${esc(estimated.join(', '))})은 Sonnet 단가로 추정했습니다.</li>` : ''}`
}

/* ---------- 기간 필터 ---------- */
function renderFilters() {
  $('filters').innerHTML = Object.keys(state.reports).map((key) => `
    <button class="chip" type="button" data-range="${esc(key)}"
      aria-pressed="${key === state.range}">${esc(RANGE_LABELS[key] || key)}</button>`).join('')

  $('filters').querySelectorAll('[data-range]').forEach((button) => {
    button.addEventListener('click', () => {
      state.range = button.dataset.range
      renderAll()
    })
  })
}

/* ---------- 렌더 전체 ---------- */
function renderAll() {
  const report = currentReport()
  if (!report) return

  renderFilters()
  renderMasthead(report)
  renderGauge(report)
  renderTiles(report)
  renderDaily(report)
  renderBreakdowns(report)
  renderTokenFlow(report)
  renderHours(report)
  renderSessions(report)
  renderColophon(report)
}

/* ---------- 실시간 갱신 ---------- */
async function refresh() {
  try {
    const response = await fetch('./api/report', { cache: 'no-store' })
    if (!response.ok) throw new Error(`HTTP ${response.status}`)

    const payload = await response.json()
    state.reports = payload.reports
    state.config = { ...state.config, ...payload.config }
    state.connection = 'live'
  } catch {
    state.connection = 'error'
  }
  renderAll()
}

function boot() {
  tooltip.node = $('tooltip')
  state.connection = state.config.live ? 'live' : 'static'
  renderAll()

  if (state.config.live) {
    setInterval(refresh, state.config.refreshSeconds * 1000)
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) refresh()
    })
  }

  // 테마가 바뀌면 CSS 변수로 그린 차트를 다시 그린다
  const media = window.matchMedia('(prefers-color-scheme: dark)')
  media.addEventListener('change', renderAll)

  $('theme-toggle').addEventListener('click', () => {
    const root = document.documentElement
    const isDark = root.dataset.theme
      ? root.dataset.theme === 'dark'
      : media.matches
    root.dataset.theme = isDark ? 'light' : 'dark'
    renderAll()
  })

  window.addEventListener('scroll', hideTip, { passive: true })
}

document.addEventListener('DOMContentLoaded', boot)
