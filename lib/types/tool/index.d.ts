/**
 * Model-facing Zhihu tools: the hot and recommendation feeds, question and
 * answer reading, and in-site search, all served from the `ctx.zhihu` service.
 *
 * @module @deepseek-ai/dsh-zhihu-plugin/tool
 */
import type { Context } from '@deepseek-ai/cordis';
import z from '@deepseek-ai/schemastery';
export { FEED_TOOL_NAME, applyZhihuFeedTool, formatFeedOutput, feedMeta, presentFeedCall, presentFeedResult, projectFeedItem } from './feed.ts';
export type { ZhihuFeedItemValue, ZhihuFeedValue, ZhihuFeedEntryMeta, ZhihuFeedMeta } from './feed.ts';
export { READ_TOOL_NAME, applyZhihuReadTool, formatReadOutput, readMeta, presentReadCall, presentReadResult } from './read.ts';
export type { ZhihuReadItemValue, ZhihuReadValue, ZhihuReadItemMeta, ZhihuReadMeta } from './read.ts';
export { SEARCH_TOOL_NAME, applyZhihuSearchTool, formatSearchOutput, searchMeta, presentSearchCall, presentSearchResult, projectSearchHit } from './search.ts';
export type { ZhihuSearchItemValue, ZhihuSearchValue, ZhihuSearchItemMeta, ZhihuSearchMeta } from './search.ts';
export { ZHIHU_UNTRUSTED_CONTENT_NOTICE, boundText, describeZhihuFailure, formatEntryLine, requireText, resolveLimit } from './shared.ts';
export type { ZhihuEntryFacts, ZhihuToolLimits } from './shared.ts';
/** Plugin name under which these tools register. */
export declare const name = "tool-zhihu";
/** Services the tools read: the tool registry and the Zhihu content seam. */
export declare const inject: string[];
/** Deployment limits for the three Zhihu tools. */
export interface Config {
    /** Maximum entries one feed or search call returns. */
    maxItems?: number;
    /** Maximum answers one question read requests. */
    maxAnswerLimit?: number;
    /** Maximum characters of one excerpt, including the ellipsis. */
    excerptMaxChars?: number;
    /** Cooperative timeout budget for one call, in milliseconds. */
    timeoutMs?: number;
}
/** Schema that validates {@link Config} and fills its defaults. */
export declare const Config: z<Config>;
/**
 * Register `zhihu_feed`, `zhihu_read`, and `zhihu_search`.
 * @param ctx - context providing the tool registry and the Zhihu service.
 * @param config - deployment limits; schemastery supplies every default.
 */
export declare function apply(ctx: Context, config: Config): void;
//# sourceMappingURL=index.d.ts.map