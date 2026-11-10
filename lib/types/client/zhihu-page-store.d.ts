/**
 * Persisted reading state of the Zhihu page: the lane on screen, the pages every lane has loaded,
 * the search text with its results, and where the list was left.
 *
 * Only settled content lives here. A request in flight, a continuation in progress and a refusal
 * stay in the component that issues them, so a reopened page restores what the reader had and
 * never revives an error or asks for a page on its own.
 */
import { type EngineStoreHandle } from '@deepseek-ai/dsh-client-store';
import type { ZhihuFeedRow } from '@deepseek-ai/dsh-zhihu-plugin/types';
/** The lanes the page pages through the feed Remote. */
export type ZhihuFeedTab = 'recommend' | 'hot' | 'follow';
/** Every lane the page switches between. */
export type ZhihuPageTab = ZhihuFeedTab | 'search';
/** One lane's loaded rows and the token that continues them; an empty cursor means nothing follows. */
export interface ZhihuPageLane {
    rows: readonly ZhihuFeedRow[];
    cursor: string;
}
/** The page's persisted state. */
export interface ZhihuPageState {
    /** The lane on screen. */
    tab: ZhihuPageTab;
    /** The search text the input shows. */
    query: string;
    /** The loaded content of each feed lane. */
    feeds: Record<ZhihuFeedTab, ZhihuPageLane>;
    /** The loaded content of the search lane. */
    search: ZhihuPageLane;
    /** Vertical offset of the list, so a reopened page resumes where the reader left it. */
    scrollTop: number;
    /**
     * The Session each row's discussion runs in, keyed by {@link zhihuDiscussionKey}.
     * A state persisted before discussions existed restores without the field, so readers default it.
     */
    discussions?: Record<string, string>;
}
/** The page store's write set. A type alias, not an interface, so it satisfies `ActionsDecl`'s index signature. */
export type ZhihuPageActions = {
    /**
     * Show one lane.
     * @param draft - the current state.
     * @param tab - the lane to show.
     */
    show(draft: ZhihuPageState, tab: ZhihuPageTab): void;
    /**
     * Record the search text the reader is editing.
     * @param draft - the current state.
     * @param query - the text the input now shows.
     */
    typed(draft: ZhihuPageState, query: string): void;
    /**
     * Replace one lane with a first page.
     * @param draft - the current state.
     * @param tab - the lane that answered.
     * @param lane - the rows and continuation of that page.
     */
    loaded(draft: ZhihuPageState, tab: ZhihuPageTab, lane: ZhihuPageLane): void;
    /**
     * Extend one lane with a continuation page.
     * @param draft - the current state.
     * @param tab - the lane that answered.
     * @param lane - the rows of the continuation and the token that follows them.
     */
    appended(draft: ZhihuPageState, tab: ZhihuPageTab, lane: ZhihuPageLane): void;
    /**
     * Record where the list was left.
     * @param draft - the current state.
     * @param scrollTop - the list's vertical offset.
     */
    scrolled(draft: ZhihuPageState, scrollTop: number): void;
    /**
     * Remember the Session one row's discussion runs in.
     * @param draft - the current state.
     * @param key - the row's discussion key.
     * @param sessionId - the identity the page retained.
     */
    remember(draft: ZhihuPageState, key: string, sessionId: string): void;
};
/** The store handle the `main` registration declares and the page reads. */
export type ZhihuPageStore = EngineStoreHandle<ZhihuPageState, ZhihuPageActions>;
/**
 * Declare the page store, persisted so a reopened page keeps its lane, its rows and its offset.
 * @returns a fresh store handle for the `main` registration.
 */
export declare function createZhihuPageStore(): ZhihuPageStore;
//# sourceMappingURL=zhihu-page-store.d.ts.map