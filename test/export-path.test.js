import test from 'node:test'
import assert from 'node:assert/strict'
import { reportFileName, uniquePath } from '../electron/export-path.js'

const NOW = Date.parse('2026-08-24T18:07:31.000Z')

test('reportFileName stamps the local date and time', () => {
  // Act
  const name = reportFileName(NOW, 'Asia/Seoul')

  // Assert — KST 로 2026-08-25 03:07
  assert.equal(name, 'stoker-2026-08-25-0307.pdf')
})

test('reportFileName uses the timezone it is given', () => {
  // Assert
  assert.equal(reportFileName(NOW, 'UTC'), 'stoker-2026-08-24-1807.pdf')
})

test('reportFileName always ends in .pdf', () => {
  // Assert
  assert.match(reportFileName(NOW, 'UTC'), /\.pdf$/)
})

test('reportFileName is safe to use as a filename', () => {
  // Assert — 콜론이나 슬래시가 들어가면 저장이 깨진다
  assert.doesNotMatch(reportFileName(NOW, 'Asia/Seoul'), /[:/\\]/)
})

test('uniquePath returns the plain name when nothing is there', () => {
  // Act
  const chosen = uniquePath('/downloads', 'stoker-2026-08-24-1807.pdf', () => false)

  // Assert
  assert.equal(chosen, '/downloads/stoker-2026-08-24-1807.pdf')
})

test('uniquePath avoids overwriting an existing report', () => {
  // Arrange — 같은 분에 두 번 저장해도 앞의 것을 덮지 않는다
  const taken = new Set(['/downloads/stoker-2026-08-24-1807.pdf'])

  // Act
  const chosen = uniquePath('/downloads', 'stoker-2026-08-24-1807.pdf', (p) => taken.has(p))

  // Assert
  assert.equal(chosen, '/downloads/stoker-2026-08-24-1807-2.pdf')
})

test('uniquePath keeps counting past the second collision', () => {
  // Arrange
  const taken = new Set([
    '/downloads/stoker-a.pdf',
    '/downloads/stoker-a-2.pdf',
    '/downloads/stoker-a-3.pdf',
  ])

  // Act
  const chosen = uniquePath('/downloads', 'stoker-a.pdf', (p) => taken.has(p))

  // Assert
  assert.equal(chosen, '/downloads/stoker-a-4.pdf')
})

test('uniquePath gives up rather than looping forever', () => {
  // Act & Assert — 모든 후보가 차 있어도 멈춘다
  assert.throws(() => uniquePath('/downloads', 'x.pdf', () => true), /저장할 이름/)
})
