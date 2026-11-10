/**
 * `zhihu_feed`: the Zhihu hot list and the signed-in account's recommendation
 * stream, read through the `ctx.zhihu` seam.
 *
 * @module @deepseek-ai/dsh-zhihu-plugin/tool/feed
 */

import type { Context } from '@deepseek-ai/cordis'
import type { ZhihuFeedItem, ZhihuFeedKind } from '../service/index.ts'
import { defineTool } from '@deepseek-ai/dsh-tools'
import type { GenericCallView, GenericResultView, ToolResult } from '@deepseek-ai/dsh-tools'
import type { JsonValue } from '@deepseek-ai/dsh-util-values'
import { boundText, describeZhihuFailure, formatEntryLine, readString, resolveLimit, ZHIHU_UNTRUSTED_CONTENT_NOTICE } from './shared.ts'
import type { ZhihuToolLimits } from './shared.ts'

/** Registered name of the feed tool. */
export const FEED_TOOL_NAME = 'zhihu_feed'

/** One feed entry in the tool's canonical value. */
export interface ZhihuFeedItemValue {
  /** Content kind of the entry. */
  readonly kind: 'question' | 'answer' | 'article'
  /** Zhihu content id, kept as the provider's decimal string. */
  readonly id: string
  /** Entry title. */
  readonly title: string
  /** Bounded excerpt. */
  readonly excerpt: string
  /** Provider heat label, when the entry carries one. */
  readonly heatLabel?: string
  /** Canonical URL of the entry. */
  readonly url: string
}

/** The feed tool's canonical output value. */
export interface ZhihuFeedValue {
  /** Which feed was listed. */
  readonly kind: ZhihuFeedKind
  /** The limit this call requested, after clamping. */
  readonly limit: number
  /** Returned entries, in provider order. */
  readonly items: readonly ZhihuFeedItemValue[]
  /** True when the feed reached the requested limit, so more entries may exist. */
  readonly truncated: boolean
}

/** One entry as the replayable presentation meta carries it. */
export type ZhihuFeedEntryMeta = {
  kind: 'question' | 'answer' | 'article'
  id: string
  title: string
  url: string
  heatLabel?: string
}

/** The feed tool's replayable presentation meta: bounded facts and no excerpts. */
export type ZhihuFeedMeta = {
  kind: ZhihuFeedKind
  limit: number
  count: number
  items: ZhihuFeedEntryMeta[]
  truncated: boolean
}

/** Card and render titles per feed kind. */
const FEED_LABELS: Readonly<Record<ZhihuFeedKind, string>> = {
  hot: 'Zhihu hot list',
  recommend: 'Zhihu recommendation feed',
  follow: 'Zhihu follow feed',
}

const FEED_DESCRIPTION = 'Read Zhihu\'s own feeds. kind \'hot\' returns the site-wide hot list; kind \'recommend\' returns the recommendation stream of the signed-in account; kind \'follow\' returns what the accounts it follows published. Zhihu content needs the account\'s login state and web_fetch cannot retrieve it: Zhihu answers 403 or a risk-control challenge page. Ids are decimal strings of varying length; a long one loses precision if treated as a number, so pass it back exactly as returned. Each question or answer id can go to zhihu_read. Failures name their cause: ZHIHU_LOGIN_REQUIRED means no Zhihu cookie is stored, ZHIHU_RATE_LIMITED means the calls are too frequent, and ZHIHU_BLOCKED means a verification challenge is pending. Report the cause instead of repeating the same call.'

/**
 * Project one seam entry into the canonical value, bounding the excerpt so the
 * value, the render text, and the meta stay the same size.
 * @param item - one entry from `ctx.zhihu.feed`.
 * @param excerptMaxChars - the deployment's excerpt cap.
 * @returns the entry's canonical form.
 */
export function projectFeedItem(item: ZhihuFeedItem, excerptMaxChars: number): ZhihuFeedItemValue {
  return {
    kind: item.kind,
    id: item.id,
    title: item.title,
    excerpt: boundText(item.excerpt, excerptMaxChars),
    ...(item.heatLabel === undefined ? {} : { heatLabel: item.heatLabel }),
    url: item.url,
  }
}

/**
 * Reduce the canonical value to the replayable facts a card needs. Excerpts stay
 * out so the meta is bounded and carries no body text.
 * @param value - the canonical feed value.
 * @returns the bounded presentation meta.
 */
