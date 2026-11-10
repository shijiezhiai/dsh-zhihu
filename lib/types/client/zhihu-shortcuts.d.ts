/**
 * One application command per detail action: the keyboard equivalent of the
 * context menu, each resolving against whatever row the page has open.
 */
import type { Context as ClientContext } from '@deepseek-ai/cordis';
import type { ShortcutCommand, ShortcutCommandId } from '@deepseek-ai/dsh-client-shortcuts/client';
import type { ZhihuTranslate } from './ZhihuContent.tsx';
import { type ZhihuDetailAction, type ZhihuDetailRegistry } from './zhihu-detail.ts';
/**
 * The detail commands, bound to primary+shift+letter in every profile.
 * @param details - the registry the page publishes its open row into.
 * @param t - copy of the Zhihu namespace.
 * @returns one command per detail action.
 */
export declare function zhihuDetailCommands(details: ZhihuDetailRegistry, t: ZhihuTranslate): readonly ShortcutCommand[];
/**
 * Register the detail commands.
 * @param ctx - client context providing the shortcuts service.
 * @param details - the registry the page publishes its open row into.
 * @param t - copy of the Zhihu namespace.
 */
export declare function registerZhihuDetailShortcuts(ctx: ClientContext, details: ZhihuDetailRegistry, t: ZhihuTranslate): void;
/**
 * Read the keycaps the reader currently has bound for one detail action.
 * @param shortcuts - the client shortcuts service.
 * @returns a reader for a menu entry's keys; empty when the action has no binding.
 */
export declare function zhihuKeycaps(shortcuts: {
    readonly catalog: {
        getSnapshot(): readonly {
            readonly id: ShortcutCommandId;
            readonly keys: readonly string[];
        }[];
    };
}): (action: ZhihuDetailAction) => readonly string[];
//# sourceMappingURL=zhihu-shortcuts.d.ts.map