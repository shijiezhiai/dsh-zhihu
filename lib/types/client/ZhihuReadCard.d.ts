import type { PropsLocale } from '@deepseek-ai/dsh-client-ui-slots';
import type { ToolCallViewProps } from '@deepseek-ai/dsh-client-ui-tool/client';
type ZhihuReadCardProps = ToolCallViewProps & PropsLocale<'zhihu'>;
/**
 * Render a read call from its recorded metadata and result text. The body is expanded on demand and
 * marked when the tool cut it at the deployment cap.
 * @param props - tool call state and localized copy.
 * @returns the read card.
 */
export declare function ZhihuReadCard(props: ZhihuReadCardProps): import("react").JSX.Element;
export {};
//# sourceMappingURL=ZhihuReadCard.d.ts.map