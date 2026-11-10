/**
 * Credentialed HTTP transport for Zhihu. Every request resolves the cookie from its source, waits
 * for the provider's rate-limit slot, sends the Zhihu headers, refuses redirects, and parses the
 * body losslessly. Failure messages carry redacted cookie diagnostics only.
 * @module @deepseek-ai/dsh-zhihu-plugin/http/client
 */
import type { CookieSource, ZhihuClock, ZhihuTransport } from './types.ts';
/** Construction inputs for {@link ZhihuHttpClient}. */
export interface ZhihuHttpClientOptions {
    /** Resolves the cookie per request, so a changed credential applies immediately. */
    readonly cookie: CookieSource;
    /** Time source for the rate-limit spacing; injected so tests never wait. */
    readonly clock: ZhihuClock;
    /** `user-agent` header value. */
    readonly userAgent: string;
    /** Per-request timeout handed to `AbortSignal.timeout()`. */
    readonly requestTimeoutMs: number;
    /** Minimum spacing between two requests made by this client. */
    readonly minIntervalMs: number;
}
/**
 * The transport behind {@link ZhihuHttpProvider}: one serial queue, one rate-limit slot per request,
 * and a lossless parser for the body.
 */
export declare class ZhihuHttpClient implements ZhihuTransport {
    private readonly options;
    private lastRequestAt;
    private tail;
    constructor(options: ZhihuHttpClientOptions);
    /**
     * Perform one GET through the serial queue.
     * @param url - absolute request URL.
     * @returns the parsed body.
     */
    get<T>(url: string): Promise<T>;
    /** Resolve the cookie, wait for the next allowed slot, send, and parse. */
    private perform;
    /** Report a 200 body that is not JSON: a challenge page is blocked, anything else is unusable. */
    private nonJsonBody;
    /** Read the cookie or fail with the login-required code; the message never contains it. */
    private requireCookie;
    /** Sleep out the remainder of `minIntervalMs` measured from the previous request. */
    private waitForSlot;
    /**
     * Send one GET. `redirect: 'error'` makes fetch reject instead of following a redirect, so a
     * redirected credential-bearing request never reaches a second host (packages/web/AGENTS.md).
     */
    private send;
    /** Turn a failed response into the classified seam failure. */
    private failure;
}
//# sourceMappingURL=client.d.ts.map