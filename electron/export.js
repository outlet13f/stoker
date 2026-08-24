import { app, shell } from 'electron'
import fs from 'node:fs'
import fsp from 'node:fs/promises'
import { reportFileName, uniquePath } from './export-path.js'

/**
 * 대시보드를 PDF 로 저장하거나 프린터로 보낸다.
 *
 * 저장은 대화상자 없이 바로 다운로드 폴더에 떨어뜨린다. 대신 저장됐는지
 * 알 방법이 사라지므로 결과를 반드시 알린다 — 조용히 성공하거나 조용히
 * 실패하는 출력 기능은 없는 것보다 나쁘다.
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

export function createExporter({
  window,
  timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone,
  onSaved,
  onFailed,
  now = () => Date.now(),
} = {}) {
  return {
    /** @returns {Promise<string|null>} 저장한 경로. 실패하면 null. */
    async toPdf() {
      let target
      try {
        const directory = app.getPath('downloads')
        await fsp.mkdir(directory, { recursive: true })
        target = uniquePath(directory, reportFileName(now(), timeZone), (candidate) =>
          fs.existsSync(candidate),
        )

        const data = await withDetailsOpen(window.webContents, () =>
          window.webContents.printToPDF(PDF_OPTIONS),
        )
        await fsp.writeFile(target, data)
      } catch (error) {
        onFailed?.(error.message)
        return null
      }

      onSaved?.(target)
      return target
    },

    /** 저장한 파일을 Finder 에서 보여 준다 */
    reveal(target) {
      shell.showItemInFolder(target)
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
