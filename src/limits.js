import fs from 'node:fs/promises'
import { CLAUDE_CONFIG_FILE } from './constants.js'

/**
 * 계정의 실제 사용 한도(퍼센트). Claude Code 가 서버에서 받아 ~/.claude.json 의
 * cachedUsageUtilization 에 캐시해 둔 값을 읽는다.
 *
 * 트랜스크립트로는 구할 수 없는 값이다. 트랜스크립트에는 토큰 수만 있고
 * 계정 한도와 그 환산 방식은 서버가 갖고 있다.
 *
 * 중요: 이것은 캐시다. Claude Code 가 마지막으로 받아온 시점의 값이므로
 * 오래된 값을 그대로 보여주면 "아직 여유 있다"는 오해를 만든다. 그래서
 * 받아온 시각과 신선도를 함께 돌려주고 화면에서도 같이 표시한다.
 */

/** 세션 한도는 빠르게 움직인다. 이보다 오래된 값은 참고용으로만 본다. */
export const STALE_AFTER_MS = 15 * 60 * 1000

const PERCENT_MIN = 0
const PERCENT_MAX = 100

/** 아는 한도 종류의 표기. 모르는 종류는 이름을 지어내지 않고 원문을 쓴다. */
const KIND_LABELS = {
  session: '현재 세션',
  weekly_all: '주간 · 모든 모델',
}

function labelFor(entry) {
  if (entry.kind === 'weekly_scoped') {
    const scoped = entry.scope?.model?.display_name
    return scoped ? `주간 · ${scoped}` : '주간 · 일부 모델'
  }

  return KIND_LABELS[entry.kind] ?? String(entry.kind ?? '알 수 없는 한도')
}

function toPercent(value) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null
  return Math.min(PERCENT_MAX, Math.max(PERCENT_MIN, Math.round(value)))
}

function toTimestamp(value) {
  const parsed = Date.parse(value ?? '')
  return Number.isNaN(parsed) ? null : parsed
}

/** 외부에서 온 데이터이므로 필드마다 검증한다. 못 믿을 항목은 버린다. */
function normalise(entry) {
  if (!entry || typeof entry !== 'object') return null

  const percent = toPercent(entry.percent)
  if (percent === null) return null

  return {
    kind: entry.kind ?? null,
    group: entry.group ?? null,
    label: labelFor(entry),
    percent,
    severity: entry.severity ?? 'normal',
    resetsAt: toTimestamp(entry.resets_at),
    isActive: Boolean(entry.is_active),
  }
}

/**
 * 캐시된 한도를 읽는다. 파일이 없거나 깨졌거나 캐시가 없으면 null.
 * accountUuid 처럼 계정을 특정하는 값은 일부러 담지 않는다(리포트는 공유될 수 있다).
 */
export async function readUsageLimits({ configPath = CLAUDE_CONFIG_FILE, now = Date.now() } = {}) {
  let cached
  try {
    const raw = await fs.readFile(configPath, 'utf8')
    cached = JSON.parse(raw)?.cachedUsageUtilization
  } catch {
    // 설정 파일이 없거나 읽을 수 없어도 대시보드는 계속 떠야 한다
    return null
  }

  if (!cached || typeof cached !== 'object') return null

  const source = Array.isArray(cached.utilization?.limits) ? cached.utilization.limits : []
  const fetchedAt = typeof cached.fetchedAtMs === 'number' ? cached.fetchedAtMs : null
  const ageMs = fetchedAt === null ? null : Math.max(0, now - fetchedAt)

  return {
    fetchedAt,
    ageMs,
    isStale: ageMs === null || ageMs > STALE_AFTER_MS,
    entries: source.map(normalise).filter(Boolean),
  }
}
