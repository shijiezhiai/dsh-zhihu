/** `zhihu_search` card: the recorded in-site search hits, styled like the feed. */
import { IconSearchOutlineRegular } from '@deepseek-ai/dsh-client-ui-primitives'
import type { PropsLocale } from '@deepseek-ai/dsh-client-ui-slots'
import type { ToolCallViewProps } from '@deepseek-ai/dsh-client-ui-tool/client'
import { ZhihuFallback } from './ZhihuFallback.tsx'
import { ZhihuListCard } from './ZhihuListCard.tsx'
import { searchFacts } from './zhihu-meta.ts'

type ZhihuSearchCardProps = ToolCallViewProps & PropsLocale<'zhihu'>

/**
 * Render a search call from its recorded metadata, or the compact fallback when the call has not
 * settled or the metadata has another layout.
 * @param props - tool call state and localized copy.
 * @returns the search card.
 */
export function ZhihuSearchCard(props: ZhihuSearchCardProps) {
  if (props.phase !== 'result') return <ZhihuFallback {...props} />
  const facts = searchFacts(props.block.meta)
  if (facts === undefined) return <ZhihuFallback {...props} />
  return <ZhihuListCard t={props.t} toolName={props.toolName} icon={<IconSearchOutlineRegular size={14} />}
    title={facts.query === '' ? props.t('search.titleBare') : props.t('search.title', { query: facts.query })}
    count={facts.count} truncated={facts.truncated} rows={facts.rows} />
}
