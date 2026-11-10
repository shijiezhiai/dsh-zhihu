import type { PropsLocale } from '@deepseek-ai/dsh-client-ui-slots';
import type { ToolCallViewProps } from '@deepseek-ai/dsh-client-ui-tool/client';
type ZhihuSearchCardProps = ToolCallViewProps & PropsLocale<'zhihu'>;
/**
 * Render a search call from its recorded metadata, or the compact fallback when the call has not
 * settled or the metadata has another layout.
 * @param props - tool call state and localized copy.
 * @returns the search card.
 */
export declare function ZhihuSearchCard(props: ZhihuSearchCardProps): import("react").JSX.Element;
export {};
//# sourceMappingURL=ZhihuSearchCard.d.ts.map