import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = path.dirname(fileURLToPath(import.meta.url))

/** 브라우저로 인라인할 파일들. format.js 는 CLI 와 공유하므로 중복 구현하지 않는다. */
const SOURCES = [path.join(HERE, '..', 'format.js'), path.join(HERE, 'client.js')]

/** 모듈 문법만 제거해 하나의 클래식 스크립트로 잇는다 */
function stripModuleSyntax(source) {
  return source
    .replace(/^import[^\n]*\n/gm, '')
    .replace(/^export\s+(?=(function|const|let|class))/gm, '')
    .replace(/^export\s*\{[^}]*\}[^\n]*\n/gm, '')
}

export async function buildClientScript() {
  const parts = await Promise.all(
    SOURCES.map(async (file) => stripModuleSyntax(await fs.readFile(file, 'utf8'))),
  )

  return parts.join('\n')
}
