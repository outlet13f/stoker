import { dialog } from 'electron'
import fs from 'node:fs/promises'
import path from 'node:path'

/**
 * 대시보드를 PDF 로 저장하거나 프린터로 보낸다.
 *
 * 접힌 데이터 표(`<details>`)는 CSS 로 펼 수 없으므로 출력 직전에 열고 끝나면
 * 되돌린다. 열지 않으면 종이에는 차트만 남고 숫자가 빠진다.
 */
const PDF_OPTIONS = {
  printBackground: true,
  pageSize: 'A4',
  margins: { marginType: 'custom', top: 0, bottom: 0, left: 0, right: 0 },
  preferCSSPageSize: true,
}

/** 파일명에 쓸 수 있는 날짜 */
function stamp(now) {
  const iso = new Date(now).toISOString()
  return `${iso.slice(0, 10)}-${iso.slice(11, 16).replace(':', '')}`
}

/** 출력 동안만 접힌 표를 펼친다. 되돌릴 정보를 함께 돌려준다. */
const OPEN_DETAILS = `(() => {
  const closed = [...document.querySelectorAll('details:not([open])')]
  closed.forEach((node) => { node.open = true })
  window.__printRestore = () => closed.forEach((node) => { node.open = false })
  return closed.length
})()`

const RESTORE_DETAILS = `(() => {
  if (window.__printRestore) window.__printRestore()
  delete window.__printRestore
  return true
})()`

async function withDetailsOpen(contents, run) {
  await contents.executeJavaScript(OPEN_DETAILS)
  try {
    return await run()
  } finally {
    await contents.executeJavaScript(RESTORE_DETAILS)
  }
}

export function createExporter({ window, now = () => Date.now() } = {}) {
  return {
    /** @returns {Promise<string|null>} 저장한 경로. 취소하면 null. */
    async toPdf() {
      const { canceled, filePath } = await dialog.showSaveDialog(window, {
        title: '리포트를 PDF 로 저장',
        defaultPath: path.join('~', 'Downloads', `stoker-${stamp(now())}.pdf`).replace(/^~/, process.env.HOME ?? '~'),
        filters: [{ name: 'PDF', extensions: ['pdf'] }],
      })

      if (canceled || !filePath) return null

      const data = await withDetailsOpen(window.webContents, () =>
        window.webContents.printToPDF(PDF_OPTIONS),
      )

      await fs.writeFile(filePath, data)
      return filePath
    },

    /** @returns {Promise<boolean>} 인쇄를 시작했는지 */
    async print() {
      return withDetailsOpen(window.webContents, () =>
        new Promise((resolve) => {
          window.webContents.print({ printBackground: true }, (success) => resolve(success))
        }),
      )
    },
  }
}
