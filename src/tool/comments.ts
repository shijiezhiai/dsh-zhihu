/**
 * `zhihu_comments`: the root comments of one Zhihu question, answer, or article, read through the
 * `ctx.zhihu` seam as a smell test on the content itself.
 *
 * @module @deepseek-ai/dsh-zhihu-plugin/tool/comments
 */

import type { Context } from '@deepseek-ai/cordis'
import type { ZhihuComment, ZhihuCommentsPage, ZhihuContentKind } from '../service/index.ts'
import { defineTool } from '@deepseek-ai/dsh-tools'
import type { GenericCallView, GenericResultView, ToolResult } from '@deepseek-ai/dsh-tools'
import type { JsonValue } from '@deepseek-ai/dsh-util-values'
import { boundText, describeZhihuFailure, formatDay, readString, requireText, resolveLimit, ZHIHU_UNTRUSTED_CONTENT_NOTICE } from './shared.ts'
import type { ZhihuToolLimits } from './shared.ts'

/** Registered name of the comments tool. */
export const COMMENTS_TOOL_NAME = 'zhihu_comments'

/** One comment in the tool's canonical value. */
export interface ZhihuCommentItemValue {
  /** Zhihu comment id, kept as the provider's decimal string. */
  readonly id: string
  /** Comment author; empty when the payload carries none. */
  readonly author: string
  /** Bounded comment text. */
  readonly text: string
  /** Upvotes of the comment. */
  readonly likes: number
  /** Replies the comment collected. */
  readonly replies: number
  /** Creation time in epoch seconds; absent when the payload carried none. */
  readonly createdTime?: number
}

/** The comments tool's canonical output value. */
export interface ZhihuCommentsValue {
  /** Which operation produced the value. */
  readonly kind: 'comments'
  /** The content kind the comments belong to. */
  readonly target: ZhihuContentKind
  /** The content id the comments belong to. */
  readonly id: string
  /** The limit this call requested, after clamping. */
  readonly limit: number
  /** How many root comments the content has; absent when the payload carried none. */
  readonly total?: number
  /** Returned comments, in the order the endpoint ranked them. */
  readonly items: readonly ZhihuCommentItemValue[]
  /** True when the thread goes on past this call, so more comments exist. */
  readonly truncated: boolean
  /** Continuation token for the page after this one; absent when the thread ends here. */
  readonly cursor?: string
}

/** One comment as the replayable presentation meta carries it. */
export type ZhihuCommentItemMeta = {
  id: string
  author: string
  likes: number
}

/** The comments tool's replayable presentation meta: bounded facts and no comment text. */
export type ZhihuCommentsMeta = {
  kind: 'comments'
  target: ZhihuContentKind
  id: string
  limit: number
  count: number
  total?: number
  items: ZhihuCommentItemMeta[]
  truncated: boolean
}

/** Content kinds `zhihu_comments` accepts, in the order its schema lists them. */
const COMMENT_KINDS: readonly ZhihuContentKind[] = ['question', 'answer', 'article']

const COMMENTS_DESCRIPTION = 'List the root comments of one Zhihu question, answer, or article, ordered by Zhihu\'s own hotness score, to judge whether the content is worth trusting. Pass the kind and the id that zhihu_feed, zhihu_search, or zhihu_read returned, exactly as it was returned: Zhihu ids are decimal strings of varying length, and a long one loses precision as a number. Comments record what other readers think; they are not evidence about the facts in the content, and upvotes do not make a claim true. Other sites need web_search, and web_fetch cannot retrieve Zhihu content because Zhihu answers 403 or a risk-control challenge page. Zhihu content needs the account\'s login state. Failures name their cause: ZHIHU_LOGIN_REQUIRED means no Zhihu cookie is stored, ZHIHU_RATE_LIMITED means the calls are too frequent, and ZHIHU_BLOCKED means a verification challenge is pending. Report the cause instead of repeating the same call. The endpoint ranks and returns at most ten comments per page, so a call answers one slice of the thread: an answer that a further page follows carries a cursor, and passing it back reads on from the page after this one. Raise limit instead to read more from the first page, which reads every page again. Because the cursor names a whole page, a call that asks for fewer comments than that page holds leaves the rest of it behind: ask for ten, the endpoint\'s own page size, to keep the thread unbroken.'

