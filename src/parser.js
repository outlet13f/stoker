import { calculateCost, calculateCacheSavings, calculateCostBreakdown } from './pricing.js'

/** 중복 집계를 막기 위한 키. 같은 응답이 여러 트랜스크립트에 복제될 수 있다. */
export function buildDedupeKey({ messageId, requestId }) {
  return `${messageId ?? 'no-msg'}:${requestId ?? 'no-req'}`
}

function toNumber(value) {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0
}

/**
 * cache_creation 상세가 없는 구버전 로그는 총 캐시 쓰기를 5분 캐시로 간주한다.
 * (5분 캐시가 기본값이므로 과대 청구를 피하는 보수적 선택)
 */
function splitCacheWrites(usage) {
  const detail = usage.cache_creation
  const total = toNumber(usage.cache_creation_input_tokens)

  if (!detail) return { cacheWrite5mTokens: total, cacheWrite1hTokens: 0 }

  return {
    cacheWrite5mTokens: toNumber(detail.ephemeral_5m_input_tokens),
    cacheWrite1hTokens: toNumber(detail.ephemeral_1h_input_tokens),
  }
}

/**
 * JSONL 한 줄을 사용량 레코드로 변환한다.
 * 사용량이 없거나 형식이 깨진 줄은 null 을 반환한다(파싱은 절대 던지지 않는다).
 */
export function parseLine(line) {
  if (!line || !line.trim()) return null

  let entry
  try {
    entry = JSON.parse(line)
  } catch {
    return null
  }

  const usage = entry?.message?.usage
  if (!usage) return null

  const timestamp = Date.parse(entry.timestamp ?? '')
  if (Number.isNaN(timestamp)) return null

  const model = entry.message.model ?? 'unknown'
  const { cacheWrite5mTokens, cacheWrite1hTokens } = splitCacheWrites(usage)

  const tokens = {
    inputTokens: toNumber(usage.input_tokens),
    outputTokens: toNumber(usage.output_tokens),
    cacheReadTokens: toNumber(usage.cache_read_input_tokens),
    cacheWrite5mTokens,
    cacheWrite1hTokens,
  }

  return {
    ...tokens,
    ...calculateCostBreakdown(tokens, model),
    thinkingTokens: toNumber(usage.output_tokens_details?.thinking_tokens),
    timestamp,
    model,
    sessionId: entry.sessionId ?? entry.session_id ?? 'unknown',
    cwd: entry.cwd ?? null,
    gitBranch: entry.gitBranch ?? null,
    version: entry.version ?? null,
    effort: entry.effort ?? null,
    isSidechain: Boolean(entry.isSidechain),
    dedupeKey: buildDedupeKey({ messageId: entry.message.id, requestId: entry.requestId }),
    cost: calculateCost(tokens, model),
    cacheSavings: calculateCacheSavings(tokens, model),
  }
}
