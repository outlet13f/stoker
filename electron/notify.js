import { Notification } from 'electron'

/**
 * 알림을 실제로 띄운다. 무엇을 알릴지는 alerts.js 가 정하고 여기서는 띄우기만
 * 한다 — 그래서 결정 로직을 Electron 없이 테스트할 수 있다.
 *
 * macOS 는 알림을 **조용히 거부한다**. 서명되지 않았거나 사용자가 시스템 설정에서
 * 껐으면 show() 는 성공한 것처럼 돌아가고 'failed' 이벤트만 온다(UNErrorDomain 1).
 * 그대로 두면 "알림이 켜져 있는데 안 온다" 를 알 방법이 없으므로 실패를 기록해
 * 트레이 메뉴에 드러낸다.
 */
const SAMPLE = {
  title: 'Stoker 알림 확인',
  body: '이 알림이 보이면 정상입니다',
}

export function createNotifier({ onActivate } = {}) {
  let lastError = null
  let delivered = 0

  function send({ title, body }) {
    if (!Notification.isSupported()) {
      lastError = '이 시스템은 알림을 지원하지 않습니다'
      return
    }

    const notification = new Notification({ title, body, silent: false })

    notification.on('failed', (_event, error) => {
      lastError = String(error ?? '알 수 없는 이유')
    })
    notification.on('show', () => {
      lastError = null
      delivered += 1
    })
    if (onActivate) notification.on('click', () => onActivate())

    notification.show()
  }

  return {
    show(alerts) {
      for (const alert of alerts) send(alert)
      return alerts.length
    },

    /** 사용자가 직접 확인할 수 있게 표본 하나를 띄운다 */
    test() {
      send(SAMPLE)
    },

    /** 마지막 실패 이유. 없으면 null. */
    status() {
      return { lastError, delivered }
    },
  }
}
