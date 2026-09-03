import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

/**
 * 웹폰트를 CSS 안에 base64 로 심는다.
 *
 * 대시보드는 파일 하나로 완결돼야 하므로(정적 내보내기) 폰트를 별도 파일로
 * 두면 그 파일만 열었을 때 타이포가 깨진다. 그리고 Google Fonts 를 링크로
 * 두면 매 로드마다 외부 요청이 28건 나갔다 — "로컬 전용" 이라는 말과 맞지 않았다.
 *
 * 한글은 번들하지 않는다. 웹폰트로 받으면 수 MB이고 macOS·Windows 모두
 * 품질 좋은 기본 서체가 있다. 라틴만 번들해 숫자와 라벨의 성격을 지킨다.
 */
const HERE = path.dirname(fileURLToPath(import.meta.url))
const FONT_DIR = path.join(HERE, 'fonts')

/**
 * [파일, font-family, font-weight] — 가변 폰트는 굵기 범위를 그대로 쓴다.
 *
 * 둘 다 가변이라 굵기마다 파일을 두지 않는다. Google Fonts 가 JetBrains Mono 를
 * 가변으로 넘기기 시작해서, 굵기별로 받으면 같은 파일을 세 번 심게 된다.
 */
const FACES = [
  ['inter-var.woff2', 'Inter', '400 700'],
  ['jetbrains-mono-var.woff2', 'JetBrains Mono', '400 600'],
]

async function faceCss([file, family, weight]) {
  const base64 = (await fs.readFile(path.join(FONT_DIR, file))).toString('base64')

  return `@font-face {
  font-family: '${family}';
  font-style: normal;
  font-weight: ${weight};
  font-display: swap;
  src: url(data:font/woff2;base64,${base64}) format('woff2');
}`
}

/** 폰트 파일을 읽지 못하면 빈 문자열을 준다 — 시스템 폰트로 떨어질 뿐 죽지 않는다 */
export async function buildFontFaceCss() {
  try {
    return (await Promise.all(FACES.map(faceCss))).join('\n')
  } catch {
    return ''
  }
}
