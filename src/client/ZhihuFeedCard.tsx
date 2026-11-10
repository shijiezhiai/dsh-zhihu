/** `zhihu_feed` card: the recorded hot list or recommendation list. */
import { IconGlobeOutlineRegular } from '@deepseek-ai/dsh-client-ui-primitives'
import type { PropsLocale } from '@deepseek-ai/dsh-client-ui-slots'
import type { ToolCallViewProps } from '@deepseek-ai/dsh-client-ui-tool/client'
import { ZhihuFallback } from './ZhihuFallback.tsx'
import { ZhihuListCard } from './ZhihuListCard.tsx'
import { feedFacts } from './zhihu-meta.ts'

type ZhihuFeedCardProps = ToolCallViewProps & PropsLocale<'zhihu'>

/**
 * Render a feed call from its recorded metadata, or the compact fallback when the call has not
 * settled or the metadata has another layout.
 * @param props - tool call state and localized copy.
 * @returns the feed card.
 */
export function ZhihuFeedCard(props: ZhihuFeedCardProps) {
  if (props.phase !== 'result') return <ZhihuFallback {...props} />
  const facts = feedFacts(props.block.meta)
  if (facts === undefined) return <ZhihuFallback {...props} />
  return <ZhihuListCard t={props.t} toolName={props.toolName} icon={<IconGlobeOutlineRegular size={14} />}
    title={facts.kind === 'hot' ? props.t('feed.hot') : props.t('feed.recommend')}
    count={facts.count} truncated={facts.truncated} rows={facts.rows} />
}
