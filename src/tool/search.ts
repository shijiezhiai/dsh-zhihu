/**
 * `zhihu_search`: in-site search across Zhihu questions, answers, and articles,
 * read through the `ctx.zhihu` seam.
 *
 * @module @deepseek-ai/dsh-zhihu-plugin/tool/search
 */

import type { Context } from '@deepseek-ai/cordis'
import type { ZhihuSearchHit, ZhihuSearchPage } from '../service/index.ts'
import { defineTool } from '@deepseek-ai/dsh-tools'
import type { GenericCallView, GenericResultView, ToolResult } from '@deepseek-ai/dsh-tools'
import type { JsonValue } from '@deepseek-ai/dsh-util-values'
import { boundText, describeZhihuFailure, formatEntryLine, readString, requireText, resolveLimit, ZHIHU_UNTRUSTED_CONTENT_NOTICE } from './shared.ts'
import type { ZhihuToolLimits } from './shared.ts'

/** Registered name of the search tool. */
export const SEARCH_TOOL_NAME = 'zhihu_search'

/** One search hit in the tool's canonical value. */
export interface ZhihuSearchItemValue {
  /** Content kind of the hit. */
  readonly kind: 'question' | 'answer' | 'article'
  /** Zhihu content id, kept as the provider's decimal string. */
  readonly id: string
  /** Hit title. */
  readonly title: string
  /** Bounded excerpt. */
  readonly excerpt: string
  /** Canonical URL of the hit. */
  readonly url: string
}

/** The search tool's canonical output value. */
export interface ZhihuSearchValue {
  /** Which query kind produced the value. */
  readonly kind: 'search'
  /** The query that was searched. */
  readonly query: string
  /** The limit this call requested, after clamping. */
  readonly limit: number
  /** Returned hits, in provider order. */
  readonly items: readonly ZhihuSearchItemValue[]
  /** True when the search reached the requested limit, so more hits may exist. */
  readonly truncated: boolean
  /** Token that continues this search; absent when no further page exists. */
  readonly cursor?: string
}

/** One hit as the replayable presentation meta carries it. */
export type ZhihuSearchItemMeta = {
  kind: 'question' | 'answer' | 'article'
  id: string
  title: string
  url: string
}

/** The search tool's replayable presentation meta: bounded facts and no excerpts. */
export type ZhihuSearchMeta = {
  kind: 'search'
  query: string
  limit: number
  count: number
  items: ZhihuSearchItemMeta[]
  truncated: boolean
}

const SEARCH_DESCRIPTION = 'Search inside Zhihu for questions, answers, and articles matching a query, and return hits whose ids zhihu_read accepts. Use it for Zhihu discussions; other sites need web_search, and web_fetch cannot retrieve Zhihu content because Zhihu answers 403 or a risk-control challenge page. Ids are decimal strings of varying length; a long one loses precision if treated as a number, so pass it back exactly as returned. Zhihu content needs the account\'s login state. Failures name their cause: ZHIHU_LOGIN_REQUIRED means no Zhihu cookie is stored, ZHIHU_RATE_LIMITED means the calls are too frequent, and ZHIHU_BLOCKED means a verification challenge is pending. Report the cause instead of repeating the same call.'

/**
 * Project one seam hit into the canonical value, bounding the excerpt so the
 * value, the render text, and the meta stay the same size.
 * @param hit - one hit from `ctx.zhihu.search`.
 * @param excerptMaxChars - the deployment's excerpt cap.
 * @returns the hit's canonical form.
 */
export function projectSearchHit(hit: ZhihuSearchHit, excerptMaxChars: number): ZhihuSearchItemValue {
  return {
    kind: hit.kind,
    id: hit.id,
    title: hit.title,
    excerpt: boundText(hit.excerpt, excerptMaxChars),
    url: hit.url,
  }
}

/**
 * Reduce the canonical value to the replayable facts a card needs. Excerpts stay
 * out so the meta is bounded and carries no body text.
 * @param value - the canonical search value.
 * @returns the bounded presentation meta.
 */
export function searchMeta(value: ZhihuSearchValue): JsonValue {
  return {
    kind: value.kind,
    query: value.query,
    limit: value.limit,
    count: value.items.length,
    items: value.items.map(item => ({
      kind: item.kind,
      id: item.id,
      title: item.title,
      url: item.url,
    })),
    truncated: value.truncated,
  }
}

/**
 * Render the hits for the model: the untrusted-content notice, one markdown line
 * per hit, and what a follow-up call can do with the ids.
 * @param value - the canonical search value.
 * @returns the model-facing text.
 */
