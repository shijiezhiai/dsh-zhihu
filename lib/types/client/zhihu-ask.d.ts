/**
 * The draft that starts a conversation about the row the reader has open: the
 * title, the author, the link, and the body as model input, followed by the
 * question they have yet to type.
 */
import type { ZhihuFeedRow, ZhihuReadItem } from '@deepseek-ai/dsh-zhihu-plugin/types';
import type { ZhihuTranslate } from './ZhihuContent.tsx';
/** Characters of the body carried into the draft; the rest stays behind its link. */
export declare const ASK_BODY_LIMIT = 6000;
/** The pause between revealing the blank Session and handing it the draft. */
export declare const ASK_DRAFT_DELAY_MS = 250;
/** How long the draft is looked for in the composer before the reader gets a copy instead. */
export declare const ASK_CONFIRM_TIMEOUT_MS = 1500;
/** The pause between two looks at the composer. */
export declare const ASK_CONFIRM_POLL_MS = 150;
/**
 * Where the draft went: into the composer the reader is looking at, or onto
 * their clipboard because that composer never took it.
 */
export type ZhihuAskOutcome = 'drafted' | 'copied';
/** What the ask action needs from the surface that holds the composer. */
export interface ZhihuAskDeps {
    /** Text of the composer the reader is looking at. */
    composerText(): string;
    /** Types the draft into that composer; false when there is nothing to type into. */
    type(text: string): boolean;
    /** Puts the draft where the reader can paste it themselves. */
    copy(text: string): void;
    /** Tells the reader where the draft went, wherever they are looking. */
    report(text: string): void;
}
/** The workspace navigation the draft lands in; one blank session carries one conversation. */
export interface ZhihuAskTarget {
    /**
     * Open the Workspace's blank Session, keeping any existing draft.
     * @param workspaceId - absent inherits the current or most recent Workspace.
     * @param options - the draft text, when there is one, and how an existing draft is treated.
     * @returns settled once the Session is open and revealed.
     */
    startSession(workspaceId: undefined, options: {
        readonly prompt?: string;
        readonly whenDraftExists: 'append';
    }): void | Promise<void>;
}
/**
 * Picks the body a reader acts on: Markdown when the provider supplied one, plain text otherwise.
 * @param item - the read result, absent while the page holds only a row.
 * @returns the body, or an empty string when the provider supplied none.
 */
export declare function readableBody(item: ZhihuReadItem | undefined): string;
/**
 * Compose the draft that asks the model about the open row.
 *
 * A body the provider already truncated, or one this draft cuts, says so, so the
 * reader can tell a short answer from a clipped one before sending.
 * @param t - copy of the Zhihu namespace.
 * @param row - the row the reader has open.
 * @param item - its read result, absent when the body was not fetched.
 * @returns the draft text, ready for the composer.
 */
export declare function zhihuAskPrompt(t: ZhihuTranslate, row: ZhihuFeedRow, item: ZhihuReadItem | undefined): string;
/**
 * Bind the draft to a Workspace's navigation, so the page holds no service of its own.
 *
 * A Workspace whose blank Session never takes the draft would leave the click
 * looking like a no-op, so the same text is typed into the composer the reader is
 * looking at; only when that composer refuses it does the draft go to the
 * clipboard, and the outcome is reported wherever the reader is looking.
 * @param target - the workspace navigation that opens the drafting Session.
 * @param t - copy of the Zhihu namespace.
 * @param deps - the composer the draft lands in and the clipboard behind it.
 * @returns the page's ask action.
 */
export declare function zhihuAsk(target: ZhihuAskTarget, t: ZhihuTranslate, deps: ZhihuAskDeps): (row: ZhihuFeedRow, item: ZhihuReadItem | undefined) => Promise<ZhihuAskOutcome>;
//# sourceMappingURL=zhihu-ask.d.ts.map