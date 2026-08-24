import {
  MODEL_TIERS,
  TIER_KEYWORDS,
  DEFAULT_TIER,
  CACHE_WRITE_5M_MULTIPLIER,
  CACHE_WRITE_1H_MULTIPLIER,
  CACHE_READ_MULTIPLIER,
  TOKENS_PER_MILLION,
} from './constants.js'

/**
 * 모델 ID 로부터 요금 티어를 찾는다. 모르는 모델은 기본 티어로 추정하고
 * isEstimated 로 표시해 대시보드에서 "추정치"임을 드러낸다.
 */
export function resolveTier(model) {
  const id = typeof model === 'string' ? model.toLowerCase() : ''
  const matched = TIER_KEYWORDS.find(([keyword]) => id.includes(keyword))

  if (!matched) {
    return { id: DEFAULT_TIER, ...MODEL_TIERS[DEFAULT_TIER], isEstimated: true }
  }

  const tierId = matched[1]
  const tier = MODEL_TIERS[tierId]
  return { id: tierId, ...tier, isEstimated: Boolean(tier.isEstimated) }
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
  const tier = resolveTier(model)

  return (
    priceFor(usage.inputTokens, tier.input) +
    priceFor(usage.outputTokens, tier.output) +
    priceFor(usage.cacheWrite5mTokens, tier.input * CACHE_WRITE_5M_MULTIPLIER) +
    priceFor(usage.cacheWrite1hTokens, tier.input * CACHE_WRITE_1H_MULTIPLIER) +
    priceFor(usage.cacheReadTokens, tier.input * CACHE_READ_MULTIPLIER)
  )
}

/**
 * 캐시 읽기를 매번 새 input 으로 냈다면 추가로 들었을 금액.
 * "캐시 덕분에 아낀 돈" 을 보여주기 위한 값이다.
 */
export function calculateCacheSavings(usage, model) {
  const tier = resolveTier(model)
  return priceFor(usage.cacheReadTokens, tier.input * (1 - CACHE_READ_MULTIPLIER))
}

/** 토큰 종류별로 비용을 나눈다. 합은 calculateCost 와 같다. */
export function calculateCostBreakdown(usage, model) {
  const tier = resolveTier(model)

  return {
    inputCost: priceFor(usage.inputTokens, tier.input),
    outputCost: priceFor(usage.outputTokens, tier.output),
    cacheWrite5mCost: priceFor(usage.cacheWrite5mTokens, tier.input * CACHE_WRITE_5M_MULTIPLIER),
    cacheWrite1hCost: priceFor(usage.cacheWrite1hTokens, tier.input * CACHE_WRITE_1H_MULTIPLIER),
    cacheReadCost: priceFor(usage.cacheReadTokens, tier.input * CACHE_READ_MULTIPLIER),
  }
}
