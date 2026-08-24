import fs from 'node:fs/promises'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import path from 'node:path'
import os from 'node:os'

/**
 * Claude Code 의 OAuth 액세스 토큰을 찾는다.
 *
 * 이 파일이 다루는 값은 살아 있는 자격증명이다. 규칙:
 *   - 토큰은 절대 로그·에러 메시지·JSON 출력에 실리지 않는다
 *   - 밖으로 넘길 때는 열거 불가 속성에 담아 JSON.stringify 로 새지 않게 한다
 *   - 어디서 찾았는지(source)만 밖으로 알린다
 */
const execFileAsync = promisify(execFile)

const CREDENTIALS_FILE = path.join(os.homedir(), '.claude', '.credentials.json')
const KEYCHAIN_SERVICE = 'Claude Code-credentials'
const KEYCHAIN_TIMEOUT_MS = 5000

/** 토큰 같아 보이는 문자열의 최소 길이. 짧은 값은 토큰이 아니라고 본다. */
const MIN_TOKEN_LENGTH = 20

const ACCESS_TOKEN_KEYS = new Set(['accessToken', 'access_token'])
const EXPIRY_KEYS = new Set(['expiresAt', 'expires_at', 'expiry'])

/**
 * 자격증명 파일의 정확한 형태를 문서로 보장할 수 없으므로
 * 중첩 구조를 훑어 액세스 토큰처럼 보이는 값을 찾는다.
 */
function findToken(value, depth = 0) {
  if (depth > 4 || !value || typeof value !== 'object') return null

  for (const [key, nested] of Object.entries(value)) {
    if (ACCESS_TOKEN_KEYS.has(key) && typeof nested === 'string' && nested.length >= MIN_TOKEN_LENGTH) {
      return { token: nested, expiresAt: findExpiry(value) }
    }
  }

  for (const nested of Object.values(value)) {
    const found = findToken(nested, depth + 1)
    if (found) return found
  }

  return null
}

function findExpiry(holder) {
  for (const [key, value] of Object.entries(holder)) {
    if (!EXPIRY_KEYS.has(key)) continue
    const numeric = typeof value === 'number' ? value : Date.parse(value ?? '')
    if (Number.isFinite(numeric)) return numeric
  }
  return null
}

/** 토큰을 열거 불가 속성에 담아 실수로 직렬화되지 않게 한다 */
function seal({ token, expiresAt, source }) {
  const holder = { source, expiresAt: expiresAt ?? null }

  Object.defineProperty(holder, 'accessToken', {
    value: token,
    enumerable: false,
    writable: false,
    configurable: false,
  })

  return holder
}

async function fromEnvironment(env) {
  const token = env.CLAUDE_CODE_OAUTH_TOKEN
  if (typeof token !== 'string' || token.length < MIN_TOKEN_LENGTH) return null
  return seal({ token, expiresAt: null, source: 'env' })
}

async function fromFile(file) {
  try {
    const found = findToken(JSON.parse(await fs.readFile(file, 'utf8')))
    return found ? seal({ ...found, source: 'file' }) : null
  } catch {
    // 파일이 없거나 못 읽어도 다음 후보로 넘어간다
    return null
  }
}

async function fromKeychain() {
  if (process.platform !== 'darwin') return null

  try {
    const { stdout } = await execFileAsync(
      'security',
      ['find-generic-password', '-s', KEYCHAIN_SERVICE, '-w'],
      { timeout: KEYCHAIN_TIMEOUT_MS },
    )
    const found = findToken(JSON.parse(stdout))
    return found ? seal({ ...found, source: 'keychain' }) : null
  } catch {
    // 키체인 항목이 없거나 접근이 거부돼도 조용히 넘어간다
    return null
  }
}

/**
 * 환경변수 → 자격증명 파일 → macOS 키체인 순으로 찾는다.
 * 못 찾으면 null. 실패 이유에 토큰이 섞일 여지를 아예 만들지 않기 위해
 * 각 단계의 오류는 삼키고 다음 후보로 넘어간다.
 */
export async function loadCredentials({ env = process.env, file = CREDENTIALS_FILE } = {}) {
  return (await fromEnvironment(env)) ?? (await fromFile(file)) ?? (await fromKeychain())
}

/**
 * 토큰을 모르는 지점에서도 쓸 수 있는 방어선(HTTP 500 핸들러 등).
 * 토큰처럼 생긴 문자열을 패턴으로 지운다. redact 가 실패하거나 앞으로
 * 누군가 새 경로를 만들어도 여기서 한 번 더 걸린다.
 */
const SECRET_PATTERNS = [
  [/sk-ant-[A-Za-z0-9_-]{10,}/g, '<redacted>'],
  [/\b(Bearer)\s+[A-Za-z0-9._~+/-]{20,}=*/gi, '$1 <redacted>'],
]

export function scrubSecrets(text) {
  if (typeof text !== 'string') return text

  return SECRET_PATTERNS.reduce((acc, [pattern, replacement]) => acc.replace(pattern, replacement), text)
}

/** 문자열에서 토큰을 지운다. 로그·에러에 내보내기 전에 반드시 통과시킨다. */
export function redact(text, credentials) {
  const token = credentials?.accessToken
  if (typeof text !== 'string') return text
  if (typeof token !== 'string' || token.length < MIN_TOKEN_LENGTH) return text

  return text.split(token).join('<redacted>')
}
