import { writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

/**
 * 번들할 라틴 서브셋 웹폰트를 다시 받는다. 결과물은 리포지토리에 커밋돼 있으므로
 * 평소에는 실행할 필요가 없다 — 굵기를 바꿀 때만 쓴다.
 */
const OUT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'src', 'render', 'fonts')
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36'

/**
 * 가변 폰트 하나만 받는다. 굵기별 정적 파일로 떨어지면 fonts.js 가 선언한
 * `font-weight: 400 700` 이 거짓이 되므로(브라우저가 굵기를 합성한다)
 * 그때는 받지 않고 멈춘다.
 */
const WANTED = [
  { query: 'Inter:wght@400..700', file: 'inter-var.woff2' },
  { query: 'JetBrains+Mono:wght@400..600', file: 'jetbrains-mono-var.woff2' },
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

/** 실패를 조용히 넘기면 아무것도 안 받고 exit 0 이 된다 */
async function get(url, what) {
  const response = await fetch(url, { headers: { 'User-Agent': UA } })
  if (!response.ok) throw new Error(`${what} 요청 실패: HTTP ${response.status} ${response.statusText}`)
  return response
}

for (const { query, file } of WANTED) {
  const url = `https://fonts.googleapis.com/css2?family=${query}&display=swap`
  const faces = latinFaces(await (await get(url, query)).text())

  if (faces.length !== 1) {
    throw new Error(
      `${query}: latin 서브셋이 ${faces.length}개다(가변 폰트 1개를 기대했다). ` +
      '굵기별 정적 파일로 바뀌었다면 fonts.js 의 font-weight 선언부터 손봐야 한다.',
    )
  }

  const target = path.join(OUT, file)
  const bytes = Buffer.from(await (await get(faces[0].url, file)).arrayBuffer())
  await writeFile(target, bytes)
  console.log(`${file}: ${bytes.length} bytes`)
}
