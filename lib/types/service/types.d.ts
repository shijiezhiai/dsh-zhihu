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
export type ZhihuErrorCode = 'ZHIHU_LOGIN_REQUIRED' | 'ZHIHU_RATE_LIMITED' | 'ZHIHU_BLOCKED' | 'ZHIHU_NOT_FOUND' | 'ZHIHU_BAD_RESPONSE' | 'ZHIHU_DUPLICATE_PROVIDER' | 'ZHIHU_PROVIDER_CONFIGURED_MISSING' | 'ZHIHU_PROVIDER_CONFIGURED_UNAVAILABLE' | 'ZHIHU_PROVIDER_UNAVAILABLE' | 'ZHIHU_PROVIDER_AMBIGUOUS';
/** Feed sources `feed()` can list. */
export type ZhihuFeedKind = 'hot' | 'recommend' | 'follow' | 'topic';
/** Content kinds a feed item, read result, or search hit can describe. */
export type ZhihuContentKind = 'question' | 'answer' | 'article';
/** Content kinds `read()` can load by id. */
export type ZhihuReadKind = 'question' | 'answer' | 'article';
/**
 * One feed listing request. `limit` is a hint to the provider; the seam enforces it on the way
 * back, so an over-returning provider cannot widen the result.
 */
export interface ZhihuFeedRequest {
    /** Which feed to list. */
    readonly kind: ZhihuFeedKind;
    /**
     * Keyword a `topic` feed lists: the entries a search for it returns. Required for `topic`,
     * ignored by every other feed.
     */
    readonly topic?: string;
    /** Upper bound on returned items. Omitted = the provider's default page size. */
    readonly limit?: number;
    /**
     * Opaque continuation token taken from the previous page's `cursor`. Omitted = the first page.
     * A provider that does not page its feed ignores it.
     */
    readonly cursor?: string;
    /**
     * Order of a `topic` feed's entries. Omitted keeps the endpoint's own relevance order, the only
     * order it offers itself; another order is computed by the provider from several pages, so such a
     * feed answers no continuation token. Ignored by every other feed.
     */
    readonly sort?: ZhihuSearchSort;
    /**
     * Keep only a `topic` feed's entries created within this window, measured from the moment of the
     * call. Omitted keeps every age. Like {@link ZhihuFeedRequest.sort}, a window is answered from
     * several pages and leaves the feed nothing to continue. Ignored by every other feed.
     */
    readonly timeWindow?: ZhihuSearchTimeWindow;
}
/**
 * One page of a feed. `cursor` is opaque to every consumer: it is handed back through
 * {@link ZhihuFeedRequest.cursor} to continue, and its absence means the feed ended.
 */
export interface ZhihuFeedPage {
    /** The page's entries, in feed order. */
    readonly items: readonly ZhihuFeedItem[];
    /** Token that continues this feed; absent when no page follows. */
    readonly cursor?: string;
}
/** One feed entry, trimmed to what a model can read without the raw payload. */
export interface ZhihuFeedItem {
    /** What the entry links to. */
    readonly kind: ZhihuContentKind;
    /** Lossless decimal id of the linked content. */
    readonly id: string;
    /** Display title; empty when the payload carries none. */
    readonly title: string;
    /** Plain-text excerpt with markup removed. */
    readonly excerpt: string;
    /** Hot-list heat label such as `3308 万热度`; absent outside the hot list. */
    readonly heatLabel?: string;
    /** Upvote count the payload reports for the entry; absent when the feed carries none. */
    readonly voteupCount?: number;
    /** Canonical web URL of the linked content. */
    readonly url: string;
}
/**
 * One content read request. Reading a question returns its title plus its top answer's text,
 * because Zhihu's question-detail API is unavailable.
 */
