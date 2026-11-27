/**
 * Persisted reading state of the Zhihu page: the lane on screen, the pages every lane has loaded,
 * the search text with its results, and where the list was left.
 *
 * Only settled content lives here. A request in flight, a continuation in progress and a refusal
 * stay in the component that issues them, so a reopened page restores what the reader had and
 * never revives an error or asks for a page on its own.
 */
import { type EngineStoreHandle } from '@deepseek-ai/dsh-client-store';
import type { SessionId } from '@deepseek-ai/dsh-session/types';
import type { ZhihuFeedRow, ZhihuFeedSort, ZhihuFeedTimeWindow, ZhihuSyncMove, ZhihuSyncState } from '@deepseek-ai/dsh-zhihu-plugin/types';
import type { ZhihuQuoteSource } from './zhihu-quote.ts';
/** The lanes the page pages through the feed Remote. */
export type ZhihuFeedTab = 'recommend' | 'hot' | 'follow' | 'topic';
/** Every lane the page switches between. */
export type ZhihuPageTab = ZhihuFeedTab | 'search';
/** How much room one row of a list takes, and how many lines of its excerpt it shows. */
export type ZhihuPageDensity = 'compact' | 'comfortable';
/** One lane's loaded rows and the token that continues them; an empty cursor means nothing follows. */
export interface ZhihuPageLane {
    rows: readonly ZhihuFeedRow[];
    cursor: string;
}
/** One search the page keeps open, with the hits that answered it. */
export interface ZhihuSearchTab {
    /** The text that produced the hits, which also names the tab. */
    readonly query: string;
    /** The hits as this search left them. */
    readonly lane: ZhihuPageLane;
}
/** How many searches the page keeps, so a long reading session does not grow the stored state. */
export declare const ZHIHU_SEARCH_TABS = 8;
/** One keyword the page watches, with the rows that answered it and the order they were read in. */
export interface ZhihuTopicTab {
    /** The keyword that produced the rows, which also names the tab. */
    readonly topic: string;
    /** The order its rows were listed in; absent keeps Zhihu's own relevance order. */
    readonly sort?: ZhihuFeedSort;
    /** How far back the read reached; absent keeps entries of every age. */
    readonly timeWindow?: ZhihuFeedTimeWindow;
    /** The rows as that read left them. */
    readonly lane: ZhihuPageLane;
}
/** How many keywords the page keeps, so a long watching session does not grow the stored state. */
export declare const ZHIHU_TOPIC_TABS = 8;
/** The row the page shows on its own, with how far into its body the reader got. */
export interface ZhihuPageReading {
    /** The row the reader opened. */
    readonly row: ZhihuFeedRow;
    /** Vertical offset of that row's body, so a reopened page resumes the paragraph they left. */
    readonly offset: number;
}
/** How one row moved when its lane was read, measured against that lane's previous read. */
export type ZhihuRankMove = ZhihuSyncMove;
/** One row's discussion, as the page lists it again after a reload. */
export interface ZhihuDiscussionEntry {
    /** The Session the discussion runs in. */
    readonly sessionId: SessionId;
    /** The row as it was when the discussion opened, so the list reopens the same item. */
    readonly row: ZhihuFeedRow;
    /**
     * Every item a comparison quotes, when the discussion compares several; absent for a discussion
     * about one row, which {@link row} already names.
     */
    readonly rows?: readonly ZhihuFeedRow[];
    /** When the discussion was last opened, in milliseconds since the epoch. */
    readonly openedAt: number;
    /** The first line of the last answer the reader left it at, when one settled. */
    readonly lastLine?: string;
}
/**
 * One discussion as persisted: the entry, or the Session id alone that a state written before the
 * page listed discussions carries.
 */
export type ZhihuDiscussionRecord = ZhihuDiscussionEntry | string;
/**
 * Read back the entry a persisted discussion carries.
 * @param record - one discussion as the store holds it.
 * @returns the entry, or undefined for the Session id alone a legacy state wrote.
 */
