const { execFileSync } = require('node:child_process')
const path = require('node:path')

/**
 * macOS 빌드에 애드혹 서명을 붙인다.
 *
 * 서명이 없으면 번들 식별자가 'Electron' 으로 남아 UserNotifications 가
 * 알림을 거부한다(UNErrorDomain 오류 1). 애드혹 서명만으로도 식별자가
 * appId 로 잡혀 로컬 알림이 정상 동작한다 — 실측으로 확인했다.
 *
 * 배포용 공증(notarization)은 Developer ID 인증서가 있어야 하고 이것과는 별개다.
 */
exports.default = async function adhocSign(context) {
  if (context.electronPlatformName !== 'darwin') return

  const appName = `${context.packager.appInfo.productFilename}.app`
  const appPath = path.join(context.appOutDir, appName)

  execFileSync('codesign', ['--force', '--deep', '--sign', '-', appPath], { stdio: 'inherit' })
  console.log(`애드혹 서명 완료: ${appName}`)
}
