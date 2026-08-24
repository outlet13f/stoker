import { LIGHT_TOKENS, DARK_TOKENS, tokensToCss } from './theme.js'

const DARK_BLOCK = tokensToCss(DARK_TOKENS)

export const STYLES = `
:root {
${tokensToCss(LIGHT_TOKENS)}
  --display: 'Archivo', 'IBM Plex Sans KR', system-ui, sans-serif;
  --body: 'IBM Plex Sans KR', 'Archivo', system-ui, sans-serif;
  --mono: 'IBM Plex Mono', ui-monospace, SFMono-Regular, monospace;
  --gutter: clamp(16px, 4vw, 40px);
  --band-gap: clamp(32px, 5vw, 56px);
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
}

.shell {
  max-width: 1240px;
  margin: 0 auto;
  padding: clamp(24px, 5vw, 56px) var(--gutter) 96px;
  display: flex;
  flex-direction: column;
  gap: var(--band-gap);
}

/* ---------- 타이포 ---------- */
.eyebrow {
  font-family: var(--display);
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--ink-faint);
  margin: 0;
}

h1 {
  font-family: var(--display);
  font-size: clamp(28px, 4vw, 40px);
  font-weight: 700;
  letter-spacing: -0.02em;
  line-height: 1.1;
  margin: 6px 0 0;
  text-wrap: balance;
}

h2 {
  font-family: var(--display);
  font-size: clamp(19px, 2.4vw, 23px);
  font-weight: 600;
  letter-spacing: -0.01em;
  margin: 4px 0 0;
  text-wrap: balance;
}

h3 {
  font-family: var(--display);
  font-size: 14px;
  font-weight: 600;
  letter-spacing: 0.01em;
  margin: 0;
}

.lede { color: var(--ink-muted); margin: 6px 0 0; max-width: 62ch; font-size: 14px; }
.num { font-family: var(--mono); font-variant-numeric: tabular-nums; letter-spacing: -0.01em; }

/* ---------- 헤더 ---------- */
.masthead {
  display: flex;
  flex-wrap: wrap;
  gap: 24px;
  justify-content: space-between;
  align-items: flex-end;
  border-bottom: 2px solid var(--ink);
  padding-bottom: 18px;
}

.masthead-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 22px;
  font-size: 12px;
  color: var(--ink-muted);
}
.masthead-meta b { font-family: var(--mono); font-weight: 500; color: var(--ink); }

.live {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  font-family: var(--display);
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.1em;
  text-transform: uppercase;
}
.live-dot {
  width: 7px; height: 7px; border-radius: 50%;
  background: var(--ok);
  box-shadow: 0 0 0 3px var(--ok-wash);
}
.live[data-state="stale"] .live-dot { background: var(--warn); box-shadow: 0 0 0 3px var(--warn-wash); }
.live[data-state="error"] .live-dot { background: var(--crit); box-shadow: 0 0 0 3px var(--crit-wash); }

@media (prefers-reduced-motion: no-preference) {
  .live[data-state="live"] .live-dot { animation: pulse 2.4s ease-in-out infinite; }
  @keyframes pulse { 50% { opacity: 0.35; } }
}

/* ---------- 밴드 ---------- */
.band { display: flex; flex-direction: column; gap: 20px; }
.band-head { display: flex; flex-wrap: wrap; gap: 12px 24px; justify-content: space-between; align-items: baseline; }

/* ---------- 소진 계기 ---------- */
.gauge {
  background: var(--surface);
  border: 1px solid var(--line);
  padding: clamp(18px, 3vw, 28px);
  display: flex;
  flex-direction: column;
  gap: 22px;
}

.gauge-top { display: flex; flex-wrap: wrap; gap: 24px 40px; align-items: flex-end; justify-content: space-between; }

.hero { display: flex; flex-direction: column; gap: 8px; }
.hero-value {
  font-family: var(--mono);
  font-variant-numeric: tabular-nums;
  font-size: clamp(38px, 6vw, 58px);
  font-weight: 500;
  line-height: 1;
  letter-spacing: -0.03em;
}
.hero-note { font-size: 13px; color: var(--ink-muted); }

.pill {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  align-self: flex-start;
  padding: 4px 11px 4px 9px;
  border-radius: 2px;
  font-family: var(--display);
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}
.pill-glyph { font-family: var(--mono); font-size: 12px; line-height: 1; }
.pill[data-level="ok"]   { background: var(--ok-wash);   color: var(--ok); }
.pill[data-level="warn"] { background: var(--warn-wash); color: var(--warn); }
.pill[data-level="crit"] { background: var(--crit-wash); color: var(--crit); }
.pill[data-level="idle"] { background: var(--surface-sunk); color: var(--ink-muted); }

.readouts { display: flex; flex-wrap: wrap; gap: 10px 36px; }
.readout { display: flex; flex-direction: column; gap: 2px; min-width: 96px; }
.readout dt {
  font-family: var(--display);
  font-size: 10px; font-weight: 600;
  letter-spacing: 0.11em; text-transform: uppercase;
  color: var(--ink-faint);
}
.readout dd { margin: 0; font-family: var(--mono); font-variant-numeric: tabular-nums; font-size: 17px; }

.gauge-face { display: flex; flex-direction: column; gap: 8px; }
.gauge-scale {
  display: flex; justify-content: space-between;
  font-family: var(--mono); font-size: 11px; color: var(--ink-faint);
}

/* ---------- 통계 타일 ---------- */
.tiles { display: grid; grid-template-columns: repeat(auto-fit, minmax(168px, 1fr)); gap: 1px; background: var(--line); border: 1px solid var(--line); }
.tile { background: var(--surface); padding: 16px 18px; display: flex; flex-direction: column; gap: 5px; }
.tile-label { font-family: var(--display); font-size: 10px; font-weight: 600; letter-spacing: 0.11em; text-transform: uppercase; color: var(--ink-faint); }
.tile-value { font-family: var(--mono); font-variant-numeric: tabular-nums; font-size: 24px; line-height: 1.1; letter-spacing: -0.02em; }
.tile-note { font-size: 12px; color: var(--ink-muted); }
.up { color: var(--crit); }
.down { color: var(--ok); }

/* ---------- 차트 ---------- */
.panel { background: var(--surface); border: 1px solid var(--line); padding: clamp(16px, 2.5vw, 22px); display: flex; flex-direction: column; gap: 14px; }
.panel-head { display: flex; flex-wrap: wrap; gap: 8px 18px; align-items: baseline; justify-content: space-between; }
.panel-note { font-size: 12px; color: var(--ink-muted); }
.chart-wrap { overflow-x: auto; }
.chart { display: block; width: 100%; height: auto; }
.grid-line { stroke: var(--grid); stroke-width: 1; }
.axis-text { font-family: var(--mono); font-size: 10px; fill: var(--ink-faint); }
.bar { transition: opacity 0.12s ease; }
.bar:hover, .bar.is-hot { opacity: 1; }
.chart:hover .bar:not(:hover) { opacity: 0.55; }

.split { display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 16px; }

/* ---------- 순위 표 ---------- */
table { width: 100%; border-collapse: collapse; font-size: 13px; }
caption { text-align: left; font-size: 12px; color: var(--ink-muted); padding-bottom: 8px; }
th {
  font-family: var(--display); font-size: 10px; font-weight: 600;
  letter-spacing: 0.11em; text-transform: uppercase; color: var(--ink-faint);
  text-align: right; padding: 0 0 8px; border-bottom: 1px solid var(--line-strong);
}
th:first-child { text-align: left; }
td { padding: 9px 0; border-bottom: 1px solid var(--line); text-align: right; font-family: var(--mono); font-variant-numeric: tabular-nums; }
td:first-child { text-align: left; font-family: var(--body); }
#sessions td:nth-child(2), #sessions th:nth-child(2) { text-align: left; }
tbody tr:last-child td { border-bottom: none; }

.rank-name { display: flex; flex-direction: column; gap: 5px; min-width: 0; }
.rank-label { display: flex; align-items: center; gap: 8px; min-width: 0; }
.rank-text { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.rank-sub { font-size: 11px; color: var(--ink-faint); font-family: var(--mono); }
.rank-bar { display: block; height: 5px; background: var(--line); border-radius: 0 2px 2px 0; overflow: hidden; max-width: 260px; }
.rank-fill { display: block; height: 100%; min-width: 2px; background: var(--accent); border-radius: 0 2px 2px 0; }
.swatch { display: inline-block; width: 9px; height: 9px; border-radius: 2px; flex: none; }
.tag { font-family: var(--mono); font-size: 10px; color: var(--ink-faint); border: 1px solid var(--line-strong); padding: 0 4px; border-radius: 2px; }

/* ---------- 범례 / 필터 ---------- */
.legend { display: flex; flex-wrap: wrap; gap: 6px 18px; font-size: 12px; }
.legend-item { display: inline-flex; align-items: center; gap: 7px; color: var(--ink-muted); }
.legend-item b { color: var(--ink); font-family: var(--mono); font-weight: 500; }

.filters { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
.filter-label { font-family: var(--display); font-size: 10px; font-weight: 600; letter-spacing: 0.11em; text-transform: uppercase; color: var(--ink-faint); margin-right: 4px; }
.chip {
  font-family: var(--mono); font-size: 12px;
  padding: 5px 11px; border: 1px solid var(--line-strong); background: var(--surface);
  color: var(--ink-muted); border-radius: 2px; cursor: pointer;
}
.chip:hover { border-color: var(--accent); color: var(--ink); }
.chip[aria-pressed="true"] { background: var(--ink); border-color: var(--ink); color: var(--bg); }
.chip:focus-visible, .toggle:focus-visible, summary:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }

/* 헤더 제어(갱신 주기 · 테마) */
.masthead-controls { display: inline-flex; align-items: center; gap: 8px; }
select.toggle { appearance: none; padding-right: 22px;
  background-image: linear-gradient(45deg, transparent 50%, var(--ink-muted) 50%),
    linear-gradient(135deg, var(--ink-muted) 50%, transparent 50%);
  background-position: calc(100% - 13px) 50%, calc(100% - 8px) 50%;
  background-size: 5px 5px, 5px 5px; background-repeat: no-repeat;
}
select.toggle:disabled { color: var(--ink-faint); cursor: not-allowed; }

/* 날짜 직접 선택 */
.date-range { display: inline-flex; flex-wrap: wrap; align-items: center; gap: 6px; margin-left: 10px; }
.date-input {
  font-family: var(--mono); font-size: 12px;
  padding: 4px 8px; border: 1px solid var(--line-strong); background: var(--surface);
  color: var(--ink); border-radius: 2px; color-scheme: light dark;
}
.date-input:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
.date-input:disabled { color: var(--ink-faint); cursor: not-allowed; }
.date-sep { color: var(--ink-faint); font-family: var(--mono); font-size: 12px; }
.date-message { font-family: var(--mono); font-size: 11px; color: var(--ink-muted); }
.date-message[data-state="error"] { color: var(--crit); }

/* 화면에는 안 보이지만 스크린리더에는 읽히는 라벨 */
.sr-only {
  position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px;
  overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; border: 0;
}

.toggle {
  font-family: var(--mono); font-size: 12px; padding: 5px 11px;
  border: 1px solid var(--line-strong); background: var(--surface);
  color: var(--ink-muted); border-radius: 2px; cursor: pointer;
}

/* ---------- 툴팁 ---------- */
.tooltip {
  position: fixed; z-index: 20; pointer-events: none; opacity: 0;
  transform: translate(-50%, calc(-100% - 12px));
  background: var(--ink); color: var(--bg);
  padding: 8px 11px; border-radius: 3px;
  font-family: var(--mono); font-size: 11.5px; line-height: 1.5;
  white-space: nowrap; transition: opacity 0.1s ease;
  box-shadow: 0 6px 20px rgb(0 0 0 / 0.18);
}
.tooltip[data-open="true"] { opacity: 1; }
.tooltip-title { font-family: var(--display); font-size: 10px; letter-spacing: 0.09em; text-transform: uppercase; opacity: 0.7; display: block; }

/* ---------- 데이터 표 접기 ---------- */
details { border-top: 1px solid var(--line); padding-top: 10px; }
summary { cursor: pointer; font-family: var(--display); font-size: 11px; font-weight: 600; letter-spacing: 0.09em; text-transform: uppercase; color: var(--ink-faint); }
summary:hover { color: var(--accent); }
details[open] summary { margin-bottom: 10px; }
.table-scroll { overflow-x: auto; max-height: 320px; }
.scroll-x { overflow-x: auto; }
.scroll-x table, .table-scroll table { min-width: 420px; }

/* ---------- 푸터 ---------- */
.colophon { border-top: 1px solid var(--line); padding-top: 20px; font-size: 12.5px; color: var(--ink-muted); display: flex; flex-direction: column; gap: 8px; }
.colophon strong { color: var(--ink); font-weight: 600; }
.colophon ul { margin: 0; padding-left: 18px; display: flex; flex-direction: column; gap: 5px; }
.colophon code { font-family: var(--mono); font-size: 12px; background: var(--surface-sunk); padding: 1px 5px; border-radius: 2px; }

.empty { color: var(--ink-muted); font-size: 13px; padding: 24px 0; text-align: center; }
`
