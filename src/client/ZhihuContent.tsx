// Shared Zhihu content pieces: the untrusted-content notice, one feed list, and
// one opened row. The right Sidebar tab and the full page render the same
// markup, so a row reads the same wherever it is opened.
import { useMemo } from 'react'
import type { ReactNode } from 'react'
import { Button, MarkdownText } from '@deepseek-ai/dsh-client-ui-primitives'
import type { MarkdownLabels } from '@deepseek-ai/dsh-client-ui-primitives'
import type { RemoteFailure } from '@deepseek-ai/dsh-api-remotes/client'
import type { PropsLocale } from '@deepseek-ai/dsh-client-ui-slots'
import type { ZhihuFeedRow, ZhihuReadItem } from '@deepseek-ai/dsh-zhihu-plugin/types'
import { zhihuPanelFailureLine } from './zhihu-panel-failure.ts'
import css from './ZhihuContent.module.css'

/** Copy handle of the Zhihu namespace. */
export type ZhihuTranslate = PropsLocale<'zhihu'>['t']

/**
 * One row opened for reading: the request, its content, or its refusal.
 *
 * The linked state is a row Zhihu serves no body for, such as an article: the
 * surface shows its title and excerpt and offers the original link instead.
 */
export type ZhihuOpenedRow<R extends ZhihuFeedRow = ZhihuFeedRow> =
  | { readonly status: 'loading'; readonly row: R }
  | { readonly status: 'ready'; readonly row: R; readonly item: ZhihuReadItem }
  | { readonly status: 'failed'; readonly row: R; readonly failure: RemoteFailure }
  | { readonly status: 'linked'; readonly row: R }

/**
 * Render one body as Markdown. The provider converts Zhihu's HTML before the body reaches a
 * client, so this surface never parses HTML itself.
 * @param props.text - GitHub-flavored Markdown body of the opened row.
 * @param props.t - copy of the Zhihu namespace.
 * @returns the formatted body.
 */
function ZhihuBody({ text, t }: { readonly text: string; readonly t: ZhihuTranslate }): ReactNode {
  const copyLabel = t('markdown.copy')
  const copiedLabel = t('markdown.copied')
  const codeLabel = t('markdown.code')
  const wrapLabel = t('markdown.wrap')
  const unwrapLabel = t('markdown.unwrap')
  const footnotes = t('markdown.footnotes')
  const labels = useMemo<MarkdownLabels>(() => ({
    code: { copyLabel, copiedLabel, toolbarLabels: { codeLabel, wrapLabel, unwrapLabel } }, footnotes,
  }), [copyLabel, copiedLabel, footnotes, codeLabel, wrapLabel, unwrapLabel])
  return <MarkdownText text={text} labels={labels} omitHtml />
}

/**
 * Render the rows of one feed page.
 *
 * Every row opens inside the surface that lists it, including an article, which
 * the opened state shows as a linked row rather than leaving for the browser.
 * @param props.rows - rows of the current page, in feed order.
 * @param props.t - copy of the Zhihu namespace.
 * @param props.onOpen - called with the row a reader picks.
 * @returns the notice, an empty state, or the row list.
 */
export function ZhihuRowList({ rows, t, onOpen }: {
  readonly rows: readonly ZhihuFeedRow[]
  readonly t: ZhihuTranslate
  readonly onOpen: (row: ZhihuFeedRow) => void
}): ReactNode {
  if (rows.length === 0) return <p className={css.state}>{t('list.empty')}</p>
  return (
    <>
      <p className={css.notice}>{t('panel.untrusted')}</p>
      <ol className={css.list}>
        {rows.map(row => (
          <li
            key={row.kind + ':' + row.id}
            className={css.row}
          >
            <button
              type="button"
              className={css.rowTitle}
              onClick={() => { onOpen(row) }}
            >
              {row.title}
            </button>
            <span className={css.excerpt}>{row.excerpt}</span>
            {row.heatLabel !== undefined && <span className={css.heat}>{row.heatLabel}</span>}
          </li>
        ))}
      </ol>
    </>
  )
}

/**
 * Render one opened row: its title, body, author line, and the refusal path.
 * @param props.state - the open row, its content, or its refusal.
 * @param props.t - copy of the Zhihu namespace.
 * @param props.onRetry - called when the reader retries a refused read.
 * @param props.onAsk - drafts a conversation about this row; omitted where the seat has no Workspace.
 * @returns the opened row.
 */
export function ZhihuOpenedContent<R extends ZhihuFeedRow>({ state, t, onRetry, onAsk }: {
  readonly state: ZhihuOpenedRow<R>
  readonly t: ZhihuTranslate
  readonly onRetry: () => void
  readonly onAsk?: () => void
}): ReactNode {
  return (
    <div className={css.content}>
      <h3 className={css.detailTitle}>
        {state.status === 'ready' && state.item.title !== '' ? state.item.title : state.row.title}
      </h3>
      <p className={css.notice}>{t('panel.untrusted')}</p>
      {onAsk !== undefined && (
        <Button variant="outline" size="sm" onClick={onAsk}>{t('ask.action')}</Button>
      )}
      {state.status === 'loading' && <p className={css.state}>{t('card.loading')}</p>}
      {state.status === 'linked' && (
        <>
          <p className={css.paragraph}>{state.row.excerpt}</p>
          <p className={css.state}>{t('read.noBody')}</p>
        </>
      )}
      {state.status === 'failed' && (
        <div className={css.failure}>
          <p className={css.state}>{zhihuPanelFailureLine(t, state.failure)}</p>
          <Button variant="outline" size="sm" onClick={onRetry}>{t('panel.retry')}</Button>
        </div>
      )}
      {state.status === 'ready' && state.item.contentMarkdown.trim() === '' && (
        <p className={css.state}>{t('read.bodyEmpty')}</p>
      )}
      {state.status === 'ready' && state.item.contentMarkdown.trim() !== '' && (
        <ZhihuBody text={state.item.contentMarkdown} t={t} />
      )}
      {state.status === 'ready' && state.item.contentTruncated && (
        <p className={css.state}>{t('read.truncated')}</p>
      )}
      {state.status === 'ready' && (
        <p className={css.meta}>
          {state.item.author === '' ? t('panel.anonymous')
            : state.item.author + ' · ' + (state.item.voteupCount === 1
              ? t('read.upvotesOne')
              : t('read.upvotes', { count: state.item.voteupCount }))}
        </p>
      )}
      <a className={css.original} href={state.row.url} target="_blank" rel="noreferrer">
        {t('panel.openOriginal')}
      </a>
    </div>
  )
}
