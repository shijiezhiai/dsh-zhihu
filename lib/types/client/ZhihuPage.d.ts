import type { ReactNode } from 'react';
import type { PropsLocale, PropsRenderSlots, PropsRuntime, PropsStore } from '@deepseek-ai/dsh-client-ui-slots';
import type { ZhihuDetailAction, ZhihuDetailRegistry } from './zhihu-detail.ts';
import { type ZhihuDiscussionSeat } from './zhihu-discussion.ts';
import type { ZhihuPageFace } from './zhihu-page-face.ts';
import type { ZhihuPageStore } from './zhihu-page-store.ts';
import { type ZhihuTranslate } from './ZhihuContent.tsx';
/**
 * Render the Zhihu page.
 * @param props.face - the page's fetching face.
 * @param props.t - copy of the Zhihu namespace.
 * @param props.details - the registry the open row is published into for its shortcuts.
 * @param props.keycaps - the effective key labels of one action's command.
 * @param props.discussion - the seat that opens and instructs the open row's conversation.
 * @param props.report - announces an outcome on the shell overlay, where the reader is looking.
 * @param props.renderSlot - renders the retained discussion Session's Conversation.
 * @param props.SessionProvider - binds that Conversation to the retained Session.
 * @param props.useStore - the page store's read seat.
 * @param props.actions - the page store's write seat.
 * @returns the lane switch, the lane on screen, or the opened row.
 */
export declare function ZhihuPage({ face, t, details, keycaps, discussion, report, renderSlot, SessionProvider, useStore, actions }: {
    readonly face: ZhihuPageFace;
    readonly t: ZhihuTranslate;
    readonly details: ZhihuDetailRegistry;
    readonly keycaps: (action: ZhihuDetailAction) => readonly string[];
    readonly discussion: ZhihuDiscussionSeat;
    readonly report: (text: string) => void;
} & PropsStore<ZhihuPageStore> & PropsRenderSlots<'zhihu.discussion'>): ReactNode;
/**
 * Bind the page to its face, in the form a `main` slot registration declares.
 * @param face - the page's fetching face.
 * @param details - the registry the open row is published into for its shortcuts.
 * @param keycaps - the effective key labels of one action's command.
 * @param discussion - the seat that opens and instructs the open row's conversation.
 * @param report - announces an outcome on the shell overlay, where the reader is looking.
 * @returns the component the `main` seat renders, over the page store that registration declares.
 */
export declare function zhihuPageFor(face: ZhihuPageFace, details: ZhihuDetailRegistry, keycaps: (action: ZhihuDetailAction) => readonly string[], discussion: ZhihuDiscussionSeat, report: (text: string) => void): (props: PropsRuntime<'main'> & PropsLocale<'zhihu'> & PropsStore<ZhihuPageStore> & PropsRenderSlots<'zhihu.discussion'>) => ReactNode;
//# sourceMappingURL=ZhihuPage.d.ts.map