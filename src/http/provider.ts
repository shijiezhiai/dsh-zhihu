/**
 * Zhihu `ZhihuProvider` implemented over the HTTP transport. Zhihu payloads are mapped into seam
 * items here: promotional entries are dropped, HTML becomes plain text, ids stay strings, and every
 * link is built from a lossless id.
 * @module @deepseek-ai/dsh-zhihu-plugin/http/provider
 */

import {
  ZhihuError,
  type ZhihuComment,
  type ZhihuCommentsPage,
  type ZhihuCommentsRequest,
  type ZhihuContentKind,
  type ZhihuFeedItem,
  type ZhihuFeedPage,
  type ZhihuFeedRequest,
  type ZhihuProvider,
  type ZhihuReadRequest,
  type ZhihuReadResult,
  type ZhihuRepliesRequest,
  type ZhihuSearchHit,
  type ZhihuSearchPage,
  type ZhihuSearchRequest,
  type ZhihuSearchSort,
  type ZhihuSearchTimeWindow,
} from '../service/index.ts'
import { capText, toPlainText, toSearchText } from './html.ts'
import { toMarkdown } from './markdown.ts'
import type {
  ZhihuAnswer,
  ZhihuCommentRow,
  ZhihuHotItem,
  ZhihuListBody,
  ZhihuMomentItem,
  ZhihuPaging,
  ZhihuRecommendItem,
  ZhihuSearchItem,
  ZhihuTransport,
} from './types.ts'
import { contentUrl } from './urls.ts'

const API_ROOT = 'https://www.zhihu.com'

/** Wire type names that name a content kind the seam can link. */
const CONTENT_KIND: Record<string, ZhihuContentKind> = {
  question: 'question',
  answer: 'answer',
  article: 'article',
}

/** Path segment naming a content kind in the comment endpoint. */
const COMMENT_KIND: Record<ZhihuContentKind, string> = {
  question: 'questions',
  answer: 'answers',
  article: 'articles',
}

/** Only this search entry type carries content; `hot_timing` and `knowledge_ad` are promos. */
const SEARCH_RESULT = 'search_result'

/** Length of each search time window, in seconds. A month is 30 days and a year 365. */
const TIME_WINDOW_SECONDS: Record<ZhihuSearchTimeWindow, number> = {
  day: 86_400,
  week: 604_800,
  month: 2_592_000,
  year: 31_536_000,
}

/** Construction inputs for {@link ZhihuHttpProvider}. */
export interface ZhihuHttpProviderOptions {
  /** The transport that performs and parses the request. */
  readonly transport: ZhihuTransport
  /** Character cap applied to a read result's plain text. */
  readonly maxContentChars: number
  /** Items requested from a feed or search when the caller omits a limit. */
  readonly pageSize: number
  /** Pages one `feed()` call may fetch: a paged feed is followed until the limit is met. */
  readonly maxFeedPages: number
  /** Answers requested when a question read omits `answerLimit`. */
  readonly answerLimit: number
  /** Pages one ordered or windowed search may read before it answers its slice. */
  readonly searchScanPages: number
  /** Pages one `comments()` call may read: the endpoint answers at most ten comments per page. */
  readonly commentPages: number
}

/** The Zhihu HTTP provider, registered into `ctx.zhihu`. */
export class ZhihuHttpProvider implements ZhihuProvider {
  /** Registry key, and the value a `provider` config field pins. */
  readonly id = 'zhihu-http'

  constructor(private readonly options: ZhihuHttpProviderOptions) {}

  /**
   * Whether this provider can serve a request. Authentication is resolved per request because the
   * credential source is asynchronous and may change at any time; a missing cookie surfaces as
   * `ZHIHU_LOGIN_REQUIRED` from the operation itself.
   * @returns always true; this provider has no configuration that can be absent up front.
   */
  available(): boolean {
    return true
  }

