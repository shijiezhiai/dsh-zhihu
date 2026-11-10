import type { ReactNode } from 'react';
import type { InjectFace, PropsLocale, PropsRuntime, PropsStore } from '@deepseek-ai/dsh-client-ui-slots';
import type { ZhihuPanelInjected } from './zhihu-panel-face.ts';
import type { ZhihuPanelStore } from './zhihu-panel-store.ts';
/** The panel body's props: the slot's own seats plus this package's store and face. */
export type ZhihuPanelProps = PropsRuntime<'sidebar.right.pane.tab'> & PropsStore<ZhihuPanelStore> & InjectFace<ZhihuPanelInjected> & PropsLocale<'zhihu'>;
/**
 * Render the Zhihu feed panel of one tab.
 * @param props - the slot's runtime seats, the panel store, the injected face, and copy.
 * @returns the panel element.
 */
export declare function ZhihuPanel({ useTabInfo, useStore, actions, load, read, ask, t }: ZhihuPanelProps): ReactNode;
//# sourceMappingURL=ZhihuPanel.d.ts.map