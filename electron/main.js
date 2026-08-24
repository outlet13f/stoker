import { app, BrowserWindow, shell, Menu } from 'electron'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { startServer } from '../src/server.js'
import { DEFAULT_REFRESH_SECONDS } from '../src/constants.js'

/**
 * 데스크톱 껍데기. 집계와 렌더는 기존 서버를 그대로 쓴다.
 * 포트 0 으로 띄워 OS 가 빈 포트를 고르게 하므로 이미 쓰는 포트와 부딪히지 않는다.
 */
const HERE = path.dirname(fileURLToPath(import.meta.url))

const WINDOW = { width: 1440, height: 940, minWidth: 720, minHeight: 560 }
const BACKGROUND = '#F5F3F0'

/** --refresh 10 처럼 CLI 로 준 값을 그대로 받는다 */
function parseRefreshSeconds(argv) {
  const index = argv.indexOf('--refresh')
  if (index === -1) return DEFAULT_REFRESH_SECONDS

  const value = Number(argv[index + 1])
  return Number.isFinite(value) && value >= 0 ? value : DEFAULT_REFRESH_SECONDS
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

/** 새로고침·확대·개발자도구만 남긴 최소 메뉴 */
function buildMenu(url) {
  return Menu.buildFromTemplate([
    ...(process.platform === 'darwin' ? [{ role: 'appMenu' }] : []),
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

  const { url } = await startServer({
    port: 0,
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    refreshSeconds: parseRefreshSeconds(process.argv),
  })

  Menu.setApplicationMenu(buildMenu(url))
  createWindow(url)

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow(url)
  })
}

app.on('window-all-closed', () => {
  // macOS 는 창을 닫아도 앱이 살아 있는 것이 관례지만, 이 앱은 창이 전부다.
  app.quit()
})

main().catch((error) => {
  console.error(`대시보드를 띄우지 못했습니다: ${error.message}`)
  app.exit(1)
})
