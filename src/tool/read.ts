/**
 * `zhihu_read`: the answer list of one question, or the full text of one answer,
 * read through the `ctx.zhihu` seam.
 *
 * @module @deepseek-ai/dsh-zhihu-plugin/tool/read
 */

import type { Context } from '@deepseek-ai/cordis'
import type { ZhihuReadKind, ZhihuReadResult } from '../service/index.ts'
import { defineTool } from '@deepseek-ai/dsh-tools'
import type { GenericCallView, GenericResultView, ToolResult } from '@deepseek-ai/dsh-tools'
import type { JsonValue } from '@deepseek-ai/dsh-util-values'
import { describeZhihuFailure, readString, requireText, resolveLimit, ZHIHU_UNTRUSTED_CONTENT_NOTICE } from './shared.ts'
import type { ZhihuToolLimits } from './shared.ts'

/** Registered name of the read tool. */
export const READ_TOOL_NAME = 'zhihu_read'

/** The read content in the tool's canonical value. */
export interface ZhihuReadItemValue {
  /** Content kind that was read. */
  readonly kind: ZhihuReadKind
  /** Zhihu content id, kept as the provider's decimal string. */
  readonly id: string
  /** Content title. */
  readonly title: string
  /** Canonical URL of the content. */
  readonly url: string
  /** Upvote count the provider reported. */
  readonly voteupCount: number
  /** Author name, empty when the provider reports none. */
  readonly author: string
}

/** The read tool's canonical output value. */
export interface ZhihuReadValue {
  /** Content kind that was read. */
  readonly kind: ZhihuReadKind
  /** Content id that was read. */
  readonly id: string
  /** Answer limit this call requested, when it requested one for a question. */
  readonly answerLimit?: number
  /** The content facts, without the body text. */
  readonly item: ZhihuReadItemValue
  /** The body text the model reads. */
  readonly contentText: string
  /** True when the provider cut the body text at its cap. */
  readonly contentTruncated: boolean
}

/** The read content as the replayable presentation meta carries it. */
export type ZhihuReadItemMeta = {
  kind: ZhihuReadKind
  id: string
  title: string
  url: string
  voteupCount: number
  author: string
}

/** The read tool's replayable presentation meta: bounded facts and no body text. */
export type ZhihuReadMeta = {
  kind: ZhihuReadKind
  id: string
  count: number
  items: ZhihuReadItemMeta[]
  contentTruncated: boolean
}

const READ_DESCRIPTION = 'Read one Zhihu item by id. kind \'question\' returns that question\'s answer list and the text of its first answer; kind \'answer\' returns one answer in full; kind \'article\' returns a Zhihu column post, whose body is located by title, so pass the title exactly as the listing showed it. Pass an id exactly as zhihu_feed or zhihu_search returned it: Zhihu ids are decimal strings of varying length, and a long one loses precision as a number, so never construct, round, or shorten one. Zhihu content needs the account\'s login state and web_fetch cannot retrieve it: Zhihu answers 403 or a risk-control challenge page. ZHIHU_LOGIN_REQUIRED means no Zhihu cookie is stored, ZHIHU_NOT_FOUND means the content was deleted or the id does not exist, and ZHIHU_BLOCKED means a verification challenge is pending. Report the cause instead of repeating the same call.'

/**
 * Render the read content for the model: the untrusted-content notice, the
 * content facts, the body, and what the text is good for.
 * @param value - the canonical read value.
 * @returns the model-facing text.
 */
export function formatReadOutput(value: ZhihuReadValue): string {
  const item = value.item
  const label = item.title.length > 0 ? item.title : item.url
  const author = item.author.length > 0 ? ` · ${item.author}` : ''
  const header = `[${label}](${item.url}) · ${item.kind} ${item.id} · ${item.voteupCount} upvotes${author}`
  const notes = [
    ...(value.contentTruncated ? ['The answer text was cut at the deployment cap.'] : []),
    'Cite the URL above as a markdown link when you use this text.',
  ]
  return [ZHIHU_UNTRUSTED_CONTENT_NOTICE, header, value.contentText, notes.join('\n')].join('\n\n')
}

/**
 * Reduce the canonical value to the replayable facts a card needs. The body text
 * stays out so the meta is bounded.
 * @param value - the canonical read value.
 * @returns the bounded presentation meta.
 */
export function readMeta(value: ZhihuReadValue): JsonValue {
  return {
    kind: value.kind,
    id: value.id,
    count: 1,
    items: [
      {
        kind: value.item.kind,
        id: value.item.id,
        title: value.item.title,
        url: value.item.url,
        voteupCount: value.item.voteupCount,
        author: value.item.author,
      },
    ],
    contentTruncated: value.contentTruncated,
  }
}

