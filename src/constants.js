import os from 'node:os'
import path from 'node:path'

/** Claude Code 가 세션 트랜스크립트(JSONL)를 저장하는 위치 */
export const CLAUDE_PROJECTS_DIR = path.join(os.homedir(), '.claude', 'projects')

/** 사용 한도가 리셋되는 롤링 블록 길이(시간) */
export const BLOCK_DURATION_HOURS = 5
export const WEEKLY_WINDOW_DAYS = 7
export const MS_PER_HOUR = 60 * 60 * 1000
export const MS_PER_DAY = 24 * MS_PER_HOUR

/** 블록에 마지막 활동 후 이 시간 안이면 "진행 중"으로 본다 */
export const ACTIVE_BLOCK_GRACE_MS = BLOCK_DURATION_HOURS * MS_PER_HOUR

/** 캐시 요금은 input 요금의 배수로 책정된다 */
export const CACHE_WRITE_5M_MULTIPLIER = 1.25
export const CACHE_WRITE_1H_MULTIPLIER = 2
export const CACHE_READ_MULTIPLIER = 0.1

export const TOKENS_PER_MILLION = 1_000_000

/**
 * 100만 토큰당 USD 단가. 공개 API 가격 기준이며 구독 요금제 사용자에게는
 * "API 로 환산했을 때의 참고값"이다.
 */
export const MODEL_TIERS = {
  opus: { label: 'Opus', input: 15, output: 75 },
  sonnet: { label: 'Sonnet', input: 3, output: 15 },
  haiku: { label: 'Haiku', input: 1, output: 5 },
  fable: { label: 'Fable', input: 3, output: 15, isEstimated: true },
  synthetic: { label: 'Synthetic', input: 0, output: 0 },
}

/** 모델 ID 안에서 이 키워드를 찾아 티어를 결정한다(먼저 매칭되는 순서대로) */
export const TIER_KEYWORDS = [
  ['opus', 'opus'],
  ['sonnet', 'sonnet'],
  ['haiku', 'haiku'],
  ['fable', 'fable'],
  ['synthetic', 'synthetic'],
]

export const DEFAULT_TIER = 'sonnet'

/** 대시보드 기본값 */
export const DEFAULT_PORT = 7331
export const DEFAULT_REFRESH_SECONDS = 30
export const DEFAULT_RANGE_DAYS = 30
export const TOP_N_PROJECTS = 12
export const TOP_N_SESSIONS = 10
export const HEATMAP_HOURS = 24

/** 대시보드에서 고를 수 있는 기간(일). 'all' 은 첫 활동일까지 늘어난다. */
export const RANGE_PRESETS = [7, 30, 90]

/** 진행 중 블록의 예상 소진량을 과거 블록 분포와 비교할 때의 경계 */
export const BURN_WARN_PERCENTILE = 0.5
export const BURN_CRIT_PERCENTILE = 0.9

/** 진행 중 블록 계기판의 눈금 개수(5시간 / 60 = 5분당 1눈금) */
export const BLOCK_TICKS = 60

/** 동시에 열어 두는 트랜스크립트 파일 수 상한(파일 디스크립터 고갈 방지) */
export const MAX_OPEN_TRANSCRIPTS = 24
