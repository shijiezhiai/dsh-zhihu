/**
 * Zhihu browser half: the three keyed toolview cards for `zhihu_feed`,
 * `zhihu_read`, and `zhihu_search`, plus the Zhihu feed panel as a right-Sidebar
 * tab type.
 *
 * Both halves are registered eagerly, before the Zhihu Remote is reachable. The
 * Host assembly mounts a fixed list of namespaces, so a capability outside it
 * carries its own generated descriptors and this plugin mounts them itself; the
 * panel asks for the namespace when a tab loads instead of waiting for it during
 * plugin activation, because a registration that waits for a namespace the Host
 * never publishes leaves no card, no tab, and no diagnostic.
 *
 * The panel reaches the Sidebar through its public path only: the definition into
 * `ctx.sidebarRightTabs`, the body into the keyed `sidebar.right.pane.tab` seat
 * under the definition's id. The chip title needs no registration because the
 * definition's title thunk is the fallback.
 */
import type { Context as ClientContext } from '@deepseek-ai/cordis';
import type { MainPanelId } from '@deepseek-ai/dsh-client-ui-layout/client';
import { type ZhihuKey } from './locales.ts';
declare module '@deepseek-ai/dsh-client-ui-slots' {
    interface LocaleNamespaceMap {
        /** Copy for the Zhihu cards and the feed panel. */
        zhihu: ZhihuKey;
    }
}
/** Main panel id of the Zhihu page, shared by the left navigation entry and the page seat. */
export declare const ZHIHU_PAGE_ID: MainPanelId;
/**
 * Required services: the registries, copy, the command registry, workspace
 * navigation, the Session controller, and the Remote service this plugin mounts into.
 */
export declare const inject: string[];
/**
 * Mount the Zhihu Remote and register the cards and the panel.
 * @param ctx - client root context.
 * @returns disposer unmounting the Remote contribution.
 */
export declare function apply(ctx: ClientContext): Promise<() => Promise<void>>;
//# sourceMappingURL=index.d.ts.map