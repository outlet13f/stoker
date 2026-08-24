import { Tray, Menu, nativeImage, shell } from 'electron'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { trayTitle, trayTooltip, trayReadouts } from './label.js'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const ICON = path.join(HERE, '..', 'build', 'trayTemplate.png')

/** 메뉴바 갱신은 창보다 느려도 된다. 너무 잦으면 수집기를 두드린다. */
const MIN_POLL_SECONDS = 15
const IDLE_POLL_SECONDS = 60

function pollIntervalMs(refreshSeconds) {
  const seconds = Number(refreshSeconds) > 0 ? Number(refreshSeconds) : IDLE_POLL_SECONDS
  return Math.max(seconds, MIN_POLL_SECONDS) * 1000
}

/**
 * 메뉴바 상주. 창을 닫아도 여기서 현재 소진 상태를 계속 보여준다.
 * 수치는 창과 같은 /api/report 를 읽으므로 두 화면이 어긋나지 않는다.
 */
export function createTray({ url, refreshSeconds, onToggleWindow, onQuit }) {
  const image = nativeImage.createFromPath(ICON)
  // 템플릿 이미지로 표시하면 macOS 가 메뉴바 명암에 맞춰 자동으로 반전한다
  image.setTemplateImage(true)

  const tray = new Tray(image)
  let report = null
  let timer = null

  function render() {
    tray.setTitle(trayTitle(report))
    tray.setToolTip(trayTooltip(report))

    tray.setContextMenu(
      Menu.buildFromTemplate([
        ...trayReadouts(report).map((label) => ({ label, enabled: false })),
        { type: 'separator' },
        { label: '지금 갱신', click: () => void poll() },
        { label: '대시보드 열기', click: () => onToggleWindow(true) },
        { label: '브라우저에서 열기', click: () => shell.openExternal(url) },
        { type: 'separator' },
        { label: 'Stoker 종료', click: onQuit },
      ]),
    )
  }

  async function poll() {
    try {
      const response = await fetch(`${url}/api/report`, { cache: 'no-store' })
      if (!response.ok) throw new Error(`HTTP ${response.status}`)

      const payload = await response.json()
      // 메뉴바에는 전체 기간이 아니라 30일 기준을 쓴다(대시보드 기본값과 같다)
      report = payload.reports['30'] ?? Object.values(payload.reports)[0] ?? null
    } catch {
      // 한 번 실패해도 이전 값을 그대로 두고 다음 주기에 다시 시도한다
    }
    render()
  }

  // 아이콘을 그냥 클릭하면 창을 여닫는다(메뉴는 우클릭)
  tray.on('click', () => onToggleWindow())

  render()
  void poll()
  timer = setInterval(() => void poll(), pollIntervalMs(refreshSeconds))

  return {
    tray,
    refresh: poll,
    destroy() {
      if (timer) clearInterval(timer)
      timer = null
      tray.destroy()
    },
  }
}
