/**
 * 디자인 토큰. 색은 dataviz 검증기(scripts/validate_palette.js)로
 * 두 테마 모두에서 명도대역·채도·CVD 분리·대비를 통과시킨 값이다.
 *
 *   범주형 3색   : 실행 주체(main/subagent/workflow) 구분 — all-pairs PASS
 *   순차 램프 5단 : 토큰 종류(단가 오름차순) — ordinal PASS
 *   상태 3색     : 블록 소진 상태 — 항상 글자 라벨과 함께 쓴다
 */
export const LIGHT_TOKENS = {
  bg: '#F5F3F0',
  surface: '#FFFFFF',
  'surface-sunk': '#FAF9F7',
  line: '#E4E0DA',
  'line-strong': '#CFC9C0',
  ink: '#1C1A17',
  'ink-muted': '#6B655D',
  'ink-faint': '#9A948B',
  accent: '#D9662F',
  'accent-wash': '#FBEDE4',
  'cat-1': '#D9662F',
  'cat-2': '#0E9A88',
  'cat-3': '#7C6BD1',
  'seq-1': '#E39C6E',
  'seq-2': '#D07B44',
  'seq-3': '#B85A28',
  'seq-4': '#99451B',
  'seq-5': '#7A360F',
  ok: '#00846F',
  warn: '#C2861B',
  crit: '#AE3040',
  'ok-wash': '#E3F2EE',
  'warn-wash': '#F8EFDC',
  'crit-wash': '#F9E6E9',
  grid: '#EDEAE5',
}

export const DARK_TOKENS = {
  bg: '#131210',
  surface: '#1B1917',
  'surface-sunk': '#211E1B',
  line: '#2E2A26',
  'line-strong': '#423C36',
  ink: '#EDE9E3',
  'ink-muted': '#A29B92',
  'ink-faint': '#726C64',
  accent: '#D9662F',
  'accent-wash': '#2C1C13',
  'cat-1': '#D9662F',
  'cat-2': '#0E9A88',
  'cat-3': '#7C6BD1',
  'seq-1': '#F0BC85',
  'seq-2': '#E1934F',
  'seq-3': '#CE7038',
  'seq-4': '#B05526',
  'seq-5': '#8F4318',
  ok: '#17A38C',
  warn: '#B7842A',
  crit: '#C0424F',
  'ok-wash': '#12241F',
  'warn-wash': '#241C0F',
  'crit-wash': '#261216',
  grid: '#252220',
}

export const FONT_HREF =
  'https://fonts.googleapis.com/css2?family=Archivo:wght@500;600;700&family=IBM+Plex+Mono:wght@400;500;600&family=IBM+Plex+Sans+KR:wght@400;500;600&display=swap'

/** 토큰 맵을 CSS 커스텀 프로퍼티 선언문으로 바꾼다 */
export function tokensToCss(tokens) {
  return Object.entries(tokens)
    .map(([name, value]) => `  --${name}: ${value};`)
    .join('\n')
}
