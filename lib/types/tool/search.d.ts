/**
 * `zhihu_search`: in-site search across Zhihu questions, answers, and articles,
 * read through the `ctx.zhihu` seam.
 *
 * @module @deepseek-ai/dsh-zhihu-plugin/tool/search
 */
import type { Context } from '@deepseek-ai/cordis';
import type { ZhihuSearchHit } from '../service/index.ts';
import type { GenericCallView, GenericResultView, ToolResult } from '@deepseek-ai/dsh-tools';
import type { JsonValue } from '@deepseek-ai/dsh-util-values';
import type { ZhihuToolLimits } from './shared.ts';
/** Registered name of the search tool. */
export declare const SEARCH_TOOL_NAME = "zhihu_search";
/** One search hit in the tool's canonical value. */
export interface ZhihuSearchItemValue {
    /** Content kind of the hit. */
    readonly kind: 'question' | 'answer' | 'article';
    /** Zhihu content id, kept as the provider's decimal string. */
    readonly id: string;
    /** Hit title. */
    readonly title: string;
    /** Bounded excerpt. */
    readonly excerpt: string;
    /** Canonical URL of the hit. */
    readonly url: string;
}
/** The search tool's canonical output value. */
export interface ZhihuSearchValue {
    /** Which query kind produced the value. */
    readonly kind: 'search';
    /** The query that was searched. */
    readonly query: string;
    /** The limit this call requested, after clamping. */
    readonly limit: number;
    /** Returned hits, in provider order. */
    readonly items: readonly ZhihuSearchItemValue[];
    /** True when the search reached the requested limit, so more hits may exist. */
    readonly truncated: boolean;
    /** Token that continues this search; absent when no further page exists. */
    readonly cursor?: string;
}
/** One hit as the replayable presentation meta carries it. */
export type ZhihuSearchItemMeta = {
    kind: 'question' | 'answer' | 'article';
    id: string;
    title: string;
    url: string;
};
/** The search tool's replayable presentation meta: bounded facts and no excerpts. */
export type ZhihuSearchMeta = {
    kind: 'search';
    query: string;
    limit: number;
    count: number;
    items: ZhihuSearchItemMeta[];
    truncated: boolean;
};
/**
 * Project one seam hit into the canonical value, bounding the excerpt so the
 * value, the render text, and the meta stay the same size.
 * @param hit - one hit from `ctx.zhihu.search`.
 * @param excerptMaxChars - the deployment's excerpt cap.
 * @returns the hit's canonical form.
 */
export declare function projectSearchHit(hit: ZhihuSearchHit, excerptMaxChars: number): ZhihuSearchItemValue;
/**
 * Reduce the canonical value to the replayable facts a card needs. Excerpts stay
 * out so the meta is bounded and carries no body text.
 * @param value - the canonical search value.
 * @returns the bounded presentation meta.
 */
export declare function searchMeta(value: ZhihuSearchValue): JsonValue;
/**
 * Render the hits for the model: the untrusted-content notice, one markdown line
 * per hit, and what a follow-up call can do with the ids.
 * @param value - the canonical search value.
 * @returns the model-facing text.
 */
export declare function formatSearchOutput(value: ZhihuSearchValue): string;
/**
 * Present a pending `zhihu_search` call.
 * @param args - presenter arguments from the session log.
 * @returns the generic card view, or undefined for the default card.
 */
export declare function presentSearchCall(args: unknown): GenericCallView | undefined;
/**
 * Present a completed `zhihu_search` result.
 * @param args - presenter arguments from the session log.
 * @param result - the final model-facing result.
 * @returns the generic card view, or undefined for the default card.
 */
export declare function presentSearchResult(args: unknown, result: ToolResult): GenericResultView | undefined;
/**
 * Register `zhihu_search` on the calling context.
 * @param ctx - context providing the tool registry and the Zhihu service.
 * @param limits - deployment caps resolved from the plugin config.
 */
export declare function applyZhihuSearchTool(ctx: Context, limits: ZhihuToolLimits): void;
//# sourceMappingURL=search.d.ts.map