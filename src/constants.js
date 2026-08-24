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
 * 모델별 100만 토큰당 USD 단가. 출처:
 * https://platform.claude.com/docs/ko/about-claude/pricing
 *
 * 같은 계열 안에서도 버전에 따라 단가가 다르다(Opus 4.1 은 $15, Opus 4.5 부터 $5).
 * 그래서 계열 키워드만으로는 값을 정할 수 없고 버전까지 봐야 한다.
 */
export const MODEL_PRICES = [
  { family: 'fable', version: 5, label: 'Fable 5', input: 10, output: 50 },
  { family: 'mythos', version: 5, label: 'Mythos 5', input: 10, output: 50 },
  { family: 'opus', version: 5, label: 'Opus 5', input: 5, output: 25 },
  { family: 'opus', version: 4.8, label: 'Opus 4.8', input: 5, output: 25 },
  { family: 'opus', version: 4.7, label: 'Opus 4.7', input: 5, output: 25 },
  { family: 'opus', version: 4.6, label: 'Opus 4.6', input: 5, output: 25 },
  { family: 'opus', version: 4.5, label: 'Opus 4.5', input: 5, output: 25 },
  { family: 'opus', version: 4.1, label: 'Opus 4.1', input: 15, output: 75 },
  { family: 'opus', version: 4, label: 'Opus 4', input: 15, output: 75 },
  { family: 'sonnet', version: 5, label: 'Sonnet 5', input: 2, output: 10 },
  { family: 'sonnet', version: 4.6, label: 'Sonnet 4.6', input: 3, output: 15 },
  { family: 'sonnet', version: 4.5, label: 'Sonnet 4.5', input: 3, output: 15 },
  { family: 'sonnet', version: 4, label: 'Sonnet 4', input: 3, output: 15 },
  { family: 'haiku', version: 4.5, label: 'Haiku 4.5', input: 1, output: 5 },
  { family: 'haiku', version: 3.5, label: 'Haiku 3.5', input: 0.8, output: 4 },
]

/** Claude Code 내부 합성 메시지. 청구 대상이 아니다. */
export const SYNTHETIC_PRICE = { family: 'synthetic', version: null, label: 'Synthetic', input: 0, output: 0 }

/** 처음 보는 계열은 현행 Sonnet 단가로 추정한다 */
export const FALLBACK_FAMILY = 'sonnet'

/** 대시보드 기본값 */
export const DEFAULT_PORT = 7331
export const DEFAULT_REFRESH_SECONDS = 30

/**
 * 갱신 주기의 허용 범위(초). 하한은 수집기를 두드리지 않을 만큼,
 * 상한은 "켜 뒀는데 안 도는" 오해가 없을 만큼으로 잡았다. 0 은 자동 갱신 끔.
 */
export const MIN_REFRESH_SECONDS = 5
export const MAX_REFRESH_SECONDS = 3600

/** 대시보드에서 고를 수 있는 주기(초). 0 은 '멈춤'. */
export const REFRESH_CHOICES = [0, 5, 10, 30, 60, 300]
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
