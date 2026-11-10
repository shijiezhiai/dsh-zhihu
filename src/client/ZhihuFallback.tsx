/** Compact presentation for a call or result the card layouts do not recognize. */
import { IconLinkOutlineRegular } from '@deepseek-ai/dsh-client-ui-primitives'
import type { PropsLocale } from '@deepseek-ai/dsh-client-ui-slots'
import type { ToolCallViewProps } from '@deepseek-ai/dsh-client-ui-tool/client'
import css from './ZhihuCard.module.css'

type ZhihuFallbackProps = ToolCallViewProps & PropsLocale<'zhihu'>

/**
 * Render one line naming the tool and its state, so a preparing call, a failed call, or an
 * unfamiliar result still reads as a Zhihu card.
 * @param props - tool call state and localized copy.
 * @returns the fallback row.
 */
export function ZhihuFallback(props: ZhihuFallbackProps) {
  const state = props.phase === 'result' ? (props.block.isError ? 'error' : 'empty')
    : props.phase === 'start' ? 'running' : 'preparing'
  const note = state === 'error' ? props.t('card.failed')
    : state === 'empty' ? props.t('card.unavailable') : props.t('card.loading')
  return <div className={css.fallback} data-tool={props.toolName} data-state={state}>
    <IconLinkOutlineRegular size={14} />
    <span className={css.fallbackTitle}>{props.t('fallback.title')}</span>
    <span>{note}</span>
  </div>
}
