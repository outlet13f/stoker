import http from 'node:http'
import { DEFAULT_PORT, DEFAULT_REFRESH_SECONDS } from './constants.js'
import { createCollector } from './collector.js'
import { buildReportSet } from './report.js'
import { parseDateRange } from './daterange.js'
import { renderPage } from './render/html.js'

const JSON_HEADERS = { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' }
const HTML_HEADERS = { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' }

/** 매 요청마다 다시 모으되, 바뀐 파일만 파싱되므로 비용이 낮다 */
function createSnapshotSource({ timeZone, root }) {
  const collector = createCollector(root ? { root } : {})

  return async function snapshot(customWindow = null) {
    const { records, edits, stats } = await collector.collect()

    return {
      reports: buildReportSet(records, { now: Date.now(), timeZone, edits, customWindow }),
      config: {
        live: true,
        refreshSeconds: DEFAULT_REFRESH_SECONDS,
        timeZone,
        fileCount: stats.fileCount,
        collectMs: stats.durationMs,
        errors: stats.errors,
        customWindow: customWindow
          ? { from: customWindow.fromDate, to: customWindow.toDate }
          : null,
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
        let customWindow
        try {
          customWindow = parseDateRange(
            { from: url.searchParams.get('from'), to: url.searchParams.get('to') },
            timeZone,
          )
        } catch (invalid) {
          // 사용자 입력 오류는 400 으로 되돌려 준다(500 으로 감추지 않는다)
          response.writeHead(400, JSON_HEADERS).end(JSON.stringify({ error: invalid.message }))
          return
        }

        const payload = await snapshot(customWindow)
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
