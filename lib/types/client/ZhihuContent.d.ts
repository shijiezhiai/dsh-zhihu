import type { ReactNode } from 'react';
import type { RemoteFailure } from '@deepseek-ai/dsh-api-remotes/client';
import type { PropsLocale } from '@deepseek-ai/dsh-client-ui-slots';
import type { ZhihuCollectQuery, ZhihuCollectResult, ZhihuCollectionsResult, ZhihuCommentRow, ZhihuCommentsResult, ZhihuFeedRow, ZhihuReadItem, ZhihuVoteQuery, ZhihuVoteResult } from '@deepseek-ai/dsh-zhihu-plugin/types';
import type { ZhihuPageOutcome } from './zhihu-page-face.ts';
import type { ZhihuPageDensity, ZhihuRankMove } from './zhihu-page-store.ts';
/** Copy handle of the Zhihu namespace. */
export type ZhihuTranslate = PropsLocale<'zhihu'>['t'];
/**
 * One row opened for reading: the request, its content, or its refusal.
 *
 * The linked state is a row Zhihu serves no body for, such as an article: the
 * surface shows its title and excerpt and offers the original link instead.
 */
export type ZhihuOpenedRow<R extends ZhihuFeedRow = ZhihuFeedRow> = {
    readonly status: 'loading';
    readonly row: R;
} | {
    readonly status: 'ready';
    readonly row: R;
    readonly item: ZhihuReadItem;
} | {
    readonly status: 'failed';
    readonly row: R;
    readonly failure: RemoteFailure;
} | {
    readonly status: 'linked';
    readonly row: R;
};
/**
 * Render the rows of one feed page.
 *
 * Every row opens inside the surface that lists it, including an article, which
 * the opened state shows as a linked row rather than leaving for the browser.
 * @param props.rows - rows of the current page, in feed order.
 * @param props.t - copy of the Zhihu namespace.
 * @param props.onOpen - called with the row a reader picks.
 * @param props.moves - the marks the lane's latest read left; omitted where nothing ranks a lane.
 * @param props.counted - whether the rows that arrived since the previous read are counted above
 *   them. A stream lane has no position to mark, so its new arrivals are what the reader needs.
 * @param props.density - how tightly the rows pack and how many lines of an excerpt they show.
 * @returns the notice, an empty state, or the row list.
 */
export declare function ZhihuRowList({ rows, t, onOpen, moves, counted, density }: {
    readonly rows: readonly ZhihuFeedRow[];
    readonly t: ZhihuTranslate;
    readonly onOpen: (row: ZhihuFeedRow) => void;
    readonly moves?: Readonly<Record<string, ZhihuRankMove>> | undefined;
    readonly counted?: boolean;
    readonly density?: ZhihuPageDensity;
}): ReactNode;
/**
 * Render one opened row's root comments, read once it opens.
 *
 * The seam answers one slice of the thread with no continuation token, so a further read asks for
 * a larger slice and keeps the comments already shown.
 * @param props.row - the row whose thread this is.
 * @param props.t - copy of the Zhihu namespace.
 * @param props.load - reads one slice of the thread.
 * @param props.loadReplies - reads one slice of the replies under one comment.
 * @returns the comment section.
 */
export declare function ZhihuComments({ row, t, load, loadReplies }: {
    readonly row: ZhihuFeedRow;
    readonly t: ZhihuTranslate;
    readonly load: (row: ZhihuFeedRow, limit: number) => Promise<ZhihuPageOutcome<ZhihuCommentsResult>>;
    /** Reads one slice of a comment's replies; omitted where the seat has no reply lane. */
    readonly loadReplies?: (commentId: string, limit: number) => Promise<ZhihuPageOutcome<ZhihuCommentsResult>>;
}): ReactNode;
/**
 * Render the replies under one root comment, requested only once the reader asks for them.
 *
 * Zhihu keeps one level of replies: a reply to a reply arrives in the same list, so nothing here
 * opens a further thread.
 * @param props.comment - the root comment whose replies these are.
 * @param props.t - copy of the Zhihu namespace.
 * @param props.load - reads one slice of the replies.
 * @returns the reply list, or the button that reveals it.
 */
export declare function ZhihuReplies({ comment, t, load }: {
    readonly comment: ZhihuCommentRow;
    readonly t: ZhihuTranslate;
    readonly load: (commentId: string, limit: number) => Promise<ZhihuPageOutcome<ZhihuCommentsResult>>;
}): ReactNode;
/**
 * Render one opened row: its title, body, author line, and the refusal path.
 * @param props.state - the open row, its content, or its refusal.
 * @param props.t - copy of the Zhihu namespace.
 * @param props.onRetry - called when the reader retries a refused read.
 * @param props.onAsk - drafts a conversation about this row; omitted where the seat has no Workspace.
 * @param props.onComments - reads the row's thread; omitted where the seat has no comment lane.
 * @param props.onReplies - reads a comment's replies; omitted where the seat has no reply lane.
 * @param props.onVote - casts the reader's own upvote; omitted where the seat cannot write one.
 * @param props.onCollections - lists the reader's own collections; omitted where the seat cannot write.
 * @param props.onCollect - files the row into a collection; omitted where the seat cannot write.
 * @returns the opened row.
 */
export declare function ZhihuOpenedContent<R extends ZhihuFeedRow>({ state, t, onRetry, onAsk, onComments, onReplies, onVote, onCollections, onCollect, }: {
    readonly state: ZhihuOpenedRow<R>;
    readonly t: ZhihuTranslate;
    readonly onRetry: () => void;
    readonly onAsk?: () => void;
    readonly onComments?: (row: ZhihuFeedRow, limit: number) => Promise<ZhihuPageOutcome<ZhihuCommentsResult>>;
    readonly onReplies?: (commentId: string, limit: number) => Promise<ZhihuPageOutcome<ZhihuCommentsResult>>;
    readonly onVote?: (query: ZhihuVoteQuery) => Promise<ZhihuPageOutcome<ZhihuVoteResult>>;
    readonly onCollections?: () => Promise<ZhihuPageOutcome<ZhihuCollectionsResult>>;
    readonly onCollect?: (query: ZhihuCollectQuery) => Promise<ZhihuPageOutcome<ZhihuCollectResult>>;
}): ReactNode;
//# sourceMappingURL=ZhihuContent.d.ts.map