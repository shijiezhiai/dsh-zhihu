/**
 * `zhihu_feed`: the Zhihu hot list and the signed-in account's recommendation
 * stream, read through the `ctx.zhihu` seam.
 *
 * @module @deepseek-ai/dsh-zhihu-plugin/tool/feed
 */
import type { Context } from '@deepseek-ai/cordis';
import type { ZhihuFeedItem, ZhihuFeedKind } from '../service/index.ts';
import type { GenericCallView, GenericResultView, ToolResult } from '@deepseek-ai/dsh-tools';
import type { JsonValue } from '@deepseek-ai/dsh-util-values';
import type { ZhihuToolLimits } from './shared.ts';
/** Registered name of the feed tool. */
export declare const FEED_TOOL_NAME = "zhihu_feed";
/** One feed entry in the tool's canonical value. */
export interface ZhihuFeedItemValue {
    /** Content kind of the entry. */
    readonly kind: 'question' | 'answer' | 'article';
    /** Zhihu content id, kept as the provider's decimal string. */
    readonly id: string;
    /** Entry title. */
    readonly title: string;
    /** Bounded excerpt. */
    readonly excerpt: string;
    /** Provider heat label, when the entry carries one. */
    readonly heatLabel?: string;
    /** Canonical URL of the entry. */
    readonly url: string;
}
/** The feed tool's canonical output value. */
export interface ZhihuFeedValue {
    /** Which feed was listed. */
    readonly kind: ZhihuFeedKind;
    /** The limit this call requested, after clamping. */
    readonly limit: number;
    /** Returned entries, in provider order. */
    readonly items: readonly ZhihuFeedItemValue[];
    /** True when the feed reached the requested limit, so more entries may exist. */
    readonly truncated: boolean;
}
/** One entry as the replayable presentation meta carries it. */
export type ZhihuFeedEntryMeta = {
    kind: 'question' | 'answer' | 'article';
    id: string;
    title: string;
    url: string;
    heatLabel?: string;
};
/** The feed tool's replayable presentation meta: bounded facts and no excerpts. */
export type ZhihuFeedMeta = {
    kind: ZhihuFeedKind;
    limit: number;
    count: number;
    items: ZhihuFeedEntryMeta[];
    truncated: boolean;
};
/**
 * Project one seam entry into the canonical value, bounding the excerpt so the
 * value, the render text, and the meta stay the same size.
 * @param item - one entry from `ctx.zhihu.feed`.
 * @param excerptMaxChars - the deployment's excerpt cap.
 * @returns the entry's canonical form.
 */
export declare function projectFeedItem(item: ZhihuFeedItem, excerptMaxChars: number): ZhihuFeedItemValue;
/**
 * Reduce the canonical value to the replayable facts a card needs. Excerpts stay
 * out so the meta is bounded and carries no body text.
 * @param value - the canonical feed value.
 * @returns the bounded presentation meta.
 */
export declare function feedMeta(value: ZhihuFeedValue): JsonValue;
/**
 * Render the feed for the model: the untrusted-content notice, one markdown line
 * per entry, and what a follow-up call can do with the ids.
 * @param value - the canonical feed value.
 * @returns the model-facing text.
 */
export declare function formatFeedOutput(value: ZhihuFeedValue): string;
/**
 * Present a pending `zhihu_feed` call.
 * @param args - presenter arguments from the session log.
 * @returns the generic card view, or undefined for the default card.
 */
export declare function presentFeedCall(args: unknown): GenericCallView | undefined;
/**
 * Present a completed `zhihu_feed` result.
 * @param args - presenter arguments from the session log.
 * @param result - the final model-facing result.
 * @returns the generic card view, or undefined for the default card.
 */
export declare function presentFeedResult(args: unknown, result: ToolResult): GenericResultView | undefined;
/**
 * Register `zhihu_feed` on the calling context.
 * @param ctx - context providing the tool registry and the Zhihu service.
 * @param limits - deployment caps resolved from the plugin config.
 */
export declare function applyZhihuFeedTool(ctx: Context, limits: ZhihuToolLimits): void;
//# sourceMappingURL=feed.d.ts.map