/**
 * 디자인 토큰. 색은 `npm run palette` (scripts/validate_palette.js) 로
 * 두 테마 모두에서 대비와 램프 단조성을 통과시킨 값이다.
 * 값을 바꾸면 그 검증기를 다시 돌려야 한다 — 테스트에도 묶여 있다.
 *
 *   범주형 3색   : 실행 주체(main/subagent/workflow) 구분 — all-pairs PASS
 *   순차 램프 5단 : 토큰 종류(단가 오름차순) — ordinal PASS
 *   상태 3색     : 블록 소진 상태 — 항상 글자 라벨과 함께 쓴다
 *
 * 중립색은 파랑 쪽으로 살짝 틀어 둔 회색이다. 완전 무채색은 카드를 여러 장
 * 겹쳤을 때 탁해 보이고, 인디고 액센트 옆에서 누렇게 읽힌다.
 *
 * 순차 램프는 액센트와 같은 색상 계열이다. 순차 스케일은 단일 색상이어야
 * 크기 비교로 읽히기 때문이고, 범주형과는 쓰이는 밴드가 달라 섞이지 않는다.
 */
export const LIGHT_TOKENS = {
  bg: '#F4F5F8',
  surface: '#FFFFFF',
  'surface-sunk': '#F7F8FB',
  line: '#E6E8EF',
  'line-strong': '#D0D5E0',
  ink: '#12141A',
  'ink-muted': '#555C6B',
  'ink-faint': '#636A79',
  accent: '#4F46E5',
  'accent-wash': '#EEEDFD',
  'cat-1': '#4F46E5',
  'cat-2': '#0E8F80',
  'cat-3': '#C2317C',
  'seq-1': '#8A80EC',
  'seq-2': '#7365E2',
  'seq-3': '#5C4BD0',
  'seq-4': '#46349F',
  'seq-5': '#2E216B',
  ok: '#0A7C5F',
  warn: '#A65407',
  crit: '#C02C42',
  'ok-wash': '#E8F6F1',
  'warn-wash': '#FAF0DC',
  'crit-wash': '#FBE7EA',
  grid: '#EDEFF4',
}

export const DARK_TOKENS = {
  bg: '#0B0C10',
  surface: '#14161C',
  'surface-sunk': '#1A1D24',
  line: '#242832',
  'line-strong': '#363C48',
  ink: '#E9EBF0',
  'ink-muted': '#9AA1B1',
  'ink-faint': '#8A91A1',
  accent: '#8B85FF',
  'accent-wash': '#1E1B3A',
  'cat-1': '#8B85FF',
  'cat-2': '#2DD4BF',
  'cat-3': '#F472B6',
  'seq-1': '#CFCBFF',
  'seq-2': '#B4ADFA',
  'seq-3': '#9A90F2',
  'seq-4': '#8074E4',
  'seq-5': '#6455CE',
  ok: '#2CB894',
  warn: '#D9A441',
  crit: '#E4707E',
  'ok-wash': '#0E241E',
  'warn-wash': '#241D0E',
  'crit-wash': '#2A1319',
  grid: '#20242C',
}

/**
 * 그림자와 반투명 면. 색이 아니라 효과라서 팔레트 검증기와 분리해 둔다
 * (검증기는 hex 만 읽는다). 두 테마의 값이 다른 이유는 물리가 달라서다 —
 * 밝은 배경에서는 그림자가 깊이를 만들지만, 어두운 배경에서는 그림자가
 * 보이지 않으므로 카드를 배경보다 밝게 띄우고 테두리로 경계를 만든다.
 */
export const LIGHT_EFFECTS = {
  'shadow-sm': '0 1px 2px rgb(16 20 32 / 0.05)',
  'shadow-md': '0 1px 2px rgb(16 20 32 / 0.05), 0 6px 16px -6px rgb(16 20 32 / 0.10)',
  'shadow-pop': '0 8px 28px -6px rgb(16 20 32 / 0.28)',
  'glass': 'rgb(255 255 255 / 0.78)',
  'ring': 'rgb(79 70 229 / 0.18)',
}

export const DARK_EFFECTS = {
  'shadow-sm': '0 1px 2px rgb(0 0 0 / 0.35)',
  'shadow-md': '0 1px 2px rgb(0 0 0 / 0.35), 0 6px 16px -6px rgb(0 0 0 / 0.55)',
  'shadow-pop': '0 8px 28px -6px rgb(0 0 0 / 0.7)',
  'glass': 'rgb(20 22 28 / 0.78)',
  'ring': 'rgb(139 133 255 / 0.28)',
}

/** 토큰 맵을 CSS 커스텀 프로퍼티 선언문으로 바꾼다 */
export function tokensToCss(tokens) {
  return Object.entries(tokens)
    .map(([name, value]) => `  --${name}: ${value};`)
    .join('\n')
}
