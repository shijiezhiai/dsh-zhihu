import type { PropsLocale } from '@deepseek-ai/dsh-client-ui-slots';
import type { ToolCallViewProps } from '@deepseek-ai/dsh-client-ui-tool/client';
type ZhihuFeedCardProps = ToolCallViewProps & PropsLocale<'zhihu'>;
/**
 * Render a feed call from its recorded metadata, or the compact fallback when the call has not
 * settled or the metadata has another layout.
 * @param props - tool call state and localized copy.
 * @returns the feed card.
 */
export declare function ZhihuFeedCard(props: ZhihuFeedCardProps): import("react").JSX.Element;
export {};
//# sourceMappingURL=ZhihuFeedCard.d.ts.map