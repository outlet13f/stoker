import { writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { encodePng, forEachSubsample, SUBSAMPLES_PER_PIXEL } from './png.mjs'
import { isInsideMark, ringPath, ringStroke, MARK_RGB } from '../src/render/mark.js'

/**
 * 아이콘 세 벌을 한 번에 굽는다 — 모두 src/render/mark.js 의 링 게이지다.
 *
 *   trayTemplate*.png  macOS 메뉴바 (검정 + 알파, macOS 가 명암에 맞춰 반전)
 *   trayColor*.png     Windows·Linux 작업표시줄 (색이 구워진 것)
 *   icon.png / icon.svg  앱 아이콘 (electron-builder 가 icns·ico 로 변환)
 *
 * SVG 를 PNG 로 바꿔 줄 도구가 없어도 돌아가야 하므로 직접 래스터화한다.
 */
const HERE = path.dirname(fileURLToPath(import.meta.url))

const BLACK = [0, 0, 0]
const WHITE = [0xff, 0xff, 0xff]

/**
 * 작업표시줄 아이콘 색. theme.js 의 두 accent(라이트 #4F46E5 / 다크 #8B85FF)
 * 사이의 중간값이다. 한쪽 토큰을 그대로 쓰면 반대 테마에서 무너진다 —
 * #4F46E5 는 어두운 표시줄(#202020)에서 2.59:1, #8B85FF 는 Windows 밝은
 * 표시줄(#F3F3F3)에서 2.74:1 로 둘 다 기준 미달이다. 이 값은 #F3F3F3 3.34:1 ·
 * #202020 4.39:1 로 양쪽을 넘긴다(WCAG 1.4.11 비텍스트 기준 3:1).
 */
const TASKBAR_ACCENT = MARK_RGB

/* ---------- 메뉴바 · 작업표시줄 아이콘 ---------- */

/** 마크를 주어진 색으로 그린다. 모양은 같고 색만 다르다. */
function renderTrayIcon(size, [red, green, blue]) {
  const pixels = Buffer.alloc(size * size * 4)

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      let hits = 0
      forEachSubsample(x, y, size, (sx, sy) => {
        if (isInsideMark(sx, sy)) hits += 1
      })

      const offset = (y * size + x) * 4
      pixels[offset] = red
      pixels[offset + 1] = green
      pixels[offset + 2] = blue
      pixels[offset + 3] = Math.round((hits / SUBSAMPLES_PER_PIXEL) * 255)
    }
  }

  return encodePng(size, pixels)
}

/* ---------- 앱 아이콘 ---------- */

const APP_ICON_SIZE = 1024
/** 둥근 사각형 모서리 반경(캔버스 대비). 1024 에서 228 — macOS 스퀘어클에 가깝다. */
const CORNER_RADIUS = 228 / 1024
/** 마크가 차지하는 비율. 앱 아이콘은 여백이 있어야 아이콘답게 보인다. */
const MARK_SCALE = 0.68
/** 좌상단 → 우하단 대각 그라디언트. 대시보드 seq 램프의 양 끝이다. */
const GRADIENT_FROM = [0x8a, 0x80, 0xec]
const GRADIENT_TO = [0x3a, 0x2b, 0x93]

/** 정규화 좌표가 둥근 사각형 안인가 — 모서리는 반경 CORNER_RADIUS 의 원 */
function isInsideRoundedRect(x, y) {
  const dx = Math.max(CORNER_RADIUS - x, 0, x - (1 - CORNER_RADIUS))
  const dy = Math.max(CORNER_RADIUS - y, 0, y - (1 - CORNER_RADIUS))

  return dx * dx + dy * dy <= CORNER_RADIUS * CORNER_RADIUS
}

/** 마크는 캔버스 가운데에 MARK_SCALE 로 축소돼 놓인다 */
function isInsideScaledMark(x, y) {
  return isInsideMark((x - 0.5) / MARK_SCALE + 0.5, (y - 0.5) / MARK_SCALE + 0.5)
}

function gradientAt(x, y) {
  const t = Math.min(1, Math.max(0, (x + y) / 2))

  return GRADIENT_FROM.map((from, index) => from + (GRADIENT_TO[index] - from) * t)
}

/**
 * 배경(그라디언트)과 링(흰색)을 서브샘플 단위로 섞는다.
 *
 * 색을 픽셀 단위로 정하고 알파만 부드럽게 하면 링 가장자리에 배경색이
 * 계단으로 남는다. 덮인 서브샘플의 색을 평균 내야 경계가 깨끗하다.
 */
function renderAppIcon(size) {
  const pixels = Buffer.alloc(size * size * 4)

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      let covered = 0
      let red = 0
      let green = 0
      let blue = 0

      forEachSubsample(x, y, size, (sx, sy) => {
        if (!isInsideRoundedRect(sx, sy)) return

        covered += 1
        const [r, g, b] = isInsideScaledMark(sx, sy) ? WHITE : gradientAt(sx, sy)
        red += r
        green += g
        blue += b
      })

      const offset = (y * size + x) * 4
      if (covered === 0) continue

      pixels[offset] = Math.round(red / covered)
      pixels[offset + 1] = Math.round(green / covered)
      pixels[offset + 2] = Math.round(blue / covered)
      pixels[offset + 3] = Math.round((covered / SUBSAMPLES_PER_PIXEL) * 255)
    }
  }

  return encodePng(size, pixels)
}

const toHex = (channel) => channel.toString(16).padStart(2, '0')
const hex = ([r, g, b]) => `#${toHex(r)}${toHex(g)}${toHex(b)}`

/** PNG 와 같은 그림의 벡터 원본. 값이 어긋나지 않도록 같은 상수로 만든다. */
function renderAppIconSvg(size) {
  const inner = size * MARK_SCALE
  const offset = Number(((size - inner) / 2).toFixed(2))

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" role="img" aria-label="Stoker">
  <!-- 이 파일은 \`npm run icons\` 가 build/make-icons.mjs 로 생성합니다. 직접 고치지 마세요. -->
  <defs>
    <linearGradient id="stoker-bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${hex(GRADIENT_FROM)}"/>
      <stop offset="1" stop-color="${hex(GRADIENT_TO)}"/>
    </linearGradient>
  </defs>
  <rect width="${size}" height="${size}" rx="${Math.round(CORNER_RADIUS * size)}" fill="url(#stoker-bg)"/>
  <g transform="translate(${offset} ${offset})">
    <path d="${ringPath(inner)}" fill="none" stroke="${hex(WHITE)}" stroke-width="${ringStroke(inner)}"/>
  </g>
</svg>
`
}

/* ---------- 굽기 ---------- */

const TRAY_VARIANTS = [
  [16, 'trayTemplate.png', BLACK],
  [32, 'trayTemplate@2x.png', BLACK],
  [16, 'trayColor.png', TASKBAR_ACCENT],
  [32, 'trayColor@2x.png', TASKBAR_ACCENT],
]

for (const [size, name, color] of TRAY_VARIANTS) {
  writeFileSync(path.join(HERE, name), renderTrayIcon(size, color))
  console.log(`${name}: ${size}x${size}`)
}

writeFileSync(path.join(HERE, 'icon.png'), renderAppIcon(APP_ICON_SIZE))
console.log(`icon.png: ${APP_ICON_SIZE}x${APP_ICON_SIZE}`)

writeFileSync(path.join(HERE, 'icon.svg'), renderAppIconSvg(APP_ICON_SIZE))
console.log('icon.svg: vector source')
