import { STYLES } from './styles.js'
import { FONT_HREF } from './theme.js'
import { buildClientScript } from './bundle.js'

const PAGE_TITLE = '사용량 콘솔'

/** JSON 을 </script> 로 끊기지 않게 안전하게 심는다 */
function embedJson(value) {
  return JSON.stringify(value).replace(/</g, '\\u003c')
}

function band({ question, heading, note, body }) {
  return `
  <section class="band">
    <div class="band-head">
      <div>
        <p class="eyebrow">${question}</p>
        <h2>${heading}</h2>
      </div>
      ${note ? `<p class="panel-note" id="${note}"></p>` : ''}
    </div>
    ${body}
  </section>`
}

function bodyMarkup() {
  return `
<div class="shell">
  <header class="masthead">
    <div>
      <p class="eyebrow">Claude Code · 로컬 트랜스크립트</p>
      <h1>${PAGE_TITLE}</h1>
      <p class="lede">
        <code>~/.claude/projects</code> 의 세션 기록을 직접 읽어 토큰과 환산 비용을 집계합니다.
        네트워크로 나가는 데이터는 없습니다.
      </p>
    </div>
    <div style="display:flex;flex-direction:column;gap:10px;align-items:flex-end">
      <span class="live" id="live" data-state="static">
        <span class="live-dot"></span><span id="live-text">스냅샷</span>
      </span>
      <div class="masthead-meta">
        <span>갱신 <b id="generated">-</b></span>
        <span>응답 <b id="req-count">-</b></span>
        <span>기간 <b id="span-text">-</b></span>
      </div>
      <button class="toggle" id="theme-toggle" type="button">테마 전환</button>
    </div>
  </header>

  <div class="filters">
    <span class="filter-label">집계 기간</span>
    <span class="filters" id="filters"></span>
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

  <footer class="colophon">
    <strong>읽는 법</strong>
    <ul id="colophon-stats"></ul>
  </footer>
</div>
<div class="tooltip" id="tooltip" role="status" aria-live="polite"></div>`
}

/**
 * mode 'standalone' : 로컬 파일/서버용 완전한 HTML 문서
 * mode 'artifact'   : Artifact 퍼블리시용(문서 골격은 퍼블리셔가 감싼다)
 */
export async function renderPage({ reports, config, mode = 'standalone' }) {
  const script = await buildClientScript()

  const head = `<title>${PAGE_TITLE}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="${FONT_HREF}">
<style>${STYLES}</style>`

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
<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'%3E%3Crect width='16' height='16' fill='%23D9662F' rx='2'/%3E%3C/svg%3E">
${head}
</head>
<body>
${bodyMarkup()}
${tail}
</body>
</html>`
}
