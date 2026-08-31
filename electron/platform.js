import { LIGHT_TOKENS, DARK_TOKENS } from '../src/render/theme.js'

/**
 * OS 마다 갈리는 값들. Electron 을 import 하지 않으므로 그대로 테스트한다.
 *
 * 이 값들을 main.js·tray.js 안에서 `process.platform` 으로 바로 갈랐더니
 * 모듈을 읽는 순간 고정돼 버려서, macOS 에서 돌리는 테스트로는 Windows 쪽
 * 갈래를 한 번도 밟아 볼 수 없었다.
 */

/**
 * 검정 + 알파(템플릿) 아이콘은 macOS 만 메뉴바 명암에 맞춰 반전한다.
 * 다른 OS 는 그 처리가 없어 어두운 작업표시줄에서 아이콘이 사라진다.
 */
export function trayIconFile(platform) {
  return platform === 'darwin' ? 'trayTemplate.png' : 'trayColor.png'
}

/** 알림이 막혔을 때 어디를 열어야 하는지 */
export function notifySettingsHint(platform) {
  return platform === 'win32'
    ? '설정 > 시스템 > 알림에서 Stoker 를 허용해 주세요.'
    : '시스템 설정 > 알림에서 Stoker 를 허용해 주세요.'
}

/**
 * 창이 첫 페인트 전에 칠할 색. 팔레트에서 직접 가져온다 —
 * 색을 따로 적어 두면 테마를 바꿀 때 여기만 남아 없는 색이 번쩍인다.
 */
export function windowBackground(isDark) {
  return isDark ? DARK_TOKENS.bg : LIGHT_TOKENS.bg
}
