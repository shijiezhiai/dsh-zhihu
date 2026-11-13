/**
 * The conversation a reader holds about one Zhihu row: the Session it runs in,
 * and the instruction that points the model at the row.
 *
 * The Session belongs to the Client catalog, so the discussion outlives the
 * panel: the page only keeps a reference while the segment is on screen and
 * remembers the identity it retained.
 */
import type { ISessions, SessionReference } from '@deepseek-ai/dsh-api-session-controller/client';
import type { ZhihuFeedRow } from '@deepseek-ai/dsh-zhihu-plugin/types';
import type { ZhihuTranslate } from './ZhihuContent.tsx';
declare module '@deepseek-ai/dsh-api-session-controller/client' {
    interface SessionReferenceSourceMap {
        /** A Zhihu row's conversation, referenced while its segment is on screen. */
        zhihuDiscussion: unknown;
    }
}
/**
 * The copy key that names what kind of item a row is.
 * @param kind - the row's kind.
 * @returns the key of its label.
 */
export declare function zhihuKindKey(kind: ZhihuFeedRow['kind']): 'kind.question' | 'kind.answer' | 'kind.article';
/**
 * Compose the instruction that opens or continues a discussion.
 *
 * The model reads the body itself, so the message carries the identity the
 * Zhihu Remote accepts rather than a copy of the text.
 * @param t - copy of the Zhihu namespace.
 * @param row - the row the reader has open.
 * @param instruction - what the reader asked for, in their own copy.
 * @returns the message text.
 */
export declare function zhihuDiscussionPrompt(t: ZhihuTranslate, row: ZhihuFeedRow, instruction: string): string;
/** One opened discussion. */
export interface ZhihuDiscussion {
    /** The retained Client Session the embedded Conversation renders. */
    readonly reference: SessionReference;
    /** Whether the discussion took an unused Session of the list instead of one created for it. */
    readonly reused: boolean;
    /**
     * Send one message into the discussion.
     * @param text - prompt text, sent verbatim as one text block.
     * @returns whether the Host accepted it.
     */
    send(text: string): Promise<boolean>;
    /**
     * The exchange so far, for a note that files it.
     * @returns every settled turn in order, empty while none has settled.
     */
    transcript(): readonly ZhihuDiscussionTurn[];
    /** Drop this panel's reference; the Session and its transcript stay. */
    release(): void;
}
/**
 * The step one open reached, so a pane that stalls names where it stopped instead of only how long.
 * `open` means the seat was never entered at all.
 */
export type ZhihuDiscussionStage = 'open' | 'catalog' | 'create' | 'retain';
/** The page's door to the Client Session catalog. */
export interface ZhihuDiscussionSeat {
    /**
     * Open the discussion of one row, resuming the Session it was remembered with.
     * @param row - the row the reader has open.
     * @param known - the identity a previous visit retained, when it still exists.
     * @returns the retained discussion.
     */
    open(row: ZhihuFeedRow, known: string | undefined): Promise<ZhihuDiscussion>;
    /**
     * The step the current or latest open reached.
     * @returns the stage it stopped at, for a pane that has waited too long.
     */
    stage(): ZhihuDiscussionStage;
}
/** How long the catalog may take before the page reports the wait instead of leaving its pane empty. */
export declare const DISCUSSION_OPEN_TIMEOUT_MS = 4000;
/** How long the pane shows a pending discussion before it reports the stall as a failure. */
export declare const DISCUSSION_PANEL_TIMEOUT_MS = 6000;
/** One turn of a discussion, as a note files it. */
export interface ZhihuDiscussionTurn {
    /** Who said it: the reader's instruction, or the model's answer. */
    readonly role: 'user' | 'assistant';
    /** The turn's text blocks, joined; reasoning and tool calls stay out. */
    readonly text: string;
}
/** Characters of an answer the discussion list keeps as its reminder. */
export declare const DISCUSSION_LINE_LIMIT = 120;
/**
 * The one line a discussion list shows for a conversation: its last answer, first line, plain.
 * @param turns - the settled turns of the discussion.
 * @returns that line, or undefined while no answer settled.
 */
export declare function lastAnswerLine(turns: readonly ZhihuDiscussionTurn[]): string | undefined;
/** What the seat needs from the Session catalog. */
export type ZhihuDiscussionSessions = Pick<ISessions, 'create' | 'list' | 'retain'>;
/**
 * Bind discussions to the Client Session catalog.
 * @param sessions - the catalog that creates and retains them.
 * @returns the page's discussion seat.
 */
export declare function createZhihuDiscussionSeat(sessions: ZhihuDiscussionSessions): ZhihuDiscussionSeat;
//# sourceMappingURL=zhihu-discussion.d.ts.map