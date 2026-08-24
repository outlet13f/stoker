import fs from 'node:fs'
import readline from 'node:readline'
import { CLAUDE_PROJECTS_DIR } from './constants.js'
import { listTranscripts } from './scanner.js'
import { parseLine } from './parser.js'
import { dedupeRecords } from './aggregate.js'
import { mapWithLimit } from './concurrency.js'
import { MAX_OPEN_TRANSCRIPTS } from './constants.js'

/** 한 파일을 스트리밍으로 읽어 사용량 레코드만 뽑는다(622MB 전체를 메모리에 올리지 않음) */
async function readFileRecords(file) {
  const records = []
  const stream = fs.createReadStream(file.path, { encoding: 'utf8' })
  const lines = readline.createInterface({ input: stream, crlfDelay: Infinity })

  try {
    for await (const line of lines) {
      const record = parseLine(line)
      if (!record) continue

      records.push({
        ...record,
        project: record.cwd ?? file.projectLabel,
        projectLabel: file.projectLabel,
        sourceKind: file.sourceKind,
        parentSessionId: file.parentSessionId,
      })
    }
  } catch (error) {
    // 한 파일이 깨져도 전체 집계는 계속되어야 한다
    return { records: [], error: `${file.path}: ${error.message}` }
  } finally {
    lines.close()
    stream.destroy()
  }

  return { records, error: null }
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
        return cached.records
      }

      const { records, error } = await readFileRecords(file)
      if (error) errors.push(error)

      reparsedFiles += 1
      cache.set(file.path, { size: file.size, mtimeMs: file.mtimeMs, records })
      return records
    })

    // 사라진 파일은 캐시에서도 지운다
    const livePaths = new Set(files.map((file) => file.path))
    for (const key of cache.keys()) {
      if (!livePaths.has(key)) cache.delete(key)
    }

    const records = dedupeRecords(perFile.flat())

    return {
      records,
      stats: {
        fileCount: files.length,
        reparsedFiles,
        recordCount: records.length,
        durationMs: Date.now() - startedAt,
        errors,
      },
    }
  }

  return { collect }
}
