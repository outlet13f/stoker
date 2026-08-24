import http from 'node:http'
import { DEFAULT_PORT, DEFAULT_REFRESH_SECONDS } from './constants.js'
import { createCollector } from './collector.js'
import { buildReportSet } from './report.js'
import { renderPage } from './render/html.js'

const JSON_HEADERS = { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' }
const HTML_HEADERS = { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' }

/** 매 요청마다 다시 모으되, 바뀐 파일만 파싱되므로 비용이 낮다 */
function createSnapshotSource({ timeZone, root }) {
  const collector = createCollector(root ? { root } : {})

  return async function snapshot() {
    const { records, stats } = await collector.collect()

    return {
      reports: buildReportSet(records, { now: Date.now(), timeZone }),
      config: {
        live: true,
        refreshSeconds: DEFAULT_REFRESH_SECONDS,
        timeZone,
        fileCount: stats.fileCount,
        collectMs: stats.durationMs,
        errors: stats.errors,
      },
    }
  }
}

export async function startServer({ port = DEFAULT_PORT, timeZone, root } = {}) {
  const snapshot = createSnapshotSource({ timeZone, root })

  const server = http.createServer(async (request, response) => {
    try {
      const url = new URL(request.url, 'http://localhost')

      if (url.pathname === '/api/report') {
        const payload = await snapshot()
        response.writeHead(200, JSON_HEADERS).end(JSON.stringify(payload))
        return
      }

      if (url.pathname === '/' || url.pathname === '/index.html') {
        const payload = await snapshot()
        response.writeHead(200, HTML_HEADERS).end(await renderPage(payload))
        return
      }

      response.writeHead(404, JSON_HEADERS).end(JSON.stringify({ error: 'not found' }))
    } catch (error) {
      // 대시보드가 죽는 것보다 오류를 노출하는 편이 낫다
      response.writeHead(500, JSON_HEADERS).end(JSON.stringify({ error: error.message }))
    }
  })

  await new Promise((resolve, reject) => {
    server.once('error', reject)
    server.listen(port, '127.0.0.1', resolve)
  })

  return { server, url: `http://127.0.0.1:${port}` }
}
