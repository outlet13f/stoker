/**
 * 기본 브라우저로 열 명령을 고른다. execFile 을 부르지 않으므로 그대로 테스트한다.
 *
 * Windows 에서 start 를 쓰지 않는다. start 는 실행 파일이 아니라 cmd 빌트인이라
 * execFile 로는 부를 수 없고, cmd 를 거치면 cmd 가 argv 를 나누기 **전에**
 * & ^ % 를 자기 문법으로 먼저 읽는다. `--out "C:\R&D\dash.html"` 같은 평범한
 * 경로가 두 개의 명령으로 쪼개진다. rundll32 는 보통의 실행 파일이라 그 단계가
 * 없고, http 주소와 로컬 파일 경로를 모두 기본 프로그램으로 넘긴다.
 */
export function openCommand(platform, target) {
  if (platform === 'darwin') return { command: 'open', args: [target] }
  if (platform === 'win32') return { command: 'rundll32', args: ['url.dll,FileProtocolHandler', target] }
  return { command: 'xdg-open', args: [target] }
}
