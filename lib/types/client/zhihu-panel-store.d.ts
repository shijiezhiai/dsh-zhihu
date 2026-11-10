/**
 * Panel state: the selected segment and one feed per segment, per open tab.
 *
 * The store is the panel's only source of truth: the component reads it through
 * its \`useStore\` seat and writes only through \`actions\`, while the face in
 * \`zhihu-panel-face.ts\` performs the Remote call and records the outcome. A
 * tab's bucket appears on first use and is forgotten when that tab's lifetime
 * signal aborts, so a closed tab leaves nothing behind.
 */
import type { RemoteFailure } from '@deepseek-ai/dsh-api-remotes/client';
import { type EngineStoreHandle } from '@deepseek-ai/dsh-client-store';
import type { TabId } from '@deepseek-ai/dsh-client-ui-dockkit';
import type { ZhihuFeedQuery, ZhihuFeedRow, ZhihuReadItem } from '@deepseek-ai/dsh-zhihu-plugin/types';
/** The feed segments the panel can show. */
export type ZhihuPanelSegment = ZhihuFeedQuery['kind'];
/** What the panel knows about one segment of one tab. */
export type ZhihuPanelFeed = {
    readonly status: 'idle';
} | {
    readonly status: 'loading';
} | {
    readonly status: 'ready';
    readonly rows: readonly ZhihuFeedRow[];
} | {
    readonly status: 'failed';
    readonly failure: RemoteFailure;
};
/** What the panel knows about the one row a reader opened, if any. */
export type ZhihuPanelDetail = {
    readonly status: 'closed';
} | {
    readonly status: 'loading';
    readonly row: ZhihuFeedRow;
} | {
    readonly status: 'ready';
    readonly row: ZhihuFeedRow;
    readonly item: ZhihuReadItem;
} | {
    readonly status: 'failed';
    readonly row: ZhihuFeedRow;
    readonly failure: RemoteFailure;
} | {
    readonly status: 'linked';
    readonly row: ZhihuFeedRow;
};
/** One tab's panel state: its selected segment, the feed of each segment, and the row it has open. */
export interface ZhihuPanelTabState {
    segment: ZhihuPanelSegment;
    feeds: Record<ZhihuPanelSegment, ZhihuPanelFeed>;
    detail: ZhihuPanelDetail;
}
/** The panel store's state: one bucket per open tab. */
export interface ZhihuPanelState {
    byTab: Record<string, ZhihuPanelTabState>;
}
/** The panel store's write set. A type alias, not an interface, so it satisfies `ActionsDecl`'s index signature. */
export type ZhihuPanelActions = {
    /**
     * Show one segment.
     * @param draft - the current state.
     * @param tabId - the tab being switched.
     * @param segment - the segment to show.
     */
    select(draft: ZhihuPanelState, tabId: TabId, segment: ZhihuPanelSegment): void;
    /**
     * Mark one segment as requested.
     * @param draft - the current state.
     * @param tabId - the requesting tab.
     * @param segment - the segment being requested.
     */
    loading(draft: ZhihuPanelState, tabId: TabId, segment: ZhihuPanelSegment): void;
    /**
     * Record the rows a request returned.
     * @param draft - the current state.
     * @param tabId - the requesting tab.
     * @param segment - the segment that answered.
     * @param rows - the returned rows, possibly empty.
     */
    loaded(draft: ZhihuPanelState, tabId: TabId, segment: ZhihuPanelSegment, rows: readonly ZhihuFeedRow[]): void;
    /**
     * Record a refused request.
     * @param draft - the current state.
     * @param tabId - the requesting tab.
     * @param segment - the segment that failed.
     * @param failure - the Remote failure to report.
     */
    failed(draft: ZhihuPanelState, tabId: TabId, segment: ZhihuPanelSegment, failure: RemoteFailure): void;
    /**
     * Open one row, which starts a read.
     * @param draft - the current state.
     * @param tabId - the tab listing the row.
     * @param row - the row being opened.
     */
    open(draft: ZhihuPanelState, tabId: TabId, row: ZhihuFeedRow): void;
    /**
     * Record the content a read returned.
     * @param draft - the current state.
     * @param tabId - the tab that opened the row.
     * @param row - the row that was read.
     * @param item - the returned content.
     */
    opened(draft: ZhihuPanelState, tabId: TabId, row: ZhihuFeedRow, item: ZhihuReadItem): void;
    /**
     * Open a row Zhihu serves no body for, showing what the feed already carried.
     * @param draft - the current state.
     * @param tabId - the tab listing the row.
     * @param row - the row being opened.
     */
    linked(draft: ZhihuPanelState, tabId: TabId, row: ZhihuFeedRow): void;
    /**
     * Record a refused read.
     * @param draft - the current state.
     * @param tabId - the tab that opened the row.
     * @param row - the row that was read.
     * @param failure - the Remote failure to report.
     */
    openFailed(draft: ZhihuPanelState, tabId: TabId, row: ZhihuFeedRow, failure: RemoteFailure): void;
    /**
     * Return to the list.
     * @param draft - the current state.
     * @param tabId - the tab to close.
     */
    close(draft: ZhihuPanelState, tabId: TabId): void;
    /**
     * Drop a tab's bucket.
     * @param draft - the current state.
     * @param tabId - the tab to forget.
     */
    forget(draft: ZhihuPanelState, tabId: TabId): void;
};
/**
 * Create the panel store. The slot runtime creates one instance per scope, so
 * two Sessions never share a bucket.
 * @returns the handle the \`sidebar.right.pane.tab\` registration carries.
 */
export declare function createZhihuPanelStore(): EngineStoreHandle<ZhihuPanelState, ZhihuPanelActions>;
/** The panel store handle. */
export type ZhihuPanelStore = ReturnType<typeof createZhihuPanelStore>;
//# sourceMappingURL=zhihu-panel-store.d.ts.map