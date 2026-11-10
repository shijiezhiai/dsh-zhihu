/** Shared list card for `zhihu_feed` and `zhihu_search`: ranked rows linking to Zhihu. */
import type { ReactNode } from 'react'
import { Tag } from '@deepseek-ai/dsh-client-ui-primitives'
import type { PropsLocale } from '@deepseek-ai/dsh-client-ui-slots'
import type { ZhihuEntryKind, ZhihuEntryRow } from './zhihu-meta.ts'
import css from './ZhihuCard.module.css'

/** The translated-copy seat the cards receive from the toolview slot. */
export type ZhihuTranslate = PropsLocale<'zhihu'>['t']

/** Dictionary keys naming each entry kind. */
const KIND_KEY = {
  question: 'kind.question',
  answer: 'kind.answer',
  article: 'kind.article',
} as const satisfies Record<ZhihuEntryKind, string>

/**
 * Name one entry kind.
 * @param t - translated-copy seat of the card.
 * @param kind - the recorded entry kind.
 * @returns the localized kind label.
 */
export function kindLabel(t: ZhihuTranslate, kind: ZhihuEntryKind): string {
  return t(KIND_KEY[kind])
}

/**
 * Name a row count, using the singular copy for one row.
 * @param t - translated-copy seat of the card.
 * @param count - number of rows.
 * @returns the localized count label.
 */
export function countLabel(t: ZhihuTranslate, count: number): string {
  return count === 1 ? t('list.countOne') : t('list.count', { count })
}

/** Props of the shared list card; each tool supplies its own title and icon. */
export interface ZhihuListCardProps {
  readonly t: ZhihuTranslate
  readonly toolName: string
  readonly icon: ReactNode
  readonly title: string
  readonly count: number
  readonly truncated: boolean
  readonly rows: readonly ZhihuEntryRow[]
}

/**
 * Render one header with the count and truncation badges and the linked rows below it.
 * @param props - tool name, header content, and rows.
 * @returns the list card.
 */
export function ZhihuListCard({ t, toolName, icon, title, count, truncated, rows }: ZhihuListCardProps) {
  return <section className={css.card} data-tool={toolName} data-state="ok">
    <header className={css.header}>
      <span className={css.icon}>{icon}</span>
      <h3 className={css.title}>{title}</h3>
      <span className={css.badges}>
        <Tag tone="neutral">{countLabel(t, count)}</Tag>
        {truncated && <Tag tone="quiet">{t('list.truncated')}</Tag>}
      </span>
    </header>
    {rows.length === 0
      ? <p className={css.empty}>{t('list.empty')}</p>
      : <ol className={css.list}>
        {rows.map((row, index) => <li className={css.item} key={`${row.kind}:${row.id}`}>
          <span className={css.rank}>{index + 1}</span>
          <div className={css.entry}>
            <a className={css.link} href={row.url} target="_blank" rel="noopener noreferrer">{row.title}</a>
            <span className={css.meta}>
              <Tag tone="outline">{kindLabel(t, row.kind)}</Tag>
              {row.heatLabel !== undefined && <Tag tone="quiet">{row.heatLabel}</Tag>}
            </span>
          </div>
        </li>)}
      </ol>}
  </section>
}
