import { deflateSync, crc32 } from 'node:zlib'

/**
 * 의존성 없는 PNG 인코더와 슈퍼샘플러.
 *
 * `qlmanage` 로 SVG 를 변환하면 알파가 흰 배경으로 평탄화된다. 메뉴바
 * 템플릿에서는 통짜 사각형이 되고, 앱 아이콘에서는 둥근 모서리 바깥이
 * 흰색으로 남는다. 그래서 zlib 만 써서 알파까지 직접 래스터화한다.
 */

/** 픽셀 하나를 SUPERSAMPLE² 로 나눠 잰다 */
export const SUPERSAMPLE = 4

/**
 * 픽셀 (px, py) 안의 서브샘플 좌표를 정규화 단위(0~1)로 하나씩 넘긴다.
 * 반환값은 없다 — 호출한 쪽이 세든 색을 섞든 알아서 한다.
 */
export function forEachSubsample(px, py, size, visit) {
  for (let sy = 0; sy < SUPERSAMPLE; sy += 1) {
    for (let sx = 0; sx < SUPERSAMPLE; sx += 1) {
      visit(
        (px + (sx + 0.5) / SUPERSAMPLE) / size,
        (py + (sy + 0.5) / SUPERSAMPLE) / size,
      )
    }
  }
}

export const SUBSAMPLES_PER_PIXEL = SUPERSAMPLE * SUPERSAMPLE

function chunk(type, body) {
  const length = Buffer.alloc(4)
  length.writeUInt32BE(body.length)

  const typed = Buffer.concat([Buffer.from(type, 'ascii'), body])
  const checksum = Buffer.alloc(4)
  checksum.writeUInt32BE(crc32(typed) >>> 0)

  return Buffer.concat([length, typed, checksum])
}

/** RGBA 픽셀 버퍼를 PNG 로 인코딩한다 */
export function encodePng(size, pixels) {
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
