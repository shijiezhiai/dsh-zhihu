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
import type { ZhihuExportQuery, ZhihuExportResult, ZhihuFeedQuery, ZhihuFeedResult, ZhihuFeedRow, ZhihuReadItem } from '@deepseek-ai/dsh-zhihu-plugin/types';
/** Either a returned value or the Remote failure that refused it. */
export type ZhihuPageOutcome<T> = {
    readonly ok: true;
    readonly value: T;
} | {
    readonly ok: false;
    readonly failure: RemoteFailure;
};
/** What the full page calls for its feeds, its search lane, and its opened rows. */
export interface ZhihuPageFace {
    /**
     * Request one feed page.
     * @param kind - which feed to read.
     * @param cursor - continuation token from the previous page; omitted reads the first page.
     * @returns the rows and the token that continues the feed, or the refusal.
     */
    feed(kind: ZhihuFeedQuery['kind'], cursor?: string): Promise<ZhihuPageOutcome<ZhihuFeedResult>>;
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