  /**
   * List one feed page. The hot list is a single response; the recommendation and follow feeds
   * carry a continuation URL, so they are followed until `request.limit` is met or
   * `maxFeedPages` is spent.
   * @param request - the feed kind, an optional item limit, and an optional continuation token.
   * @param signal - cancellation of the call.
   * @returns the page with promo entries dropped.
   */
  async feed(request: ZhihuFeedRequest, signal?: AbortSignal): Promise<ZhihuFeedPage> {
    const limit = request.limit ?? this.options.pageSize
    // A topic feed is the search endpoint's own order, so it continues from the search offset
    // rather than from a feed URL.
    if (request.kind === 'topic') {
      const page = await this.search({
        query: request.topic ?? '',
        limit,
        ...(request.cursor === undefined ? {} : { cursor: request.cursor }),
      }, signal)
      return { items: page.items, ...(page.cursor === undefined ? {} : { cursor: page.cursor }) }
    }
    if (request.kind === 'hot') {
      const body = await this.options.transport.get<ZhihuListBody<ZhihuHotItem>>(
        `${API_ROOT}/api/v3/feed/topstory/hot-lists/total?limit=${limit}`,
        signal,
      )
      return { items: (body.data ?? []).flatMap(item => hotItem(item)) }
    }
    const first = request.cursor ?? (request.kind === 'follow'
      ? `${API_ROOT}/api/v3/moments?desktop=true&limit=${limit}`
      : `${API_ROOT}/api/v3/feed/topstory/recommend?action=down&ad_interval=-1&desktop=true&limit=${limit}`)
    return await this.pageFeed(first, limit, signal)
  }

  /**
   * Follow a feed's continuation URLs until the limit is met or the page budget is spent.
   * @param first - absolute URL of the first page to fetch.
   * @param limit - item cap for the returned page.
   * @param signal - cancellation of the call.
   * @returns the collected items and the continuation token, when one remains.
   */
  private async pageFeed(first: string, limit: number, signal: AbortSignal | undefined): Promise<ZhihuFeedPage> {
    const items: ZhihuFeedItem[] = []
    let next: string | undefined = first
    let following: string | undefined
    for (let pages = 0; next !== undefined && pages < this.options.maxFeedPages; pages += 1) {
      const body = await this.options.transport.get<ZhihuListBody<ZhihuMomentItem | ZhihuRecommendItem>>(next, signal)
      items.push(...(body.data ?? []).flatMap(item => targetItem(item)))
      following = nextPageUrl(body.paging)
      if (items.length >= limit) break
      next = following
    }
    return { items, ...(following === undefined ? {} : { cursor: following }) }
  }

  /**
   * Read a question (its title plus one answer's text), a single answer, or an article. Zhihu's
   * question-detail API is unavailable, so a question read goes through the answers list and takes
   * the question title from an included answer.
   * @param request - the content kind, its lossless id, an article's title, and an optional answer count.
   * @param signal - cancellation of the call.
   * @returns the read result with plain text capped by `maxContentChars`.
   */
  async read(request: ZhihuReadRequest, signal?: AbortSignal): Promise<ZhihuReadResult> {
    switch (request.kind) {
      case 'question': return await this.readQuestion(request, signal)
      case 'answer': return await this.readAnswer(request, signal)
      case 'article': return await this.readArticle(request, signal)
    }
  }

