/**
 * Mapping from Zhihu HTTP responses to seam failures, plus redacted cookie diagnostics. Every
 * message this module produces is safe to log: a cookie contributes its byte length and whether a
 * ticket is present, never its value.
 * @module @deepseek-ai/dsh-zhihu-plugin/http/classify
 */

import type { ZhihuErrorCode } from '../service/index.ts'
import { assertNever } from './assert-never.ts'
import type { ZhihuWireError } from './types.ts'

/**
 * The failure groups a Zhihu response can fall into. Zhihu reports most failures as a 401 or 403
 * with an `error.code`; the HTTP status alone is only a fallback, because the same status carries
 * different meanings (403 is both `40362` throttling and `40353` paywalled content).
 */
export type ZhihuFailureKind = 'login-required' | 'rate-limited' | 'blocked' | 'not-found' | 'bad-response'

/**
 * Map a failure group onto its seam error code.
 * @param kind - the classified failure.
 * @returns the discriminant carried by `ZhihuError.code`.
 */
export function zhihuErrorCode(kind: ZhihuFailureKind): ZhihuErrorCode {
  switch (kind) {
    case 'login-required':
      return 'ZHIHU_LOGIN_REQUIRED'
    case 'rate-limited':
      return 'ZHIHU_RATE_LIMITED'
    case 'blocked':
      return 'ZHIHU_BLOCKED'
    case 'not-found':
      return 'ZHIHU_NOT_FOUND'
    case 'bad-response':
      return 'ZHIHU_BAD_RESPONSE'
    default:
      return assertNever(kind)
  }
}

/**
 * Classify one failed response. The body's API error code wins over the HTTP status, and the status
 * is used only when the body carries no recognized code.
 * @param status - HTTP status of the response.
 * @param error - the parsed `error` member, when the body carried one.
 * @returns the failure group.
 */
export function classifyFailure(status: number, error: ZhihuWireError | undefined): ZhihuFailureKind {
  const code = typeof error?.code === 'string' ? Number(error.code) : error?.code
  if (code === 101 || code === 100) return 'login-required'
  if (code === 40362) return 'rate-limited'
  if (code === 40353) return 'blocked'
  if (code === 4041) return 'not-found'
  if (status === 401) return 'login-required'
  if (status === 403) return 'blocked'
  if (status === 404) return 'not-found'
  if (status === 429) return 'rate-limited'
  return 'bad-response'
}

/** Markers present only on a Zhihu risk-control challenge page. */
const CHALLENGE_MARKERS = ['zh-zse-ck', 'unhuman']

/**
 * Classify a 200 response whose body is not JSON. Zhihu answers a throttled caller with a
 * challenge page carrying `zh-zse-ck` or `unhuman` markers instead of an API error.
 * @param text - the raw response body.
 * @returns the failure group: `blocked` for a challenge page, `bad-response` otherwise.
 */
export function classifyBody(text: string): 'blocked' | 'bad-response' {
  const challenged = CHALLENGE_MARKERS.some(marker => text.includes(marker))
  return challenged ? 'blocked' : 'bad-response'
}

/**
 * Describe a cookie without revealing it. Only the byte length and whether a `z_c0` or `d_c0`
 * field is present may leave this function, so the result is safe for logs and error messages.
 * @param cookie - the cookie header value, possibly empty.
 * @returns a redacted diagnostic such as `cookie bytes=812, ticket=present`.
 */
export function cookieDiagnostics(cookie: string): string {
  const ticket = cookie.includes('z_c0=') || cookie.includes('d_c0=')
  return `cookie bytes=${cookie.length}, ticket=${ticket ? 'present' : 'absent'}`
}