export interface ZhihuReadRequest {
    /** Which kind of content `id` addresses. */
    readonly kind: ZhihuReadKind;
    /** Lossless decimal content id. */
    readonly id: string;
    /** How many answers of a question to request; ignored for any other kind. */
    readonly answerLimit?: number;
    /**
     * Display title of the row being read. An article's detail endpoint is signed, so a provider
     * locates that article by title through the search endpoint instead; omitted leaves an article
     * unreadable.
     */
    readonly title?: string;
}
/** One content read result, with the body available both as plain text and as Markdown. */
export interface ZhihuReadResult {
    /** What was read. */
    readonly kind: ZhihuReadKind;
    /** Lossless decimal id of the content that was read. */
    readonly id: string;
    /** Question title; empty when the payload carries none. */
    readonly title: string;
    /** Plain-text body, capped to the provider's `maxContentChars`. */
    readonly contentText: string;
    /**
     * The same body as GitHub-flavored Markdown, keeping headings, emphasis, lists, links, images,
     * formulas, and fenced code; capped to the provider's `maxContentChars`.
     */
    readonly contentMarkdown: string;
    /** True when the body was cut at the character cap. */
    readonly contentTruncated: boolean;
    /** Upvote count of the answer whose text this is; 0 when unavailable. */
    readonly voteupCount: number;
    /** Author display name; empty when the payload carries none. */
    readonly author: string;
    /** Canonical web URL of the read content. */
    readonly url: string;
}
/** One search request. */
/** Order in which a search returns its hits. */
export type ZhihuSearchSort = 'relevance' | 'newest' | 'top';
/** How far back a search reaches, measured from the moment of the call. */
export type ZhihuSearchTimeWindow = 'day' | 'week' | 'month' | 'year';
export interface ZhihuSearchRequest {
    /** Free-text query, forwarded verbatim to the provider. */
    readonly query: string;
    /** Upper bound on returned hits; the seam enforces it. Omitted = provider default. */
    readonly limit?: number;
    /**
     * Opaque continuation token taken from the previous page's `cursor`. Omitted = the first page.
     * A provider that does not page its search ignores it.
     */
    readonly cursor?: string;
    /**
     * Order of the returned hits. Omitted keeps the provider's own relevance order, which is the
     * only order the endpoint itself offers; another order is computed by the provider.
     */
    readonly sort?: ZhihuSearchSort;
    /**
     * Keep only hits created within this window, measured from the moment of the call. Omitted keeps
     * every age. A hit whose creation time is unknown never satisfies a window.
     */
    readonly timeWindow?: ZhihuSearchTimeWindow;
}
/** One search hit. Promotional cards and non-content result types never appear here. */
export interface ZhihuSearchHit {
    /** What the hit points at. */
    readonly kind: ZhihuContentKind;
    /** Lossless decimal content id. */
    readonly id: string;
    /** Display title; empty when the payload carries none. */
    readonly title: string;
    /** Plain-text excerpt with markup removed. */
    readonly excerpt: string;
    /** Canonical web URL of the hit. */
    readonly url: string;
    /** Creation time in epoch seconds; absent when the payload carried none. */
    readonly createdTime?: number;
}
/**
 * One page of search hits. `cursor` is opaque to every consumer: it is handed back through
 * {@link ZhihuSearchRequest.cursor} to continue, and its absence means the search ended.
 */
export interface ZhihuSearchPage {
    /** The page's hits, in result order. */
    readonly items: readonly ZhihuSearchHit[];
    /** Continuation token for the next page; absent when nothing follows. */
    readonly cursor?: string;
}
/**
 * One comments request. Zhihu serves root comments of questions, answers, and articles through the
 * same endpoint, ranked by its own hotness score rather than by upvote count alone.
 */
export interface ZhihuCommentsRequest {
    /** Which kind of content `id` addresses. */
    readonly kind: ZhihuContentKind;
    /** Lossless decimal content id. */
    readonly id: string;
    /**
     * Upper bound on returned comments; the seam enforces it. Omitted = provider default.
     */
    readonly limit?: number;
    /**
     * Continuation token from an earlier call, whose comments are then passed by. Omitted reads the
     * first page; a token the provider did not issue reads as one too.
     */
    readonly cursor?: string;
}
/** One root comment on a piece of Zhihu content. */
export interface ZhihuComment {
    /** Lossless decimal comment id. */
    readonly id: string;
    /** Author display name; empty when the payload carries none. */
    readonly author: string;
    /** Plain-text body with markup removed. */
    readonly text: string;
    /** Upvote count of the comment; 0 when unavailable. */
    readonly likes: number;
    /** How many replies the comment collected. */
    readonly replies: number;
    /** Creation time in epoch seconds; absent when the payload carried none. */
    readonly createdTime?: number;
}
/**
 * One slice of a comment thread. `total` counts the content's root comments, not the ones this
 * slice carries, so a caller can say how much of the thread it read.
 */
