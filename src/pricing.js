import {
  MODEL_PRICES,
  SYNTHETIC_PRICE,
  FALLBACK_FAMILY,
  CACHE_WRITE_5M_MULTIPLIER,
  CACHE_WRITE_1H_MULTIPLIER,
  CACHE_READ_MULTIPLIER,
  TOKENS_PER_MILLION,
} from './constants.js'

/**
 * 현행 모델 ID: claude-opus-4-8, claude-haiku-4-5-20251001, claude-sonnet-5
 * 버전 뒤에 오는 것은 문서 끝이거나 다음 하이픈이어야 한다. 그렇지 않으면
 * claude-3-5-sonnet-20240620 의 날짜(20240620)를 버전으로 오해한다.
 */
const CURRENT_ID = /(opus|sonnet|haiku|fable|mythos)-(\d{1,2})(?:-(\d{1,2}))?(?=-\d{8}|-|$)/

/** 구형 모델 ID: claude-3-5-sonnet-20240620, claude-3-opus-20240229 */
const LEGACY_ID = /(\d{1,2})(?:-(\d{1,2}))?-(opus|sonnet|haiku)/

function toVersion(major, minor) {
  return minor === undefined ? Number(major) : Number(`${major}.${minor}`)
}

/** 모델 ID 에서 계열과 버전을 뽑는다. 알아볼 수 없으면 둘 다 null. */
export function parseModelId(model) {
  const id = typeof model === 'string' ? model.toLowerCase() : ''
  if (id.includes('synthetic')) return { family: 'synthetic', version: null }

  const current = CURRENT_ID.exec(id)
  if (current) return { family: current[1], version: toVersion(current[2], current[3]) }

  const legacy = LEGACY_ID.exec(id)
  if (legacy) return { family: legacy[3], version: toVersion(legacy[1], legacy[2]) }

  return { family: null, version: null }
}

/** 캐시 단가는 input 단가의 배수다. 미리 풀어 두면 대시보드가 계산하지 않아도 된다. */
function withCacheRates(price, isEstimated) {
  return {
    family: price.family,
    version: price.version,
    label: price.label,
    input: price.input,
    output: price.output,
    cacheWrite5m: price.input * CACHE_WRITE_5M_MULTIPLIER,
    cacheWrite1h: price.input * CACHE_WRITE_1H_MULTIPLIER,
    cacheRead: price.input * CACHE_READ_MULTIPLIER,
    isEstimated,
  }
}

/**
 * 모델 ID 로부터 단가를 찾는다.
 * 정확히 아는 모델이면 isEstimated=false, 계열만 알거나 아무것도 모르면 true 로
 * 표시해 대시보드에서 "추정치"임을 드러낸다.
 */
export function resolveModelPrice(model) {
  const { family, version } = parseModelId(model)

  if (family === 'synthetic') return withCacheRates(SYNTHETIC_PRICE, false)

  const inFamily = MODEL_PRICES.filter((price) => price.family === family)

  if (inFamily.length === 0) {
    const fallback = MODEL_PRICES.find((price) => price.family === FALLBACK_FAMILY)
    return withCacheRates(fallback, true)
  }

  const exact = inFamily.find((price) => price.version === version)
  if (exact) return withCacheRates(exact, false)

  // 모르는 버전은 같은 계열에서 그 아래로 가장 가까운 단가로 추정한다.
  // 새 버전이면 가장 최신 단가가 잡히고, 아주 오래된 버전이면 가장 낮은 것이 잡힌다.
  const newestFirst = [...inFamily].sort((a, b) => b.version - a.version)
  const nearest = newestFirst.find((price) => price.version <= version) ?? newestFirst.at(-1)

  return withCacheRates(nearest, true)
}

/** 100만 토큰 단가를 실제 토큰 수에 적용한다 */
function priceFor(tokens, ratePerMillion) {
  return ((tokens || 0) / TOKENS_PER_MILLION) * ratePerMillion
}

/**
 * 한 요청의 USD 비용을 계산한다.
 * 공개 API 단가 기준이므로 구독 요금제에서는 환산 참고값이다.
 */
export function calculateCost(usage, model) {
  const price = resolveModelPrice(model)

  return (
    priceFor(usage.inputTokens, price.input) +
    priceFor(usage.outputTokens, price.output) +
    priceFor(usage.cacheWrite5mTokens, price.cacheWrite5m) +
    priceFor(usage.cacheWrite1hTokens, price.cacheWrite1h) +
    priceFor(usage.cacheReadTokens, price.cacheRead)
  )
}

/**
 * 캐시 읽기를 매번 새 input 으로 냈다면 추가로 들었을 금액.
 * "캐시 덕분에 아낀 돈" 을 보여주기 위한 값이다.
 */
export function calculateCacheSavings(usage, model) {
  const price = resolveModelPrice(model)
  return priceFor(usage.cacheReadTokens, price.input - price.cacheRead)
}

/** 토큰 종류별로 비용을 나눈다. 합은 calculateCost 와 같다. */
export function calculateCostBreakdown(usage, model) {
  const price = resolveModelPrice(model)

  return {
    inputCost: priceFor(usage.inputTokens, price.input),
    outputCost: priceFor(usage.outputTokens, price.output),
    cacheWrite5mCost: priceFor(usage.cacheWrite5mTokens, price.cacheWrite5m),
    cacheWrite1hCost: priceFor(usage.cacheWrite1hTokens, price.cacheWrite1h),
    cacheReadCost: priceFor(usage.cacheReadTokens, price.cacheRead),
  }
}
