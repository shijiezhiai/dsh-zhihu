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
  /** Longest wait a throttled request absorbs before it is sent once more, in milliseconds; 0 never resends. */
  readonly retryCeilingMs: number
}

/** One send: either the parsed body, or the classified failure that ended it. */
type ZhihuAttempt<T> =
  | { readonly ok: true; readonly body: T }
  | { readonly ok: false; readonly failure: ZhihuError }

/** A JSON body one write sends; a read passes none. */
interface ZhihuWrite {
  /** JSON request body. */
  readonly body: string
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
   * @param signal - cancellation of the call, including the wait before a resend.
   * @returns the parsed body.
   */
  async get<T>(url: string, signal?: AbortSignal): Promise<T> {
    return await this.queued<T>(url, signal, undefined)
  }

  /**
   * Perform one POST through the same serial queue, so a write never overtakes a read.
   * @param url - absolute request URL.
   * @param body - JSON request body.
   * @param signal - cancellation of the call, including the wait before a resend.
   * @returns the parsed body.
   */
  async post<T>(url: string, body: string, signal?: AbortSignal): Promise<T> {
    return await this.queued<T>(url, signal, { body })
  }

  /** Put one request on the queue and hand back its own result. */
  private async queued<T>(url: string, signal: AbortSignal | undefined, write: ZhihuWrite | undefined): Promise<T> {
    const result = this.tail.then(async () => await this.perform<T>(url, signal, write))
    this.tail = result.then(() => undefined, () => undefined)
    return await result
  }

  /**
   * Serve one request, absorbing the throttling wait it named at most once. A request that fails
   * again after the resend is reported, so a permanently refused URL cannot loop.
   */
  private async perform<T>(url: string, signal: AbortSignal | undefined, write: ZhihuWrite | undefined): Promise<T> {
    const cookie = await this.requireCookie()
    const first = await this.exchange<T>(url, cookie, signal, write)
    if (first.ok) return first.body
    const wait = this.waitBeforeRetry(first.failure)
    if (wait === undefined) throw first.failure
    await sleepUnlessAborted(this.options.clock, wait, signal)
    const second = await this.exchange<T>(url, cookie, signal, write)
    if (second.ok) return second.body
    throw second.failure
  }

  /** Wait for the next allowed slot, send, and classify the answer. */
  private async exchange<T>(
    url: string,
    cookie: string,
    signal: AbortSignal | undefined,
    write: ZhihuWrite | undefined,
  ): Promise<ZhihuAttempt<T>> {
    await this.waitForSlot()
    const response = await this.send(url, cookie, signal, write)
    const text = await response.text()
    if (!response.ok) {
      return { ok: false, failure: this.failure(response.status, text, response.headers.get('retry-after'), cookie) }
    }
    try {
      return { ok: true, body: parseLosslessJson(text) as T }
    } catch (cause) {
      throw this.nonJsonBody(text, cookie, cause)
    }
  }

  /**
   * Read the wait a failure asked for, when this client is allowed to absorb it.
   * @param failure - the classified failure of the first attempt.
   * @returns the wait in milliseconds, or `undefined` when the request must be reported instead.
   */
  private waitBeforeRetry(failure: ZhihuError): number | undefined {
    const seconds = failure.retryAfterSeconds
    if (seconds === undefined || this.options.retryCeilingMs === 0) return undefined
    const wait = seconds * 1_000
    return wait <= this.options.retryCeilingMs ? wait : undefined
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
   * Send one request. `redirect: 'error'` makes fetch reject instead of following a redirect, so a
   * redirected credential-bearing request never reaches a second host (packages/web/AGENTS.md).
   */
  private async send(
    url: string, cookie: string, signal: AbortSignal | undefined, write: ZhihuWrite | undefined,
  ): Promise<Response> {
    try {
      return await fetch(url, {
        method: write === undefined ? 'GET' : 'POST',
        headers: {
          'user-agent': this.options.userAgent,
          'referer': ZHIHU_REFERER,
          'accept': ZHIHU_ACCEPT,
          'cookie': cookie,
          ...(write === undefined ? {} : { 'content-type': 'application/json' }),
        },
        ...(write === undefined ? {} : { body: write.body }),
        redirect: 'error',
        signal: combinedSignal(signal, AbortSignal.timeout(this.options.requestTimeoutMs)),
      })
    } catch (cause) {
      throw new ZhihuError(`Zhihu request failed before a response arrived (${cookieDiagnostics(cookie)})`, 'ZHIHU_BAD_RESPONSE', { cause })
    }
  }

  /**
   * Turn a failed response into the classified seam failure, carrying the wait a throttling response
   * asked for so both the message and the error itself can name it.
   */
  private failure(status: number, text: string, retryAfter: string | null, cookie: string): ZhihuError {
    const error = errorOf(text)
    const detail = error?.message ?? 'unrecognized response body'
    const kind = classifyFailure(status, error)
    const seconds = retryAfterSeconds(retryAfter, this.options.clock.now())
    const wait = seconds === undefined ? '' : `, retry after ${seconds} s`
    return new ZhihuError(
      `Zhihu request failed with HTTP ${status}: ${detail}${wait} (${cookieDiagnostics(cookie)})`,
      zhihuErrorCode(kind),
      seconds === undefined ? undefined : { retryAfterSeconds: seconds },
    )
  }
}

/**
 * Tie a request's own timeout to the caller's cancellation.
 * @param signal - the caller's cancellation, when it passes one.
 * @param timeout - the request's own deadline.
 * @returns a signal that aborts when either one does.
 */
function combinedSignal(signal: AbortSignal | undefined, timeout: AbortSignal): AbortSignal {
  return signal === undefined ? timeout : AbortSignal.any([signal, timeout])
}

/**
 * Wait against the client's clock, giving the wait up the moment the caller cancels.
 * @param clock - time source; tests inject one that resolves without waiting.
 * @param ms - the wait in milliseconds; a non-positive value resolves immediately.
 * @param signal - the caller's cancellation, when it passes one.
 * @throws the signal's reason when it aborts before the wait elapses.
 */
async function sleepUnlessAborted(clock: ZhihuClock, ms: number, signal: AbortSignal | undefined): Promise<void> {
  if (ms <= 0) return
  if (signal === undefined) {
    await clock.sleep(ms)
    return
  }
  signal.throwIfAborted()
  const aborted = Promise.withResolvers<never>()
  const onAbort = (): void => { aborted.reject(signal.reason) }
  signal.addEventListener('abort', onAbort, { once: true })
  try {
    await Promise.race([clock.sleep(ms), aborted.promise])
  } finally {
    signal.removeEventListener('abort', onAbort)
  }
}

/** `Retry-After` sent as delay-seconds, per RFC 9110. */
const DELAY_SECONDS = /^\d+$/u

/**
 * Read the wait a response asked for. RFC 9110 allows either delay-seconds or an HTTP-date, and a
 * date already in the past means "now".
 * @param header - the `retry-after` header value, or `null` when absent.
 * @param now - current time in milliseconds, used to age an HTTP-date.
 * @returns the wait in whole seconds, or `undefined` when the header is absent or unreadable.
 */
function retryAfterSeconds(header: string | null, now: number): number | undefined {
  const value = (header ?? '').trim()
  if (value === '') return undefined
  if (DELAY_SECONDS.test(value)) return Number(value)
  const at = Date.parse(value)
  if (Number.isNaN(at)) return undefined
  return Math.max(0, Math.ceil((at - now) / 1_000))
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
