/**
 * Wire, transport, and time-source types for the credentialed Zhihu HTTP provider. Every wire
 * member is optional because Zhihu omits fields per content kind; ids may arrive as numbers in a
 * payload whose values were not rewritten, so each one is converted with `String()` at the edge.
 * @module @deepseek-ai/dsh-zhihu-plugin/http/types
 */

/** Supplies the cookie for one request. `undefined` means no credential is stored. */
export type CookieSource = () => Promise<string | undefined>

/** Time source for rate limiting; tests inject a deterministic one instead of waiting. */
export interface ZhihuClock {
  /** Current time in milliseconds. */
  now(): number
  /**
   * Resolve after at least `ms` milliseconds.
   * @param ms - the delay; negative values resolve immediately.
   */
  sleep(ms: number): Promise<void>
}

/** The HTTP surface the provider maps into seam results; tests replace it with typed fixtures. */
export interface ZhihuTransport {
  /**
   * Perform one GET and parse the body losslessly.
   * @param url - absolute request URL.
   * @returns the parsed body.
   */
  get<T>(url: string): Promise<T>
}

/** The `error` member of a Zhihu failure body. */
export interface ZhihuWireError {
  /** Numeric API error code; a string is accepted because a rewritten payload may carry one. */
  readonly code?: number | string
  /** Machine-readable name such as `AuthenticationError`. */
  readonly name?: string
  /** Human-readable message; safe to surface, never contains the cookie. */
  readonly message?: string
}

/** A body carrying a `data` array, shared by feeds and search. */
export interface ZhihuListBody<T> {
  /** Page of items; absent when the API answers with an error object instead. */
  readonly data?: readonly T[]
  /** Continuation marker; absent on feeds that do not page. */
  readonly paging?: ZhihuPaging
}

/** Pagination marker of a list response. */
export interface ZhihuPaging {
  /** Absolute URL of the next page; absent when none follows. */
  readonly next?: string
  /** True when the response is the last page. */
  readonly is_end?: boolean
}

/** The `target` of one hot-list entry. */
export interface ZhihuHotTarget {
  /** Wire type; `question` for content entries. */
  readonly type?: string
  /** Content id. */
  readonly id?: string | number
  /** Display title. */
  readonly title?: string
  /** Rich-text excerpt. */
  readonly excerpt?: string
}

/** One hot-list entry. */
export interface ZhihuHotItem {
  /** Wire type of the entry. */
  readonly type?: string
  /** The linked content; absent for promo cards. */
  readonly target?: ZhihuHotTarget
  /** Heat label such as `3308 万热度`. */
  readonly detail_text?: string
}

/** The `target` of one recommendation entry. */
export interface ZhihuRecommendTarget {
  /** Wire type: `answer` or `article`. */
  readonly type?: string
  /** Content id. */
  readonly id?: string | number
  /** Article title; answers carry none. */
  readonly title?: string
  /** Rich-text body. */
  readonly content?: string
  /** Rich-text excerpt. */
  readonly excerpt?: string
  /** The question an answer belongs to; its title is the only title an answer has. */
  readonly question?: { readonly title?: string }
}

/** One recommendation-feed entry. */
export interface ZhihuRecommendItem {
  /** The linked content; absent for promo cards. */
  readonly target?: ZhihuRecommendTarget
}

/** One follow-feed entry, as returned by `api/v3/moments`. */
export interface ZhihuMomentItem {
  /** The linked content; absent for promo entries. */
  readonly target?: ZhihuRecommendTarget
}

/** One answer object, as returned by the answers list and the answer detail endpoint. */
export interface ZhihuAnswer {
  /** Answer id. */
  readonly id?: string | number
  /** Rich-text body. */
  readonly content?: string
  /** Rich-text excerpt. */
  readonly excerpt?: string
  /** Upvote count. */
  readonly voteup_count?: number
  /** Author. */
  readonly author?: { readonly name?: string }
  /** The question this answer belongs to. */
  readonly question?: { readonly title?: string; readonly id?: string | number }
}

/** The `object` member of one search entry. */
export interface ZhihuSearchObject {
  /** Content type: `question`, `answer`, `article`, or a non-content type. */
  readonly type?: string
  /** Content id. */
  readonly id?: string | number
  /** Display title. */
  readonly title?: string
  /** Rich-text excerpt. */
  readonly excerpt?: string
  /** Rich-text body; search returns it for an article, whose detail endpoint is signed. */
  readonly content?: string
  /** Upvote count. */
  readonly voteup_count?: number
  /** Author. */
  readonly author?: { readonly name?: string }
}

/** One search entry. */
export interface ZhihuSearchItem {
  /** Entry type: only `search_result` carries content; `hot_timing` and `knowledge_ad` are promos. */
  readonly type?: string
  /** The linked content. */
  readonly object?: ZhihuSearchObject
}
