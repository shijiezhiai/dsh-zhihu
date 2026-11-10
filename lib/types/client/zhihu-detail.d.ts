/**
 * The open detail as its menu and its shortcuts see it.
 *
 * The page publishes a handle while a row is open, so a menu pick and a shortcut
 * press run the same action against the same row.
 */
import type { ShortcutCommandId } from '@deepseek-ai/dsh-client-shortcuts/client';
/** Actions the open detail offers its menu and its shortcuts. */
export type ZhihuDetailAction = 'copyTitle' | 'copyLink' | 'copyBody' | 'ask' | 'openOriginal' | 'export' | 'back';
/** What the page lends while a row is open. */
export interface ZhihuDetailHandle {
    /**
     * Run one action against the open row.
     * @param action - the action to run.
     */
    run(action: ZhihuDetailAction): void;
}
/** The one published detail: the page keeps a single row open. */
export interface ZhihuDetailRegistry {
    /**
     * Publish the open detail, or nothing once it closes.
     * @param handle - the open row's actions, or undefined while the list shows.
     * @returns the undo for this publish; it clears only what it published.
     */
    attach(handle: ZhihuDetailHandle | undefined): () => void;
    /**
     * The open detail's handle.
     * @returns the handle, or undefined while the list is what the reader sees.
     */
    current(): ZhihuDetailHandle | undefined;
}
/**
 * Create the registry both the page and the shortcut commands read.
 * @returns an empty registry.
 */
export declare function createZhihuDetailRegistry(): ZhihuDetailRegistry;
/**
 * The application command id of one detail action.
 * @param action - the action a command runs.
 * @returns the branded id the shortcuts registry keys on.
 */
export declare function zhihuShortcutId(action: ZhihuDetailAction): ShortcutCommandId;
//# sourceMappingURL=zhihu-detail.d.ts.map