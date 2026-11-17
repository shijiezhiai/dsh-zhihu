// Shared Zhihu content pieces: the untrusted-content notice, one feed list, and
// one opened row. The right Sidebar tab and the full page render the same
// markup, so a row reads the same wherever it is opened.
import { Fragment, useMemo, useRef, useState } from 'react'
import type { KeyboardEvent, ReactNode } from 'react'
import { Button, MarkdownText, Tag } from '@deepseek-ai/dsh-client-ui-primitives'
import type { MarkdownLabels } from '@deepseek-ai/dsh-client-ui-primitives'
import type { RemoteFailure } from '@deepseek-ai/dsh-api-remotes/client'
import type { PropsLocale } from '@deepseek-ai/dsh-client-ui-slots'
import type { ZhihuFeedRow, ZhihuReadItem } from '@deepseek-ai/dsh-zhihu-plugin/types'
import { zhihuPanelFailureLine } from './zhihu-panel-failure.ts'
import type { ZhihuRankMove } from './zhihu-page-store.ts'
import { zhihuRowKey } from './zhihu-row-key.ts'
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
 * Mark how one row moved since its lane was last read.
 * @param props.move - the mark the lane's latest read recorded for this row.
 * @param props.t - copy of the Zhihu namespace.
 * @returns the tag naming that move.
 */
function ZhihuRankTag({ move, t }: { readonly move: ZhihuRankMove; readonly t: ZhihuTranslate }): ReactNode {
  switch (move.kind) {
    case 'new': return <Tag tone="info">{t('rank.new')}</Tag>
    case 'up': return <Tag tone="success">{t('rank.up', { places: move.places })}</Tag>
    case 'down': return <Tag tone="danger">{t('rank.down', { places: move.places })}</Tag>
  }
}

/**
 * Render the rows of one feed page.
 *
 * Every row opens inside the surface that lists it, including an article, which
 * the opened state shows as a linked row rather than leaving for the browser.
 * @param props.rows - rows of the current page, in feed order.
 * @param props.t - copy of the Zhihu namespace.
 * @param props.onOpen - called with the row a reader picks.
 * @param props.moves - the marks the lane's latest read left; omitted where nothing ranks a lane.
 * @param props.counted - whether the rows that arrived since the previous read are counted above
 *   them. A stream lane has no position to mark, so its new arrivals are what the reader needs.
 * @returns the notice, an empty state, or the row list.
 */
export function ZhihuRowList({ rows, t, onOpen, moves, counted = false }: {
  readonly rows: readonly ZhihuFeedRow[]
  readonly t: ZhihuTranslate
  readonly onOpen: (row: ZhihuFeedRow) => void
  readonly moves?: Readonly<Record<string, ZhihuRankMove>> | undefined
  readonly counted?: boolean
}): ReactNode {
  const buttons = useRef<(HTMLButtonElement | null)[]>([])
  const [active, setActive] = useState(-1)
  /**
   * The row the list counts as its current one: the one the reader moved to, or the first row
   * before they moved at all. One row owns the tab stop, so Tab enters the list once.
   */
  const current = active >= 0 && active < rows.length ? active : 0

  /**
   * Put the reader on one row, and keep the index inside the page they are looking at.
   * @param index - the row to move to.
   */
  function moveTo(index: number): void {
    const next = Math.max(0, Math.min(rows.length - 1, index))
    setActive(next)
    buttons.current[next]?.focus()
  }

  /**
   * Walk the list from the keyboard. The shortcuts registry reserves a modifier for every
   * command, so the list handles its own plain keys instead of registering them.
   * @param event - the key press, from a row or from a field inside a row.
   */
  function keyDown(event: KeyboardEvent<HTMLOListElement>): void {
    if (event.metaKey || event.ctrlKey || event.altKey) return
    // A row reached with Tab was never walked to, so the row holding focus is where the next key starts.
    const from = active >= 0 && active < rows.length
      ? active
      : buttons.current.findIndex(button => button !== null && button === document.activeElement)
    switch (event.key) {
      case 'ArrowDown':
      case 'j':
        event.preventDefault()
        moveTo(from === -1 ? 0 : from + 1)
        return
      case 'ArrowUp':
      case 'k':
        event.preventDefault()
        moveTo(from === -1 ? rows.length - 1 : from - 1)
        return
      case 'Home':
      case 'End':
        event.preventDefault()
        moveTo(event.key === 'Home' ? 0 : rows.length - 1)
        return
      case 'Escape':
        if (from === -1) return
        event.preventDefault()
        buttons.current[from]?.blur()
        setActive(-1)
        return
      default:
        return
    }
  }

  if (rows.length === 0) return <p className={css.state}>{t('list.empty')}</p>
  // Only the leading run is counted: a row that turns up further down keeps its own mark instead
  // of pulling the dividing line somewhere the reader would not expect it.
  let arrived = 0
  if (counted && moves !== undefined) {
    while (arrived < rows.length) {
      const row = rows[arrived]
      if (row === undefined || moves[zhihuRowKey(row)]?.kind !== 'new') break
      arrived += 1
    }
  }
  return (
    <>
      <p className={css.notice}>{t('panel.untrusted')}</p>
      <ol className={css.list} onKeyDown={keyDown}>
        {rows.map((row, index) => {
          const move = moves?.[zhihuRowKey(row)]
          return (
            <Fragment key={zhihuRowKey(row)}>
              <li className={css.row}>
                <button
                  type="button"
                  className={css.rowTitle}
                  tabIndex={index === current ? 0 : -1}
                  ref={(element) => { buttons.current[index] = element }}
                  onClick={() => { onOpen(row) }}
                >
                  {row.title}
                </button>
                <span className={css.excerpt}>{row.excerpt}</span>
                {(move !== undefined || row.heatLabel !== undefined) && (
                  <span className={css.meta}>
                    {move !== undefined && <ZhihuRankTag move={move} t={t} />}
                    {row.heatLabel !== undefined && <span className={css.heat}>{row.heatLabel}</span>}
                  </span>
                )}
              </li>
              {index + 1 === arrived && (
                <li className={css.divider}>{t('list.arrived', { count: arrived })}</li>
              )}
            </Fragment>
          )
        })}
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
