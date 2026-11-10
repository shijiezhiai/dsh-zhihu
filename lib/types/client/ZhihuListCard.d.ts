/** Shared list card for `zhihu_feed` and `zhihu_search`: ranked rows linking to Zhihu. */
import type { ReactNode } from 'react';
import type { PropsLocale } from '@deepseek-ai/dsh-client-ui-slots';
import type { ZhihuEntryKind, ZhihuEntryRow } from './zhihu-meta.ts';
/** The translated-copy seat the cards receive from the toolview slot. */
export type ZhihuTranslate = PropsLocale<'zhihu'>['t'];
/**
 * Name one entry kind.
 * @param t - translated-copy seat of the card.
 * @param kind - the recorded entry kind.
 * @returns the localized kind label.
 */
export declare function kindLabel(t: ZhihuTranslate, kind: ZhihuEntryKind): string;
/**
 * Name a row count, using the singular copy for one row.
 * @param t - translated-copy seat of the card.
 * @param count - number of rows.
 * @returns the localized count label.
 */
export declare function countLabel(t: ZhihuTranslate, count: number): string;
/** Props of the shared list card; each tool supplies its own title and icon. */
export interface ZhihuListCardProps {
    readonly t: ZhihuTranslate;
    readonly toolName: string;
    readonly icon: ReactNode;
    readonly title: string;
    readonly count: number;
    readonly truncated: boolean;
    readonly rows: readonly ZhihuEntryRow[];
}
/**
 * Render one header with the count and truncation badges and the linked rows below it.
 * @param props - tool name, header content, and rows.
 * @returns the list card.
 */
export declare function ZhihuListCard({ t, toolName, icon, title, count, truncated, rows }: ZhihuListCardProps): import("react").JSX.Element;
//# sourceMappingURL=ZhihuListCard.d.ts.map