import test from 'node:test'
import assert from 'node:assert/strict'
import { findPaletteFailures, contrastRatio, CHECK_COUNT } from '../scripts/validate_palette.js'

test('the palette passes every contrast and ramp check in both themes', () => {
  // Act
  const failures = findPaletteFailures()

  // Assert — 실패하면 어디가 왜 모자란지 그대로 보인다
  const report = failures.map((f) => `${f.name} ${f.detail} ${f.got}/${f.need} (${f.usage})`).join('\n')
  assert.deepEqual(failures, [], `\n${report}`)
})

test('the validator actually checks a meaningful number of pairs', () => {
  // Assert — 검사 목록이 비어도 통과하는 일이 없게 한다
  assert.ok(CHECK_COUNT >= 40, `검사 항목이 너무 적습니다: ${CHECK_COUNT}`)
})

test('contrastRatio matches the WCAG reference values', () => {
  // Assert — 검증기 자체가 맞는지 확인한다
  assert.equal(contrastRatio('#FFFFFF', '#000000').toFixed(1), '21.0')
  assert.equal(contrastRatio('#FFFFFF', '#FFFFFF').toFixed(1), '1.0')
  assert.equal(contrastRatio('#767676', '#FFFFFF').toFixed(2), '4.54')
})

test('contrastRatio is symmetric', () => {
  // Assert
  assert.equal(contrastRatio('#D9662F', '#FFFFFF'), contrastRatio('#FFFFFF', '#D9662F'))
})
