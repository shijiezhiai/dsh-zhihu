/**
 * Credentialed HTTP transport for Zhihu. Every request resolves the cookie from its source, waits
 * for the provider's rate-limit slot, sends the Zhihu headers, refuses redirects, and parses the
 * body losslessly. Failure messages carry redacted cookie diagnostics only.
 * @module @deepseek-ai/dsh-zhihu-plugin/http/client
 */

import { ZhihuError } from '../service/index.ts'
import { classifyBody, classifyFailure, cookieDiagnostics, zhihuErrorCode } from './classify.ts'
import { parseLosslessJson } from './lossless-json.ts'
import type { CookieSource, ZhihuClock, ZhihuTransport, ZhihuWireError } from './types.ts'

/** The request headers Zhihu requires on every API call. */
const ZHIHU_REFERER = 'https://www.zhihu.com/'
const ZHIHU_ACCEPT = 'application/json, text/plain, */*'

/** Construction inputs for {@link ZhihuHttpClient}. */
export interface ZhihuHttpClientOptions {
  /** Resolves the cookie per request, so a changed credential applies immediately. */
  readonly cookie: CookieSource
  /** Time source for the rate-limit spacing; injected so tests never wait. */
  readonly clock: ZhihuClock
  /** `user-agent` header value. */
  readonly userAgent: string
  /** Per-request timeout handed to `AbortSignal.timeout()`. */
  readonly requestTimeoutMs: number
  /** Minimum spacing between two requests made by this client. */
  readonly minIntervalMs: number
}

/** Body of a Zhihu failure response. */
interface ZhihuFailureBody {
  /** The API error member. */
  readonly error?: ZhihuWireError
}

/**
 * The transport behind {@link ZhihuHttpProvider}: one serial queue, one rate-limit slot per request,
 * and a lossless parser for the body.
 */
export class ZhihuHttpClient implements ZhihuTransport {
  private lastRequestAt: number | undefined
  private tail: Promise<void> = Promise.resolve()

  constructor(private readonly options: ZhihuHttpClientOptions) {}

  /**
   * Perform one GET through the serial queue.
   * @param url - absolute request URL.
   * @returns the parsed body.
   */
  async get<T>(url: string): Promise<T> {
    const result = this.tail.then(async () => await this.perform<T>(url))
    this.tail = result.then(() => undefined, () => undefined)
    return await result
  }

  /** Resolve the cookie, wait for the next allowed slot, send, and parse. */
  private async perform<T>(url: string): Promise<T> {
    const cookie = await this.requireCookie()
    await this.waitForSlot()
    const response = await this.send(url, cookie)
    const text = await response.text()
    if (!response.ok) throw this.failure(response.status, text, cookie)
    try {
      return parseLosslessJson(text) as T
    } catch (cause) {
      throw this.nonJsonBody(text, cookie, cause)
    }
  }

  /** Report a 200 body that is not JSON: a challenge page is blocked, anything else is unusable. */
  private nonJsonBody(text: string, cookie: string, cause: unknown): ZhihuError {
    const kind = classifyBody(text)
    const what = kind === 'blocked' ? 'a risk-control challenge page' : 'a non-JSON body'
    return new ZhihuError(`Zhihu returned ${what} instead of JSON (${cookieDiagnostics(cookie)})`, zhihuErrorCode(kind), { cause })
  }

  /** Read the cookie or fail with the login-required code; the message never contains it. */
  private async requireCookie(): Promise<string> {
    const stored = await this.options.cookie()
    const cookie = (stored ?? '').trim()
    if (cookie === '') {
      throw new ZhihuError(`no Zhihu cookie is available (${cookieDiagnostics(cookie)})`, 'ZHIHU_LOGIN_REQUIRED')
    }
    if (!cookie.includes('z_c0=')) {
      throw new ZhihuError(`the Zhihu cookie carries no z_c0 ticket (${cookieDiagnostics(cookie)})`, 'ZHIHU_LOGIN_REQUIRED')
    }
    return cookie
  }

  /** Sleep out the remainder of `minIntervalMs` measured from the previous request. */
  private async waitForSlot(): Promise<void> {
    const now = this.options.clock.now()
    const earliest = this.lastRequestAt === undefined ? now : this.lastRequestAt + this.options.minIntervalMs
    const wait = earliest - now
    if (wait > 0) await this.options.clock.sleep(wait)
    this.lastRequestAt = this.options.clock.now()
  }

  /**
   * Send one GET. `redirect: 'error'` makes fetch reject instead of following a redirect, so a
   * redirected credential-bearing request never reaches a second host (packages/web/AGENTS.md).
   */
  private async send(url: string, cookie: string): Promise<Response> {
    try {
      return await fetch(url, {
        method: 'GET',
        headers: {
          'user-agent': this.options.userAgent,
          'referer': ZHIHU_REFERER,
          'accept': ZHIHU_ACCEPT,
          'cookie': cookie,
        },
        redirect: 'error',
        signal: AbortSignal.timeout(this.options.requestTimeoutMs),
      })
    } catch (cause) {
      throw new ZhihuError(`Zhihu request failed before a response arrived (${cookieDiagnostics(cookie)})`, 'ZHIHU_BAD_RESPONSE', { cause })
    }
  }

  /** Turn a failed response into the classified seam failure. */
  private failure(status: number, text: string, cookie: string): ZhihuError {
    const error = errorOf(text)
    const detail = error?.message ?? 'unrecognized response body'
    const kind = classifyFailure(status, error)
    return new ZhihuError(`Zhihu request failed with HTTP ${status}: ${detail} (${cookieDiagnostics(cookie)})`, zhihuErrorCode(kind))
  }
}

/**
 * Extract the `error` member of a failure body.
 * @param text - raw response body.
 * @returns the parsed error, or `undefined` when the body is not a JSON error object.
 */
function errorOf(text: string): ZhihuWireError | undefined {
  try {
    return (parseLosslessJson(text) as ZhihuFailureBody).error
  } catch (_notJson) {
    return undefined // A non-JSON body carries no API error code; the status alone classifies it.
  }
}
