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
 * for, `search`, or `comments` when the call read a reply thread. One member keeps every failure
 * code's details readable by the same renderer.
 */
export type ZhihuFailureTarget = ZhihuFeedQuery['kind'] | ZhihuReadQuery['kind'] | 'search' | 'comments' | 'collections' | 'state';
/** Every failure code this Remote raises from a classified seam error. */
export type ZhihuRemoteFailureCode = 'zhihu/login-required' | 'zhihu/rate-limited' | 'zhihu/blocked' | 'zhihu/not-found' | 'zhihu/bad-response' | 'zhihu/unavailable' | 'zhihu/export-failed';
/** Order a `topic` feed lists its entries in. */
export type ZhihuFeedSort = 'relevance' | 'newest' | 'top';
/** How far back a `topic` feed reaches, measured from the moment of the read. */
export type ZhihuFeedTimeWindow = 'day' | 'week' | 'month' | 'year';
/** One feed request; the Host applies its own default and cap to `limit`. */
export interface ZhihuFeedQuery {
    /**
     * Feed to read: the hot list, the recommendation stream, the accounts followed, or a keyword's
     * entries.
     */
    readonly kind: 'hot' | 'recommend' | 'follow' | 'topic';
    /** Keyword a `topic` feed lists; required for `topic` and ignored by every other feed. */
    readonly topic?: string;
    /** Requested row count; omitted uses the configured default. */
    readonly limit?: number;
    /** Continuation token from a previous page; omitted reads the first page. */
    readonly cursor?: string;
    /**
     * Order a `topic` feed lists its entries in; omitted keeps Zhihu's relevance order. An ordered
     * feed reads several pages into one answer, so it continues none of them and answers no cursor.
     * Ignored by every other feed.
     */
    readonly sort?: ZhihuFeedSort;
    /**
     * Keep only a `topic` feed's entries created within this window; omitted keeps every age. Like
     * {@link ZhihuFeedQuery.sort}, a window answers no cursor. Ignored by every other feed.
     */
    readonly timeWindow?: ZhihuFeedTimeWindow;
}
/** One feed page; the browser renders `rows` and keeps `cursor` to continue. */
export interface ZhihuFeedResult {
    /** Rows of this page, in feed order. */
    readonly rows: readonly ZhihuFeedRow[];
    /** Opaque token that continues this feed; absent when no page follows. */
    readonly cursor?: string;
}
/** Deployment settings the browser half reads once, before it quotes anything. */
export interface ZhihuClientSettings {
    /** Longest passage one quoted instruction carries, in characters. */
    readonly quoteMaxChars: number;
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
    /** Upvote count the feed reported for the row; absent when the feed carries none. */
    readonly voteupCount?: number;
    /** Canonical provider URL, so clients never build links. */
    readonly url: string;
}
/** One request for the root comments of a content. */
export interface ZhihuCommentsQuery {
    /** Which kind of content `id` addresses. */
    readonly kind: 'question' | 'answer' | 'article';
    /** Provider content id, carried as a string because some ids exceed 2^53. */
    readonly id: string;
    /** Comments requested; the Host applies its own default and cap. */
    readonly limit?: number;
}
/** One root comment a browser can render without credentials. */
export interface ZhihuCommentRow {
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
/** The comments one call answers: a slice of the thread, ranked by the endpoint. */
export interface ZhihuCommentsResult {
    /** Comments in the order the endpoint ranked them. */
    readonly items: readonly ZhihuCommentRow[];
    /** Number of root comments on the content; absent when the payload carried none. */
    readonly total?: number;
}
/** One replies request: the root comment whose answers are wanted, and how many. */
export interface ZhihuRepliesQuery {
    /** Provider comment id, carried as a string because some ids exceed 2^53. */
    readonly commentId: string;
    /** Replies requested; the Host applies its own default and cap. */
    readonly limit?: number;
}
/** One vote the reader casts on an answer or an article. */
export interface ZhihuVoteQuery {
    /** Content kind the vote applies to; a question is followed rather than voted on. */
    readonly kind: 'answer' | 'article';
    /** Provider content id, carried as a string because some ids exceed 2^53. */
    readonly id: string;
    /** Vote to hold after the call: `up` upvotes, `none` withdraws an upvote. */
    readonly vote: 'up' | 'none';
}
/** What one vote answered: the count it left, and the state the reader now holds. */
export interface ZhihuVoteResult {
    /** Upvote count after the vote; absent when the payload carried none. */
    readonly voteupCount?: number;
    /** True when the reader now holds an upvote. */
    readonly voted: boolean;
}
/** One request for the collections of the reader's own account. */
export interface ZhihuCollectionsQuery {
    /** Collections requested; the Host applies its own default and cap. */
    readonly limit?: number;
}
/** One collection the reader keeps items in. */
export interface ZhihuCollectionRow {
    /** Lossless decimal collection id. */
    readonly id: string;
    /** Title the reader gave it. */
    readonly title: string;
    /** Number of items it holds. */
    readonly itemCount: number;
}
/** The collections of the reader's own account, in the order Zhihu lists them. */
export interface ZhihuCollectionsResult {
    /** Collections read. */
    readonly items: readonly ZhihuCollectionRow[];
}
/** One change to a collection of the reader's own account. */
export interface ZhihuCollectQuery {
    /** Content kind the change applies to; a question is followed rather than collected. */
    readonly kind: 'answer' | 'article';
    /** Provider content id, carried as a string because some ids exceed 2^53. */
    readonly id: string;
    /** Lossless decimal id of the collection that gains or loses the item. */
    readonly collectionId: string;
    /** Whether the item belongs in that collection after the call. */
    readonly collected: boolean;
}
/** What one collection change answered. */
export interface ZhihuCollectResult {
    /** True when the item belongs in the collection after the call. */
    readonly collected: boolean;
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
/** The conversation a capture carries into its note. */
export interface ZhihuExportDiscussion {
    /** Heading of the section, in the reader's copy. */
    readonly heading: string;
    /** The answer the conversation ended on, as Markdown. */
    readonly text: string;
}
/** A passage the reader marks on its own, filed into the note it came from. */
export interface ZhihuExportExcerpt {
    /** Heading of the section, in the reader's copy. */
    readonly heading: string;
    /** The passage, as Markdown. */
    readonly text: string;
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
    /** Conclusion to file under the body; omitted when the reader discussed nothing. */
    readonly discussion?: ZhihuExportDiscussion;
    /**
     * Passage to add under its own heading; omitted when the reader filed none.
     * The note keeps whatever it already held, so this section adds to a capture
     * rather than replacing it.
     */
    readonly excerpt?: ZhihuExportExcerpt;
}
/** Where a filed capture landed. */
export interface ZhihuExportResult {
    /** Vault-relative path of the note. */
    readonly path: string;
}
/** Every lane the shared page document can name. */
export type ZhihuSyncTab = 'recommend' | 'hot' | 'follow' | 'topic' | 'search';
/** How tightly the shared page document packs its lists. */
export type ZhihuSyncDensity = 'compact' | 'comfortable';
/** How one row moved in the latest read of its lane. */
export type ZhihuSyncMove = {
    readonly kind: 'new';
} | {
    readonly kind: 'up';
    readonly places: number;
} | {
    readonly kind: 'down';
    readonly places: number;
};
/** One discussion as the shared page document carries it. */
export interface ZhihuSyncDiscussion {
    /** The Session the discussion runs in, as a stored id rather than a Session handle. */
    readonly sessionId: string;
    /** The row the discussion opened from, so another machine reopens the same item. */
    readonly row: ZhihuFeedRow;
    /** When it opened, in epoch milliseconds. */
    readonly openedAt: number;
}
/** The row a page left open and how far into its body the reader got. */
export interface ZhihuSyncReading {
    /** The row the reader opened. */
    readonly row: ZhihuFeedRow;
    /** Vertical offset of that row's body, so another machine resumes the same paragraph. */
    readonly offset: number;
}
/**
 * The page fields two machines share: the lane on screen, how the lists pack, what each row
 * discusses, how the lanes moved, and which row a reader left open. Loaded rows and search hits
 * stay on the machine that read them.
 */
export interface ZhihuSyncState {
    /** The lane on screen. */
    readonly tab: ZhihuSyncTab;
    /** Keyword the topic lane reads. */
    readonly topic: string;
    /** How tightly the lists pack their rows. */
    readonly density: ZhihuSyncDensity;
    /** Vertical offset of the list, so the next machine opens at the same place. */
    readonly scrollTop: number;
    /** The discussion each row holds, keyed by `<kind>:<id>`; a bare string is a Session id. */
    readonly discussions: Readonly<Record<string, ZhihuSyncDiscussion | string>>;
    /** How each row moved in the latest read of its lane, keyed by lane then by row. */
    readonly moves: Readonly<Record<string, Readonly<Record<string, ZhihuSyncMove>>>>;
    /** The row the reader left open, when one is. */
    readonly reading?: ZhihuSyncReading;
}
/** One page as the vault stores it. */
export interface ZhihuSyncDocument {
    /** Format version; a reader ignores a document written in a version it does not know. */
    readonly version: number;
    /** ISO instant of the write, so two machines resolve to the newer copy. */
    readonly savedAt: string;
    /** The fields two machines share. */
    readonly state: ZhihuSyncState;
}
/** Answer to a request for the stored page. */
export interface ZhihuSyncReadResult {
    /** The stored page; omitted when the vault holds none. */
    readonly document?: ZhihuSyncDocument;
}
/** Answer to a write of the stored page. */
export interface ZhihuSyncSaveResult {
    /** True when the vault took the document; false leaves the local copy in charge. */
    readonly saved: boolean;
}
//# sourceMappingURL=types.d.ts.map