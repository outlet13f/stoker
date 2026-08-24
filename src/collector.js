import fs from 'node:fs'
import readline from 'node:readline'
import { CLAUDE_PROJECTS_DIR } from './constants.js'
import { listTranscripts } from './scanner.js'
import { parseLine } from './parser.js'
import { dedupeRecords } from './aggregate.js'
import { parseEditLine, dedupeEdits } from './edits.js'
import { mapWithLimit } from './concurrency.js'
import { MAX_OPEN_TRANSCRIPTS } from './constants.js'

/** 파일에서 온 레코드에 프로젝트·출처 라벨을 붙인다 */
function labelled(record, file) {
  return {
    ...record,
    project: record.cwd ?? file.projectLabel,
    projectLabel: file.projectLabel,
    sourceKind: file.sourceKind,
    parentSessionId: file.parentSessionId,
  }
}

/**
 * 한 파일을 스트리밍으로 읽어 사용량 레코드와 코드 변경 레코드를 뽑는다
 * (622MB 전체를 메모리에 올리지 않음). 한 줄은 둘 중 하나에만 해당한다.
 */
async function readFileRecords(file) {
  const records = []
  const edits = []
  const stream = fs.createReadStream(file.path, { encoding: 'utf8' })
  const lines = readline.createInterface({ input: stream, crlfDelay: Infinity })

  try {
    for await (const line of lines) {
      const record = parseLine(line)
      if (record) {
        records.push(labelled(record, file))
        continue
      }

      const edit = parseEditLine(line)
      if (edit) edits.push(labelled(edit, file))
    }
  } catch (error) {
    // 한 파일이 깨져도 전체 집계는 계속되어야 한다
    return { records: [], edits: [], error: `${file.path}: ${error.message}` }
  } finally {
    lines.close()
    stream.destroy()
  }

  return { records, edits, error: null }
}

/**
 * 파일 단위 캐시를 들고 있는 수집기.
 * 크기와 수정시각이 그대로인 파일은 다시 파싱하지 않으므로
 * 주기적 새로고침이 저렴하다.
 */
export function createCollector({ root = CLAUDE_PROJECTS_DIR } = {}) {
  const cache = new Map()

  async function collect() {
    const startedAt = Date.now()
    const files = await listTranscripts(root)
    const errors = []
    let reparsedFiles = 0

    const perFile = await mapWithLimit(files, MAX_OPEN_TRANSCRIPTS, async (file) => {
      const cached = cache.get(file.path)
      if (cached && cached.size === file.size && cached.mtimeMs === file.mtimeMs) {
        return cached.parsed
      }

      const { records, edits, error } = await readFileRecords(file)
      if (error) errors.push(error)

      reparsedFiles += 1
      const parsed = { records, edits }
      cache.set(file.path, { size: file.size, mtimeMs: file.mtimeMs, parsed })
      return parsed
    })

    // 사라진 파일은 캐시에서도 지운다
    const livePaths = new Set(files.map((file) => file.path))
    for (const key of cache.keys()) {
      if (!livePaths.has(key)) cache.delete(key)
    }

    const records = dedupeRecords(perFile.flatMap((parsed) => parsed.records))
    const edits = dedupeEdits(perFile.flatMap((parsed) => parsed.edits))

    return {
      records,
      edits,
      stats: {
        fileCount: files.length,
        reparsedFiles,
        recordCount: records.length,
        editCount: edits.length,
        durationMs: Date.now() - startedAt,
        errors,
      },
    }
  }

  return { collect }
}