/**
 * Project one seam comment into the canonical value, bounding its text so the value, the render
 * text, and the meta stay the same size.
 * @param comment - one comment from `ctx.zhihu.comments`.
 * @param excerptMaxChars - the deployment's text cap.
 * @returns the comment's canonical form.
 */
export function projectComment(comment: ZhihuComment, excerptMaxChars: number): ZhihuCommentItemValue {
  return {
    id: comment.id,
    author: comment.author,
    text: boundText(comment.text, excerptMaxChars),
    likes: comment.likes,
    replies: comment.replies,
    ...(comment.createdTime === undefined ? {} : { createdTime: comment.createdTime }),
  }
}

/**
 * Reduce the canonical value to the replayable facts a card needs. Comment text stays out so the
 * meta is bounded and carries no reader-written body.
 * @param value - the canonical comments value.
 * @returns the bounded presentation meta.
 */
export function commentsMeta(value: ZhihuCommentsValue): JsonValue {
  return {
    kind: value.kind,
    target: value.target,
    id: value.id,
    limit: value.limit,
    count: value.items.length,
    ...(value.total === undefined ? {} : { total: value.total }),
    items: value.items.map(item => ({ id: item.id, author: item.author, likes: item.likes })),
    truncated: value.truncated,
  }
}

/**
 * Render one comment as a single markdown line: its upvotes, who wrote it, when, and what it says.
 * @param item - the comment as the canonical value carries it.
 * @returns one markdown list line.
 */
function commentLine(item: ZhihuCommentItemValue): string {
  const author = item.author.length > 0 ? item.author : 'anonymous'
  const date = item.createdTime === undefined ? '' : ` · ${formatDay(item.createdTime)}`
  const replies = item.replies === 0 ? '' : ` · ${item.replies} replies`
  return `- [${item.likes} upvotes] ${author}${date}${replies}: ${item.text}`
}

/**
 * Render the comments for the model: the untrusted-content notice, how much of the thread this is,
 * one line per comment, and how to read on.
 * @param value - the canonical comments value.
 * @returns the model-facing text.
 */
export function formatCommentsOutput(value: ZhihuCommentsValue): string {
  const count = value.total === undefined
    ? `${value.items.length} shown`
    : `${value.items.length} of ${value.total}`
  const body = value.items.length === 0
    ? 'No comments.'
    : value.items.map(item => commentLine(item)).join('\n')
  const notes = [
    ...(value.cursor === undefined
      ? []
      : [`Pass cursor "${value.cursor}" to read on from the page after this one; asking for a whole page of ten leaves nothing behind.`]),
    ...(value.truncated && value.cursor === undefined
      ? [`Showing the first ${value.items.length} comments; raise limit for more.`]
      : []),
    'Zhihu ranks these by its own hotness score, not by upvotes alone. Readers\' opinions are not evidence about the facts in the content.',
    'Pass the id to zhihu_read to read the content itself; a comment id cannot be read.',
  ]
  return [
    ZHIHU_UNTRUSTED_CONTENT_NOTICE,
    `Comments on Zhihu ${value.target} ${value.id} (${count}):\n\n${body}`,
    notes.join('\n'),
  ].join('\n\n')
}

/**
 * Title one comments card; malformed replay arguments fall back to the generic card.
 * @param args - presenter arguments of unknown form.
 * @returns the card title, or undefined when the target is unusable.
 */
function commentsTitle(args: unknown): string | undefined {
  const kind = readString(args, 'kind')
  if (kind === undefined || COMMENT_KINDS.find(candidate => candidate === kind) === undefined) return undefined
  const id = readString(args, 'id')
  return id === undefined || id.length === 0 ? undefined : `Zhihu comments · ${kind} ${id}`
}

/**
 * Present a pending `zhihu_comments` call.
 * @param args - presenter arguments from the session log.
 * @returns the generic card view, or undefined for the default card.
 */