  /**
   * Search Zhihu content, dropping every non-content entry. The endpoint answers one
   * relevance-ordered page and ignores every sort and date parameter, so an order or a window is
   * computed here from several pages of entries.
   * @param request - the query, an optional hit limit, an optional continuation token, and the
   *   order and time window the hits must satisfy.
   * @param signal - cancellation of the call.
   * @returns one page of hits; an ordered or windowed search answers a slice with no token,
   *   because a continuation would interleave with the order it imposed.
   */
  async search(request: ZhihuSearchRequest, signal?: AbortSignal): Promise<ZhihuSearchPage> {
    const limit = request.limit ?? this.options.pageSize
    const order = request.sort ?? 'relevance'
    const since = request.timeWindow === undefined ? undefined : nowSeconds() - TIME_WINDOW_SECONDS[request.timeWindow]
    if (order === 'relevance' && since === undefined) {
      const offset = searchOffset(request.cursor)
      const entries = await this.searchEntries(request.query, limit, offset, signal)
      // A request spends its entry budget on promo cards too, so the next page starts past every
      // entry read rather than past every hit kept.
      const items = entries.flatMap(item => searchHit(item))
      return entries.length === 0 ? { items } : { items, cursor: String(offset + entries.length) }
    }
    const entries = await this.scanSearch(request.query, signal)
    const kept = since === undefined ? entries : entries.filter(item => (createdOf(item) ?? 0) >= since)
    return { items: orderEntries(kept, order).flatMap(item => searchHit(item)).slice(0, limit) }
  }

  /**
   * List a content's root comments. They are a smell test on the content rather than evidence about
   * it, so the first answers are the ones worth reading. Zhihu ranks a page at ten comments at
   * most, so a larger limit is filled from the continuation URLs it hands out; each page asks only
   * for what is still missing, which keeps every comment of a page it reads.
   * @param request - the content kind and id, and an optional comment limit.
   * @param signal - cancellation of the call.
   * @returns the comments read, and the content's root-comment count when the payload carries one.
   */
  async comments(request: ZhihuCommentsRequest, signal?: AbortSignal): Promise<ZhihuCommentsPage> {
    return await this.walkComments(commentUrl(request.kind, request.id, request.limit ?? this.options.pageSize), request.limit, signal)
  }

  /**
   * Read the replies under one root comment. Zhihu keeps a thread two levels deep, so this list
   * also carries the answers to those replies.
   * @param request - the root comment id and an optional reply limit.
   * @param signal - cancellation of the call.
   * @returns one slice of the replies with the thread size when the payload names it.
   */
  async replies(request: ZhihuRepliesRequest, signal?: AbortSignal): Promise<ZhihuCommentsPage> {
    return await this.walkComments(childCommentUrl(request.commentId, request.limit ?? this.options.pageSize), request.limit, signal)
  }

  /**
   * Walk a comment listing until the limit is met or the page budget is spent.
   * @param first - absolute URL of the first page to fetch.
   * @param limit - comments wanted; omitted reads the provider's page size.
   * @param signal - cancellation of the call.
   * @returns the comments read and the thread size when the payload names it.
   */
  private async walkComments(first: string, limit: number | undefined, signal: AbortSignal | undefined): Promise<ZhihuCommentsPage> {
    const wanted = limit ?? this.options.pageSize
    const items: ZhihuComment[] = []
    let next: string | undefined = first
    let total: number | undefined
    for (let pages = 0; next !== undefined && pages < this.options.commentPages && items.length < wanted; pages += 1) {
      const body = await this.options.transport.get<ZhihuListBody<ZhihuCommentRow>>(next, signal)
      items.push(...(body.data ?? []).flatMap(row => commentItem(row)))
      total = body.paging?.totals ?? total
      next = nextPageUrl(body.paging)
      if (next !== undefined) next = withLimit(next, wanted - items.length)
    }
    return { items, ...(total === undefined ? {} : { total }) }
  }

  /**
   * Read search entries across the configured page budget. An order or a window needs more than
   * the single relevance-ordered page the endpoint answers, or it would have nothing to choose
   * from.
   * @param query - search text.
   * @param signal - cancellation of the call.
   * @returns every entry read, promos included, in the order the endpoint answered.
   */
  private async scanSearch(query: string, signal: AbortSignal | undefined): Promise<readonly ZhihuSearchItem[]> {
    const entries: ZhihuSearchItem[] = []
    for (let page = 0; page < this.options.searchScanPages; page += 1) {
      const read = await this.searchEntries(query, this.options.pageSize, page * this.options.pageSize, signal)
      entries.push(...read)
      if (read.length < this.options.pageSize) break
    }
    return entries
  }

