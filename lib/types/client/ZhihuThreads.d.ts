/**
 * The reader's discussions as a page of its own: each entry reopens the item it was about, and
 * filing one away archives the Session the conversation ran in.
 */
import type { ReactNode } from 'react';
import type { SessionId } from '@deepseek-ai/dsh-session/types';
import type { ZhihuDiscussionEntry } from './zhihu-page-store.ts';
import type { ZhihuTranslate } from './ZhihuContent.tsx';
/** The Workspace action that files one discussion's Session into the archive. */
export type ZhihuThreadArchive = (sessionId: SessionId) => Promise<void>;
/** One listed discussion, under the row key the page remembered it by. */
export interface ZhihuThread {
    /** The row's discussion key. */
    readonly key: string;
    /** What the page kept of the discussion. */
    readonly entry: ZhihuDiscussionEntry;
}
/**
 * List the reader's discussions, newest first.
 * @param props - the entries, the copy, and what reopening or filing one away does.
 * @returns the list, or its empty state.
 */
export declare function ZhihuThreads({ threads, t, onOpen, onArchive }: {
    readonly threads: readonly ZhihuThread[];
    readonly t: ZhihuTranslate;
    readonly onOpen: (entry: ZhihuDiscussionEntry) => void;
    readonly onArchive: (thread: ZhihuThread) => void;
}): ReactNode;
//# sourceMappingURL=ZhihuThreads.d.ts.map