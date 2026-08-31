/**
 * 브랜드 마크의 기하 — 아래가 트인 링 게이지.
 *
 * 대시보드 헤더(SVG), 메뉴바 아이콘(16px 래스터), 앱 아이콘(1024px 래스터)이
 * 이 파일 하나를 공유한다. 예전에는 불꽃 모양이 SVG 와 래스터라이저에 각각
 * 적혀 있어서 한쪽만 고치면 조용히 어긋났다.
 *
 * 비율은 16px 에서 읽히는 것을 기준으로 정했다:
 *   바깥 지름 0.92 → 14.7px · 획 0.20 → 3.2px · 안쪽 구멍 0.52 → 8.3px
 * 가운데 점을 넣어 봤지만 1x 에서 구멍을 거의 다 먹어 링이 통짜 원반으로
 * 읽혔다. 그래서 비워 둔다.
 *
 * 틈이 84° 였을 때는 **사람 실루엣으로 읽혔다.** 링이 두꺼워 바깥 윤곽이
 * 머리가 되고, 벌어진 두 끝이 어깨가 됐다. 안쪽 구멍이 배경색이라 틈 아래와
 * 이어지면서 그 착시가 굳었다. 틈을 130° 로 벌리면 두 끝이 거의 수평으로
 * 누워 어깨가 사라지고 게이지 호로 읽힌다.
 */
export const MARK = {
  outerRadius: 0.46,
  innerRadius: 0.26,
  /** 아래쪽에 남기는 틈. 게이지라는 것이 이 틈으로 읽힌다. */
  gapDegrees: 130,
}

/**
 * 마크를 단색으로 칠할 때 쓰는 색.
 *
 * 작업표시줄·브라우저 탭처럼 **테마를 알 수 없는 자리**에 놓이므로 밝은 바탕과
 * 어두운 바탕 양쪽에서 견디는 값이어야 한다. theme.js 의 accent 는 라이트/다크가
 * 서로 다른 값이라 여기에는 쓸 수 없다.
 *
 * 아이콘 래스터라이저(build/make-icons.mjs)와 파비콘(render/html.js)이 함께 쓴다.
 */
export const MARK_HEX = '#7C75F0'
export const MARK_RGB = [0x7c, 0x75, 0xf0]

const CENTER_RADIUS = (MARK.outerRadius + MARK.innerRadius) / 2
const STROKE_RATIO = MARK.outerRadius - MARK.innerRadius
const GAP_HALF_RADIANS = ((MARK.gapDegrees / 2) * Math.PI) / 180

/**
 * 링의 세로 중심.
 *
 * 틈이 아래에 있으므로 도형은 위로 쏠린다 — 맨 위는 바깥 반지름만큼 올라가지만
 * 맨 아래는 호가 끊긴 지점까지밖에 못 내려온다. 원의 중심을 캔버스 한가운데
 * 두면 16px 메뉴바에서 아이콘이 위에 붙어 보이고 앱 아이콘은 아래가 휑하다.
 * 그래서 **외곽 상자**가 가운데 오도록 원을 내려 놓는다.
 *
 * 위 여백 = 아래 여백 이 되는 지점을 풀면 아래 식이 나온다.
 * 틈이 180°를 넘으면 맨 아래는 호의 끝이 아니라 좌우 3·9시라 0 으로 자른다.
 */
export const centerY = 0.5 + (MARK.outerRadius * (1 - Math.max(0, Math.cos(GAP_HALF_RADIANS)))) / 2

/**
 * 정규화 좌표(0~1)의 한 점이 링 안인가.
 * 래스터라이저가 픽셀을 잘게 쪼개 이 함수를 부른다.
 */
export function isInsideMark(x, y) {
  const dx = x - 0.5
  const dy = y - centerY
  const distance = Math.hypot(dx, dy)

  if (distance < MARK.innerRadius || distance > MARK.outerRadius) return false

  // atan2(dx, dy) 는 아래(+y)를 0 으로 재는 각이다. 그 부채꼴만 비운다.
  return Math.abs(Math.atan2(dx, dy)) > GAP_HALF_RADIANS
}

/** 캔버스 한 변이 size 일 때의 링 획 두께 */
export function ringStroke(size) {
  return round(STROKE_RATIO * size)
}

/**
 * 링 호의 SVG path. **butt cap 을 전제로 한 좌표다.**
 *
 * 둥근 끝(round cap)을 주면 획 절반만큼 호가 늘어나 아래 틈이 130°에서 약 98° 로
 * 좁아진다. 그러면 같은 값에서 나온 래스터 아이콘과 틈 크기가 눈에 띄게
 * 달라진다 — 두 아이콘을 나란히 두면 바로 보인다.
 */
export function ringPath(size) {
  const center = size / 2
  const radius = CENTER_RADIUS * size
  const dx = radius * Math.sin(GAP_HALF_RADIANS)
  const y = centerY * size + radius * Math.cos(GAP_HALF_RADIANS)

  // 호는 위를 지나 시계방향이다(sweep=1). large-arc 는 틈 크기에서 따라온다 —
  // 상수로 박아 두면 틈을 180° 이상으로 벌렸을 때 호가 반대쪽으로 그려진다.
  const largeArc = 360 - MARK.gapDegrees > 180 ? 1 : 0

  return `M${round(center - dx)} ${round(y)}` +
    `A${round(radius)} ${round(radius)} 0 ${largeArc} 1 ${round(center + dx)} ${round(y)}`
}

function round(value) {
  return Number(value.toFixed(2))
}
