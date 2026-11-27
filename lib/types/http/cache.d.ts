/**
 * Request-keyed TTL cache for the Zhihu transport. Two reads of the same lane inside one lifetime
 * answer from memory, so reopening a panel costs no upstream request. Failures are never stored.
 * @module @deepseek-ai/dsh-zhihu-plugin/http/cache
 */
import type { ZhihuClock, ZhihuTransport } from './types.ts';
/** Construction inputs for {@link ZhihuCachedTransport}. */
export interface ZhihuCachedTransportOptions {
    /** The transport that performs the request on a miss. */
    readonly inner: ZhihuTransport;
    /** Time source for an entry's lifetime; injected so tests never wait. */
    readonly clock: ZhihuClock;
    /** How long one response stays usable, in milliseconds. */
    readonly ttlMs: number;
}
/**
 * A transport that answers a repeated URL from memory until its entry expires. Two identical
 * concurrent misses each reach Zhihu, because a request in flight is not yet an entry.
 */
export declare class ZhihuCachedTransport implements ZhihuTransport {
    private readonly options;
    private readonly entries;
    constructor(options: ZhihuCachedTransportOptions);
    /**
     * Answer one GET, from memory while its entry is fresh.
     * @param url - absolute request URL, which is also the cache key.
     * @param signal - cancellation of the request this call misses into.
     * @returns the parsed body.
     */
    get<T>(url: string, signal?: AbortSignal): Promise<T>;
    /**
     * Send one write straight through: a POST answers what its body asks for, so no earlier GET of the
     * same URL may stand in for it.
     * @param url - absolute request URL.
     * @param body - JSON request body.
     * @param signal - cancellation of the call.
     * @returns the parsed body.
     */
    post<T>(url: string, body: string, signal?: AbortSignal): Promise<T>;
    /**
     * Drop every entry whose lifetime has elapsed. Called before a store so that keys a caller never
     * re-requests do not accumulate for the life of the plugin mount.
     */
    private prune;
}
//# sourceMappingURL=cache.d.ts.map