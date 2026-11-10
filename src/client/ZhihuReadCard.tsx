/** `zhihu_read` card: the recorded question or answer with a collapsible body. */
import { useState } from 'react'
import { DisclosureRow, IconDeliverDocRegular, Tag } from '@deepseek-ai/dsh-client-ui-primitives'
import type { PropsLocale } from '@deepseek-ai/dsh-client-ui-slots'
import type { ToolCallViewProps } from '@deepseek-ai/dsh-client-ui-tool/client'
import { ZhihuFallback } from './ZhihuFallback.tsx'
import { kindLabel, type ZhihuTranslate } from './ZhihuListCard.tsx'
import { plainText, readBody, readFacts } from './zhihu-meta.ts'
import css from './ZhihuCard.module.css'

type ZhihuReadCardProps = ToolCallViewProps & PropsLocale<'zhihu'>

/**
 * Name the vote count, using the singular copy for one vote.
 * @param t - translated-copy seat of the card.
 * @param count - recorded vote count.
 * @returns the localized vote label.
 */
function upvotesLabel(t: ZhihuTranslate, count: number): string {
  return count === 1 ? t('read.upvotesOne') : t('read.upvotes', { count })
}

/**
 * Render a read call from its recorded metadata and result text. The body is expanded on demand and
 * marked when the tool cut it at the deployment cap.
 * @param props - tool call state and localized copy.
 * @returns the read card.
 */
export function ZhihuReadCard(props: ZhihuReadCardProps) {
  const [expanded, setExpanded] = useState(false)
  if (props.phase !== 'result') return <ZhihuFallback {...props} />
  const facts = readFacts(props.block.meta)
  if (facts === undefined) return <ZhihuFallback {...props} />
  const body = readBody(plainText(props.block.content))
  return <section className={css.card} data-tool={props.toolName} data-state="ok">
    <header className={css.header}>
      <span className={css.icon}><IconDeliverDocRegular size={14} /></span>
      <h3 className={css.title}>
        <a className={css.link} href={facts.row.url} target="_blank" rel="noopener noreferrer">{facts.row.title}</a>
      </h3>
      <span className={css.badges}>
        <Tag tone="outline">{kindLabel(props.t, facts.kind)}</Tag>
        <Tag tone="neutral">{upvotesLabel(props.t, facts.row.voteupCount)}</Tag>
        {facts.truncated && <Tag tone="quiet">{props.t('read.truncated')}</Tag>}
      </span>
    </header>
    {facts.row.author !== '' && <p className={css.author}>{facts.row.author}</p>}
    <DisclosureRow icon={<IconDeliverDocRegular size={14} />} title={props.t('read.body')} open={expanded}
      expandable expandOnRowClick onToggle={() => { setExpanded(value => !value) }}>
      {body === undefined || body === '' ? <p className={css.body}>{props.t('read.bodyEmpty')}</p>
        : <p className={css.body}>{body}</p>}
    </DisclosureRow>
  </section>
}
