#!/usr/bin/env node
import { fileURLToPath } from 'node:url'
import process from 'node:process'
import { LIGHT_TOKENS, DARK_TOKENS } from '../src/render/theme.js'

/**
 * 팔레트 검증기. theme.js 주석이 이 파일을 가리키므로 실제로 돌아가야 한다.
 *
 * 계산값만 보고 판정하지 않는다. 토큰이 **어디에 어떤 크기로** 쓰이는지에 따라
 * 필요한 대비가 달라진다. 그래서 실사용처를 명시해 두고 그 기준으로 본다.
 *   - 본문/라벨 텍스트 : 4.5:1 (WCAG 1.4.3, 소형 텍스트)
 *   - 9~10px 마크·스와치 : 3.0:1 (WCAG 1.4.11, 의미를 지닌 비텍스트)
 *   - 장식 테두리·차트 그리드선 : 면제 (1.4.11 예외)
 */
const TEXT_MIN = 4.5
const MARK_MIN = 3.0

/** [전경, 배경, 필요대비, 실사용처] */
const PAIRS = [
  ['ink', 'bg', TEXT_MIN, '본문'],
  ['ink', 'surface', TEXT_MIN, '본문 on 카드'],
  ['ink', 'surface-sunk', TEXT_MIN, '본문 on 함몰면'],
  ['ink-muted', 'bg', TEXT_MIN, '보조 텍스트'],
  ['ink-muted', 'surface', TEXT_MIN, '보조 텍스트 on 카드'],
  ['ink-faint', 'bg', TEXT_MIN, '10~11px 축·타일 라벨'],
  ['ink-faint', 'surface', TEXT_MIN, '10~11px 태그·부제'],
  ['accent', 'bg', TEXT_MIN, '아이브로우 11px'],
  ['accent', 'surface', TEXT_MIN, '접기 요약 hover'],
  ['bg', 'accent', TEXT_MIN, '선택된 기간 칩 글자'],
  ['accent', 'surface-sunk', MARK_MIN, '선택된 기간 칩 vs 트랙'],
  ['ok', 'ok-wash', TEXT_MIN, '"안정" 배지 11px'],
  ['warn', 'warn-wash', TEXT_MIN, '"주의" 배지 11px'],
  ['crit', 'crit-wash', TEXT_MIN, '"높음" 배지 11px'],
  ['ok', 'surface', TEXT_MIN, '안정 수치'],
  ['warn', 'surface', TEXT_MIN, '주의 수치'],
  ['crit', 'surface', TEXT_MIN, '높음 수치'],
  ['cat-1', 'surface', MARK_MIN, '9px 스와치(실행 주체)'],
  ['cat-2', 'surface', MARK_MIN, '9px 스와치(실행 주체)'],
  ['cat-3', 'surface', MARK_MIN, '9px 스와치(실행 주체)'],
  ['seq-1', 'surface', MARK_MIN, '9px 스와치(토큰 종류)'],
  ['seq-2', 'surface', MARK_MIN, '9px 스와치(토큰 종류)'],
  ['seq-3', 'surface', MARK_MIN, '9px 스와치(토큰 종류)'],
  ['seq-4', 'surface', MARK_MIN, '9px 스와치(토큰 종류)'],
  ['seq-5', 'surface', MARK_MIN, '9px 스와치(토큰 종류)'],
]

/** 순차 램프는 밝기 순서가 유지돼야 크기 비교로 읽힌다 */
const RAMP = ['seq-1', 'seq-2', 'seq-3', 'seq-4', 'seq-5']

const srgb = (channel) =>
  channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4

export function relativeLuminance(hex) {
  const [r, g, b] = [1, 3, 5].map((offset) => parseInt(hex.slice(offset, offset + 2), 16) / 255)
  return 0.2126 * srgb(r) + 0.7152 * srgb(g) + 0.0722 * srgb(b)
}

export function contrastRatio(a, b) {
  const [lighter, darker] = [relativeLuminance(a), relativeLuminance(b)].sort((x, y) => y - x)
  return (lighter + 0.05) / (darker + 0.05)
}

function checkTheme(name, tokens) {
  const failures = []

  for (const [fg, bg, need, usage] of PAIRS) {
    const ratio = contrastRatio(tokens[fg], tokens[bg])
    if (ratio + 1e-9 < need) {
      failures.push({ name, kind: '대비', detail: `${fg} on ${bg}`, usage, got: ratio.toFixed(2), need })
    }
  }

  // 램프의 밝기 단조성. seq-1 이 가장 밝고 seq-5 가 가장 어두워야 한다.
  const luminances = RAMP.map((token) => relativeLuminance(tokens[token]))
  for (let index = 1; index < luminances.length; index += 1) {
    if (luminances[index] >= luminances[index - 1]) {
      failures.push({
        name, kind: '램프', detail: `${RAMP[index - 1]} → ${RAMP[index]}`,
        usage: '밝기가 단조 감소해야 한다', got: '역전', need: '-',
      })
    }
  }

  return failures
}

/** 두 테마의 모든 위반 목록. 테스트에서도 이 함수를 쓴다. */
export function findPaletteFailures() {
  return [...checkTheme('LIGHT', LIGHT_TOKENS), ...checkTheme('DARK', DARK_TOKENS)]
}

export const CHECK_COUNT = PAIRS.length * 2 + (RAMP.length - 1) * 2

/* 직접 실행할 때만 리포트를 찍는다(import 하면 그냥 함수만 쓴다) */
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const failures = findPaletteFailures()

  if (failures.length === 0) {
    console.log(`팔레트 검증 통과 — ${CHECK_COUNT}개 항목`)
  } else {
    console.error(`팔레트 검증 실패 — ${failures.length}건\n`)
    for (const f of failures) {
      console.error(`  ${f.name.padEnd(5)} ${f.kind}  ${f.detail.padEnd(26)} ${String(f.got).padStart(6)} / ${f.need}   ${f.usage}`)
    }
    console.error('\n장식 테두리(line, line-strong)와 차트 그리드선(grid)은 WCAG 1.4.11 면제라 검사하지 않습니다.')
    process.exitCode = 1
  }
}