  /**
   * Request raw search entries. Only the search endpoint returns an article body: the article-detail
   * endpoint answers 403 `code:10003` without the page signature, so an article is read through the
   * search entry that carries its id.
   * @param query - search text.
   * @param limit - entries requested.
   * @param offset - entries to skip; the endpoint pages by this alone.
   * @param signal - cancellation of the call.
   * @returns the entries as they arrived, promos included.
   */
  private async searchEntries(
    query: string, limit: number, offset = 0, signal?: AbortSignal,
  ): Promise<readonly ZhihuSearchItem[]> {
    const body = await this.options.transport.get<ZhihuListBody<ZhihuSearchItem>>(
      `${API_ROOT}/api/v4/search_v3?t=general&q=${encodeURIComponent(query)}&limit=${limit}&offset=${offset}&correction=1`,
      signal,
    )
    return body.data ?? []
  }

  /**
   * Convert one HTML body into both of the seam's renderings.
   * @param html - the rich-text field of the payload.
   * @returns the plain text a model reads, the Markdown a reader sees, and whether either was cut.
   */
  private render(html: string): { readonly text: string; readonly markdown: string; readonly truncated: boolean } {
    const text = capText(toPlainText(html), this.options.maxContentChars)
    const markdown = capText(toMarkdown(html), this.options.maxContentChars)
    return { text: text.text, markdown: markdown.text, truncated: text.truncated || markdown.truncated }
  }

  private async readQuestion(request: ZhihuReadRequest, signal: AbortSignal | undefined): Promise<ZhihuReadResult> {
    const limit = request.answerLimit ?? this.options.answerLimit
    const body = await this.options.transport.get<ZhihuListBody<ZhihuAnswer>>(
      `${API_ROOT}/api/v4/questions/${request.id}/answers?include=content,excerpt,voteup_count,author.name,question.title&limit=${limit}&offset=0`,
      signal,
    )
    const [answer] = body.data ?? []
    if (answer === undefined) {
      throw new ZhihuError(`question ${request.id} has no readable answer`, 'ZHIHU_BAD_RESPONSE')
    }
    const rendered = this.render(answer.content ?? answer.excerpt ?? '')
    return {
      kind: 'question',
      id: request.id,
      title: answer.question?.title ?? '',
      contentText: rendered.text,
      contentMarkdown: rendered.markdown,
      contentTruncated: rendered.truncated,
      voteupCount: answer.voteup_count ?? 0,
      author: answer.author?.name ?? '',
      url: contentUrl('question', request.id),
    }
  }

  private async readAnswer(request: ZhihuReadRequest, signal: AbortSignal | undefined): Promise<ZhihuReadResult> {
    const answer = await this.options.transport.get<ZhihuAnswer>(
      `${API_ROOT}/api/v4/answers/${request.id}?include=content,excerpt,voteup_count,author.name`,
      signal,
    )
    const rendered = this.render(answer.content ?? answer.excerpt ?? '')
    return {
      kind: 'answer',
      id: request.id,
      title: answer.question?.title ?? '',
      contentText: rendered.text,
      contentMarkdown: rendered.markdown,
      contentTruncated: rendered.truncated,
      voteupCount: answer.voteup_count ?? 0,
      author: answer.author?.name ?? '',
      url: contentUrl('answer', request.id),
    }
  }

