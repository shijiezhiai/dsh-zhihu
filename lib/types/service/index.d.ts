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
import type { ZhihuErrorCode, ZhihuFeedPage, ZhihuFeedRequest, ZhihuProvider, ZhihuReadRequest, ZhihuReadResult, ZhihuSearchPage, ZhihuSearchRequest } from './types.ts';
export type { ZhihuContentKind, ZhihuErrorCode, ZhihuFeedItem, ZhihuFeedKind, ZhihuFeedPage, ZhihuFeedRequest, ZhihuProvider, ZhihuReadKind, ZhihuReadRequest, ZhihuReadResult, ZhihuSearchHit, ZhihuSearchPage, ZhihuSearchRequest, } from './types.ts';
/**
 * Failure raised by the seam or by a provider. `code` is the machine-readable discriminant; every
 * message is free of credential material, so it is safe to log and to show a model.
 */
export declare class ZhihuError extends HarnessError {
    /** Discriminant; see {@link ZhihuErrorCode}. */
    readonly code: ZhihuErrorCode;
    /**
     * @param message - human-readable failure description; never contains a cookie.
     * @param code - the discriminant.
     * @param options - optional `cause`, for the underlying transport failure.
     */
    constructor(message: string, code: ZhihuErrorCode, options?: ErrorOptions);
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
     * @returns the page, its entries truncated when the provider over-returns.
     */
    feed(request: ZhihuFeedRequest): Promise<ZhihuFeedPage>;
    /**
     * Read one question or answer through the selected provider. A question read returns its title
     * plus the text of one answer, because Zhihu's question-detail API is unavailable.
     * @param request - the content kind, its lossless id, and an optional answer count.
     * @returns the read result with the body already converted to plain text.
     */
    read(request: ZhihuReadRequest): Promise<ZhihuReadResult>;
    /**
     * Search Zhihu content through the selected provider, capped to `request.limit`.
     * @param request - the query, an optional hit limit, and an optional continuation token.
     * @returns the page, its hits truncated when the provider over-returns.
     */
    search(request: ZhihuSearchRequest): Promise<ZhihuSearchPage>;
    /** Select the provider with the rules above, throwing the matching {@link ZhihuError}. */
    private selectProvider;
}
export default ZhihuService;
//# sourceMappingURL=index.d.ts.map