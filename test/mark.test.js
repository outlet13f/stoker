import test from 'node:test'
import assert from 'node:assert/strict'
import { MARK, centerY, isInsideMark, ringPath, ringStroke } from '../src/render/mark.js'

/**
 * 마크는 두 가지 방식으로 그려진다 — SVG 호(대시보드 헤더·앱 아이콘 원본)와
 * 해석적 래스터라이저(메뉴바·앱 아이콘 PNG). 이 파일이 지키는 것은 **둘이 같은
 * 도형인가**다. 예전에 불꽃 모양이 두 곳에 따로 적혀 있어 한쪽만 고치면
 * 조용히 어긋났다.
 */

const CENTER_RADIUS = (MARK.outerRadius + MARK.innerRadius) / 2

/** 아래(+y)에서 angle 만큼 돈 지점의 정규화 좌표. 링 중심은 광학 보정으로 내려가 있다. */
function atAngleFromBottom(degrees, radius = CENTER_RADIUS) {
  const radians = (degrees * Math.PI) / 180
  return [0.5 + radius * Math.sin(radians), centerY + radius * Math.cos(radians)]
}

/** ringPath 가 뱉은 'M x y A r r 0 1 1 x2 y2' 를 숫자로 되돌린다 */
function parseRingPath(size) {
  const [x1, y1, radius, , , , , x2, y2] = ringPath(size)
    .match(/-?\d+(?:\.\d+)?/g)
    .map(Number)

  return { x1, y1, radius, x2, y2 }
}

test('the ring is solid at the top and hollow at the centre', () => {
  // Assert — 가운데 구멍과 링 본체
  assert.equal(isInsideMark(0.5, centerY), false, '가운데는 비어 있어야 한다')
  assert.equal(isInsideMark(...atAngleFromBottom(180)), true, '맨 위는 링이다')
  assert.equal(isInsideMark(0.5, centerY - MARK.innerRadius / 2), false, '안쪽 반지름보다 안은 비어 있다')
  assert.equal(isInsideMark(0.5, centerY - MARK.outerRadius - 0.02), false, '바깥 반지름 밖은 비어 있다')
})

test('the gauge gap is open at the bottom and only at the bottom', () => {
  // Arrange — 틈은 아래를 중심으로 gapDegrees 만큼이다
  const half = MARK.gapDegrees / 2

  // Assert
  assert.equal(isInsideMark(...atAngleFromBottom(0)), false, '정확히 아래는 틈이다')
  assert.equal(isInsideMark(...atAngleFromBottom(half - 2)), false, '틈 안쪽은 비어 있다')
  assert.equal(isInsideMark(...atAngleFromBottom(half + 2)), true, '틈 바로 밖은 링이다')
  assert.equal(isInsideMark(...atAngleFromBottom(-(half + 2))), true, '틈은 좌우 대칭이다')
})

