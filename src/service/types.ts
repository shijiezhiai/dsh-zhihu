/**
 * Vocabulary for the Zhihu content capability seam (`ctx.zhihu`). Zhihu ids are decimal strings of
 * varying length; one longer than `Number.MAX_SAFE_INTEGER` stays a string so no digit is lost, and
 * every item carries its own canonical `url` so consumers never assemble one.
 * @module @deepseek-ai/dsh-zhihu-plugin/types
 */

/**
 * Discriminant values carried by `ZhihuError.code`. Provider-selection codes mirror the web seam;
 * the HTTP codes describe a response the provider refused to turn into a result.
 */
export type ZhihuErrorCode =
  | 'ZHIHU_LOGIN_REQUIRED'
  | 'ZHIHU_RATE_LIMITED'
  | 'ZHIHU_BLOCKED'
  | 'ZHIHU_NOT_FOUND'
  | 'ZHIHU_BAD_RESPONSE'
  | 'ZHIHU_DUPLICATE_PROVIDER'
  | 'ZHIHU_PROVIDER_CONFIGURED_MISSING'
  | 'ZHIHU_PROVIDER_CONFIGURED_UNAVAILABLE'
  | 'ZHIHU_PROVIDER_UNAVAILABLE'
  | 'ZHIHU_PROVIDER_AMBIGUOUS'

/** Feed sources `feed()` can list. */
export type ZhihuFeedKind = 'hot' | 'recommend' | 'follow'

/** Content kinds a feed item, read result, or search hit can describe. */
export type ZhihuContentKind = 'question' | 'answer' | 'article'

/** Content kinds `read()` can load by id. */
export type ZhihuReadKind = 'question' | 'answer' | 'article'

/**
 * One feed listing request. `limit` is a hint to the provider; the seam enforces it on the way
 * back, so an over-returning provider cannot widen the result.
 */
export interface ZhihuFeedRequest {
  /** Which feed to list. */
  readonly kind: ZhihuFeedKind
  /** Upper bound on returned items. Omitted = the provider's default page size. */
  readonly limit?: number
  /**
   * Opaque continuation token taken from the previous page's `cursor`. Omitted = the first page.
   * A provider that does not page its feed ignores it.
   */
  readonly cursor?: string
}

/**
 * One page of a feed. `cursor` is opaque to every consumer: it is handed back through
 * {@link ZhihuFeedRequest.cursor} to continue, and its absence means the feed ended.
 */
export interface ZhihuFeedPage {
  /** The page's entries, in feed order. */
  readonly items: readonly ZhihuFeedItem[]
  /** Token that continues this feed; absent when no page follows. */
  readonly cursor?: string
}

/** One feed entry, trimmed to what a model can read without the raw payload. */
export interface ZhihuFeedItem {
  /** What the entry links to. */
  readonly kind: ZhihuContentKind
  /** Lossless decimal id of the linked content. */
  readonly id: string
  /** Display title; empty when the payload carries none. */
  readonly title: string
  /** Plain-text excerpt with markup removed. */
  readonly excerpt: string
  /** Hot-list heat label such as `3308 万热度`; absent outside the hot list. */
  readonly heatLabel?: string
  /** Canonical web URL of the linked content. */
  readonly url: string
}

/**
 * One content read request. Reading a question returns its title plus its top answer's text,
 * because Zhihu's question-detail API is unavailable.
 */
export interface ZhihuReadRequest {
  /** Which kind of content `id` addresses. */
  readonly kind: ZhihuReadKind
  /** Lossless decimal content id. */
  readonly id: string
  /** How many answers of a question to request; ignored for any other kind. */
  readonly answerLimit?: number
  /**
   * Display title of the row being read. An article's detail endpoint is signed, so a provider
   * locates that article by title through the search endpoint instead; omitted leaves an article
   * unreadable.
   */
  readonly title?: string
}

/** One content read result, with the body available both as plain text and as Markdown. */
export interface ZhihuReadResult {
  /** What was read. */
  readonly kind: ZhihuReadKind
  /** Lossless decimal id of the content that was read. */
  readonly id: string
  /** Question title; empty when the payload carries none. */
  readonly title: string
  /** Plain-text body, capped to the provider's `maxContentChars`. */
  readonly contentText: string
  /**
   * The same body as GitHub-flavored Markdown, keeping headings, emphasis, lists, links, images,
   * formulas, and fenced code; capped to the provider's `maxContentChars`.
   */
  readonly contentMarkdown: string
  /** True when the body was cut at the character cap. */
  readonly contentTruncated: boolean
  /** Upvote count of the answer whose text this is; 0 when unavailable. */
  readonly voteupCount: number
  /** Author display name; empty when the payload carries none. */
  readonly author: string
  /** Canonical web URL of the read content. */
  readonly url: string
}

/** One search request. */
export interface ZhihuSearchRequest {
  /** Free-text query, forwarded verbatim to the provider. */
  readonly query: string
  /** Upper bound on returned hits; the seam enforces it. Omitted = provider default. */
  readonly limit?: number
  /**
   * Opaque continuation token taken from the previous page's `cursor`. Omitted = the first page.
   * A provider that does not page its search ignores it.
   */
  readonly cursor?: string
}

/** One search hit. Promotional cards and non-content result types never appear here. */
export interface ZhihuSearchHit {
  /** What the hit points at. */
  readonly kind: ZhihuContentKind
  /** Lossless decimal content id. */
  readonly id: string
  /** Display title; empty when the payload carries none. */
  readonly title: string
  /** Plain-text excerpt with markup removed. */
  readonly excerpt: string
  /** Canonical web URL of the hit. */
  readonly url: string
}

/**
 * One page of search hits. `cursor` is opaque to every consumer: it is handed back through
 * {@link ZhihuSearchRequest.cursor} to continue, and its absence means the search ended.
 */
export interface ZhihuSearchPage {
  /** The page's hits, in result order. */
  readonly items: readonly ZhihuSearchHit[]
  /** Continuation token for the next page; absent when nothing follows. */
  readonly cursor?: string
}

/**
 * One backend that can serve `ctx.zhihu`. Providers register themselves with the service and
 * answer `available()` per call, so selection reflects credentials that changed at runtime.
 */
export interface ZhihuProvider {
  /** Registry key, and the value a consumer pins through the `provider` config field. */
  readonly id: string
  /** Whether this provider can serve a request right now. Must not perform network I/O. */
  available(): boolean
  /**
   * List one feed.
   * @param request - the feed kind, an optional item limit, and an optional continuation token.
   * @returns one page; the seam caps its entries to `request.limit`.
   */
  feed(request: ZhihuFeedRequest): Promise<ZhihuFeedPage>
  /**
   * Read one question or answer.
   * @param request - the content kind, its id, and an optional answer count.
   * @returns the read result.
   */
  read(request: ZhihuReadRequest): Promise<ZhihuReadResult>
  /**
   * Search Zhihu content.
   * @param request - the query, an optional hit limit, and an optional continuation token.
   * @returns one page of content hits; the seam caps them to `request.limit`.
   */
  search(request: ZhihuSearchRequest): Promise<ZhihuSearchPage>
}