export declare function zhihuDiscussionEntry(record: ZhihuDiscussionRecord | undefined): ZhihuDiscussionEntry | undefined;
/**
 * Read the Session one persisted discussion runs in.
 * @param record - one discussion as the store holds it.
 * @returns its Session, or undefined when the row has no discussion.
 */
export declare function zhihuDiscussionSession(record: ZhihuDiscussionRecord | undefined): SessionId | undefined;
/** The page's persisted state. */
export interface ZhihuPageState {
    /** The lane on screen. */
    tab: ZhihuPageTab;
    /** The search text the input shows. */
    query: string;
    /**
     * The keyword the topic input shows.
     * A state persisted before topic lanes existed restores without the field, so readers default it.
     */
    topic?: string;
    /**
     * The keyword whose rows are on screen; absent when the reader submitted none.
     * A state persisted before topic tabs existed restores without the field, so readers go through
     * {@link zhihuTopics}.
     */
    activeTopic?: string;
    /**
     * The keywords the page watches, oldest first, so a second keyword adds a tab instead of
     * replacing the rows of the first.
     * A state persisted before topic tabs existed restores without the field, so readers go through
     * {@link zhihuTopics}.
     */
    topics?: readonly ZhihuTopicTab[];
    /**
     * Order the one topic lane of a state persisted before topic tabs existed listed its rows in.
     * Read it through {@link zhihuTopics}, which folds it into its own tab.
     */
    topicSort?: ZhihuFeedSort;
    /**
     * How far back that lane reached; absent keeps entries of every age.
     * Read it through {@link zhihuTopics}, which folds it into its own tab.
     */
    topicWindow?: ZhihuFeedTimeWindow;
    /**
     * The loaded content of each feed lane. A state persisted before topic lanes existed restores
     * without one, so readers go through {@link zhihuLane}.
     */
    feeds: Partial<Record<ZhihuFeedTab, ZhihuPageLane>>;
    /**
     * The searches the page keeps, oldest first, so a second search adds a tab instead of replacing
     * the hits of the first.
     * A state persisted before search tabs existed restores without the field, so readers go through
     * {@link zhihuSearches}.
     */
    searches?: readonly ZhihuSearchTab[];
    /** The search whose hits are on screen; absent when the reader ran none. */
    activeSearch?: string;
    /**
     * The one search lane of a state persisted before search tabs existed.
     * Read it through {@link zhihuSearches}, which folds it into its own tab.
     */
    search?: ZhihuPageLane;
    /** Vertical offset of the list, so a reopened page resumes where the reader left it. */
    scrollTop: number;
    /**
     * How tightly the lists pack their rows.
     * A state persisted before the density switch existed restores without the field, so readers default it.
     */
    density?: ZhihuPageDensity;
    /**
     * The discussion each row holds, keyed by {@link zhihuRowKey}.
     * A state persisted before discussions existed restores without the field, so readers default it.
     */
    discussions?: Record<string, ZhihuDiscussionRecord>;
    /**
     * How each row moved in the latest read of its lane, keyed by lane and then by {@link zhihuRowKey}.
     * Only a row that was new, climbed or fell carries an entry, so the field stays small and the
     * list marks nothing for a row that held its place or a lane read for the first time.
     * A state persisted before rank tracking existed restores without the field, so readers default it.
     */
    moves?: Partial<Record<ZhihuFeedTab, Readonly<Record<string, ZhihuRankMove>>>>;
    /**
     * The passages collected for the next discussion, in the order the reader added them, each
     * grouped under the row it was read in.
     * A state persisted before comparisons existed restores without the field, so readers default it.
     */
    comparison?: readonly ZhihuQuoteSource[];
    /**
     * The row the reader left open and how far into its body they had read, so the page reopens on it
     * instead of the list.
     * A state persisted before an opened row was kept restores without the field, so readers default it.
     */
    reading?: ZhihuPageReading;
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
     * Record the keyword the reader is watching.
     * @param draft - the current state.
     * @param topic - the text the topic input now shows.
     */
    topicTyped(draft: ZhihuPageState, topic: string): void;
    /**
     * Open a keyword tab, or the one a repeated keyword already named, and show it.
     * @param draft - the current state.
     * @param topic - the keyword the reader submitted.
     */
    topicOpened(draft: ZhihuPageState, topic: string): void;
    /**
     * Show one keyword tab the reader already has.
     * @param draft - the current state.
     * @param topic - the keyword to show.
     */
    topicShown(draft: ZhihuPageState, topic: string): void;
    /**
     * Close one keyword tab, moving to a neighbour when the closed one was on screen.
     * @param draft - the current state.
     * @param topic - the keyword to stop watching.
     */
    topicClosed(draft: ZhihuPageState, topic: string): void;
    /**
     * Record the order and the time window the reader picked for the keyword on screen.
     * @param draft - the current state.
     * @param sort - the order its rows are listed in.
     * @param timeWindow - how far back the lane reaches; undefined keeps every age.
     */
    topicOrdered(draft: ZhihuPageState, sort: ZhihuFeedSort, timeWindow: ZhihuFeedTimeWindow | undefined): void;
    /**
     * Replace one keyword tab's rows with a first page.
     * @param draft - the current state.
     * @param topic - the keyword that answered.
     * @param lane - the rows and continuation of that page.
     */
    topicLoaded(draft: ZhihuPageState, topic: string, lane: ZhihuPageLane): void;
    /**
     * Extend one keyword tab with a continuation page.
     * @param draft - the current state.
     * @param topic - the keyword that answered.
     * @param lane - the rows of the continuation and the token that follows them.
     */
    topicAppended(draft: ZhihuPageState, topic: string, lane: ZhihuPageLane): void;
    /**
     * Open a search tab, or the one a repeated query already named, and show it.
     * @param draft - the current state.
     * @param query - the text the reader submitted.
     */
    searchOpened(draft: ZhihuPageState, query: string): void;
    /**
     * Show one search tab the reader already has.
     * @param draft - the current state.
     * @param query - the search to show.
     */
    searchShown(draft: ZhihuPageState, query: string): void;
    /**
     * Close one search tab, moving to a neighbour when the closed one was on screen.
     * @param draft - the current state.
     * @param query - the search to drop.
     */
    searchClosed(draft: ZhihuPageState, query: string): void;
    /**
     * Replace one feed lane with a first page.
     * @param draft - the current state.
     * @param tab - the lane that answered.
     * @param lane - the rows and continuation of that page.
     */
    loaded(draft: ZhihuPageState, tab: ZhihuFeedTab, lane: ZhihuPageLane): void;
    /**
     * Extend one feed lane with a continuation page.
     * @param draft - the current state.
     * @param tab - the lane that answered.
     * @param lane - the rows of the continuation and the token that follows them.
     */
    appended(draft: ZhihuPageState, tab: ZhihuFeedTab, lane: ZhihuPageLane): void;
    /**
     * Replace one search tab's hits with a first page.
     * @param draft - the current state.
     * @param query - the search that answered.
     * @param lane - the rows and continuation of that page.
     */
    searchLoaded(draft: ZhihuPageState, query: string, lane: ZhihuPageLane): void;
    /**
     * Extend one search tab with a continuation page.
     * @param draft - the current state.
     * @param query - the search that answered.
     * @param lane - the rows of the continuation and the token that follows them.
     */
    searchAppended(draft: ZhihuPageState, query: string, lane: ZhihuPageLane): void;
    /**
     * Record where the list was left.
     * @param draft - the current state.
     * @param scrollTop - the list's vertical offset.
     */
    scrolled(draft: ZhihuPageState, scrollTop: number): void;
    /**
     * Keep the row the page shows on its own, or forget it when the reader goes back to the list.
     * @param draft - the current state.
     * @param row - the row now on screen, or undefined when the list is.
     */
    readingOpened(draft: ZhihuPageState, row: ZhihuFeedRow | undefined): void;
    /**
     * Record how far into the open row's body the reader got.
     * @param draft - the current state.
     * @param offset - the body's vertical offset.
     */
    readingScrolled(draft: ZhihuPageState, offset: number): void;
    /**
     * Take over the page another machine left, so both machines read the same lane and the same row.
     * @param draft - the current state.
     * @param state - the fields the other machine shared.
     */
    adopted(draft: ZhihuPageState, state: ZhihuSyncState): void;
    /**
     * Pack the lists tightly or roomily.
     * @param draft - the current state.
     * @param density - the density the reader picked.
     */
    densified(draft: ZhihuPageState, density: ZhihuPageDensity): void;
    /**
     * Remember one row's discussion, keeping the line an earlier visit left it at.
     * @param draft - the current state.
     * @param key - the row's discussion key.
     * @param entry - the discussion as this visit opened it.
     */
    remember(draft: ZhihuPageState, key: string, entry: ZhihuDiscussionEntry): void;
    /**
     * Record the answer the reader left one discussion at.
     * @param draft - the current state.
     * @param key - the row's discussion key.
     * @param line - the first line of its last answer.
     */
    noted(draft: ZhihuPageState, key: string, line: string): void;
    /**
     * Drop one discussion from the page, once the Session it ran in was filed away.
     * @param draft - the current state.
     * @param key - the row's discussion key.
     */
    forgot(draft: ZhihuPageState, key: string): void;
    /**
     * Replace the passages collected for the next discussion.
     * @param draft - the current state.
     * @param sources - the comparison as the page now holds it; empty clears the bar.
     */
    collected(draft: ZhihuPageState, sources: readonly ZhihuQuoteSource[]): void;
};
/** The store handle the `main` registration declares and the page reads. */
export type ZhihuPageStore = EngineStoreHandle<ZhihuPageState, ZhihuPageActions>;
/**
 * Read one lane of a stored page.
 * @param state - the page state.
 * @param tab - the lane to read.
 * @returns the stored lane, or an empty one when the state predates that lane.
 */