test('the SVG arc ends exactly where the rasterised gap begins', () => {
  // Arrange — 벡터와 래스터가 어긋나면 두 아이콘의 틈 크기가 달라진다
  const size = 32
  const { x1, y1, radius, x2, y2 } = parseRingPath(size)

  // Act — 끝점을 정규화 좌표로 되돌려 래스터라이저에 물어본다
  const toNormalised = (x, y) => [x / size, y / size]
  const arcCentreY = centerY * size
  const endpointRadius = Math.hypot(x1 - size / 2, y1 - arcCentreY)

  // Assert
  assert.equal(Number(radius.toFixed(2)), Number((CENTER_RADIUS * size).toFixed(2)),
    '호의 반지름은 링 중심선이어야 한다')
  assert.ok(Math.abs(endpointRadius - radius) < 0.02, '끝점은 그 반지름 위에 있어야 한다')
  assert.ok(Math.abs((x1 + x2) / 2 - size / 2) < 0.02, '두 끝점은 좌우 대칭이어야 한다')
  assert.equal(Number(y1.toFixed(2)), Number(y2.toFixed(2)), '두 끝점의 높이는 같아야 한다')
  assert.ok(y1 > arcCentreY, '틈은 링 중심보다 아래에 있어야 한다')

  // 호가 끝나는 각이 곧 틈의 절반이어야 래스터의 부채꼴과 같은 자리에서 끊긴다.
  // 끝점 자체는 경계라 반올림에 따라 안팎이 갈리므로 각으로 잰다.
  const half = MARK.gapDegrees / 2
  const endpointDegrees = Math.abs(
    (Math.atan2(x1 - size / 2, y1 - arcCentreY) * 180) / Math.PI,
  )
  assert.ok(Math.abs(endpointDegrees - half) < 0.1,
    `호는 아래에서 ${half}° 지점에서 끊겨야 한다(실제 ${endpointDegrees.toFixed(2)}°)`)

  // 틈 바로 바깥은 래스터에서도 링이다
  assert.equal(isInsideMark(...atAngleFromBottom(-(half + 1))), true, '끝점 바깥쪽은 링이다')
  assert.equal(isInsideMark(...toNormalised(size / 2, y1)), false, '두 끝점 사이는 틈이다')
})

test('the arc flag matches how far the ring actually sweeps', () => {
  // Arrange — 호가 180°를 넘는지에 따라 large-arc 플래그가 달라져야 한다.
  //           상수로 박아 두면 틈을 넓혔을 때 호가 반대쪽으로 그려진다.
  const sweep = 360 - MARK.gapDegrees
  const flags = ringPath(32).match(/A[\d.\s]+ (\d) (\d) /)

  // Assert
  assert.ok(flags, 'A 명령에서 플래그 두 개를 읽을 수 있어야 한다')
  assert.equal(flags[1], sweep > 180 ? '1' : '0', `호가 ${sweep}° 이므로 large-arc 가 맞아야 한다`)
  assert.equal(flags[2], '1', '위를 지나는 시계방향이어야 한다')
})

test('the stroke width is the difference between the two radii', () => {
  // Assert — 획이 반지름 차이와 다르면 SVG 가 래스터보다 두껍거나 얇게 찍힌다
  assert.equal(ringStroke(32), Number(((MARK.outerRadius - MARK.innerRadius) * 32).toFixed(2)))
  assert.equal(ringStroke(1024), Number(((MARK.outerRadius - MARK.innerRadius) * 1024).toFixed(2)))
})

test('the mark is optically centred, not geometrically centred', () => {
  // Arrange — 틈이 아래에 있어 도형이 위로 쏠린다. 상자를 가운데 놓아야 한다.
  const half = (MARK.gapDegrees / 2) * Math.PI / 180
  const top = centerY - MARK.outerRadius
  const bottom = centerY + MARK.outerRadius * Math.max(0, Math.cos(half))

  // Assert
  assert.ok(centerY > 0.5, '링 중심은 캔버스 가운데보다 아래여야 한다')
  assert.ok(Math.abs(top - (1 - bottom)) < 1e-9, `위 여백 ${top} 과 아래 여백 ${1 - bottom} 이 같아야 한다`)
  assert.ok(top > 0, '캔버스 위로 넘치면 안 된다')
  assert.ok(bottom < 1, '캔버스 아래로 넘치면 안 된다')
})

test('the mark stays inside its canvas', () => {
  // Assert — 캔버스를 넘으면 16px 메뉴바 아이콘의 위아래가 잘린다
  assert.ok(MARK.outerRadius < 0.5, '바깥 반지름이 캔버스 절반을 넘으면 안 된다')
  assert.ok(MARK.innerRadius < MARK.outerRadius, '안쪽 반지름이 더 작아야 한다')
  assert.ok(MARK.gapDegrees > 0 && MARK.gapDegrees < 360, '틈은 0 과 한 바퀴 사이여야 한다')
})
