/**
 * Zhihu `ZhihuProvider` implemented over the HTTP transport. Zhihu payloads are mapped into seam
 * items here: promotional entries are dropped, HTML becomes plain text, ids stay strings, and every
 * link is built from a lossless id.
 * @module @deepseek-ai/dsh-zhihu-plugin/http/provider
 */
import { type ZhihuCommentsPage, type ZhihuCommentsRequest, type ZhihuFeedPage, type ZhihuFeedRequest, type ZhihuProvider, type ZhihuReadRequest, type ZhihuReadResult, type ZhihuRepliesRequest, type ZhihuSearchPage, type ZhihuSearchRequest, type ZhihuVoteRequest, type ZhihuVoteResult } from '../service/index.ts';
import type { ZhihuTransport } from './types.ts';
/** Construction inputs for {@link ZhihuHttpProvider}. */
export interface ZhihuHttpProviderOptions {
    /** The transport that performs and parses the request. */
    readonly transport: ZhihuTransport;
    /** Character cap applied to a read result's plain text. */
    readonly maxContentChars: number;
    /** Items requested from a feed or search when the caller omits a limit. */
    readonly pageSize: number;
    /** Pages one `feed()` call may fetch: a paged feed is followed until the limit is met. */
    readonly maxFeedPages: number;
    /** Answers requested when a question read omits `answerLimit`. */
    readonly answerLimit: number;
    /** Pages one ordered or windowed search may read before it answers its slice. */
    readonly searchScanPages: number;
    /** Pages one `comments()` call may read: the endpoint answers at most ten comments per page. */
    readonly commentPages: number;
}
/** The Zhihu HTTP provider, registered into `ctx.zhihu`. */
export declare class ZhihuHttpProvider implements ZhihuProvider {
    private readonly options;
    /** Registry key, and the value a `provider` config field pins. */
    readonly id = "zhihu-http";
    constructor(options: ZhihuHttpProviderOptions);
    /**
     * Whether this provider can serve a request. Authentication is resolved per request because the
     * credential source is asynchronous and may change at any time; a missing cookie surfaces as
     * `ZHIHU_LOGIN_REQUIRED` from the operation itself.
     * @returns always true; this provider has no configuration that can be absent up front.
     */
    available(): boolean;
    /**
     * List one feed page. The hot list is a single response; the recommendation and follow feeds
     * carry a continuation URL, so they are followed until `request.limit` is met or
     * `maxFeedPages` is spent.
     * @param request - the feed kind, an optional item limit, an optional continuation token, and for
     *   a `topic` feed the order and time window its entries must satisfy.
     * @param signal - cancellation of the call.
     * @returns the page with promo entries dropped.
     */
    feed(request: ZhihuFeedRequest, signal?: AbortSignal): Promise<ZhihuFeedPage>;
    /**
     * Follow a feed's continuation URLs until the limit is met or the page budget is spent.
     * @param first - absolute URL of the first page to fetch.
     * @param limit - item cap for the returned page.
     * @param signal - cancellation of the call.
     * @returns the collected items and the continuation token, when one remains.
     */
    private pageFeed;
    /**
     * Read a question (its title plus one answer's text), a single answer, or an article. Zhihu's
     * question-detail API is unavailable, so a question read goes through the answers list and takes
     * the question title from an included answer.
     * @param request - the content kind, its lossless id, an article's title, and an optional answer count.
     * @param signal - cancellation of the call.
     * @returns the read result with plain text capped by `maxContentChars`.
     */
    read(request: ZhihuReadRequest, signal?: AbortSignal): Promise<ZhihuReadResult>;
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
    search(request: ZhihuSearchRequest, signal?: AbortSignal): Promise<ZhihuSearchPage>;
    /**
     * List a content's root comments. They are a smell test on the content rather than evidence about
     * it, so the first answers are the ones worth reading. Zhihu ranks a page at ten comments at
     * most, so a larger limit is filled from the continuation URLs it hands out; each page asks only
     * for what is still missing, which keeps every comment of a page it reads. An unusable cursor
     * reads from the first page: the token is a tool's output, and following a page address this
     * provider did not issue would either duplicate or skip comments.
     * @param request - the content kind and id, an optional comment limit, and an optional cursor.
     * @param signal - cancellation of the call.
     * @returns the comments read, the content's root-comment count when the payload carries one, and
     * the cursor of the page that follows.
     */
    comments(request: ZhihuCommentsRequest, signal?: AbortSignal): Promise<ZhihuCommentsPage>;
    /**
     * Read the replies under one root comment. Zhihu keeps a thread two levels deep, so this list
     * also carries the answers to those replies.
     * @param request - the root comment id and an optional reply limit.
     * @param signal - cancellation of the call.
     * @returns one slice of the replies with the thread size when the payload names it.
     */
    replies(request: ZhihuRepliesRequest, signal?: AbortSignal): Promise<ZhihuCommentsPage>;
    /**
     * Cast or withdraw the reader's upvote. Zhihu takes the state to hold rather than a toggle, so
     * sending the same vote twice leaves the account where it already was.
     * @param request - the content kind, its id, and the vote to hold after the call.
     * @param signal - cancellation of the call.
     * @returns the count the vote left, and the state the payload names — or the one asked for when
     * the payload names none.
     */
    vote(request: ZhihuVoteRequest, signal?: AbortSignal): Promise<ZhihuVoteResult>;
    /**
     * Walk a comment listing until the limit is met or the page budget is spent.
     * @param first - absolute URL of the first page to fetch.
     * @param limit - comments wanted; omitted reads the provider's page size.
     * @param signal - cancellation of the call.
     * @returns the comments read, the thread size when the payload names it, and the cursor of the
     * page after the last one read.
     */
    private walkComments;
    /**
     * Read search entries across the configured page budget. An order or a window needs more than
     * the single relevance-ordered page the endpoint answers, or it would have nothing to choose
     * from.
     * @param query - search text.
     * @param signal - cancellation of the call.
     * @returns every entry read, promos included, in the order the endpoint answered.
     */
    private scanSearch;
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
    private searchEntries;
    /**
     * Convert one HTML body into both of the seam's renderings.
     * @param html - the rich-text field of the payload.
     * @returns the plain text a model reads, the Markdown a reader sees, and whether either was cut.
     */
    private render;
    private readQuestion;
    private readAnswer;
    private readArticle;
}
//# sourceMappingURL=provider.d.ts.map