export function feedMeta(value: ZhihuFeedValue): JsonValue {
  return {
    kind: value.kind,
    limit: value.limit,
    count: value.items.length,
    items: value.items.map(item => ({
      kind: item.kind,
      id: item.id,
      title: item.title,
      url: item.url,
      ...(item.heatLabel === undefined ? {} : { heatLabel: item.heatLabel }),
    })),
    truncated: value.truncated,
  }
}

/**
 * Render the feed for the model: the untrusted-content notice, one markdown line
 * per entry, and what a follow-up call can do with the ids.
 * @param value - the canonical feed value.
 * @returns the model-facing text.
 */
export function formatFeedOutput(value: ZhihuFeedValue): string {
  const label = FEED_LABELS[value.kind]
  const body = value.items.length === 0
    ? 'No entries.'
    : value.items.map(item => formatEntryLine(item)).join('\n')
  const notes = [
    ...(value.truncated ? [`Showing the first ${value.items.length} entries; more are available.`] : []),
    'Pass a question or answer id to zhihu_read to read it in full; article entries open only through their URL.',
  ]
  return [ZHIHU_UNTRUSTED_CONTENT_NOTICE, `${label} (limit ${value.limit}):\n\n${body}`, notes.join('\n')].join('\n\n')
}

/**
 * Title one feed call or result card; malformed replay arguments fall back to the
 * generic card.
 * @param args - presenter arguments of unknown form.
 * @returns the card title, or undefined when the kind is unusable.
 */
function feedTitle(args: unknown): string | undefined {
  const kind = readString(args, 'kind')
  if (kind !== 'hot' && kind !== 'recommend' && kind !== 'follow') return undefined
  return kind === 'hot' ? 'Zhihu hot list' : kind === 'recommend' ? 'Zhihu recommendations' : 'Zhihu follow feed'
}

/**
 * Present a pending `zhihu_feed` call.
 * @param args - presenter arguments from the session log.
 * @returns the generic card view, or undefined for the default card.
 */
export function presentFeedCall(args: unknown): GenericCallView | undefined {
  const title = feedTitle(args)
  if (title === undefined) return undefined
  return { card: 'generic', title, kind: 'fetch' }
}

/**
 * Present a completed `zhihu_feed` result.
 * @param args - presenter arguments from the session log.
 * @param result - the final model-facing result.
 * @returns the generic card view, or undefined for the default card.
 */
export function presentFeedResult(args: unknown, result: ToolResult): GenericResultView | undefined {
  const title = feedTitle(args)
  if (title === undefined) return undefined
  return { card: 'generic', title, content: result.content }
}

/**
 * Register `zhihu_feed` on the calling context.
 * @param ctx - context providing the tool registry and the Zhihu service.
 * @param limits - deployment caps resolved from the plugin config.
 */
export function applyZhihuFeedTool(ctx: Context, limits: ZhihuToolLimits): void {
  const { maxItems, excerptMaxChars, timeoutMs } = limits
  ctx.tools.register(defineTool({
    name: FEED_TOOL_NAME,
    description: FEED_DESCRIPTION,
    parameters: {
      kind: {
        type: 'string',
        required: true,
        enum: ['hot', 'recommend', 'follow'],
        description: "'hot' lists the site-wide hot list; 'recommend' lists the recommendation stream of the signed-in account; 'follow' lists what the accounts it follows published.",
      },
      limit: {
        type: 'number',
        description: `How many entries to return, at most ${maxItems}. Omitted returns up to ${maxItems}.`,
      },
    },
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          kind: { type: 'string', required: true, enum: ['hot', 'recommend', 'follow'] },
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
                heatLabel: { type: 'string' },
                url: { type: 'string', required: true },
              },
            },
          },
          truncated: { type: 'boolean', required: true },
        },
      },
      render: (_args, value) => [{ type: 'text', text: formatFeedOutput(value) }],
      presentationMeta: (_args, value) => feedMeta(value),
    },
    timeoutMs,
    // Feed reads do not mutate parent-agent state.
    isConcurrencySafe: () => true,
    async execute(args) {
      const limit = resolveLimit(args.limit, 'limit', maxItems)
      let items: readonly ZhihuFeedItem[]
      try {
        items = (await ctx.zhihu.feed({ kind: args.kind, limit })).items
      } catch (error) {
        throw new Error(describeZhihuFailure(error), { cause: error })
      }
      return {
        kind: args.kind,
        limit,
        items: items.map(item => projectFeedItem(item, excerptMaxChars)),
        truncated: items.length >= limit,
      }
    },
    presentCall: presentFeedCall,
    presentResult: presentFeedResult,
  }))
}
