const UNKNOWN_LABEL = '알 수 없음'

/** C:\Users\me\app 또는 \\server\share\app 처럼 Windows 경로로 보이는가 */
const WINDOWS_PATH = /^(?:[A-Za-z]:[\\/]|\\\\)/

/** 구분자는 경로 모양을 보고 고른다 */
function separatorFor(fullPath) {
  return WINDOWS_PATH.test(fullPath) ? /[\\/]+/ : /\/+/
}

/**
 * 프로젝트 경로에서 표시용 이름과 상위 폴더를 뽑는다.
 * 이름이 같은 프로젝트가 여러 경로에 있을 수 있어 상위 폴더로 구분한다.
 *
 * 역슬래시를 무조건 구분자로 보지는 않는다. POSIX 에서 역슬래시는 정상적인
 * 파일명 글자라서, 그러면 멀쩡한 폴더 이름이 쪼개진다.
 */
export function describeProjectPath(fullPath) {
  const raw = String(fullPath ?? '')
  const segments = raw.split(separatorFor(raw)).filter(Boolean)

  if (segments.length === 0) return { label: UNKNOWN_LABEL, parent: '' }

  return {
    label: segments.at(-1),
    parent: segments.length > 1 ? segments.at(-2) : '',
  }
}
