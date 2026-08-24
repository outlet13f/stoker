import { deflateSync, crc32 } from 'node:zlib'
import { writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

/**
 * 메뉴바 템플릿 아이콘을 알파 채널까지 직접 그린다.
 *
 * qlmanage 로 SVG 를 변환하면 알파가 흰 배경으로 평탄화돼 템플릿이 통짜
 * 사각형이 되고, macOS 가 그 사각형 전체를 칠해 버린다. 그래서 의존성 없이
 * (zlib 만) 직접 래스터화한다.
 */
const HERE = path.dirname(fileURLToPath(import.meta.url))

/**
 * 불꽃(눈물방울) 모양. 좌표는 캔버스 정규화 단위(0~1)를 그대로 쓴다.
 * 캔버스가 정사각이라 배(bulb)를 원으로 두면 픽셀에서도 원으로 보인다.
 */
const FLAME_TIP_Y = 0.06 // 꼭지
const FLAME_BASE_Y = 0.96 // 바닥
const BULB_RADIUS = 0.3 // 최대 반폭 → 좌우 합쳐 60%(16px 에서 약 10px)
const BULB_CENTER_Y = FLAME_BASE_Y - BULB_RADIUS
const TAPER_EXPONENT = 0.55 // 1 보다 작으면 어깨가 부풀고 꼭지가 뾰족해진다
const SUPERSAMPLE = 4

function isInsideFlame(x, y) {
  const dx = Math.abs(x - 0.5)

  // 배 중심보다 아래는 원, 위는 꼭지로 좁아지는 곡선
  if (y >= BULB_CENTER_Y) {
    return dx * dx + (y - BULB_CENTER_Y) ** 2 <= BULB_RADIUS ** 2
  }

  const climbed = (BULB_CENTER_Y - y) / (BULB_CENTER_Y - FLAME_TIP_Y)
  if (climbed >= 1) return false

  return dx <= BULB_RADIUS * (1 - climbed) ** TAPER_EXPONENT
}

/** 픽셀 하나를 SUPERSAMPLE² 로 나눠 재 안티에일리어싱한다 */
function coverageAt(px, py, size) {
  let hits = 0

  for (let sy = 0; sy < SUPERSAMPLE; sy += 1) {
    for (let sx = 0; sx < SUPERSAMPLE; sx += 1) {
      const x = (px + (sx + 0.5) / SUPERSAMPLE) / size
      const y = (py + (sy + 0.5) / SUPERSAMPLE) / size
      if (isInsideFlame(x, y)) hits += 1
    }
  }

  return hits / (SUPERSAMPLE * SUPERSAMPLE)
}

function chunk(type, body) {
  const length = Buffer.alloc(4)
  length.writeUInt32BE(body.length)

  const typed = Buffer.concat([Buffer.from(type, 'ascii'), body])
  const checksum = Buffer.alloc(4)
  checksum.writeUInt32BE(crc32(typed) >>> 0)

  return Buffer.concat([length, typed, checksum])
}

/** RGBA 픽셀 버퍼를 PNG 로 인코딩한다 */
function encodePng(size, pixels) {
  const header = Buffer.alloc(13)
  header.writeUInt32BE(size, 0)
  header.writeUInt32BE(size, 4)
  header[8] = 8 // bit depth
  header[9] = 6 // colour type: RGBA
  header[10] = 0 // deflate
  header[11] = 0 // adaptive filtering
  header[12] = 0 // no interlace

  // 스캔라인마다 필터 바이트(0 = None)를 앞에 붙인다
  const stride = size * 4
  const raw = Buffer.alloc((stride + 1) * size)
  for (let y = 0; y < size; y += 1) {
    raw[y * (stride + 1)] = 0
    pixels.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride)
  }

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

/** 템플릿 이미지는 검정 + 알파만 쓴다. 색은 macOS 가 입힌다. */
function renderTemplate(size) {
  const pixels = Buffer.alloc(size * size * 4)

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const offset = (y * size + x) * 4
      pixels[offset] = 0
      pixels[offset + 1] = 0
      pixels[offset + 2] = 0
      pixels[offset + 3] = Math.round(coverageAt(x, y, size) * 255)
    }
  }

  return encodePng(size, pixels)
}

for (const [size, name] of [[16, 'trayTemplate.png'], [32, 'trayTemplate@2x.png']]) {
  const file = path.join(HERE, name)
  writeFileSync(file, renderTemplate(size))
  console.log(`${name}: ${size}x${size}`)
}
