import { writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

/**
 * 번들할 라틴 서브셋 웹폰트를 다시 받는다. 결과물은 리포지토리에 커밋돼 있으므로
 * 평소에는 실행할 필요가 없다 — 굵기를 바꿀 때만 쓴다.
 */
const OUT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'src', 'render', 'fonts')
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36'

const WANTED = [
  { query: 'Archivo:wght@500..700', family: 'Archivo', file: () => 'archivo-var.woff2' },
  { query: 'IBM+Plex+Mono:wght@400;500;600', family: 'IBM Plex Mono', file: (w) => `ibm-plex-mono-${w}.woff2` },
]

/** Google Fonts CSS 에서 latin 서브셋 블록만 골라낸다 */
function latinFaces(css) {
  const blocks = [...css.matchAll(/\/\*\s*([\w[\]-]+)\s*\*\/\s*@font-face\s*\{(.*?)\}/gs)]

  return blocks
    .filter(([, subset]) => subset === 'latin')
    .map(([, , body]) => ({
      weight: body.match(/font-weight:\s*([^;]+)/)?.[1].trim().split(/\s+/)[0],
      url: body.match(/url\((https:\/\/[^)]+\.woff2)\)/)?.[1],
    }))
    .filter((face) => face.url)
}

for (const { query, file } of WANTED) {
  const css = await (await fetch(`https://fonts.googleapis.com/css2?family=${query}&display=swap`, {
    headers: { 'User-Agent': UA },
  })).text()

  for (const { weight, url } of latinFaces(css)) {
    const target = path.join(OUT, file(weight))
    const bytes = Buffer.from(await (await fetch(url)).arrayBuffer())
    await writeFile(target, bytes)
    console.log(`${path.basename(target)}: ${bytes.length} bytes`)
  }
}
