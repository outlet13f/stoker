import fs from 'node:fs/promises'
import path from 'node:path'

const TRANSCRIPT_EXTENSION = '.jsonl'
const SUBAGENT_SEGMENT = 'subagents'
const WORKFLOW_SEGMENT = 'workflows'

/**
 * 프로젝트 디렉터리 이름은 경로 구분자를 '-' 로 치환한 형태라 원래 경로를
 * 100% 되돌릴 수 없다. 레코드의 cwd 가 있으면 그쪽을 쓰고,
 * 여기서는 사람이 알아볼 수 있는 짧은 라벨만 만든다.
 */
export function projectLabelFromDir(dirName) {
  const segments = dirName.split('-').filter(Boolean)
  return segments.at(-1) ?? dirName
}

/**
 * 프로젝트 디렉터리 기준 상대 경로 조각으로 트랜스크립트 종류를 판별한다.
 *   <proj>/<session>.jsonl                                   → main
 *   <proj>/<session>/subagents/agent-*.jsonl                 → subagent
 *   <proj>/<session>/subagents/workflows/<wf>/agent-*.jsonl  → workflow
 */
export function classifyTranscript(segments) {
  const [, ...rest] = segments

  if (rest.length <= 1) {
    return { sourceKind: 'main', parentSessionId: rest[0]?.replace(/\.jsonl$/, '') ?? null }
  }

  const sourceKind = rest.includes(WORKFLOW_SEGMENT)
    ? 'workflow'
    : rest.includes(SUBAGENT_SEGMENT)
      ? 'subagent'
      : 'main'

  return { sourceKind, parentSessionId: rest[0] }
}

async function walk(dir, onFile) {
  const entries = await fs.readdir(dir, { withFileTypes: true }).catch(() => [])

  await Promise.all(
    entries.map((entry) => {
      const full = path.join(dir, entry.name)
      if (entry.isDirectory()) return walk(full, onFile)
      if (entry.isFile() && entry.name.endsWith(TRANSCRIPT_EXTENSION)) return onFile(full)
      return null
    }),
  )
}

async function describe(filePath, root) {
  const stat = await fs.stat(filePath).catch(() => null)
  if (!stat) return null

  const segments = path.relative(root, filePath).split(path.sep)
  const projectDir = segments[0]

  return {
    path: filePath,
    projectDir,
    projectLabel: projectLabelFromDir(projectDir),
    ...classifyTranscript(segments),
    size: stat.size,
    mtimeMs: stat.mtimeMs,
  }
}

/** ~/.claude/projects 아래의 모든 트랜스크립트를 재귀적으로 나열한다 */
export async function listTranscripts(root) {
  const projectDirs = await fs.readdir(root, { withFileTypes: true }).catch((error) => {
    throw new Error(`트랜스크립트 디렉터리를 읽을 수 없습니다: ${root} (${error.message})`)
  })

  const found = []
  await Promise.all(
    projectDirs
      .filter((entry) => entry.isDirectory())
      .map((entry) => walk(path.join(root, entry.name), (file) => found.push(file))),
  )

  const described = await Promise.all(found.map((file) => describe(file, root)))
  return described.filter(Boolean)
}
