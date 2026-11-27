import type { ZhihuSyncDocument, ZhihuSyncState } from './types.ts';
/** Format version this Host writes and reads. */
export declare const STATE_VERSION = 1;
/**
 * Read the fields two machines share.
 * @param value - `state` from the stored document.
 * @returns the state, or undefined when it cannot say which lane and density the page shows.
 */
export declare function readSyncState(value: unknown): ZhihuSyncState | undefined;
/**
 * Read one stored document, envelope included.
 * @param source - JSON the vault holds.
 * @returns the document, or undefined when it is not JSON this Host understands.
 */
export declare function readStateDocument(source: string): ZhihuSyncDocument | undefined;
/**
 * Refuse a document the vault must not store.
 * @param document - document a Client asked to store.
 * @throws RemoteError when the envelope names another version or an unreadable write instant.
 */
export declare function assertStateDocument(document: ZhihuSyncDocument): void;
//# sourceMappingURL=state.d.ts.map