#!/usr/bin/env node
import fs from 'node:fs/promises'
import path from 'node:path'
import { execFile } from 'node:child_process'
import { parseArgs } from './args.js'
import { createCollector } from './collector.js'
import { resolveUsageLimits } from './limits.js'
import { buildReportSet } from './report.js'
import { renderPage } from './render/html.js'
import { renderSummary } from './summary.js'
import { startServer } from './server.js'
import { REFRESH_CHOICES, MIN_REFRESH_SECONDS, MAX_REFRESH_SECONDS } from './constants.js'

const DEFAULT_OUT = path.join(process.cwd(), 'dist', 'dashboard.html')

const HELP = `
claude-usage — Claude Code 사용량 모니터링 대시보드

사용법
  claude-usage                     정적 대시보드 HTML 을 만들고 요약을 출력
  claude-usage --serve             실시간 대시보드 서버 실행 (기본 포트 7331)
  claude-usage --json              집계 결과를 JSON 으로 출력

옵션
  --serve            로컬 서버 실행 (파일 변경분만 다시 파싱해 주기적으로 갱신)
  --port <번호>      서버 포트 (기본 7331)
  --days <일수>      터미널 요약에 쓸 기간 (기본 30, HTML 은 7/30/90/전체 모두 포함)
  --out <경로>       HTML 저장 위치 (기본 ./dist/dashboard.html)
  --tz <타임존>      집계 기준 타임존 (기본: 시스템 설정)
  --refresh <초>     대시보드 자동 갱신 주기 (기본 30, 5~3600, 0 은 끔)
                     실행 후에도 대시보드 헤더에서 바꿀 수 있습니다
  --no-live-limits   계정 한도를 서버에 직접 묻지 않고 캐시만 사용
                     (기본은 GET api.anthropic.com/api/oauth/usage 로 조회)
  --open             만든 HTML 또는 서버 주소를 브라우저로 열기
  --help, -h         이 도움말
`

/**
 * 기본 브라우저로 연다.
 *
 * Windows 의 start 는 실행 파일이 아니라 cmd.exe 빌트인이라 execFile 로는
 * 부를 수 없다. 그리고 start 는 첫 인자를 창 제목으로 삼으므로 빈 제목("")을
 * 먼저 넘겨야 URL 이 제목으로 먹히지 않는다.
 */
function openCommand() {
  if (process.platform === 'darwin') return ['open', []]
  if (process.platform === 'win32') return ['cmd', ['/c', 'start', '']]
  return ['xdg-open', []]
}

function openInBrowser(target) {
  const [command, prefix] = openCommand()

  execFile(command, [...prefix, target], (error) => {
    // 못 열어도 주소는 이미 찍어 뒀다. 조용히 삼키면 왜 안 열렸는지 알 수 없다.
    if (error) console.error(`브라우저를 열지 못했습니다(${error.message}). 위 주소를 직접 열어 주세요.`)
  })
}

async function runServer(options) {
  const { url } = await startServer({
    port: options.port,
    timeZone: options.timeZone,
    refreshSeconds: options.refreshSeconds,
    liveLimits: options.liveLimits,
  })

  console.log(`대시보드 실행 중 → ${url}`)
  console.log(
    options.refreshSeconds > 0
      ? `${options.refreshSeconds}초마다 갱신합니다(대시보드에서 바꿀 수 있습니다). 종료하려면 Ctrl+C.`
      : '자동 갱신을 끈 상태입니다(대시보드에서 켤 수 있습니다). 종료하려면 Ctrl+C.',
  )
  if (options.open) openInBrowser(url)
}

async function runBuild(options) {
  const { records, edits, stats } = await createCollector().collect()
  const limits = await resolveUsageLimits({ live: options.liveLimits })
  const reports = buildReportSet(records, { now: Date.now(), timeZone: options.timeZone, edits })

  if (options.json) {
    console.log(JSON.stringify({ reports, limits, stats }, null, 2))
    return
  }

  const outPath = options.out ?? DEFAULT_OUT
  const html = await renderPage({
    reports,
    config: {
      live: false,
      timeZone: options.timeZone,
      fileCount: stats.fileCount,
      refreshSeconds: 0,
      refreshChoices: REFRESH_CHOICES,
      refreshBounds: { min: MIN_REFRESH_SECONDS, max: MAX_REFRESH_SECONDS },
      limits,
    },
  })

  await fs.mkdir(path.dirname(outPath), { recursive: true })
  await fs.writeFile(outPath, html, 'utf8')

  const chosen = reports[String(options.days)] ?? reports['30']
  console.log(renderSummary(chosen, limits))
  console.log('')
  console.log(
    `트랜스크립트 ${stats.fileCount}개 · 응답 ${stats.recordCount.toLocaleString('en-US')}건 · ` +
      `편집 ${stats.editCount.toLocaleString('en-US')}건 · ${stats.durationMs}ms 소요`,
  )
  if (stats.errors.length > 0) console.warn(`읽지 못한 파일 ${stats.errors.length}개`)
  console.log(`대시보드 저장 → ${outPath}`)

  if (options.open) openInBrowser(outPath)
}

async function main() {
  let options
  try {
    options = parseArgs(process.argv.slice(2))
  } catch (error) {
    console.error(error.message)
    console.error(HELP)
    process.exitCode = 1
    return
  }

  if (options.help) {
    console.log(HELP)
    return
  }

  try {
    await (options.serve ? runServer(options) : runBuild(options))
  } catch (error) {
    console.error(`실행에 실패했습니다: ${error.message}`)
    process.exitCode = 1
  }
}

main()
