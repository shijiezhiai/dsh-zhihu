/**
 * Model-facing Zhihu tools: the hot and recommendation feeds, question and
 * answer reading, in-site search, and the root comments of one item, all served
 * from the `ctx.zhihu` service, plus the keyword watch that hands its recurring
 * check to the Host Schedule service.
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
export { COMMENTS_TOOL_NAME, applyZhihuCommentsTool, commentsMeta, formatCommentsOutput, presentCommentsCall, presentCommentsResult, projectComment } from './comments.ts';
export type { ZhihuCommentItemValue, ZhihuCommentsValue, ZhihuCommentItemMeta, ZhihuCommentsMeta } from './comments.ts';
export { WATCH_TOOL_NAME, applyZhihuWatchTool, formatWatchOutput, presentWatchCall, presentWatchResult, projectWatchItem, watchMeta, watchPrompt, watchTitle } from './watch.ts';
export type { ZhihuWatchAction, ZhihuWatchItemValue, ZhihuWatchMeta, ZhihuWatchScheduleValue, ZhihuWatchValue } from './watch.ts';
export { ZHIHU_UNTRUSTED_CONTENT_NOTICE, boundText, describeZhihuFailure, formatDay, formatEntryLine, requireText, resolveLimit } from './shared.ts';
export type { ZhihuEntryFacts, ZhihuToolLimits } from './shared.ts';
/** Plugin name under which these tools register. */
export declare const name = "tool-zhihu";
/** Services the tools read: the tool registry and the Zhihu content seam. */
export declare const inject: string[];
/** Deployment limits for the four Zhihu tools. */
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
 * Register `zhihu_feed`, `zhihu_read`, `zhihu_search`, and `zhihu_comments`, and
 * `zhihu_watch` wherever the Host Schedule service is mounted.
 * @param ctx - context providing the tool registry and the Zhihu service.
 * @param config - deployment limits; schemastery supplies every default.
 */
export declare function apply(ctx: Context, config: Config): void;
//# sourceMappingURL=index.d.ts.map