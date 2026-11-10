/**
 * Stage one of the panel registration: what the Zhihu feed tab type IS.
 *
 * It is a page type — it recognizes no resource address and is opened by kind —
 * so it omits \`patterns\` and offers one guide entry, which is how a reader
 * reaches it. The chip title is a thunk, so a language change needs no
 * re-registration.
 */
import type { SidebarRightTabDefinition } from '@deepseek-ai/dsh-client-ui-sidebar-right/client';
import type { ZhihuTranslate } from './ZhihuListCard.tsx';
/** The tab kind this package owns. */
export declare const ZHIHU_PANEL_KIND = "zhihu";
/** This implementation's identity in the tab system: also the key its body registers under. */
export declare const ZHIHU_PANEL_ID = "@deepseek-ai/dsh-client-ui-zhihu";
/**
 * The feed panel's registry definition.
 * @param t - localized copy for the chip and the guide entry.
 * @returns the definition to register.
 */
export declare function zhihuPanelDefinition(t: ZhihuTranslate): SidebarRightTabDefinition;
//# sourceMappingURL=zhihu-panel-definition.d.ts.map