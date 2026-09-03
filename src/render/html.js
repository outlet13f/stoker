import { STYLES } from './styles.js'
import { buildFontFaceCss } from './fonts.js'
import { buildClientScript } from './bundle.js'
import { ringPath, ringStroke, MARK_HEX } from './mark.js'

const PAGE_TITLE = 'Stoker'

/** JSON 을 </script> 로 끊기지 않게 안전하게 심는다 */
function embedJson(value) {
  return JSON.stringify(value).replace(/</g, '\\u003c')
}

/**
 * 브랜드 마크 — 아래가 트인 링 게이지. 도형은 mark.js 하나에서 나온다.
 *
 * **바탕판을 깔지 않는다.** 둥근 사각형 위에 흰 호를 얹으면 26px 에서
 * 사람 실루엣으로 읽혔다 — 호 안쪽의 어두운 면이 머리가 되고 틈 아래가
 * 몸이 됐다. 도형과 바탕이 같은 색인 탓이라 바탕판을 빼면 사라진다.
 * 메뉴바 아이콘이 이미 바탕 없는 단색 실루엣이고, 그쪽은 16px 에서도 읽힌다.
 * 앱 아이콘만 바탕판을 쓴다 — 1024px 에서는 그 착시가 생기지 않는다.
 */
const MARK_BOX = 32
const RING_PATH = ringPath(MARK_BOX)
const RING_STROKE = ringStroke(MARK_BOX)

function brandMark() {
  return `<svg class="brand-mark" viewBox="0 0 ${MARK_BOX} ${MARK_BOX}" role="img" aria-label="Stoker">
      <path d="${RING_PATH}" fill="none" stroke="var(--accent)" stroke-width="${RING_STROKE}"/>
    </svg>`
}

/** 라벨 없는 section 은 a11y 트리에서 region 으로 노출되지 않는다 */
function band({ question, heading, note, body }) {
  const headingId = `band-${heading.replace(/[^가-힣A-Za-z0-9]+/g, '-')}`

  return `
  <section class="band" aria-labelledby="${headingId}">
    <div class="band-head">
      <div>
        <p class="eyebrow">${question}</p>
        <h2 id="${headingId}">${heading}</h2>
      </div>
      ${note ? `<p class="panel-note" id="${note}"></p>` : ''}
    </div>
    ${body}
  </section>`
}

/** 페이지 머리의 작은 지표 카드 하나 */
function metaCard(label, valueId) {
  return `<div><dt>${label}</dt><dd id="${valueId}">-</dd></div>`
}

