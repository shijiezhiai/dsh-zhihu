declare module '@deepseek-ai/dsh-typert-protocol' {
    interface RemoteErrorDetailsMap {
        /** The provider requires a signed-in browser and no usable credential was supplied. */
        'zhihu/login-required': {
            readonly kind: ZhihuFailureTarget;
        };
        /** The provider refused the request as too frequent. */
        'zhihu/rate-limited': {
            readonly kind: ZhihuFailureTarget;
        };
        /** The provider served a block or verification page instead of content. */
        'zhihu/blocked': {
            readonly kind: ZhihuFailureTarget;
        };
        /** The requested feed resource does not exist. */
        'zhihu/not-found': {
            readonly kind: ZhihuFailureTarget;
        };
        /** The provider answered with content the provider cannot parse. */
        'zhihu/bad-response': {
            readonly kind: ZhihuFailureTarget;
        };
        /** `ctx.zhihu` has no usable provider for this request. */
        'zhihu/unavailable': {
            readonly kind: ZhihuFailureTarget;
        };
        /** The Host could not write the captured note into the Obsidian vault. */
        'zhihu/export-failed': {
            readonly kind: ZhihuExportQuery['kind'];
        };
    }
}
/**
 * The request a failure names: the feed kind a listing asked for, the content kind a read asked
 * for, or `search`. One member keeps every failure code's details readable by the same renderer.
 */
export type ZhihuFailureTarget = ZhihuFeedQuery['kind'] | ZhihuReadQuery['kind'] | 'search';
/** Every failure code this Remote raises from a classified seam error. */
export type ZhihuRemoteFailureCode = 'zhihu/login-required' | 'zhihu/rate-limited' | 'zhihu/blocked' | 'zhihu/not-found' | 'zhihu/bad-response' | 'zhihu/unavailable' | 'zhihu/export-failed';
/** One feed request; the Host applies its own default and cap to `limit`. */
export interface ZhihuFeedQuery {
    /** Feed to read: the hot list, the recommendation stream, or the accounts followed. */
    readonly kind: 'hot' | 'recommend' | 'follow';
    /** Requested row count; omitted uses the configured default. */
    readonly limit?: number;
    /** Continuation token from a previous page; omitted reads the first page. */
    readonly cursor?: string;
}
/** One feed page; the browser renders `rows` and keeps `cursor` to continue. */
export interface ZhihuFeedResult {
    /** Rows of this page, in feed order. */
    readonly rows: readonly ZhihuFeedRow[];
    /** Opaque token that continues this feed; absent when no page follows. */
    readonly cursor?: string;
}
/** One search request; the Host applies its own default and cap to `limit`. */
export interface ZhihuSearchQuery {
    /** Query text Zhihu matches against questions, answers and articles. */
    readonly query: string;
    /** Requested hit count; omitted uses the configured default. */
    readonly limit?: number;
    /** Opaque token that continues this search; omitted reads the first page. */
    readonly cursor?: string;
}
/** One page of search results. */
export interface ZhihuSearchResult {
    /** Rows of this page, in result order. */
    readonly rows: readonly ZhihuFeedRow[];
    /** Opaque token that continues this search; absent when no page follows. */
    readonly cursor?: string;
}
/** One feed or search row a browser can render without article bodies or credentials. */
export interface ZhihuFeedRow {
    /** Content kind the row links to. */
    readonly kind: 'question' | 'answer' | 'article';
    /** Provider content id, carried as a string because some ids exceed 2^53. */
    readonly id: string;
    /** Row title. */
    readonly title: string;
    /** Plain-text excerpt with markup removed. */
    readonly excerpt: string;
    /** Provider heat label when the feed carries one. */
    readonly heatLabel?: string;
    /** Canonical provider URL, so clients never build links. */
    readonly url: string;
}
/** One read request; a question read returns its title plus its top answer text. */
export interface ZhihuReadQuery {
    /** Which kind of content `id` addresses. */
    readonly kind: 'question' | 'answer' | 'article';
    /** Provider content id, carried as a string because some ids exceed 2^53. */
    readonly id: string;
    /** Answers requested for a question; ignored for any other kind. */
    readonly answerLimit?: number;
    /** Display title of the row; required to read an article, whose detail endpoint is signed. */
    readonly title?: string;
}
/** One read result, with the body already converted to plain text and to Markdown. */
export interface ZhihuReadItem {
    /** What was read. */
    readonly kind: 'question' | 'answer' | 'article';
    /** Provider content id that was read. */
    readonly id: string;
    /** Question title; empty when the payload carries none. */
    readonly title: string;
    /** Plain-text body, capped by the provider. */
    readonly contentText: string;
    /** The same body as GitHub-flavored Markdown, capped by the provider. */
    readonly contentMarkdown: string;
    /** True when the body was cut at the provider's character cap. */
    readonly contentTruncated: boolean;
    /** Upvote count of the answer whose text this is; 0 when unavailable. */
    readonly voteupCount: number;
    /** Author display name; empty when the payload carries none. */
    readonly author: string;
    /** Canonical provider URL of the read content. */
    readonly url: string;
}
/** One capture the browser asks the Host to file into the Obsidian vault. */
export interface ZhihuExportQuery {
    /** Content kind the capture carries. */
    readonly kind: 'question' | 'answer' | 'article';
    /** Provider content id, carried as a string because some ids exceed 2^53. */
    readonly id: string;
    /** Title written into the note and used for its file name. */
    readonly title: string;
    /** Canonical Zhihu URL recorded as the note's source. */
    readonly url: string;
    /** Author display name; omitted when the capture carries none. */
    readonly author?: string;
    /** Plain-text body the reader already holds. */
    readonly body: string;
    /** True when the body was cut at the provider's character cap. */
    readonly truncated: boolean;
}
/** Where a filed capture landed. */
export interface ZhihuExportResult {
    /** Vault-relative path of the note. */
    readonly path: string;
}
//# sourceMappingURL=types.d.ts.map