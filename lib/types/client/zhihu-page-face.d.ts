/**
 * The full Zhihu page's asynchronous half: one Remote call per request, with a
 * refusal returned instead of thrown.
 *
 * The namespace is resolved per request rather than captured at plugin
 * activation, so a Client whose Host never publishes `remote.zhihu` still opens
 * the page and reports the missing namespace on its first request.
 */
import type { ClientRemote } from '@deepseek-ai/dsh-api-gateway/client';
import type { RemoteFailure } from '@deepseek-ai/dsh-api-remotes/client';
import type { ZhihuClientSettings, ZhihuCollectQuery, ZhihuCollectResult, ZhihuCollectionsResult, ZhihuCommentsResult, ZhihuExportQuery, ZhihuExportResult, ZhihuFeedQuery, ZhihuFeedResult, ZhihuFeedRow, ZhihuFeedSort, ZhihuFeedTimeWindow, ZhihuReadItem, ZhihuSyncDocument, ZhihuSyncReadResult, ZhihuSyncSaveResult, ZhihuVoteQuery, ZhihuVoteResult } from '@deepseek-ai/dsh-zhihu-plugin/types';
/** Either a returned value or the Remote failure that refused it. */
export type ZhihuPageOutcome<T> = {
    readonly ok: true;
    readonly value: T;
} | {
    readonly ok: false;
    readonly failure: RemoteFailure;
};
/** What a `topic` lane reads: its keyword and, when the reader picked one, an order and a window. */
export interface ZhihuFeedLane {
    /** Keyword the lane lists. */
    readonly topic: string;
    /** Order the rows are listed in; omitted keeps Zhihu's relevance order. */
    readonly sort?: ZhihuFeedSort;
    /** Keep only rows created within this window; omitted keeps every age. */
    readonly timeWindow?: ZhihuFeedTimeWindow;
}
/** What the full page calls for its feeds, its search lane, and its opened rows. */
export interface ZhihuPageFace {
    /**
     * Request one feed page.
     * @param kind - which feed to read.
     * @param cursor - continuation token from the previous page; omitted reads the first page.
     * @param lane - what a `topic` lane reads; ignored by every other kind.
     * @returns the rows and the token that continues the feed, or the refusal.
     */
    feed(kind: ZhihuFeedQuery['kind'], cursor?: string, lane?: ZhihuFeedLane): Promise<ZhihuPageOutcome<ZhihuFeedResult>>;
    /**
     * Run one search.
     * @param query - non-empty query text.
     * @param cursor - continuation token from the previous page; omitted reads the first page.
     * @returns the hits and the token that continues them, or the refusal.
     */
    search(query: string, cursor?: string): Promise<ZhihuPageOutcome<ZhihuFeedResult>>;
    /**
     * Read one row's body.
     * @param row - the row to read; its title is what locates an article's body.
     * @returns the content, or the refusal.
     */
    read(row: ZhihuFeedRow): Promise<ZhihuPageOutcome<ZhihuReadItem>>;
    /**
     * Read one slice of a row's root comments.
     * @param row - the opened row whose thread to read.
     * @param limit - comments requested; omitted reads the page's default slice.
     * @returns the comments and the thread's size, or the refusal.
     */
    comments(row: ZhihuFeedRow, limit?: number): Promise<ZhihuPageOutcome<ZhihuCommentsResult>>;
    /**
     * Read one slice of the replies under a root comment.
     * @param commentId - the root comment whose replies to read.
     * @param limit - replies requested; omitted reads the page's default slice.
     * @returns the replies and the thread's size, or the refusal.
     */
    replies(commentId: string, limit?: number): Promise<ZhihuPageOutcome<ZhihuCommentsResult>>;
    /**
     * Cast or withdraw the reader's own upvote on one answer or article.
     * @param query - content kind, lossless id, and the vote to hold after the call.
     * @returns the count the vote left and the state the reader now holds, or the refusal.
     */
    vote(query: ZhihuVoteQuery): Promise<ZhihuPageOutcome<ZhihuVoteResult>>;
    /**
     * Read the collections of the reader's own account.
     * @param limit - collections requested; omitted reads the page's default slice.
     * @returns the collections, or the refusal.
     */
    collections(limit?: number): Promise<ZhihuPageOutcome<ZhihuCollectionsResult>>;
    /**
     * Add the open row to one collection of the reader, or take it out again.
     * @param query - content kind, lossless id, collection id, and whether it belongs there.
     * @returns the membership the call left, or the refusal.
     */
    collect(query: ZhihuCollectQuery): Promise<ZhihuPageOutcome<ZhihuCollectResult>>;
    /**
     * Read the deployment settings this page applies. A Client whose Host publishes no namespace, or
     * a refused call, leaves the page on its own cap, so this reports no failure of its own.
     * @returns the settings, or undefined when the answer is unavailable.
     */
    settings(): Promise<ZhihuClientSettings | undefined>;
    /**
     * Read the page another machine left in the reader's vault.
     * @returns the stored document, or the refusal; a vault without one answers with no document.
     */
    state(): Promise<ZhihuPageOutcome<ZhihuSyncReadResult>>;
    /**
     * Write this page's shared fields into the reader's vault.
     * @param document - the state to store, with the instant it was written.
     * @returns whether the vault took it, or the refusal.
     */
    saveState(document: ZhihuSyncDocument): Promise<ZhihuPageOutcome<ZhihuSyncSaveResult>>;
    /**
     * Write the open row into the reader's Obsidian vault.
     * @param query - the capture to write; the reader supplies the body it already holds.
     * @returns the note's vault path, or the refusal.
     */
    export(query: ZhihuExportQuery): Promise<ZhihuPageOutcome<ZhihuExportResult>>;
}
/**
 * Build the page face over a lazily resolved namespace.
 * @param resolveRemote - reads the Zhihu Remote namespace, or undefined while the Host does not publish it.
 * @returns the face the page component calls.
 */
export declare function zhihuPageFace(resolveRemote: () => ClientRemote['zhihu'] | undefined): ZhihuPageFace;
//# sourceMappingURL=zhihu-page-face.d.ts.map