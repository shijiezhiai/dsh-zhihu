import type { PropsLocale } from '@deepseek-ai/dsh-client-ui-slots';
import type { ToolCallViewProps } from '@deepseek-ai/dsh-client-ui-tool/client';
type ZhihuFallbackProps = ToolCallViewProps & PropsLocale<'zhihu'>;
/**
 * Render one line naming the tool and its state, so a preparing call, a failed call, or an
 * unfamiliar result still reads as a Zhihu card.
 * @param props - tool call state and localized copy.
 * @returns the fallback row.
 */
export declare function ZhihuFallback(props: ZhihuFallbackProps): import("react").JSX.Element;
export {};
//# sourceMappingURL=ZhihuFallback.d.ts.map