export function formatSearchOutput(value: ZhihuSearchValue): string {
  const body = value.items.length === 0
    ? 'No hits.'
    : value.items.map(item => formatEntryLine(item)).join('\n')
  const notes = [
    ...(value.truncated ? [`Showing the first ${value.items.length} hits; refine the query for a different slice.`] : []),
    ...(value.cursor === undefined ? [] : [`More hits follow: repeat this call with cursor="${value.cursor}".`]),
    'Pass a hit\'s id to zhihu_read to read that question or answer in full.',
  ]
  return [
    ZHIHU_UNTRUSTED_CONTENT_NOTICE,
    `Zhihu search results for "${value.query}" (limit ${value.limit}):\n\n${body}`,
    notes.join('\n'),
  ].join('\n\n')
}

/**
 * Title one search card; malformed replay arguments fall back to the generic
 * card.
 * @param args - presenter arguments of unknown form.
 * @returns the card title, or undefined when the query is unusable.
 */
function searchTitle(args: unknown): string | undefined {
  const query = readString(args, 'query')
  if (query === undefined || query.length === 0) return undefined
  return `Zhihu search "${query}"`
}

/**
 * Present a pending `zhihu_search` call.
 * @param args - presenter arguments from the session log.
 * @returns the generic card view, or undefined for the default card.
 */
export function presentSearchCall(args: unknown): GenericCallView | undefined {
  const title = searchTitle(args)
  if (title === undefined) return undefined
  return { card: 'generic', title, kind: 'search' }
}

/**
 * Present a completed `zhihu_search` result.
 * @param args - presenter arguments from the session log.
 * @param result - the final model-facing result.
 * @returns the generic card view, or undefined for the default card.
 */
export function presentSearchResult(args: unknown, result: ToolResult): GenericResultView | undefined {
  const title = searchTitle(args)
  if (title === undefined) return undefined
  return { card: 'generic', title, content: result.content }
}

/**
 * Register `zhihu_search` on the calling context.
 * @param ctx - context providing the tool registry and the Zhihu service.
 * @param limits - deployment caps resolved from the plugin config.
 */
export function applyZhihuSearchTool(ctx: Context, limits: ZhihuToolLimits): void {
  const { maxItems, excerptMaxChars, timeoutMs } = limits
  ctx.tools.register(defineTool({
    name: SEARCH_TOOL_NAME,
    description: SEARCH_DESCRIPTION,
    parameters: {
      query: {
        type: 'string',
        required: true,
        description: 'Search text; Zhihu matches it against questions, answers, and articles.',
      },
      limit: {
        type: 'number',
        description: `How many hits to return, at most ${maxItems}. Omitted returns up to ${maxItems}.`,
      },
      cursor: {
        type: 'string',
        description: 'Continuation token from a previous call\'s cursor, to read the next page of the same query. Omit for the first page.',
      },
    },
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          kind: { type: 'string', required: true, enum: ['search'] },
          query: { type: 'string', required: true },
          limit: { type: 'number', required: true },
          items: {
            type: 'array',
            required: true,
            items: {
              type: 'object',
              additionalProperties: false,
              properties: {
                kind: { type: 'string', required: true, enum: ['question', 'answer', 'article'] },
                id: { type: 'string', required: true },
                title: { type: 'string', required: true },
                excerpt: { type: 'string', required: true },
                url: { type: 'string', required: true },
              },
            },
          },
          truncated: { type: 'boolean', required: true },
          cursor: { type: 'string' },
        },
      },
      render: (_args, value) => [{ type: 'text', text: formatSearchOutput(value) }],
      presentationMeta: (_args, value) => searchMeta(value),
    },
    timeoutMs,
    // Search reads do not mutate parent-agent state.
    isConcurrencySafe: () => true,
    async execute(args) {
      const query = requireText(args.query, 'query')
      const limit = resolveLimit(args.limit, 'limit', maxItems)
      const cursor = typeof args.cursor === 'string' && args.cursor.trim() !== '' ? args.cursor.trim() : undefined
      let page: ZhihuSearchPage
      try {
        page = await ctx.zhihu.search({ query, limit, ...(cursor === undefined ? {} : { cursor }) })
      } catch (error) {
        throw new Error(describeZhihuFailure(error), { cause: error })
      }
      return {
        kind: 'search' as const,
        query,
        limit,
        items: page.items.map(hit => projectSearchHit(hit, excerptMaxChars)),
        truncated: page.items.length >= limit,
        ...(page.cursor === undefined ? {} : { cursor: page.cursor }),
      }
    },
    presentCall: presentSearchCall,
    presentResult: presentSearchResult,
  }))
}
