/**
 * The page fields two machines share through the reader's vault, and the marker that orders the
 * two copies. Loaded rows and search hits stay on the machine that read them.
 */
import type { ZhihuSyncDocument, ZhihuSyncState } from '@deepseek-ai/dsh-zhihu-plugin/types';
import type { ZhihuPageState } from './zhihu-page-store.ts';
/** Wait after the last change before the shared page is written, so one scroll writes once. */
export declare const SYNC_PUSH_DELAY = 1000;
/**
 * Collect the fields one page contributes to the copy two machines share.
 * @param state - the page's persisted state.
 * @returns the fields, with this page's defaults filled in.
 */
export declare function zhihuSyncedState(state: ZhihuPageState): ZhihuSyncState;
/**
 * Write a shared state as JSON.
 * @param state - fields two machines share.
 * @returns the JSON the vault holds.
 */
export declare function zhihuSyncJson(state: ZhihuSyncState): string;
/**
 * Tell whether two shared states say the same thing, so a selection keeps one identity.
 * @param left - one shared state.
 * @param right - the other shared state.
 * @returns true when both name the same page.
 */
export declare function zhihuSyncEqual(left: ZhihuSyncState, right: ZhihuSyncState): boolean;
/**
 * Build the document the vault keeps.
 * @param state - fields two machines share.
 * @param savedAt - ISO instant of the write.
 * @returns the document to store.
 */
export declare function zhihuSyncDocument(state: ZhihuSyncState, savedAt: string): ZhihuSyncDocument;
/**
 * Tell whether a stored document is newer than the copy this machine last read or wrote.
 * @param document - document read from the vault.
 * @param marker - write instant this machine last saw, or undefined when it has seen none.
 * @returns true when the stored document wins.
 */
export declare function zhihuSyncIsNewer(document: ZhihuSyncDocument, marker: string | undefined): boolean;
/**
 * Read the write instant this machine last saw.
 * @returns the ISO instant, or undefined when no marker is stored or it cannot be read.
 */
export declare function readSyncMarker(): string | undefined;
/**
 * Record the write instant of the copy this machine last read or wrote.
 * @param savedAt - ISO instant of that write.
 */
export declare function writeSyncMarker(savedAt: string): void;
//# sourceMappingURL=zhihu-page-sync.d.ts.map