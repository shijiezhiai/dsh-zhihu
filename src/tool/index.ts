/**
 * Model-facing Zhihu tools: the hot and recommendation feeds, question and
 * answer reading, and in-site search, all served from the `ctx.zhihu` service.
 *
 * @module @deepseek-ai/dsh-zhihu-plugin/tool
 */

import type { Context } from '@deepseek-ai/cordis'
import z from '@deepseek-ai/schemastery'
import { applyZhihuFeedTool } from './feed.ts'
import { applyZhihuReadTool } from './read.ts'
import { applyZhihuSearchTool } from './search.ts'
import { assertPositiveInteger } from './shared.ts'
import type { ZhihuToolLimits } from './shared.ts'

export { FEED_TOOL_NAME, applyZhihuFeedTool, formatFeedOutput, feedMeta, presentFeedCall, presentFeedResult, projectFeedItem } from './feed.ts'
export type { ZhihuFeedItemValue, ZhihuFeedValue, ZhihuFeedEntryMeta, ZhihuFeedMeta } from './feed.ts'
export { READ_TOOL_NAME, applyZhihuReadTool, formatReadOutput, readMeta, presentReadCall, presentReadResult } from './read.ts'
export type { ZhihuReadItemValue, ZhihuReadValue, ZhihuReadItemMeta, ZhihuReadMeta } from './read.ts'
export { SEARCH_TOOL_NAME, applyZhihuSearchTool, formatSearchOutput, searchMeta, presentSearchCall, presentSearchResult, projectSearchHit } from './search.ts'
export type { ZhihuSearchItemValue, ZhihuSearchValue, ZhihuSearchItemMeta, ZhihuSearchMeta } from './search.ts'
export { ZHIHU_UNTRUSTED_CONTENT_NOTICE, boundText, describeZhihuFailure, formatEntryLine, requireText, resolveLimit } from './shared.ts'
export type { ZhihuEntryFacts, ZhihuToolLimits } from './shared.ts'

/** Plugin name under which these tools register. */
export const name = 'tool-zhihu'

/** Services the tools read: the tool registry and the Zhihu content seam. */
export const inject = ['tools', 'zhihu']

/** Deployment limits for the three Zhihu tools. */
export interface Config {
  /** Maximum entries one feed or search call returns. */
  maxItems?: number
  /** Maximum answers one question read requests. */
  maxAnswerLimit?: number
  /** Maximum characters of one excerpt, including the ellipsis. */
  excerptMaxChars?: number
  /** Cooperative timeout budget for one call, in milliseconds. */
  timeoutMs?: number
}

/** Schema that validates {@link Config} and fills its defaults. */
export const Config: z<Config> = z.object({
  maxItems: z.number().default(20).description('Maximum entries one zhihu_feed or zhihu_search call returns.'),
  maxAnswerLimit: z.number().default(5).description('Maximum answers one zhihu_read call requests for a question.'),
  excerptMaxChars: z.number().default(200).description('Maximum characters of one excerpt, including the ellipsis.'),
  timeoutMs: z.number().default(30_000).description('Cooperative timeout budget for one Zhihu call, in milliseconds.'),
})

/** {@link Config} after schemastery has applied every default. */
type ResolvedConfig = Required<Config>

/**
 * Register `zhihu_feed`, `zhihu_read`, and `zhihu_search`.
 * @param ctx - context providing the tool registry and the Zhihu service.
 * @param config - deployment limits; schemastery supplies every default.
 */
export function apply(ctx: Context, config: Config): void {
  const resolved = config as ResolvedConfig
  const limits: ZhihuToolLimits = {
    maxItems: assertPositiveInteger('maxItems', resolved.maxItems),
    maxAnswerLimit: assertPositiveInteger('maxAnswerLimit', resolved.maxAnswerLimit),
    excerptMaxChars: assertPositiveInteger('excerptMaxChars', resolved.excerptMaxChars),
    timeoutMs: assertPositiveInteger('timeoutMs', resolved.timeoutMs),
  }
  applyZhihuFeedTool(ctx, limits)
  applyZhihuReadTool(ctx, limits)
  applyZhihuSearchTool(ctx, limits)
}