export declare function zhihuLane(state: ZhihuPageState, tab: ZhihuFeedTab): ZhihuPageLane;
/**
 * Read the searches a stored page keeps from the fields that carry them.
 * @param searches - the tabs a state persisted with search tabs carries.
 * @param legacy - the single search lane of a state persisted before tabs existed.
 * @param query - the text that lane was run with.
 * @returns the tabs, oldest first; a lane that never answered keeps no tab at all.
 */
export declare function zhihuSearchTabs(searches: readonly ZhihuSearchTab[] | undefined, legacy: ZhihuPageLane | undefined, query: string): readonly ZhihuSearchTab[];
/**
 * Read the searches one page state keeps.
 * @param state - the page state.
 * @returns the tabs, oldest first, folding a state persisted before tabs existed into one.
 */
export declare function zhihuSearches(state: ZhihuPageState): readonly ZhihuSearchTab[];
/**
 * Read the keywords a stored page keeps from the fields that carry them.
 * @param topics - the tabs a state persisted with topic tabs carries.
 * @param topic - the keyword of a state persisted before tabs existed.
 * @param sort - the order that lane was read in.
 * @param timeWindow - how far back that lane reached.
 * @param lane - the rows that lane held.
 * @returns the tabs, oldest first; a keyword nobody typed keeps no tab at all.
 */
export declare function zhihuTopicTabs(topics: readonly ZhihuTopicTab[] | undefined, topic: string | undefined, sort: ZhihuFeedSort | undefined, timeWindow: ZhihuFeedTimeWindow | undefined, lane: ZhihuPageLane | undefined): readonly ZhihuTopicTab[];
/**
 * Read the keywords one page state keeps.
 * @param state - the page state.
 * @returns the tabs, oldest first, folding a state persisted before tabs existed into one.
 */
export declare function zhihuTopics(state: ZhihuPageState): readonly ZhihuTopicTab[];
/**
 * Name the keyword whose rows are on screen.
 * @param state - the page state.
 * @returns that keyword, or undefined when nothing is watched yet.
 */
export declare function zhihuActiveTopic(state: ZhihuPageState): string | undefined;
/**
 * Declare the page store, persisted so a reopened page keeps its lane, its rows and its offset.
 * @returns a fresh store handle for the `main` registration.
 */
export declare function createZhihuPageStore(): ZhihuPageStore;
//# sourceMappingURL=zhihu-page-store.d.ts.map