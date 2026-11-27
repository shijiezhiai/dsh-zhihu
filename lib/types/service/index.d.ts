/**
 * Service Definition for the Zhihu content capability seam (`ctx.zhihu`): a provider registry plus
 * provider-selecting execution for feeds, content reads, and search. Duplicate ids are rejected. At
 * execution time a configured provider must exist and be usable; without one, exactly one usable
 * provider is required, so selection never depends on registration order.
 * @module @deepseek-ai/dsh-zhihu
 */
import { Context, Service, type Volatile } from '@deepseek-ai/cordis';
import z from '@deepseek-ai/schemastery';
import { HarnessError } from '@deepseek-ai/dsh-llm';
import type { ZhihuCommentsPage, ZhihuCommentsRequest, ZhihuErrorCode, ZhihuFeedPage, ZhihuFeedRequest, ZhihuProvider, ZhihuReadRequest, ZhihuReadResult, ZhihuRepliesRequest, ZhihuSearchPage, ZhihuSearchRequest } from './types.ts';
export type { ZhihuComment, ZhihuCommentsPage, ZhihuCommentsRequest, ZhihuContentKind, ZhihuErrorCode, ZhihuFeedItem, ZhihuFeedKind, ZhihuFeedPage, ZhihuFeedRequest, ZhihuProvider, ZhihuReadKind, ZhihuReadRequest, ZhihuReadResult, ZhihuRepliesRequest, ZhihuSearchHit, ZhihuSearchPage, ZhihuSearchRequest, ZhihuSearchSort, ZhihuSearchTimeWindow, } from './types.ts';
/** Construction inputs for {@link ZhihuError}. */
export interface ZhihuErrorOptions extends ErrorOptions {
    /** Whole seconds Zhihu asked the caller to wait, from its `Retry-After` header. */
    readonly retryAfterSeconds?: number;
}
/**
 * Failure raised by the seam or by a provider. `code` is the machine-readable discriminant; every
 * message is free of credential material, so it is safe to log and to show a model.
 */
export declare class ZhihuError extends HarnessError {
    /** Discriminant; see {@link ZhihuErrorCode}. */
    readonly code: ZhihuErrorCode;
    /**
     * Wait Zhihu asked for before the next request, in whole seconds; `undefined` when the response
     * named none. Present on a rate-limited failure so a caller can say when to try again.
     */
    readonly retryAfterSeconds: number | undefined;
    /**
     * @param message - human-readable failure description; never contains a cookie.
     * @param code - the discriminant.
     * @param options - optional `cause` for the underlying transport failure, and the wait Zhihu named.
     */
    constructor(message: string, code: ZhihuErrorCode, options?: ZhihuErrorOptions);
}
declare module '@deepseek-ai/cordis' {
    interface Context {
        /** The Zhihu content seam; present once one `dsh-zhihu` service instance is mounted. */
        zhihu: ZhihuService;
    }
}
/**
 * Config for the Zhihu seam. `provider` pins which registered provider wins; omitted means
 * auto-select when exactly one usable provider is registered. Each operation reads the current
 * value, so a settings change applies to the next call without remounting the service.
 */
export interface ZhihuServiceConfig {
    /** Explicit provider id. Omitted = auto-select when exactly one provider is usable. */
    readonly provider: Volatile<string | undefined>;
}
/**
 * The Zhihu content service, registered as `ctx.zhihu` (one instance per context).
 *
 * Selection semantics (resolved per call, never order-dependent):
 * - A configured id that is registered and `available()` → that provider.
 * - A configured id not registered → `ZHIHU_PROVIDER_CONFIGURED_MISSING`.
 * - A configured id registered but unavailable → `ZHIHU_PROVIDER_CONFIGURED_UNAVAILABLE`.
 * - No id configured, exactly one registered usable provider → that provider.
 * - No id configured, multiple usable providers → `ZHIHU_PROVIDER_AMBIGUOUS`.
 * - No id configured, no usable provider → `ZHIHU_PROVIDER_UNAVAILABLE`.
 */
export declare class ZhihuService extends Service {
    private readonly config;
    /** Provider selection config, read on every call. */
    static Config: z<Schemastery.ObjectS<NoInfer<{
        provider: z<string, string, "volatile">;
    }>>, Schemastery.ObjectT<NoInfer<{
        provider: z<string, string, "volatile">;
    }>>, "plain">;
    private readonly providers;
    constructor(ctx: Context, config: ZhihuServiceConfig);
    /**
     * Register a provider. Throws {@link ZhihuError} `ZHIHU_DUPLICATE_PROVIDER` when its id is
     * already registered. The returned disposer unregisters it; the registration is also disposed
     * with the calling fiber.
     * @param provider - the provider; its `id` is the registry key and the value `provider` pins.
     * @returns the disposer that unregisters the provider.
     */
    registerProvider(provider: ZhihuProvider): () => void;
    /**
     * List one feed page through the selected provider, capped to `request.limit`.
     * @param request - the feed kind, an optional item limit, and an optional continuation token.
     * @param signal - cancellation of the call.
     * @returns the page, its entries truncated when the provider over-returns.
     */
    feed(request: ZhihuFeedRequest, signal?: AbortSignal): Promise<ZhihuFeedPage>;
    /**
     * Read one question or answer through the selected provider. A question read returns its title
     * plus the text of one answer, because Zhihu's question-detail API is unavailable.
     * @param request - the content kind, its lossless id, and an optional answer count.
     * @param signal - cancellation of the call.
     * @returns the read result with the body already converted to plain text.
     */
    read(request: ZhihuReadRequest, signal?: AbortSignal): Promise<ZhihuReadResult>;
    /**
     * Search Zhihu content through the selected provider, capped to `request.limit`.
     * @param request - the query, an optional hit limit, and an optional continuation token.
     * @param signal - cancellation of the call.
     * @returns the page, its hits truncated when the provider over-returns.
     */
    search(request: ZhihuSearchRequest, signal?: AbortSignal): Promise<ZhihuSearchPage>;
    /**
     * List one slice of a content's root comments through the selected provider, capped to
     * `request.limit`.
     * @param request - the content kind and id, an optional comment limit, and an optional cursor.
     * @param signal - cancellation of the call.
     * @returns the comments read, truncated when the provider over-returns, and the cursor of the
     * page that follows.
     */
    comments(request: ZhihuCommentsRequest, signal?: AbortSignal): Promise<ZhihuCommentsPage>;
    /**
     * Read the replies under one root comment.
     * @param request - the root comment id and an optional reply limit.
     * @param signal - cancellation of the call.
     * @returns one slice of the replies, capped to `request.limit`.
     */
    replies(request: ZhihuRepliesRequest, signal?: AbortSignal): Promise<ZhihuCommentsPage>;
    /** Select the provider with the rules above, throwing the matching {@link ZhihuError}. */
    private selectProvider;
}
export default ZhihuService;
//# sourceMappingURL=index.d.ts.map