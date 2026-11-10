import type { ReactNode } from 'react';
import type { RemoteFailure } from '@deepseek-ai/dsh-api-remotes/client';
import type { PropsLocale } from '@deepseek-ai/dsh-client-ui-slots';
import type { ZhihuFeedRow, ZhihuReadItem } from '@deepseek-ai/dsh-zhihu-plugin/types';
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
 * @returns the notice, an empty state, or the row list.
 */
export declare function ZhihuRowList({ rows, t, onOpen }: {
    readonly rows: readonly ZhihuFeedRow[];
    readonly t: ZhihuTranslate;
    readonly onOpen: (row: ZhihuFeedRow) => void;
}): ReactNode;
/**
 * Render one opened row: its title, body, author line, and the refusal path.
 * @param props.state - the open row, its content, or its refusal.
 * @param props.t - copy of the Zhihu namespace.
 * @param props.onRetry - called when the reader retries a refused read.
 * @param props.onAsk - drafts a conversation about this row; omitted where the seat has no Workspace.
 * @returns the opened row.
 */
export declare function ZhihuOpenedContent<R extends ZhihuFeedRow>({ state, t, onRetry, onAsk }: {
    readonly state: ZhihuOpenedRow<R>;
    readonly t: ZhihuTranslate;
    readonly onRetry: () => void;
    readonly onAsk?: () => void;
}): ReactNode;
//# sourceMappingURL=ZhihuContent.d.ts.map