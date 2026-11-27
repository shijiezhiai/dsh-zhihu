/**
 * Request-keyed TTL cache for the Zhihu transport. Two reads of the same lane inside one lifetime
 * answer from memory, so reopening a panel costs no upstream request. Failures are never stored.
 * @module @deepseek-ai/dsh-zhihu-plugin/http/cache
 */

import type { ZhihuClock, ZhihuTransport } from './types.ts'

/** Construction inputs for {@link ZhihuCachedTransport}. */
export interface ZhihuCachedTransportOptions {
  /** The transport that performs the request on a miss. */
  readonly inner: ZhihuTransport
  /** Time source for an entry's lifetime; injected so tests never wait. */
  readonly clock: ZhihuClock
  /** How long one response stays usable, in milliseconds. */
  readonly ttlMs: number
}

/** One stored response and when it was stored. */
interface CacheEntry {
  /** Clock reading at the moment the response arrived. */
  readonly storedAt: number
  /** The parsed body, as the transport returned it. */
  readonly body: unknown
}

/**
 * A transport that answers a repeated URL from memory until its entry expires. Two identical
 * concurrent misses each reach Zhihu, because a request in flight is not yet an entry.
 */
export class ZhihuCachedTransport implements ZhihuTransport {
  private readonly entries = new Map<string, CacheEntry>()

  constructor(private readonly options: ZhihuCachedTransportOptions) {}

  /**
   * Answer one GET, from memory while its entry is fresh.
   * @param url - absolute request URL, which is also the cache key.
   * @param signal - cancellation of the request this call misses into.
   * @returns the parsed body.
   */
  async get<T>(url: string, signal?: AbortSignal): Promise<T> {
    const entry = this.entries.get(url)
    if (entry !== undefined) {
      if (this.options.clock.now() - entry.storedAt < this.options.ttlMs) return entry.body as T
      this.entries.delete(url)
    }
    const body = await this.options.inner.get<T>(url, signal)
    this.prune()
    this.entries.set(url, { storedAt: this.options.clock.now(), body })
    return body
  }

  /**
   * Send one write straight through: a POST answers what its body asks for, so no earlier GET of the
   * same URL may stand in for it.
   * @param url - absolute request URL.
   * @param body - JSON request body.
   * @param signal - cancellation of the call.
   * @returns the parsed body.
   */
  async post<T>(url: string, body: string, signal?: AbortSignal): Promise<T> {
    return await this.options.inner.post<T>(url, body, signal)
  }

  /**
   * Drop every entry whose lifetime has elapsed. Called before a store so that keys a caller never
   * re-requests do not accumulate for the life of the plugin mount.
   */
  private prune(): void {
    const now = this.options.clock.now()
    for (const [url, entry] of this.entries) {
      if (now - entry.storedAt >= this.options.ttlMs) this.entries.delete(url)
    }
  }
}
