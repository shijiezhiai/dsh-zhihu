/**
 * Zhihu `ZhihuProvider` implemented over the HTTP transport. Zhihu payloads are mapped into seam
 * items here: promotional entries are dropped, HTML becomes plain text, ids stay strings, and every
 * link is built from a lossless id.
 * @module @deepseek-ai/dsh-zhihu-plugin/http/provider
 */

import {
  ZhihuError,
  type ZhihuContentKind,
  type ZhihuFeedItem,
  type ZhihuFeedPage,
  type ZhihuFeedRequest,
  type ZhihuProvider,
  type ZhihuReadRequest,
  type ZhihuReadResult,
  type ZhihuSearchHit,
  type ZhihuSearchPage,
  type ZhihuSearchRequest,
} from '../service/index.ts'
import { capText, toPlainText, toSearchText } from './html.ts'
import { toMarkdown } from './markdown.ts'
import type {
  ZhihuAnswer,
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

/** Only this search entry type carries content; `hot_timing` and `knowledge_ad` are promos. */
const SEARCH_RESULT = 'search_result'

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
   * @returns the page with promo entries dropped.
   */
  async feed(request: ZhihuFeedRequest): Promise<ZhihuFeedPage> {
    const limit = request.limit ?? this.options.pageSize
    if (request.kind === 'hot') {
      const body = await this.options.transport.get<ZhihuListBody<ZhihuHotItem>>(
        `${API_ROOT}/api/v3/feed/topstory/hot-lists/total?limit=${limit}`,
      )
      return { items: (body.data ?? []).flatMap(item => hotItem(item)) }
    }
    const first = request.cursor ?? (request.kind === 'follow'
      ? `${API_ROOT}/api/v3/moments?desktop=true&limit=${limit}`
      : `${API_ROOT}/api/v3/feed/topstory/recommend?action=down&ad_interval=-1&desktop=true&limit=${limit}`)
    return await this.pageFeed(first, limit)
  }

  /**
   * Follow a feed's continuation URLs until the limit is met or the page budget is spent.
   * @param first - absolute URL of the first page to fetch.
   * @param limit - item cap for the returned page.
   * @returns the collected items and the continuation token, when one remains.
   */
  private async pageFeed(first: string, limit: number): Promise<ZhihuFeedPage> {
    const items: ZhihuFeedItem[] = []
    let next: string | undefined = first
    let following: string | undefined
    for (let pages = 0; next !== undefined && pages < this.options.maxFeedPages; pages += 1) {
      const body = await this.options.transport.get<ZhihuListBody<ZhihuMomentItem | ZhihuRecommendItem>>(next)
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
   * @returns the read result with plain text capped by `maxContentChars`.
   */
  async read(request: ZhihuReadRequest): Promise<ZhihuReadResult> {
    switch (request.kind) {
      case 'question': return await this.readQuestion(request)
      case 'answer': return await this.readAnswer(request)
      case 'article': return await this.readArticle(request)
    }
  }

  /**
   * Search Zhihu content, dropping every non-content entry.
   * @param request - the query, an optional hit limit, and an optional continuation token.
   * @returns one page of hits, with the token that continues after the entries it consumed.
   */
  async search(request: ZhihuSearchRequest): Promise<ZhihuSearchPage> {
    const offset = searchOffset(request.cursor)
    const entries = await this.searchEntries(request.query, request.limit ?? this.options.pageSize, offset)
    // A request spends its entry budget on promo cards too, so the next page starts past every
    // entry read rather than past every hit kept.
    const items = entries.flatMap(item => searchHit(item))
    return entries.length === 0 ? { items } : { items, cursor: String(offset + entries.length) }
  }

  /**
   * Request raw search entries. Only the search endpoint returns an article body: the article-detail
   * endpoint answers 403 `code:10003` without the page signature, so an article is read through the
   * search entry that carries its id.
   * @param query - search text.
   * @param limit - entries requested.
   * @param offset - entries to skip; the endpoint pages by this alone.
   * @returns the entries as they arrived, promos included.
   */
  private async searchEntries(query: string, limit: number, offset = 0): Promise<readonly ZhihuSearchItem[]> {
    const body = await this.options.transport.get<ZhihuListBody<ZhihuSearchItem>>(
      `${API_ROOT}/api/v4/search_v3?t=general&q=${encodeURIComponent(query)}&limit=${limit}&offset=${offset}&correction=1`,
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

  private async readQuestion(request: ZhihuReadRequest): Promise<ZhihuReadResult> {
    const limit = request.answerLimit ?? this.options.answerLimit
    const body = await this.options.transport.get<ZhihuListBody<ZhihuAnswer>>(
      `${API_ROOT}/api/v4/questions/${request.id}/answers?include=content,excerpt,voteup_count,author.name,question.title&limit=${limit}&offset=0`,
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

  private async readAnswer(request: ZhihuReadRequest): Promise<ZhihuReadResult> {
    const answer = await this.options.transport.get<ZhihuAnswer>(
      `${API_ROOT}/api/v4/answers/${request.id}?include=content,excerpt,voteup_count,author.name`,
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

  private async readArticle(request: ZhihuReadRequest): Promise<ZhihuReadResult> {
    const title = request.title?.trim() ?? ''
    if (title.length === 0) {
      throw new ZhihuError(`article ${request.id} cannot be read without its title`, 'ZHIHU_BAD_RESPONSE')
    }
    const entries = await this.searchEntries(title, this.options.pageSize)
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
  }]
}

/**
 * Read the continuation URL out of a paging marker. Only Zhihu's own HTTPS origin is followed, so a
 * compromised or unexpected payload cannot redirect the credentialed request elsewhere.
 * @param paging - the response's paging marker.
 * @returns the absolute URL to fetch next, or `undefined` when the feed ended.
 */
function nextPageUrl(paging: ZhihuPaging | undefined): string | undefined {
  if (paging === undefined || paging.is_end === true || paging.next === undefined) return undefined
  let url: URL
  try {
    url = new URL(paging.next)
  } catch {
    return undefined
  }
  if (url.protocol !== 'https:' || url.hostname !== 'www.zhihu.com') return undefined
  return url.toString()
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
  }]
}