/**
 * Title one read card; malformed replay arguments fall back to the generic card.
 * @param args - presenter arguments of unknown form.
 * @returns the card title, or undefined when the arguments are unusable.
 */
function readTitle(args: unknown): string | undefined {
  const kind = readString(args, 'kind')
  if (kind !== 'question' && kind !== 'answer') return undefined
  const id = readString(args, 'id')
  return id === undefined ? `Zhihu ${kind}` : `Zhihu ${kind} ${id}`
}

/**
 * Present a pending `zhihu_read` call.
 * @param args - presenter arguments from the session log.
 * @returns the generic card view, or undefined for the default card.
 */
export function presentReadCall(args: unknown): GenericCallView | undefined {
  const title = readTitle(args)
  if (title === undefined) return undefined
  return { card: 'generic', title, kind: 'read' }
}

/**
 * Present a completed `zhihu_read` result.
 * @param args - presenter arguments from the session log.
 * @param result - the final model-facing result.
 * @returns the generic card view, or undefined for the default card.
 */
export function presentReadResult(args: unknown, result: ToolResult): GenericResultView | undefined {
  const title = readTitle(args)
  if (title === undefined) return undefined
  return { card: 'generic', title, content: result.content }
}

/**
 * Register `zhihu_read` on the calling context.
 * @param ctx - context providing the tool registry and the Zhihu service.
 * @param limits - deployment caps resolved from the plugin config.
 */
export function applyZhihuReadTool(ctx: Context, limits: ZhihuToolLimits): void {
  const { maxAnswerLimit, timeoutMs } = limits
  ctx.tools.register(defineTool({
    name: READ_TOOL_NAME,
    description: READ_DESCRIPTION,
    parameters: {
      kind: {
        type: 'string',
        required: true,
        enum: ['question', 'answer', 'article'],
        description: "'question' reads the question's answer list and the text of its first answer; 'answer' reads one answer in full; 'article' reads one Zhihu column post.",
      },
      id: {
        type: 'string',
        required: true,
        description: 'Content id exactly as zhihu_feed or zhihu_search returned it. Ids are decimal strings of varying length; a long one loses precision as a number, so never construct, round, or shorten one.',
      },
      title: {
        type: 'string',
        description: "Required for kind 'article' and ignored otherwise: the row's title exactly as the listing showed it, which is how an article body is located.",
      },
      answerLimit: {
        type: 'number',
        description: `How many answers to request for a question id, at most ${maxAnswerLimit}. Ignored for any other kind.`,
      },
    },
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          kind: { type: 'string', required: true, enum: ['question', 'answer', 'article'] },
          id: { type: 'string', required: true },
          answerLimit: { type: 'number' },
          item: {
            type: 'object',
            required: true,
            additionalProperties: false,
            properties: {
              kind: { type: 'string', required: true, enum: ['question', 'answer', 'article'] },
              id: { type: 'string', required: true },
              title: { type: 'string', required: true },
              url: { type: 'string', required: true },
              voteupCount: { type: 'number', required: true },
              author: { type: 'string', required: true },
            },
          },
          contentText: { type: 'string', required: true },
          contentTruncated: { type: 'boolean', required: true },
        },
      },
      render: (_args, value) => [{ type: 'text', text: formatReadOutput(value) }],
      presentationMeta: (_args, value) => readMeta(value),
    },
    timeoutMs,
    // Reads do not mutate parent-agent state.
    isConcurrencySafe: () => true,
    async execute(args) {
      const id = requireText(args.id, 'id')
      const title = args.kind === 'article' ? requireText(args.title ?? '', 'title') : undefined
      const answerLimit = args.kind === 'question' && args.answerLimit !== undefined
        ? resolveLimit(args.answerLimit, 'answerLimit', maxAnswerLimit)
        : undefined
      let result: ZhihuReadResult
      try {
        result = await ctx.zhihu.read({
          kind: args.kind,
          id,
          ...(title === undefined ? {} : { title }),
          ...(answerLimit === undefined ? {} : { answerLimit }),
        })
      } catch (error) {
        throw new Error(describeZhihuFailure(error), { cause: error })
      }
      return {
        kind: result.kind,
        id: result.id,
        ...(answerLimit === undefined ? {} : { answerLimit }),
        item: {
          kind: result.kind,
          id: result.id,
          title: result.title,
          url: result.url,
          voteupCount: result.voteupCount,
          author: result.author,
        },
        contentText: result.contentText,
        contentTruncated: result.contentTruncated,
      }
    },
    presentCall: presentReadCall,
    presentResult: presentReadResult,
  }))
}