  private async readArticle(request: ZhihuReadRequest, signal: AbortSignal | undefined): Promise<ZhihuReadResult> {
    const title = request.title?.trim() ?? ''
    if (title.length === 0) {
      throw new ZhihuError(`article ${request.id} cannot be read without its title`, 'ZHIHU_BAD_RESPONSE')
    }
    const entries = await this.searchEntries(title, this.options.pageSize, 0, signal)
    const object = entries
      .flatMap(entry => entry.type === SEARCH_RESULT ? [entry.object] : [])
      .find(candidate => candidate?.id !== undefined && String(candidate.id) === request.id)
    if (object?.content === undefined) {
      throw new ZhihuError(`article ${request.id} returned no readable text`, 'ZHIHU_BAD_RESPONSE')
    }
    const rendered = this.render(object.content)
    return {
      kind: 'article',
      id: request.id,
      title: toSearchText(object.title ?? title),
      contentText: rendered.text,
      contentMarkdown: rendered.markdown,
      contentTruncated: rendered.truncated,
      voteupCount: object.voteup_count ?? 0,
      author: object.author?.name ?? '',
      url: contentUrl('article', request.id),
    }
  }
}

/**
 * Map one hot-list entry.
 * @param item - one wire entry.
 * @returns the seam item, or an empty array for a promo entry without a target.
 */
function hotItem(item: ZhihuHotItem): ZhihuFeedItem[] {
  const target = item.target
  if (target === undefined || target.id === undefined) return []
  const id = String(target.id)
  return [{
    kind: 'question',
    id,
    title: target.title ?? '',
    excerpt: toPlainText(target.excerpt ?? ''),
    ...item.detail_text !== undefined ? { heatLabel: item.detail_text } : {},
    url: contentUrl('question', id),
  }]
}

/**
 * Map one recommendation or follow-feed entry.
 * @param item - one wire entry.
 * @returns the seam item, or an empty array when the entry is a promo or an unknown type.
 */
function targetItem(item: ZhihuRecommendItem | ZhihuMomentItem): ZhihuFeedItem[] {
  const target = item.target
  if (target === undefined || target.id === undefined || target.type === undefined) return []
  const kind = CONTENT_KIND[target.type]
  if (kind === undefined) return []
  const id = String(target.id)
  return [{
    kind,
    id,
    title: target.title ?? target.question?.title ?? '',
    excerpt: toPlainText(target.excerpt ?? ''),
    url: contentUrl(kind, id),
    ...(target.voteup_count === undefined ? {} : { voteupCount: target.voteup_count }),
  }]
}

/**
 * Read the continuation URL out of a paging marker.
 * @param paging - the response's paging marker.
 * @returns the absolute URL to fetch next, or `undefined` when the listing ended.
 */
function nextPageUrl(paging: ZhihuPaging | undefined): string | undefined {
  if (paging === undefined || paging.is_end === true) return undefined
  return zhihuUrl(paging.next)
}

/**
 * Accept one URL only when it addresses Zhihu's own HTTPS origin, so a compromised payload or a
 * hand-written token cannot redirect the credentialed request elsewhere.
 * @param candidate - the URL to check.
 * @returns the URL, or `undefined` when it is absent or not Zhihu's.
 */
function zhihuUrl(candidate: string | undefined): string | undefined {
  if (candidate === undefined) return undefined
  let url: URL
  try {
    url = new URL(candidate)
  } catch {
    return undefined
  }
  if (url.protocol !== 'https:' || url.hostname !== 'www.zhihu.com') return undefined
  return url.toString()
}

/**
 * Build the first page URL of a content's root comments. The endpoint answers an empty page when
 * `offset` is present, so the first page names only the order and the size.
 * @param kind - the content kind.
 * @param id - lossless content id.
 * @param limit - comments requested; the endpoint caps a page at ten.
 * @returns the absolute request URL.
 */
function commentUrl(kind: ZhihuContentKind, id: string, limit: number): string {
  return `${API_ROOT}/api/v4/comment_v5/${COMMENT_KIND[kind]}/${id}/root_comment?order=score&filter_tag=all&limit=${limit}`
}

/**
 * Address the replies under one root comment.
 * @param commentId - lossless decimal id of the root comment.
 * @param limit - replies requested from the first page.
 * @returns the absolute request URL.
 */