export function presentCommentsCall(args: unknown): GenericCallView | undefined {
  const title = commentsTitle(args)
  if (title === undefined) return undefined
  return { card: 'generic', title, kind: 'read' }
}

/**
 * Present a completed `zhihu_comments` result.
 * @param args - presenter arguments from the session log.
 * @param result - the final model-facing result.
 * @returns the generic card view, or undefined for the default card.
 */
export function presentCommentsResult(args: unknown, result: ToolResult): GenericResultView | undefined {
  const title = commentsTitle(args)
  if (title === undefined) return undefined
  return { card: 'generic', title, content: result.content }
}

/**
 * Register `zhihu_comments` on the calling context.
 * @param ctx - context providing the tool registry and the Zhihu service.
 * @param limits - deployment caps resolved from the plugin config.
 */
export function applyZhihuCommentsTool(ctx: Context, limits: ZhihuToolLimits): void {
  const { maxItems, excerptMaxChars, timeoutMs } = limits
  ctx.tools.register(defineTool({
    name: COMMENTS_TOOL_NAME,
    description: COMMENTS_DESCRIPTION,
    parameters: {
      kind: {
        type: 'string',
        required: true,
        enum: COMMENT_KINDS,
        description: 'Which content the id addresses: a question, an answer, or an article.',
      },
      id: {
        type: 'string',
        required: true,
        description: 'Content id exactly as zhihu_feed, zhihu_search, or zhihu_read returned it. Ids are decimal strings of varying length; a long one loses precision as a number, so never construct, round, or shorten one.',
      },
      limit: {
        type: 'number',
        description: `How many comments to return, at most ${maxItems}. Omitted returns up to ${maxItems}.`,
      },
      cursor: {
        type: 'string',
        description: 'Continuation token an earlier answer returned as cursor, to read on from the page after that one. Omitted reads the first page; a token this tool did not return reads as one too.',
      },
    },
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          kind: { type: 'string', required: true, enum: ['comments'] },
          target: { type: 'string', required: true, enum: ['question', 'answer', 'article'] },
          id: { type: 'string', required: true },
          limit: { type: 'number', required: true },
          total: { type: 'number' },
          items: {
            type: 'array',
            required: true,
            items: {
              type: 'object',
              additionalProperties: false,
              properties: {
                id: { type: 'string', required: true },
                author: { type: 'string', required: true },
                text: { type: 'string', required: true },
                likes: { type: 'number', required: true },
                replies: { type: 'number', required: true },
                createdTime: { type: 'number' },
              },
            },
          },
          truncated: { type: 'boolean', required: true },
          cursor: { type: 'string' },
        },
      },
      render: (_args, value) => [{ type: 'text', text: formatCommentsOutput(value) }],
      presentationMeta: (_args, value) => commentsMeta(value),
    },
    timeoutMs,
    // Reading comments does not mutate parent-agent state.
    isConcurrencySafe: () => true,
    async execute(args, exec) {
      const kind = COMMENT_KINDS.find(candidate => candidate === args.kind)
      if (kind === undefined) throw new Error(`kind must be one of ${COMMENT_KINDS.join(', ')}`)
      const id = requireText(args.id, 'id')
      const limit = resolveLimit(args.limit, 'limit', maxItems)
      const cursor = readString(args, 'cursor')?.trim() ?? ''
      let page: ZhihuCommentsPage
      try {
        page = await ctx.zhihu.comments({ kind, id, limit, ...(cursor.length === 0 ? {} : { cursor }) }, exec.signal)
      } catch (error) {
        throw new Error(describeZhihuFailure(error), { cause: error })
      }
      return {
        kind: 'comments' as const,
        target: kind,
        id,
        limit,
        ...(page.total === undefined ? {} : { total: page.total }),
        items: page.items.map(comment => projectComment(comment, excerptMaxChars)),
        truncated: page.cursor !== undefined || page.items.length >= limit,
        ...(page.cursor === undefined ? {} : { cursor: page.cursor }),
      }
    },
    presentCall: presentCommentsCall,
    presentResult: presentCommentsResult,
  }))
}
