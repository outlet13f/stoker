import { redact } from './credentials.js'
import { USAGE_API_BASE_URL, USAGE_API_PATH, USAGE_API_TIMEOUT_MS } from './constants.js'

/**
 * 계정 한도를 서버에서 직접 받아온다.
 *
 * Claude Code 가 쓰는 것과 같은 엔드포인트다:
 *   GET {BASE_API_URL}/api/oauth/usage   Authorization: Bearer <OAuth 토큰>
 *
 * 공개 API 가 아니라 문서화되지 않은 내부 엔드포인트다. 응답 형태가 바뀌면
 * 조용히 틀린 값을 보여주는 것이 가장 나쁘므로, 스키마를 검증해 통과하지
 * 못하면 던진다. 호출한 쪽은 캐시 값으로 되돌아간다.
 */

/** 사용자가 무엇을 하면 되는지까지 알려 준다 */
const EXPIRED_MESSAGE = 'OAuth 토큰이 만료됐습니다 — Claude Code 를 한 번 실행하면 갱신됩니다'

/** Retry-After 는 초 단위 정수로 온다. 못 읽으면 null. */
function parseRetryAfter(value) {
  const seconds = Number(value)
  return Number.isFinite(seconds) && seconds > 0 ? seconds * 1000 : null
}

/** 에러 문구에 토큰이나 헤더가 섞이지 않도록 한 겹 감싼다 */
function sanitised(message, credentials) {
  return new Error(redact(message, credentials))
}

/** 우리가 읽을 수 있는 항목인지. percent 가 숫자여야 화면에 그릴 수 있다. */
function isReadableEntry(entry) {
  return Boolean(entry) && typeof entry === 'object' && Number.isFinite(Number(entry.percent))
}

function assertUsableShape(payload) {
  if (!payload || typeof payload !== 'object') {
    throw new Error('응답이 객체가 아닙니다')
  }

  // Claude Code 가 읽는 것과 같은 자리. 없으면 우리가 아는 형태가 아니다.
  const limits = payload.limits ?? payload.utilization?.limits
  if (!Array.isArray(limits)) {
    throw new Error('응답에 limits 배열이 없습니다')
  }

  // 빈 배열은 "한도가 없음" 이라 정상이다. 그러나 항목이 있는데 하나도 읽을 수
  // 없으면 필드 이름이 바뀐 것이다 — 통과시키면 "실시간 성공, 항목 0개" 가 되어
  // 화면에는 아무것도 안 나오면서 실시간인 줄 오해한다.
  if (limits.length > 0 && !limits.some(isReadableEntry)) {
    throw new Error('limits 항목에서 percent 를 찾지 못했습니다')
  }

  return limits
}

/**
 * @returns {Promise<{ limits: unknown[], fetchedAt: number }>}
 * @throws 인증 실패·시간 초과·형태 불일치 시. 메시지에는 토큰이 남지 않는다.
 */
export async function fetchLiveUtilization({
  credentials,
  baseUrl = USAGE_API_BASE_URL,
  timeoutMs = USAGE_API_TIMEOUT_MS,
  fetchImpl = fetch,
  now = Date.now(),
} = {}) {
  const token = credentials?.accessToken
  if (typeof token !== 'string' || token.length === 0) {
    throw new Error('OAuth 토큰을 찾지 못했습니다')
  }

  // 이미 만료된 토큰으로 부르면 401 만 받는다. 갱신은 Claude Code 가 한다.
  if (typeof credentials.expiresAt === 'number' && credentials.expiresAt <= now) {
    throw new Error(EXPIRED_MESSAGE)
  }

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)

  let response
  try {
    response = await fetchImpl(`${baseUrl}${USAGE_API_PATH}`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache',
      },
      signal: controller.signal,
    })
  } catch (error) {
    const reason = error?.name === 'AbortError' ? `${timeoutMs}ms 안에 응답이 없었습니다` : error?.message
    throw sanitised(`한도 조회 실패: ${reason}`, credentials)
  } finally {
    clearTimeout(timer)
  }

  if (!response.ok) {
    // 401 은 토큰이 만료된 경우다. 갱신은 Claude Code 가 하므로 캐시로 되돌아간다.
    const error = sanitised(
      response.status === 401 ? EXPIRED_MESSAGE : `한도 조회 실패: HTTP ${response.status}`,
      credentials,
    )

    // 이 엔드포인트는 레이트 리밋이 있다. 서버가 알려주면 그만큼 쉰다.
    error.status = response.status
    error.retryAfterMs = parseRetryAfter(response.headers?.get?.('retry-after'))
    throw error
  }

  let payload
  try {
    payload = await response.json()
  } catch (error) {
    throw sanitised(`한도 응답을 읽지 못했습니다: ${error?.message}`, credentials)
  }

  try {
    return { limits: assertUsableShape(payload), fetchedAt: now }
  } catch (error) {
    throw sanitised(`한도 응답 형태가 다릅니다: ${error.message}`, credentials)
  }
}
