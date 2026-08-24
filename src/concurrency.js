/**
 * 동시 실행 개수를 제한하며 map 한다.
 * 트랜스크립트가 수백 개일 때 파일 디스크립터가 한꺼번에 열리는 것을 막는다.
 */
export async function mapWithLimit(items, limit, mapper) {
  const results = new Array(items.length)
  let cursor = 0

  async function worker() {
    while (cursor < items.length) {
      const index = cursor
      cursor += 1
      results[index] = await mapper(items[index], index)
    }
  }

  const workerCount = Math.max(1, Math.min(limit, items.length))
  await Promise.all(Array.from({ length: workerCount }, worker))

  return results
}
