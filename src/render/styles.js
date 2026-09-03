import {
  LIGHT_TOKENS, DARK_TOKENS, LIGHT_EFFECTS, DARK_EFFECTS, tokensToCss,
} from './theme.js'

const LIGHT_BLOCK = `${tokensToCss(LIGHT_TOKENS)}\n${tokensToCss(LIGHT_EFFECTS)}`
const DARK_BLOCK = `${tokensToCss(DARK_TOKENS)}\n${tokensToCss(DARK_EFFECTS)}`

export const STYLES = `
:root {
${LIGHT_BLOCK}
  /* 라틴은 번들된 웹폰트, 한글은 시스템 서체로 떨어진다(웹폰트로 받으면 수 MB) */
  --korean: 'Apple SD Gothic Neo', 'Malgun Gothic', 'Noto Sans KR', sans-serif;
  --display: 'Inter', var(--korean), system-ui;
  --body: 'Inter', -apple-system, BlinkMacSystemFont, var(--korean), system-ui;
  --mono: 'JetBrains Mono', ui-monospace, SFMono-Regular, monospace;

  /* 모서리 반경 하나만 바꿔도 전체 인상이 흔들린다. 계단을 명시해 둔다. */
  --r-card: 16px;
  --r-panel: 14px;
  --r-control: 10px;
  --r-mark: 5px;
  --r-pill: 999px;

  --gutter: clamp(16px, 4vw, 40px);
  --band-gap: clamp(30px, 4.4vw, 48px);
  --intro-gap: clamp(16px, 2.2vw, 24px);
  --topbar-h: 56px;
  color-scheme: light dark;
}

@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) {
${DARK_BLOCK}
  }
}

:root[data-theme="dark"] {
${DARK_BLOCK}
}

* { box-sizing: border-box; }

body {
  margin: 0;
  background: var(--bg);
  color: var(--ink);
  font-family: var(--body);
  font-size: 15px;
  line-height: 1.55;
  -webkit-font-smoothing: antialiased;
  /* Inter 의 표 숫자와 진짜 1(cv05). 대시보드는 세로로 줄맞춤이 생명이다. */
  font-feature-settings: 'tnum' 1, 'cv05' 1;
}

/* 스크롤이 상단 바 뒤로 들어가는 만큼 앵커 위치를 밀어 준다 */
html { scroll-padding-top: calc(var(--topbar-h) + 16px); }

.shell {
  max-width: 1240px;
  margin: 0 auto;
  padding: clamp(24px, 4vw, 44px) var(--gutter) 96px;
  display: flex;
  flex-direction: column;
  gap: var(--band-gap);
}

/* ---------- 타이포 ---------- */
.eyebrow {
  font-family: var(--display);
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--accent);
  margin: 0;
}

h1 {
  font-family: var(--display);
  font-size: clamp(28px, 4vw, 38px);
  font-weight: 700;
  letter-spacing: -0.028em;
  line-height: 1.12;
  margin: 8px 0 0;
  text-wrap: balance;
}

h2 {
  font-family: var(--display);
  font-size: clamp(18px, 2.2vw, 22px);
  font-weight: 650;
  letter-spacing: -0.018em;
  margin: 5px 0 0;
  text-wrap: balance;
}

h3 {
  font-family: var(--display);
  font-size: 14px;
  font-weight: 600;
  letter-spacing: -0.008em;
  margin: 0;
}

.lede { color: var(--ink-muted); margin: 10px 0 0; max-width: 64ch; font-size: 14px; }
code {
  font-family: var(--mono);
  font-size: 0.88em;
  background: var(--surface-sunk);
  border: 1px solid var(--line);
  padding: 1px 5px;
  border-radius: var(--r-mark);
}

/* ---------- 상단 바 ---------- */
.topbar {
  position: sticky;
  top: 0;
  z-index: 30;
  background: var(--glass);
  border-bottom: 1px solid var(--line);
  backdrop-filter: saturate(180%) blur(14px);
  -webkit-backdrop-filter: saturate(180%) blur(14px);
}

.topbar-inner {
  max-width: 1240px;
  margin: 0 auto;
  min-height: var(--topbar-h);
  padding: 9px var(--gutter);
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px 14px;
}

.brand { display: inline-flex; align-items: center; gap: 9px; }
.brand-mark { display: block; width: 27px; height: 27px; }
.brand-name {
  font-family: var(--display);
  font-size: 15px;
  font-weight: 680;
  letter-spacing: -0.02em;
}

.topbar-spacer { flex: 1 1 auto; }

.live {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  padding: 4px 11px 4px 9px;
  border-radius: var(--r-pill);
  background: var(--surface-sunk);
  border: 1px solid var(--line);
  font-family: var(--display);
  font-size: 11.5px;
  font-weight: 550;
  color: var(--ink-muted);
}
.live-dot {
  width: 7px; height: 7px; border-radius: 50%;
  background: var(--ok);
  box-shadow: 0 0 0 3px var(--ok-wash);
}
.live[data-state="stale"] .live-dot { background: var(--warn); box-shadow: 0 0 0 3px var(--warn-wash); }
.live[data-state="error"] .live-dot { background: var(--crit); box-shadow: 0 0 0 3px var(--crit-wash); }
.live[data-state="static"] .live-dot { background: var(--ink-faint); box-shadow: 0 0 0 3px var(--surface-sunk); }

@media (prefers-reduced-motion: no-preference) {
  .live[data-state="live"] .live-dot { animation: pulse 2.4s ease-in-out infinite; }
  @keyframes pulse { 50% { opacity: 0.3; } }
}

/* ---------- 페이지 머리 ---------- */
.page-head {
  display: flex;
  flex-wrap: wrap;
  gap: 24px 40px;
  justify-content: space-between;
  align-items: flex-end;
}

.masthead-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin: 0;
}
.masthead-meta > div {
  display: flex;
  flex-direction: column;
  gap: 1px;
  padding: 8px 14px;
  border-radius: var(--r-control);
  background: var(--surface);
  border: 1px solid var(--line);
  box-shadow: var(--shadow-sm);
}
.masthead-meta dt { font-size: 10.5px; font-weight: 550; color: var(--ink-faint); }
.masthead-meta dd {
  margin: 0;
  font-family: var(--mono);
  font-variant-numeric: tabular-nums;
  font-size: 13px;
  font-weight: 500;
  color: var(--ink);
  white-space: nowrap;
}

/* ---------- 도구 막대 ---------- */
/* 제목 묶음과 도구 막대는 한 덩어리다. 예전에는 부모 gap 을 음수 마진으로
   0.45 만큼 되돌렸는데, band-gap 의 clamp 를 건드릴 때마다 그 계수를 손으로
   다시 구해야 했다. 둘을 감싸고 간격을 직접 준다. */
.page-intro { display: flex; flex-direction: column; gap: var(--intro-gap); }
.toolbar {
  display: flex;
  flex-wrap: wrap;
  gap: 10px 14px;
  align-items: center;
}

/* ---------- 밴드 ---------- */
/* 밴드는 main 안에 있다. shell 의 gap 은 main 바깥에만 걸리므로 여기서 따로 준다. */
#main { display: flex; flex-direction: column; gap: var(--band-gap); }
.band { display: flex; flex-direction: column; gap: 18px; }
.band-head { display: flex; flex-wrap: wrap; gap: 10px 24px; justify-content: space-between; align-items: baseline; }

/* ---------- 카드 ---------- */
.panel, .gauge, .tile {
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: var(--r-panel);
  box-shadow: var(--shadow-sm);
}

.panel { padding: clamp(16px, 2.4vw, 22px); display: flex; flex-direction: column; gap: 14px; }
.panel-head { display: flex; flex-wrap: wrap; gap: 8px 18px; align-items: baseline; justify-content: space-between; }
.panel-note { font-size: 12.5px; color: var(--ink-muted); margin: 0; }

/* ---------- 소진 계기 ---------- */
.gauge {
  border-radius: var(--r-card);
  padding: clamp(20px, 3vw, 30px);
  display: flex;
  flex-direction: column;
  gap: 24px;
  box-shadow: var(--shadow-md);
  /* 이 밴드가 화면에서 가장 중요하다. 액센트를 아주 옅게 깔아 눈이 먼저 가게 한다. */
  background:
    radial-gradient(120% 100% at 0% 0%, var(--accent-wash) 0%, transparent 58%),
    var(--surface);
}

.gauge-top { display: flex; flex-wrap: wrap; gap: 24px 40px; align-items: flex-end; justify-content: space-between; }

.hero { display: flex; flex-direction: column; gap: 10px; align-items: flex-start; }
.hero-value {
  font-family: var(--display);
  font-variant-numeric: tabular-nums;
  font-size: clamp(40px, 6vw, 60px);
  font-weight: 700;
  line-height: 1;
  letter-spacing: -0.04em;
}
.hero-note { font-size: 13px; color: var(--ink-muted); }

.pill {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 11px 4px 9px;
  border-radius: var(--r-pill);
  font-family: var(--display);
  font-size: 11.5px;
  font-weight: 600;
  letter-spacing: 0.01em;
}
.pill-glyph { font-size: 9px; line-height: 1; }
.pill[data-level="ok"]   { background: var(--ok-wash);   color: var(--ok); }
.pill[data-level="warn"] { background: var(--warn-wash); color: var(--warn); }
.pill[data-level="crit"] { background: var(--crit-wash); color: var(--crit); }
.pill[data-level="idle"] { background: var(--surface-sunk); color: var(--ink-muted); }

.readouts { display: flex; flex-wrap: wrap; gap: 14px 34px; margin: 0; }
.readout { display: flex; flex-direction: column; gap: 3px; min-width: 92px; }
.readout dt { font-size: 11px; font-weight: 550; color: var(--ink-faint); }
.readout dd {
  margin: 0;
  font-family: var(--mono);
  font-variant-numeric: tabular-nums;
  font-size: 17px;
  font-weight: 500;
  letter-spacing: -0.02em;
}

.gauge-face { display: flex; flex-direction: column; gap: 10px; }
.gauge-scale {
  display: flex; justify-content: space-between;
  font-family: var(--mono); font-size: 11px; color: var(--ink-faint);
}

/* ---------- 통계 타일 ---------- */
.tiles { display: grid; grid-template-columns: repeat(auto-fit, minmax(176px, 1fr)); gap: 12px; }
.tile { padding: 15px 17px 16px; display: flex; flex-direction: column; gap: 5px; }
.tile-label { font-size: 11.5px; font-weight: 550; color: var(--ink-faint); }
.tile-value {
  font-family: var(--display);
  font-variant-numeric: tabular-nums;
  font-size: 25px;
  font-weight: 680;
  line-height: 1.15;
  letter-spacing: -0.032em;
}
.tile-note { font-size: 12px; color: var(--ink-muted); }
.up { color: var(--crit); font-weight: 550; }
.down { color: var(--ok); font-weight: 550; }

/* ---------- 차트 ---------- */
.chart-wrap { overflow-x: auto; }
.chart { display: block; width: 100%; height: auto; }
.grid-line { stroke: var(--grid); stroke-width: 1; }
.axis-text { font-family: var(--mono); font-size: 10px; fill: var(--ink-faint); }
.bar { transition: opacity 0.14s ease; }
.chart:hover .bar:not(:hover) { opacity: 0.5; }
/* 막대는 opacity 를 인라인 속성으로 달고 나온다(0.82/0.88). 가리킨 것을
   1 로 올리지 않으면 이웃만 흐려질 뿐 정작 그 막대는 강조되지 않는다. */
.bar:hover { opacity: 1; }

.split { display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 14px; }

/* ---------- 순위 표 ---------- */
table { width: 100%; border-collapse: collapse; font-size: 13px; }
caption { text-align: left; font-size: 12px; color: var(--ink-muted); padding-bottom: 8px; }
th {
  font-family: var(--display); font-size: 11.5px; font-weight: 550;
  color: var(--ink-faint);
  text-align: right; padding: 0 10px 9px; border-bottom: 1px solid var(--line-strong);
  white-space: nowrap;
}
th:first-child { text-align: left; padding-left: 0; }
th:last-child { padding-right: 0; }
td {
  padding: 10px; border-bottom: 1px solid var(--line); text-align: right;
  font-family: var(--mono); font-variant-numeric: tabular-nums; font-size: 12.5px;
}
td:first-child { text-align: left; font-family: var(--body); font-size: 13px; padding-left: 0; }
td:last-child { padding-right: 0; }
#sessions td:nth-child(2), #sessions th:nth-child(2) { text-align: left; }
tbody tr:last-child td { border-bottom: none; }
tbody tr { transition: background-color 0.12s ease; }
tbody tr:hover td { background: var(--surface-sunk); }

.rank-name { display: flex; flex-direction: column; gap: 6px; min-width: 0; }
.rank-label { display: flex; align-items: center; gap: 8px; min-width: 0; }
.rank-text { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-weight: 500; }
.rank-sub { font-size: 11px; color: var(--ink-faint); font-family: var(--mono); }
/* 트랙은 line 을 쓴다. surface-sunk 는 행 hover 배경과 같은 토큰이라
   마우스를 올리면 트랙이 셀에 묻혀 "100% 중 얼마" 라는 기준이 사라진다. */
.rank-bar {
  display: block; height: 6px; background: var(--line);
  border-radius: var(--r-pill); overflow: hidden; max-width: 260px;
}
.rank-fill {
  display: block; height: 100%; min-width: 3px;
  border-radius: var(--r-pill);
  /* color-mix 를 모르는 엔진은 아래 선언만 버리고 위의 단색으로 떨어진다 */
  background: var(--accent);
  background: linear-gradient(90deg, var(--accent), color-mix(in srgb, var(--accent) 66%, var(--surface)));
}
.swatch { display: inline-block; width: 9px; height: 9px; border-radius: 3px; flex: none; }
.tag {
  font-family: var(--display); font-size: 10.5px; font-weight: 550; color: var(--ink-faint);
  background: var(--surface-sunk); border: 1px solid var(--line);
  padding: 1px 6px; border-radius: var(--r-pill); white-space: nowrap;
}

/* ---------- 범례 ---------- */
.legend { display: flex; flex-wrap: wrap; gap: 6px 16px; font-size: 12px; }
.legend-item {
  display: inline-flex; align-items: center; gap: 7px; color: var(--ink-muted);
}
.legend-item b { color: var(--ink); font-family: var(--mono); font-weight: 500; }

/* ---------- 조작 요소 ---------- */
.filter-label { font-size: 11.5px; font-weight: 550; color: var(--ink-faint); }

/* 기간 칩은 세그먼티드 컨트롤 하나로 묶는다 — 서로 배타적인 선택이라서 */
.filters {
  display: inline-flex;
  flex-wrap: wrap;
  gap: 3px;
  padding: 3px;
  border-radius: var(--r-control);
  background: var(--surface-sunk);
  border: 1px solid var(--line);
}

.chip {
  font-family: var(--display); font-size: 12.5px; font-weight: 550;
  padding: 5px 13px; border: 1px solid transparent; background: none;
  color: var(--ink-muted); border-radius: 7px; cursor: pointer;
  transition: background-color 0.14s ease, color 0.14s ease, box-shadow 0.14s ease;
}
.chip:hover { color: var(--ink); background: var(--surface); }
/* 선택 상태를 배경으로 읽히게 한다. surface 로 두면 트랙(surface-sunk)과
   1.06:1 이라 사실상 글자색만으로 구분해야 했고, 다크에서는 선택 칩이 트랙보다
   어두워 눌림/솟음 은유가 뒤집혔다. */
.chip[aria-pressed="true"] {
  background: var(--accent);
  border-color: var(--accent);
  color: var(--bg);
  box-shadow: var(--shadow-sm);
}
.chip[aria-pressed="true"]:hover { background: var(--accent); color: var(--bg); }

/* 날짜 칸의 적용·해제는 세그먼티드가 아니라 버튼이다 */
.date-range .chip {
  border-color: var(--line-strong);
  background: var(--surface);
  color: var(--ink-muted);
}
.date-range .chip:hover { color: var(--ink); border-color: var(--accent); }

.toggle {
  font-family: var(--display); font-size: 12.5px; font-weight: 550;
  padding: 6px 12px;
  border: 1px solid var(--line-strong); background: var(--surface);
  color: var(--ink-muted); border-radius: var(--r-control); cursor: pointer;
  transition: color 0.14s ease, border-color 0.14s ease, box-shadow 0.14s ease;
}
.toggle:hover:not(:disabled) { color: var(--ink); border-color: var(--accent); box-shadow: var(--shadow-sm); }
.toggle:disabled { color: var(--ink-faint); cursor: not-allowed; opacity: 0.7; }

.chip:focus-visible, .toggle:focus-visible, summary:focus-visible,
.date-input:focus-visible, .brand:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}

.masthead-controls { display: inline-flex; flex-wrap: wrap; align-items: center; gap: 8px; }

.refresh-control {
  display: inline-flex; align-items: center; gap: 5px;
  font-family: var(--display); font-size: 12.5px; font-weight: 550; color: var(--ink-muted);
  padding: 5px 11px; border: 1px solid var(--line-strong);
  background: var(--surface); border-radius: var(--r-control);
  transition: border-color 0.14s ease, box-shadow 0.14s ease;
}
.refresh-control:focus-within { border-color: var(--accent); box-shadow: 0 0 0 3px var(--ring); }
.refresh-prefix, .refresh-suffix { color: var(--ink-faint); }
.refresh-input {
  /* 최대값 3600(4자리)이 잘리지 않을 폭. ch 단위는 number 입력의 내부 여백을
     빼먹어 4ch 가 28.8px 로 계산돼 두 자리에서도 잘렸다. */
  width: 4.4em; padding: 0; border: 0; background: none;
  font-family: var(--mono); font-size: 12.5px; font-weight: 500; color: var(--ink);
  text-align: right; appearance: textfield;
}
.refresh-input::-webkit-outer-spin-button,
.refresh-input::-webkit-inner-spin-button { appearance: none; margin: 0; }
.refresh-input:focus { outline: none; }
.refresh-input:disabled { color: var(--ink-faint); cursor: not-allowed; }
.refresh-message { font-size: 11.5px; color: var(--ink-faint); white-space: nowrap; }
.refresh-message[data-state="error"] { color: var(--crit); font-weight: 550; }

.date-range { display: inline-flex; flex-wrap: wrap; align-items: center; gap: 6px; }
.date-input {
  font-family: var(--mono); font-size: 12.5px;
  padding: 5px 10px; border: 1px solid var(--line-strong); background: var(--surface);
  color: var(--ink); border-radius: var(--r-control); color-scheme: light dark;
}
.date-input:disabled { color: var(--ink-faint); cursor: not-allowed; }
.date-sep { color: var(--ink-faint); font-family: var(--mono); font-size: 12.5px; }
.date-message { font-size: 11.5px; color: var(--ink-faint); }
.date-message[data-state="error"] { color: var(--crit); font-weight: 550; }

/* ---------- 사용 한도 ---------- */
.limit { display: flex; flex-direction: column; gap: 8px; }
.limit + .limit { margin-top: 18px; padding-top: 18px; border-top: 1px solid var(--line); }
.limit-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.limit-label { display: inline-flex; align-items: center; gap: 8px; font-weight: 550; font-size: 14px; }
.limit-value {
  font-family: var(--display); font-variant-numeric: tabular-nums;
  font-size: 20px; font-weight: 680; letter-spacing: -0.03em;
}
.limit-track {
  height: 10px; background: var(--surface-sunk);
  border: 1px solid var(--line); border-radius: var(--r-pill); overflow: hidden;
}
.limit-fill { height: 100%; border-radius: var(--r-pill); transition: width 0.35s ease; }
.limit-reset { font-family: var(--mono); font-size: 11px; color: var(--ink-faint); }

/* ---------- 단가표 ---------- */
/* 푸터 안에 있지만 표이므로 다른 표와 같이 카드에 담는다 */
.rate-card {
  margin-top: 24px;
  padding: clamp(16px, 2.4vw, 22px);
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: var(--r-panel);
  box-shadow: var(--shadow-sm);
  display: flex; flex-direction: column; gap: 12px;
}
.rate-model {
  display: flex; align-items: center; gap: 6px;
  font-family: var(--mono); font-size: 12px; overflow-wrap: anywhere;
}
.rate-label { display: block; margin-top: 3px; font-size: 10.5px; color: var(--ink-muted); }

/* 화면에는 안 보이지만 스크린리더에는 읽히는 라벨 */
.sr-only {
  position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px;
  overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; border: 0;
}

/* ---------- 툴팁 ---------- */
.tooltip {
  position: fixed; z-index: 40; pointer-events: none; opacity: 0;
  transform: translate(-50%, calc(-100% - 12px));
  background: var(--ink); color: var(--bg);
  padding: 9px 12px; border-radius: var(--r-control);
  font-family: var(--mono); font-size: 11.5px; line-height: 1.55;
  white-space: nowrap; transition: opacity 0.12s ease;
  box-shadow: var(--shadow-pop);
}
.tooltip[data-open="true"] { opacity: 1; }
.tooltip-title {
  font-family: var(--display); font-size: 10.5px; font-weight: 600;
  letter-spacing: 0.02em; opacity: 0.72; display: block; margin-bottom: 2px;
}

/* ---------- 데이터 표 접기 ---------- */
details { border-top: 1px solid var(--line); padding-top: 12px; }
summary {
  cursor: pointer; font-family: var(--display); font-size: 12px; font-weight: 550;
  color: var(--ink-faint); list-style: none; display: inline-flex; align-items: center; gap: 6px;
  border-radius: var(--r-mark);
}
summary::-webkit-details-marker { display: none; }
summary::before {
  content: '';
  width: 5px; height: 5px;
  border-right: 1.5px solid currentColor;
  border-bottom: 1.5px solid currentColor;
  transform: rotate(-45deg) translate(-1px, -1px);
  transition: transform 0.16s ease;
}
details[open] > summary::before { transform: rotate(45deg) translate(-1px, -1px); }
summary:hover { color: var(--accent); }
details[open] summary { margin-bottom: 12px; }
.table-scroll { overflow-x: auto; max-height: 320px; }
.scroll-x { overflow-x: auto; }
.scroll-x table, .table-scroll table { min-width: 420px; }

/* ---------- 푸터 ---------- */
.colophon {
  border-top: 1px solid var(--line); padding-top: 22px;
  font-size: 12.5px; color: var(--ink-muted);
  display: flex; flex-direction: column; gap: 10px;
}
.colophon strong { color: var(--ink); font-weight: 600; font-size: 13px; }
.colophon ul { margin: 0; padding-left: 18px; display: flex; flex-direction: column; gap: 6px; }

.empty { color: var(--ink-faint); font-size: 13px; padding: 26px 0; text-align: center; margin: 0; }

/* ---------- 인쇄 / PDF ---------- */
@media print {
  /* 종이에서는 다크 테마가 잉크만 먹고 읽기도 나쁘다 — 항상 라이트로 찍는다 */
  :root, :root[data-theme='dark'] {
${LIGHT_BLOCK}
    color-scheme: light;
  }

  @page { margin: 14mm; }

  body { background: #FFFFFF; }
  .shell { max-width: none; padding: 0; }

  /* 조작용 요소와 실시간 표시등은 종이에 의미가 없다 */
  .toolbar, .masthead-controls, .refresh-message, .date-range,
  .date-message, .tooltip, .toggle, .live { display: none !important; }

  /* 상단 바가 sticky 인 채로 인쇄되면 페이지마다 겹쳐 찍힌다 */
  .topbar { position: static; border-bottom: 1px solid var(--line); backdrop-filter: none; }
  .topbar-inner { padding: 0 0 10px; min-height: 0; }

  /* 그림자는 종이에서 회색 얼룩이 된다 */
  .panel, .gauge, .tile, .rate-card, .masthead-meta > div { box-shadow: none !important; }
  .gauge { background: var(--surface) !important; }

  /* 한 항목이 페이지 경계에 걸려 잘리지 않게 한다 */
  .band, .panel, .limit, .tile, .gauge, .rate-card { break-inside: avoid; }
  h1, h2, h3 { break-after: avoid; }
  .band { padding-top: 0; margin-top: 10mm; }
  .band:first-of-type { margin-top: 0; }

  /* 차트는 배경색이 인쇄되지 않으면 빈칸이 된다 */
  .chart, .rank-fill, .limit-fill, .bar { -webkit-print-color-adjust: exact; print-color-adjust: exact; }

  /* 가로 스크롤 표는 종이에서 전부 보여야 한다 */
  .scroll-x, .table-scroll { overflow: visible !important; max-height: none !important; }

  a[href^='http']::after { content: ' (' attr(href) ')'; font-size: 10px; color: var(--ink-muted); }
}
`