function childCommentUrl(commentId: string, limit: number): string {
  return `${API_ROOT}/api/v4/comment_v5/comment/${commentId}/child_comment?order_by=score&limit=${limit}`
}

/**
 * Resize a continuation URL to the comments still missing, so a page is never read past the limit.
 * @param url - the continuation URL the previous page named.
 * @param limit - comments still wanted; zero or less leaves nothing to read.
 * @returns the URL asking for that many, or `undefined` when the limit is already met.
 */
function withLimit(url: string, limit: number): string | undefined {
  if (limit <= 0) return undefined
  const next = new URL(url)
  next.searchParams.set('limit', String(limit))
  return next.toString()
}

/**
 * Map one root comment.
 * @param row - one wire comment.
 * @returns the seam comment, or an empty array when the row carries no id.
 */
function commentItem(row: ZhihuCommentRow): ZhihuComment[] {
  if (row.id === undefined) return []
  return [{
    id: String(row.id),
    author: row.author?.name ?? '',
    text: toPlainText(row.content ?? ''),
    likes: row.like_count ?? 0,
    replies: row.child_comment_count ?? 0,
    ...(row.created_time === undefined ? {} : { createdTime: row.created_time }),
  }]
}

/**
 * Read a continuation token as an entry offset.
 * @param cursor - the token the previous page handed out, if any.
 * @returns the entries to skip; a token this provider never issued reads as the first page.
 */
function searchOffset(cursor: string | undefined): number {
  if (cursor === undefined) return 0
  const offset = Number(cursor)
  return Number.isSafeInteger(offset) && offset >= 0 ? offset : 0
}

/**
 * Current wall-clock time in epoch seconds; a search window is measured against it.
 * @returns the current time as a whole number of seconds.
 */
function nowSeconds(): number {
  return Math.floor(Date.now() / 1_000)
}

/**
 * Creation time of one raw search entry.
 * @param item - one search entry.
 * @returns the creation time in epoch seconds, or undefined when the entry carries none.
 */
function createdOf(item: ZhihuSearchItem): number | undefined {
  return item.object?.created_time
}

/**
 * Order entries the way a search request asked. Entries without the ranked field go last, and the
 * sort is stable, so equally ranked entries keep the order the endpoint answered.
 * @param items - the entries a scan read.
 * @param order - the requested order; `relevance` keeps the endpoint's own.
 * @returns the entries in the requested order.
 */
function orderEntries(items: readonly ZhihuSearchItem[], order: ZhihuSearchSort): readonly ZhihuSearchItem[] {
  switch (order) {
    case 'relevance': return items
    case 'newest': return [...items].sort((a, b) => (createdOf(b) ?? 0) - (createdOf(a) ?? 0))
    case 'top': return [...items].sort((a, b) => (b.object?.voteup_count ?? 0) - (a.object?.voteup_count ?? 0))
  }
}

/**
 * Map one search entry.
 * @param item - one wire entry.
 * @returns the seam hit, or an empty array for a promo or a non-content object.
 */
function searchHit(item: ZhihuSearchItem): ZhihuSearchHit[] {
  if (item.type !== SEARCH_RESULT) return []
  const object = item.object
  if (object === undefined || object.id === undefined || object.type === undefined) return []
  const kind = CONTENT_KIND[object.type]
  if (kind === undefined) return []
  const id = String(object.id)
  return [{
    kind,
    id,
    // Search titles carry highlight markup, whether raw or entity-escaped.
    title: toSearchText(object.title ?? ''),
    excerpt: toSearchText(object.excerpt ?? ''),
    url: contentUrl(kind, id),
    ...(object.created_time === undefined ? {} : { createdTime: object.created_time }),
    ...(object.voteup_count === undefined ? {} : { voteupCount: object.voteup_count }),
  }]
}
