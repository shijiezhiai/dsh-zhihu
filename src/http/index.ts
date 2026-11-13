/**
 * Credentialed HTTP provider for the Zhihu content seam (`ctx.zhihu`). The cookie comes from the
 * credentials service through a `CookieSource`, never from plugin config; requests refuse
 * redirects, respect a per-provider minimum interval, and every failure names the credential only by
 * its length and ticket presence.
 * @module @deepseek-ai/dsh-zhihu-plugin/http
 */

import { credentialRef, isCredentialRefName } from '@deepseek-ai/dsh-credentials'
import type { Context } from '@deepseek-ai/cordis'
import z from '@deepseek-ai/schemastery'
import type {} from '../service/index.ts'
import { ZhihuHttpClient } from './client.ts'
import { systemClock } from './clock.ts'
import { ZhihuHttpProvider } from './provider.ts'
import type { CookieSource } from './types.ts'

const MAX_NODE_TIMER_DELAY_MS = 2_147_483_647

export { ZhihuHttpClient } from './client.ts'
export type { ZhihuHttpClientOptions } from './client.ts'
export { systemClock } from './clock.ts'
export { ZhihuHttpProvider } from './provider.ts'
export type { ZhihuHttpProviderOptions } from './provider.ts'
export type { CookieSource, ZhihuClock, ZhihuTransport } from './types.ts'

/** Browser `User-Agent` Zhihu serves without a client-upgrade error. */
export const DEFAULT_USER_AGENT = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36'

/** Cordis plugin name used by loader diagnostics. */
export const name = 'zhihu-http'

/** The Zhihu seam this provider registers into. */
export const inject = ['zhihu']

/**
 * Plugin config. The cookie itself is never a field here: `credential` names the credentials
 * reference the request resolves, so the secret stays in the credentials service.
 */
export interface Config {
  /** Credentials reference holding the Zhihu cookie. */
  readonly credential?: string
  /** Per-request timeout in milliseconds. */
  readonly requestTimeoutMs?: number
  /** Minimum spacing between two requests from this provider, in milliseconds. */
  readonly minIntervalMs?: number
  /** Character cap on a read result's plain text. */
  readonly maxContentChars?: number
  /** Items requested from a feed or search when the caller omits a limit. */
  readonly pageSize?: number
  /** Pages one feed request may fetch; a paged feed is followed until the limit is met. */
  readonly maxFeedPages?: number
  /** Answers requested when a question read omits `answerLimit`. */
  readonly answerLimit?: number
  /** `user-agent` header value. */
  readonly userAgent?: string
}

/** Config schema; every deployment-varying choice is a validated field. */
export const Config: z<Config> = z.object({
  credential: z.string().default('zhihu'),
  requestTimeoutMs: z.number().default(20_000),
  minIntervalMs: z.number().default(1_000),
  maxContentChars: z.number().default(30_000),
  pageSize: z.number().default(20),
  maxFeedPages: z.number().default(3),
  answerLimit: z.number().default(1),
  userAgent: z.string().default(DEFAULT_USER_AGENT),
})

type ResolvedConfig = Required<Config>

/**
 * Read the cookie from the credentials service for every request, so a rotated or newly stored
 * cookie applies without remounting the provider. The credentials service is read through
 * `ctx.get()`, which keeps this plugin's `inject` list to the seam it contributes to.
 * @param ctx - the plugin context.
 * @param reference - the credentials reference name, validated by the plugin config.
 * @returns a source answering the cookie, or `undefined` when no credential is stored or the
 *   credentials service is not mounted.
 */
export function credentialsCookieSource(ctx: Context, reference: string): CookieSource {
  return async () => {
    const credentials = ctx.get('credentials')
    if (credentials === undefined) return undefined
    const resolved = await credentials.resolve(credentialRef(reference))
    return resolved?.value
  }
}

/**
 * Mount the HTTP provider on the Zhihu seam.
 * @param ctx - the plugin context; `ctx.zhihu` must be mounted.
 * @param config - the validated plugin config.
 */
export function apply(ctx: Context, config: Config): void {
  const resolved = config as ResolvedConfig
  assertTimeoutMs(resolved.requestTimeoutMs)
  assertMinIntervalMs(resolved.minIntervalMs)
  assertPositiveInteger('maxContentChars', resolved.maxContentChars)
  assertPositiveInteger('pageSize', resolved.pageSize)
  assertPositiveInteger('maxFeedPages', resolved.maxFeedPages)
  assertPositiveInteger('answerLimit', resolved.answerLimit)
  assertCredentialName(resolved.credential)
  assertUserAgent(resolved.userAgent)
  const client = new ZhihuHttpClient({
    cookie: credentialsCookieSource(ctx, resolved.credential),
    clock: systemClock,
    userAgent: resolved.userAgent,
    requestTimeoutMs: resolved.requestTimeoutMs,
    minIntervalMs: resolved.minIntervalMs,
  })
  ctx.zhihu.registerProvider(new ZhihuHttpProvider({
    transport: client,
    maxContentChars: resolved.maxContentChars,
    pageSize: resolved.pageSize,
    maxFeedPages: resolved.maxFeedPages,
    answerLimit: resolved.answerLimit,
  }))
}

/**
 * Reject a timeout Node cannot represent in a timer.
 * @param value - configured `requestTimeoutMs`.
 */
function assertTimeoutMs(value: number): void {
  if (!Number.isInteger(value) || value <= 0 || value > MAX_NODE_TIMER_DELAY_MS) {
    throw new Error(`zhihu-http: requestTimeoutMs must be a positive integer no greater than ${MAX_NODE_TIMER_DELAY_MS}`)
  }
}

/**
 * Reject a spacing that is negative, infinite, or longer than a Node timer.
 * @param value - configured `minIntervalMs`.
 */
function assertMinIntervalMs(value: number): void {
  if (!Number.isFinite(value) || value < 0 || value > MAX_NODE_TIMER_DELAY_MS) {
    throw new Error(`zhihu-http: minIntervalMs must be a finite number between 0 and ${MAX_NODE_TIMER_DELAY_MS}`)
  }
}

/**
 * Reject a non-positive or fractional count.
 * @param field - config field name used in the message.
 * @param value - configured value.
 */
function assertPositiveInteger(field: string, value: number): void {
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`zhihu-http: ${field} must be a positive integer`)
  }
}

/**
 * Reject a value that is not a credentials reference name.
 * @param value - configured `credential`.
 */
function assertCredentialName(value: string): void {
  if (!isCredentialRefName(value)) {
    throw new Error('zhihu-http: credential must be a credentials reference name (letters, digits, underscores; not starting with a digit)')
  }
}

/**
 * Reject an empty `user-agent`, which Zhihu would serve as an anonymous client.
 * @param value - configured `userAgent`.
 */
function assertUserAgent(value: string): void {
  if (value.trim() === '') {
    throw new Error('zhihu-http: userAgent must be a non-empty string')
  }
}