export interface ZhihuCommentsPage {
    /** The comments read, in the order the endpoint ranked them. */
    readonly items: readonly ZhihuComment[];
    /** Number of root comments on the content; absent when the payload carried none. */
    readonly total?: number;
    /**
     * Where to read on; absent when nothing follows. The token names the page after the one this call
     * read, so a call that stopped partway through a page leaves the rest of that page behind.
     */
    readonly cursor?: string;
}
/**
 * One replies request. Zhihu keeps comment threads two levels deep: every answer to a root comment,
 * including answers to its answers, hangs under that root comment.
 */
export interface ZhihuRepliesRequest {
    /** Lossless decimal id of the root comment whose replies are wanted. */
    readonly commentId: string;
    /**
     * Upper bound on returned replies; the seam enforces it. Omitted = provider default.
     */
    readonly limit?: number;
}
/** The vote a reader holds on one answer or article. */
export type ZhihuVote = 'up' | 'none';
/** Content kinds a vote can be cast on; a question is followed rather than voted on. */
export type ZhihuVotableKind = 'answer' | 'article';
/**
 * One vote request. It changes state on the reader's own account, so only a reader action sends
 * one: no tool of this plugin casts a vote.
 */
export interface ZhihuVoteRequest {
    /** Which kind of content `id` addresses. */
    readonly kind: ZhihuVotableKind;
    /** Lossless decimal content id. */
    readonly id: string;
    /** Vote to hold after the call: `up` upvotes, `none` withdraws an upvote. */
    readonly vote: ZhihuVote;
}
/** What one vote answered: the count it left, and the state the caller now holds. */
export interface ZhihuVoteResult {
    /** Upvote count after the vote; absent when the payload carried none, so the earlier count stands. */
    readonly voteupCount?: number;
    /** True when the caller now holds an upvote. */
    readonly voted: boolean;
}
/**
 * One backend that can serve `ctx.zhihu`. Providers register themselves with the service and
 * answer `available()` per call, so selection reflects credentials that changed at runtime.
 */
export interface ZhihuProvider {
    /** Registry key, and the value a consumer pins through the `provider` config field. */
    readonly id: string;
    /** Whether this provider can serve a request right now. Must not perform network I/O. */
    available(): boolean;
    /**
     * List one feed.
     * @param request - the feed kind, an optional item limit, and an optional continuation token.
     * @param signal - cancellation of the call; a provider must stop its own work when it aborts.
     * @returns one page; the seam caps its entries to `request.limit`.
     */
    feed(request: ZhihuFeedRequest, signal?: AbortSignal): Promise<ZhihuFeedPage>;
    /**
     * Read one question or answer.
     * @param request - the content kind, its id, and an optional answer count.
     * @param signal - cancellation of the call; a provider must stop its own work when it aborts.
     * @returns the read result.
     */
    read(request: ZhihuReadRequest, signal?: AbortSignal): Promise<ZhihuReadResult>;
    /**
     * Search Zhihu content.
     * @param request - the query, an optional hit limit, and an optional continuation token.
     * @param signal - cancellation of the call; a provider must stop its own work when it aborts.
     * @returns one page of content hits; the seam caps them to `request.limit`.
     */
    search(request: ZhihuSearchRequest, signal?: AbortSignal): Promise<ZhihuSearchPage>;
    /**
     * List one page of a content's root comments.
     * @param request - the content kind and id, and an optional comment limit.
     * @param signal - cancellation of the call; a provider must stop its own work when it aborts.
     * @returns one slice of the thread; the seam caps its comments to `request.limit`.
     */
    comments(request: ZhihuCommentsRequest, signal?: AbortSignal): Promise<ZhihuCommentsPage>;
    /**
     * Read the replies under one root comment.
     * @param request - the root comment id and an optional reply limit.
     * @param signal - cancellation of the call; a provider must stop its own work when it aborts.
     * @returns one slice of the replies; the seam caps them to `request.limit`.
     */
    replies(request: ZhihuRepliesRequest, signal?: AbortSignal): Promise<ZhihuCommentsPage>;
    /**
     * Cast or withdraw the reader's upvote on one answer or article.
     * @param request - the content kind, its id, and the vote to hold after the call.
     * @param signal - cancellation of the call; a provider must stop its own work when it aborts.
     * @returns the count the vote left and the state the caller now holds.
     */
    vote(request: ZhihuVoteRequest, signal?: AbortSignal): Promise<ZhihuVoteResult>;
}
//# sourceMappingURL=types.d.ts.map