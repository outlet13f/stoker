const UNKNOWN_LABEL = '알 수 없음'

/**
 * 프로젝트 경로에서 표시용 이름과 상위 폴더를 뽑는다.
 * 이름이 같은 프로젝트가 여러 경로에 있을 수 있어 상위 폴더로 구분한다.
 */
export function describeProjectPath(fullPath) {
  const segments = String(fullPath ?? '').split('/').filter(Boolean)

  if (segments.length === 0) return { label: UNKNOWN_LABEL, parent: '' }

  return {
    label: segments.at(-1),
    parent: segments.length > 1 ? segments.at(-2) : '',
  }
}