function bodyMarkup() {
  return `
<header class="topbar">
  <div class="topbar-inner">
    <span class="brand">
      ${brandMark()}
      <span class="brand-name">${PAGE_TITLE}</span>
    </span>
    <span class="live" id="live" data-state="static">
      <span class="live-dot"></span><span id="live-text">스냅샷</span>
    </span>
    <span class="topbar-spacer"></span>
    <div class="masthead-controls">
      <label class="sr-only" for="refresh-input">자동 갱신 주기(초). 0 은 멈춤</label>
      <span class="refresh-control">
        <span class="refresh-prefix" aria-hidden="true">갱신</span>
        <input class="refresh-input" id="refresh-input" type="number"
          inputmode="numeric" list="refresh-presets" step="1">
        <span class="refresh-suffix" aria-hidden="true">초</span>
      </span>
      <datalist id="refresh-presets"></datalist>
      <span class="refresh-message" id="refresh-message" role="status"></span>
      <button class="toggle" id="refresh-now" type="button">지금 갱신</button>
      <button class="toggle" id="theme-toggle" type="button">테마 전환</button>
    </div>
  </div>
</header>

<div class="shell">
  <main id="main">

  <div class="page-intro">
  <div class="page-head">
    <div>
      <p class="eyebrow">Claude Code · 로컬 트랜스크립트</p>
      <h1>사용량 대시보드</h1>
      <p class="lede">
        <code>~/.claude/projects</code> 의 세션 기록을 직접 읽어 토큰과 환산 비용을 집계합니다.
        집계는 전부 로컬에서 하고, 계정 한도만 Anthropic 에 직접 조회합니다
        (<code>--no-live-limits</code> 로 끄면 나가는 요청이 아예 없습니다).
      </p>
    </div>
    <dl class="masthead-meta">
      ${metaCard('갱신', 'generated')}
      ${metaCard('응답', 'req-count')}
      ${metaCard('기간', 'span-text')}
    </dl>
  </div>

  <div class="toolbar">
    <span class="filter-label">집계 기간</span>
    <div class="filters" id="filters"></div>
    <span class="date-range" id="date-range">
      <label class="sr-only" for="date-from">시작일</label>
      <input class="date-input" type="date" id="date-from">
      <span class="date-sep" aria-hidden="true">–</span>
      <label class="sr-only" for="date-to">종료일</label>
      <input class="date-input" type="date" id="date-to">
      <button class="chip" id="date-apply" type="button">적용</button>
      <button class="chip" id="date-clear" type="button" hidden>해제</button>
    </span>
    <span class="date-message" id="date-message" role="alert"></span>
  </div>
  </div>

  ${band({
    question: '한도까지 얼마 남았나',
    heading: '사용 한도',
    note: 'limits-note',
    body: '<div class="panel" id="limits"></div>',
  })}

  ${band({
    question: '지금 안전한가',
    heading: '진행 중인 5시간 블록',
    body: '<div class="gauge" id="gauge"></div>',
  })}

  ${band({
    question: '추세는 어떤가',
    heading: '일별 소비와 변화',
    body: `
    <div class="tiles" id="tiles"></div>
    <div class="panel">
      <div class="panel-head"><h3>일별 환산 비용</h3></div>
      <div id="daily-chart"></div>
      <details><summary>데이터 표로 보기</summary><div id="daily-table"></div></details>
    </div>`,
  })}

  ${band({
    question: '코드는 얼마나 바뀌었나',
    heading: '코드 변경량',
    note: 'code-note',
    body: `
    <div class="tiles" id="code-tiles"></div>
    <div class="panel">
      <div class="panel-head">
        <h3>일별 추가 · 삭제 줄</h3>
        <div class="legend" id="code-legend"></div>
      </div>
      <div id="code-chart"></div>
      <details><summary>데이터 표로 보기</summary><div id="code-table"></div></details>
    </div>
    <div class="panel">
      <div class="panel-head"><h3>프로젝트별 변경 줄</h3></div>
      <div id="code-projects"></div>
    </div>`,
  })}

  ${band({
    question: '무엇이 비용을 먹는가',
    heading: '모델 · 프로젝트 · 실행 주체',
    note: 'breakdown-note',
    body: `
    <div class="split">
      <div class="panel">
        <div class="panel-head"><h3>모델별</h3></div>
        <div id="models"></div>
      </div>
      <div class="panel">
        <div class="panel-head"><h3>프로젝트별</h3></div>
        <div id="projects"></div>
      </div>
    </div>
    <div class="panel">
      <div class="panel-head">
        <h3>실행 주체별</h3>
        <div class="legend" id="sources-legend"></div>
      </div>
      <div id="sources"></div>
    </div>`,
  })}

  ${band({
    question: '토큰은 어디로 가는가',
    heading: '토큰 구성과 캐시 효율',
    note: 'flow-note',
    body: `
    <div class="panel">
      <div class="panel-head"><h3>토큰 수 기준</h3><span class="panel-note">단가가 낮은 종류부터 쌓았습니다</span></div>
      <div id="flow-volume"></div>
      <div class="legend" id="flow-volume-legend"></div>
    </div>
    <div class="panel">
      <div class="panel-head"><h3>비용 기준</h3><span class="panel-note">같은 구성을 금액으로 다시 나눈 것</span></div>
      <div id="flow-spend"></div>
      <div class="legend" id="flow-spend-legend"></div>
      <details><summary>데이터 표로 보기</summary><div id="flow-table"></div></details>
    </div>`,
  })}

  ${band({
    question: '언제 쓰는가',
    heading: '시간대별 분포',
    note: 'hours-note',
    body: '<div class="panel"><div id="hours-chart"></div></div>',
  })}

  ${band({
    question: '어느 세션이 무거웠는가',
    heading: '기간 내 상위 세션',
    body: '<div class="panel"><div id="sessions"></div></div>',
  })}

  </main>

  <footer class="colophon">
    <strong>읽는 법</strong>
    <ul id="colophon-stats"></ul>
    <div class="rate-card">
      <div class="panel-head">
        <h3>모델 단가</h3>
        <span class="panel-note">100만 토큰당 USD · 이 기록에 나온 모델</span>
      </div>
      <div id="rate-card"></div>
    </div>
  </footer>
</div>
<div class="tooltip" id="tooltip" role="status" aria-live="polite"></div>`
}

/**
 * 브라우저 탭 아이콘. 브랜드 마크와 같은 호를 그대로 쓴다.
 * 색은 트레이 아이콘과 같은 중간 인디고 — 밝은 탭 띠와 어두운 탭 띠 양쪽에서
 * 3:1 을 넘는 유일한 값이다(build/make-icons.mjs 의 TASKBAR_ACCENT 참고).
 */
const FAVICON =
  `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 ${MARK_BOX} ${MARK_BOX}'%3E` +
  `%3Cpath d='${RING_PATH}' fill='none' stroke='${encodeURIComponent(MARK_HEX)}' stroke-width='${RING_STROKE}'/%3E%3C/svg%3E`

/**
 * mode 'standalone' : 로컬 파일/서버용 완전한 HTML 문서
 * mode 'artifact'   : Artifact 퍼블리시용(문서 골격은 퍼블리셔가 감싼다)
 */
export async function renderPage({ reports, config, mode = 'standalone' }) {
  const script = await buildClientScript()

  const fontCss = await buildFontFaceCss()

  const head = `<title>${PAGE_TITLE}</title>
<style>${fontCss}\n${STYLES}</style>`

  const tail = `<script>
window.__REPORTS__ = ${embedJson(reports)};
window.__CONFIG__ = ${embedJson(config)};
</script>
<script>${script}</script>`

  const content = `${head}\n${bodyMarkup()}\n${tail}`

  if (mode === 'artifact') return content

  return `<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<link rel="icon" href="${FAVICON}">
${head}
</head>
<body>
${bodyMarkup()}
${tail}
</body>
</html>`
}
