import { buildDayWindow, toDateKey } from './timezone.js'

/**
 * 코드 변경량 집계. Claude Code 관리자 화면의 lines added/removed 와 같은 지표를
 * 로컬 트랜스크립트에서 직접 뽑는다.
 *
 * 출처는 Edit/Write 툴의 결과 레코드(`type: "user"` + `tool_result`)다.
 *   - Edit  : toolUseResult.structuredPatch 에 unified diff hunk 가 들어온다
 *   - Write : 새 파일이면 patch 가 비고 content 에 전문이 들어온다
 */

/** hunk 본문에서 +/- 로 시작하는 줄만 센다(맥락 줄과 no-newline 표시는 제외) */
function countPatchLines(structuredPatch) {
  let added = 0
  let removed = 0

  for (const hunk of structuredPatch) {
    for (const line of hunk?.lines ?? []) {
      if (typeof line !== 'string') continue
      if (line.startsWith('+')) added += 1
      else if (line.startsWith('-')) removed += 1
    }
  }

  return { added, removed }
}

/** 파일 전문의 줄 수. 끝의 개행 하나가 빈 줄로 세어지지 않게 한다. */
function countContentLines(content) {
  if (typeof content !== 'string' || content === '') return 0

  const lines = content.split('\n')
  if (lines.at(-1) === '') lines.pop()
  return lines.length
}

/**
 * JSONL 한 줄을 코드 변경 레코드로 바꾼다.
 * 파일을 건드리지 않은 줄은 null 을 반환한다(파싱은 절대 던지지 않는다).
 */
export function parseEditLine(line) {
  if (!line || !line.trim()) return null

  let entry
  try {
    entry = JSON.parse(line)
  } catch {
    return null
  }

  const result = entry?.toolUseResult
  if (!result || typeof result !== 'object') return null
  if (typeof result.filePath !== 'string') return null

  const patch = Array.isArray(result.structuredPatch) ? result.structuredPatch : []
  const isCreate = result.type === 'create'

  // 새 파일 생성은 patch 가 비므로 content 전문을 추가 줄로 센다
  const { added, removed } =
    patch.length === 0 && isCreate
      ? { added: countContentLines(result.content), removed: 0 }
      : countPatchLines(patch)

  const timestamp = Date.parse(entry.timestamp ?? '')
  if (Number.isNaN(timestamp)) return null

  return {
    linesAdded: added,
    linesRemoved: removed,
    filePath: result.filePath,
    isCreate,
    timestamp,
    sessionId: entry.sessionId ?? entry.session_id ?? 'unknown',
    cwd: entry.cwd ?? null,
    gitBranch: entry.gitBranch ?? null,
    isSidechain: Boolean(entry.isSidechain),
    dedupeKey: entry.uuid ?? `${result.filePath}:${timestamp}`,
  }
}

/** 같은 편집이 여러 트랜스크립트에 복제되는 경우를 제거한다 */
export function dedupeEdits(edits) {
  const seen = new Set()

  return edits.filter((edit) => {
    if (seen.has(edit.dedupeKey)) return false
    seen.add(edit.dedupeKey)
    return true
  })
}

/** 합계와 함께 건드린 파일 수를 센다 */
export function sumEdits(edits) {
  const files = new Set()
  let linesAdded = 0
  let linesRemoved = 0

  for (const edit of edits) {
    linesAdded += edit.linesAdded
    linesRemoved += edit.linesRemoved
    files.add(edit.filePath)
  }

  return {
    linesAdded,
    linesRemoved,
    linesNet: linesAdded - linesRemoved,
    edits: edits.length,
    files: files.size,
  }
}

/** 최근 days 일의 코드 변경 시계열. 변경이 없는 날도 0 으로 채운다. */
export function buildEditDailySeries(edits, { days, now = Date.now(), timeZone }) {
  const { offsetMs, keys } = buildDayWindow({ days, now, timeZone })
  const buckets = new Map(keys.map((key) => [key, []]))

  for (const edit of edits) {
    const bucket = buckets.get(toDateKey(edit.timestamp, offsetMs))
    if (bucket) bucket.push(edit)
  }

  return keys.map((date) => ({ date, ...sumEdits(buckets.get(date)) }))
}

/** keyFn 으로 묶어 변경 줄 수(추가+삭제) 내림차순으로 정렬한다 */
export function groupEditsBy(edits, keyFn) {
  const buckets = new Map()

  for (const edit of edits) {
    const key = keyFn(edit)
    const bucket = buckets.get(key) ?? []
    bucket.push(edit)
    buckets.set(key, bucket)
  }

  return [...buckets.entries()]
    .map(([key, group]) => ({ key, ...sumEdits(group) }))
    .sort((a, b) => b.linesAdded + b.linesRemoved - (a.linesAdded + a.linesRemoved))
}
