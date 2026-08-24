import { app, BrowserWindow, shell, Menu } from 'electron'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createTray } from './tray.js'
import { createExporter } from './export.js'
import { createNotifier } from './notify.js'
import { startServer } from '../src/server.js'
import { DEFAULT_REFRESH_SECONDS } from '../src/constants.js'

/**
 * 데스크톱 껍데기. 집계와 렌더는 기존 서버를 그대로 쓴다.
 * 포트 0 으로 띄워 OS 가 빈 포트를 고르게 하므로 이미 쓰는 포트와 부딪히지 않는다.
 */
const HERE = path.dirname(fileURLToPath(import.meta.url))

const WINDOW = { width: 1440, height: 940, minWidth: 720, minHeight: 560 }

let isQuitting = false

/** --notify-test 결과를 보고하기까지 기다리는 시간 */
const NOTIFY_TEST_REPORT_MS = 1500
const BACKGROUND = '#F5F3F0'

/** --refresh 10 처럼 CLI 로 준 값을 그대로 받는다 */
function parseRefreshSeconds(argv) {
  const index = argv.indexOf('--refresh')
  if (index === -1) return DEFAULT_REFRESH_SECONDS

  const value = Number(argv[index + 1])
  return Number.isFinite(value) && value >= 0 ? value : DEFAULT_REFRESH_SECONDS
}

/** --notify-at 70,90 / --no-notify */
function parseNotifyOptions(argv) {
  const index = argv.indexOf('--notify-at')
  const raw = index === -1 ? null : argv[index + 1]
  const marks = (raw ?? '')
    .split(',')
    .map((part) => Number(part.trim()))
    .filter((mark) => Number.isInteger(mark) && mark >= 1 && mark <= 100)

  return {
    notify: !argv.includes('--no-notify'),
    thresholds: marks.length > 0 ? [...new Set(marks)].sort((a, b) => a - b) : undefined,
  }
}

function createWindow(url) {
  const window = new BrowserWindow({
    ...WINDOW,
    backgroundColor: BACKGROUND,
    title: 'Stoker',
    show: false,
    webPreferences: {
      // 대시보드는 서버가 만든 정적 페이지만 그린다. Node 를 열어 줄 이유가 없다.
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      preload: path.join(HERE, 'preload.js'),
    },
  })

  window.once('ready-to-show', () => window.show())
  window.loadURL(url)

  // 메뉴바 앱이므로 창을 닫아도 종료하지 않고 숨긴다. 종료는 트레이 메뉴나 Cmd+Q.
  window.on('close', (event) => {
    if (isQuitting) return
    event.preventDefault()
    window.hide()
  })

  // 외부 링크(단가 문서 등)는 기본 브라우저로 넘긴다
  window.webContents.setWindowOpenHandler(({ url: target }) => {
    if (/^https?:/.test(target)) shell.openExternal(target)
    return { action: 'deny' }
  })

  // 앱 창이 다른 사이트로 이동해 버리는 것을 막는다
  window.webContents.on('will-navigate', (event, target) => {
    if (!target.startsWith(url)) {
      event.preventDefault()
      if (/^https?:/.test(target)) shell.openExternal(target)
    }
  })

  return window
}

/** 새로고침·확대·개발자도구와 출력만 남긴 최소 메뉴 */
function buildMenu(url, exporter) {
  return Menu.buildFromTemplate([
    ...(process.platform === 'darwin' ? [{ role: 'appMenu' }] : []),
    {
      label: '파일',
      submenu: [
        { label: 'PDF 저장 (다운로드 폴더)', accelerator: 'CmdOrCtrl+S', click: () => void exporter.toPdf() },
        { label: '인쇄…', accelerator: 'CmdOrCtrl+P', click: () => void exporter.print() },
      ],
    },
    {
      label: '보기',
      submenu: [
        { role: 'reload', label: '새로고침' },
        { role: 'forceReload', label: '강제 새로고침' },
        { type: 'separator' },
        { role: 'resetZoom', label: '기본 크기' },
        { role: 'zoomIn', label: '확대' },
        { role: 'zoomOut', label: '축소' },
        { type: 'separator' },
        { role: 'toggleDevTools', label: '개발자 도구' },
        { type: 'separator' },
        {
          label: '브라우저에서 열기',
          click: () => shell.openExternal(url),
        },
      ],
    },
    { role: 'windowMenu', label: '창' },
  ])
}

async function main() {
  await app.whenReady()

  const refreshSeconds = parseRefreshSeconds(process.argv)
  const { url } = await startServer({
    port: 0,
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    refreshSeconds,
  })

  let window = createWindow(url)
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone
  const notifier = createNotifier({ onActivate: () => toggleWindow(true) })

  // 대화상자 없이 저장하므로 결과를 반드시 알린다. 누르면 Finder 에서 보여 준다.
  const exporter = createExporter({
    window,
    timeZone,
    onSaved: (target) =>
      notifier.notify({
        title: 'PDF 저장 완료',
        body: `다운로드 › ${path.basename(target)}`,
        onClick: () => exporter.reveal(target),
      }),
    onFailed: (reason) => notifier.notify({ title: 'PDF 저장 실패', body: reason }),
  })

  Menu.setApplicationMenu(buildMenu(url, exporter))

  /** 트레이 아이콘을 눌렀을 때: 숨어 있으면 띄우고, 보이면 숨긴다 */
  function toggleWindow(forceShow = false) {
    if (window.isDestroyed()) window = createWindow(url)

    if (!forceShow && window.isVisible() && window.isFocused()) {
      window.hide()
      return
    }

    window.show()
    window.focus()
  }

  const tray = createTray({
    url,
    refreshSeconds,
    notifier,
    ...parseNotifyOptions(process.argv),
    onExportPdf: () => { toggleWindow(true); return exporter.toPdf() },
    onToggleWindow: toggleWindow,
    onQuit: () => {
      isQuitting = true
      app.quit()
    },
  })

  // 알림이 이 기기에서 실제로 뜨는지 확인하는 용도.
  // macOS 는 조용히 거부하므로 결과를 반드시 보고한다.
  if (process.argv.includes('--notify-test')) {
    tray.testNotification()
    setTimeout(() => {
      const { lastError, delivered } = tray.notificationStatus()
      console.log(
        lastError
          ? `알림 실패: ${lastError}\n시스템 설정 > 알림에서 Stoker 를 허용해 주세요.`
          : `알림 정상 (${delivered}건 전달)`,
      )
    }, NOTIFY_TEST_REPORT_MS)
  }

  app.on('before-quit', () => {
    isQuitting = true
    tray.destroy()
  })

  app.on('activate', () => toggleWindow(true))
}

// 창을 닫아도 메뉴바에 남아야 하므로 여기서 종료하지 않는다.

main().catch((error) => {
  console.error(`대시보드를 띄우지 못했습니다: ${error.message}`)
  app.exit(1)
})
