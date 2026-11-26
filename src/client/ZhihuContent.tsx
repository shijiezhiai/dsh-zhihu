// Shared Zhihu content pieces: the untrusted-content notice, one feed list, and
// one opened row. The right Sidebar tab and the full page render the same
// markup, so a row reads the same wherever it is opened.
import { Fragment, useEffect, useMemo, useRef, useState } from 'react'
import type { KeyboardEvent, ReactNode } from 'react'
import { Button, MarkdownText, Tag } from '@deepseek-ai/dsh-client-ui-primitives'
import type { MarkdownLabels } from '@deepseek-ai/dsh-client-ui-primitives'
import type { RemoteFailure } from '@deepseek-ai/dsh-api-remotes/client'
import type { PropsLocale } from '@deepseek-ai/dsh-client-ui-slots'
import type {
  ZhihuCommentRow, ZhihuCommentsResult, ZhihuFeedRow, ZhihuReadItem,
} from '@deepseek-ai/dsh-zhihu-plugin/types'
import type { ZhihuPageOutcome } from './zhihu-page-face.ts'
import { zhihuPanelFailureLine } from './zhihu-panel-failure.ts'
import type { ZhihuPageDensity, ZhihuRankMove } from './zhihu-page-store.ts'
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
 * @param props.density - how tightly the rows pack and how many lines of an excerpt they show.
 * @returns the notice, an empty state, or the row list.
 */
export function ZhihuRowList({ rows, t, onOpen, moves, counted = false, density = 'comfortable' }: {
  readonly rows: readonly ZhihuFeedRow[]
  readonly t: ZhihuTranslate
  readonly onOpen: (row: ZhihuFeedRow) => void
  readonly moves?: Readonly<Record<string, ZhihuRankMove>> | undefined
  readonly counted?: boolean
  readonly density?: ZhihuPageDensity
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
      <ol className={css.list} data-density={density} onKeyDown={keyDown}>
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
                {(move !== undefined || row.heatLabel !== undefined || row.voteupCount !== undefined) && (
                  <span className={css.meta}>
                    {move !== undefined && <ZhihuRankTag move={move} t={t} />}
                    {row.heatLabel !== undefined && <span className={css.heat}>{row.heatLabel}</span>}
                    {row.voteupCount !== undefined && (
                      <span className={css.heat}>
                        {row.voteupCount === 1 ? t('read.upvotesOne') : t('read.upvotes', { count: row.voteupCount })}
                      </span>
                    )}
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

/** Comments one request asks for, and the step each further request adds. */
const COMMENT_STEP = 10

/** One opened row's thread: what has been read, how much was asked for, and whether more follows. */
interface ZhihuThread {
  /** Comment count this read asked for. */
  readonly limit: number
  /** Whether the read is in flight, answered, or refused. */
  readonly status: 'loading' | 'ready' | 'failed'
  /** Comments read so far, kept across a further read so the list never blanks. */
  readonly items: readonly ZhihuCommentRow[]
  /** Root comments on the content; absent when the payload carried none. */
  readonly total?: number
  /** True when another read cannot add a comment. */
  readonly exhausted: boolean
  /** The refusal behind a failed read. */
  readonly failure?: RemoteFailure
}

/**
 * Render one opened row's root comments, read once it opens.
 *
 * The seam answers one slice of the thread with no continuation token, so a further read asks for
 * a larger slice and keeps the comments already shown.
 * @param props.row - the row whose thread this is.
 * @param props.t - copy of the Zhihu namespace.
 * @param props.load - reads one slice of the thread.
 * @param props.loadReplies - reads one slice of the replies under one comment.
 * @returns the comment section.
 */
export function ZhihuComments({ row, t, load, loadReplies }: {
  readonly row: ZhihuFeedRow
  readonly t: ZhihuTranslate
  readonly load: (row: ZhihuFeedRow, limit: number) => Promise<ZhihuPageOutcome<ZhihuCommentsResult>>
  /** Reads one slice of a comment's replies; omitted where the seat has no reply lane. */
  readonly loadReplies?: (commentId: string, limit: number) => Promise<ZhihuPageOutcome<ZhihuCommentsResult>>
}): ReactNode {
  const [thread, setThread] = useState<ZhihuThread>({ limit: COMMENT_STEP, status: 'loading', items: [], exhausted: false })
  /** Counts reads of the same slice, so a retry runs again with the limit unchanged. */
  const [attempt, setAttempt] = useState(0)
  const requested = thread.limit
  useEffect(() => {
    let live = true
    setThread(previous => ({ ...previous, status: 'loading' }))
    void load(row, requested).then((result) => {
      if (!live) return
      setThread((previous) => {
        if (!result.ok) return { ...previous, status: 'failed', failure: result.failure }
        const { items } = result.value
        const total = result.value.total
        const grew = items.length > previous.items.length
        return {
          limit: previous.limit,
          status: 'ready',
          items,
          ...(total === undefined ? {} : { total }),
          exhausted: total !== undefined ? items.length >= total : items.length < requested || !grew,
        }
      })
    })
    return () => { live = false }
  }, [load, row, requested, attempt])

  const count = thread.total === undefined
    ? ''
    : ' · ' + t('comments.count', { shown: thread.items.length, total: thread.total })
  return (
    <section className={css.comments}>
      <h4 className={css.commentsTitle}>{t('comments.heading')}{count}</h4>
      {thread.status === 'loading' && thread.items.length === 0 && <p className={css.state}>{t('card.loading')}</p>}
      {thread.status === 'failed' && thread.failure !== undefined && (
        <div className={css.failure}>
          <p className={css.state}>{zhihuPanelFailureLine(t, thread.failure)}</p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setThread(previous => ({ ...previous, status: 'loading' }))
              setAttempt(count => count + 1)
            }}
          >
            {t('panel.retry')}
          </Button>
        </div>
      )}
      {thread.status === 'ready' && thread.items.length === 0 && <p className={css.state}>{t('comments.empty')}</p>}
      {thread.items.length > 0 && (
        <ol className={css.commentList}>
          {thread.items.map(item => (
            <li key={item.id} className={css.comment}>
              <p className={css.commentText}>{item.text}</p>
              <span className={css.meta}>
                {item.author === '' ? t('panel.anonymous') : item.author}
                {' · '}{item.likes === 1 ? t('read.upvotesOne') : t('read.upvotes', { count: item.likes })}
                {item.replies > 0 && (
                  <>{' · '}{item.replies === 1
                    ? t('comments.repliesOne')
                    : t('comments.replies', { count: item.replies })}</>
                )}
              </span>
              {item.replies > 0 && loadReplies !== undefined && (
                <ZhihuReplies comment={item} t={t} load={loadReplies} />
              )}
            </li>
          ))}
        </ol>
      )}
      {thread.status === 'ready' && !thread.exhausted && (
        <Button
          variant="outline"
          size="sm"
          onClick={() => { setThread(previous => ({ ...previous, limit: previous.limit + COMMENT_STEP })) }}
        >
          {t('comments.more')}
        </Button>
      )}
    </section>
  )
}

/** Replies one request asks for, and the step each further request adds. */
const REPLY_STEP = 10

/** One comment's replies: whether they are open, what has been read, and whether more follows. */
interface ZhihuReplyThread {
  /** Whether the reader asked to see these replies; nothing is requested before that. */
  readonly open: boolean
  /** Reply count this read asked for. */
  readonly limit: number
  /** Whether the read is in flight, answered, or refused. */
  readonly status: 'loading' | 'ready' | 'failed'
  /** Replies read so far, kept across a further read so the list never blanks. */
  readonly items: readonly ZhihuCommentRow[]
  /** Replies under the comment; absent when the payload carried none. */
  readonly total?: number
  /** True when another read cannot add a reply. */
  readonly exhausted: boolean
  /** The refusal behind a failed read. */
  readonly failure?: RemoteFailure
}

/**
 * Render the replies under one root comment, requested only once the reader asks for them.
 *
 * Zhihu keeps one level of replies: a reply to a reply arrives in the same list, so nothing here
 * opens a further thread.
 * @param props.comment - the root comment whose replies these are.
 * @param props.t - copy of the Zhihu namespace.
 * @param props.load - reads one slice of the replies.
 * @returns the reply list, or the button that reveals it.
 */
export function ZhihuReplies({ comment, t, load }: {
  readonly comment: ZhihuCommentRow
  readonly t: ZhihuTranslate
  readonly load: (commentId: string, limit: number) => Promise<ZhihuPageOutcome<ZhihuCommentsResult>>
}): ReactNode {
  const [thread, setThread] = useState<ZhihuReplyThread>({
    open: false, limit: REPLY_STEP, status: 'loading', items: [], exhausted: false,
  })
  /** Counts reads of the same slice, so a retry runs again with the limit unchanged. */
  const [attempt, setAttempt] = useState(0)
  const requested = thread.limit
  const open = thread.open
  useEffect(() => {
    if (!open) return
    let live = true
    setThread(previous => ({ ...previous, status: 'loading' }))
    void load(comment.id, requested).then((result) => {
      if (!live) return
      setThread((previous) => {
        if (!result.ok) return { ...previous, status: 'failed', failure: result.failure }
        const { items } = result.value
        const total = result.value.total
        const grew = items.length > previous.items.length
        return {
          ...previous,
          status: 'ready',
          items,
          ...(total === undefined ? {} : { total }),
          exhausted: total !== undefined ? items.length >= total : items.length < requested || !grew,
        }
      })
    })
    return () => { live = false }
  }, [comment.id, load, open, requested, attempt])

  if (!open) {
    return (
      <Button
        variant="outline"
        size="sm"
        onClick={() => { setThread(previous => ({ ...previous, open: true })) }}
      >
        {comment.replies === 1
          ? t('comments.showRepliesOne')
          : t('comments.showReplies', { count: comment.replies })}
      </Button>
    )
  }
  return (
    <div className={css.replies}>
      {thread.status === 'loading' && thread.items.length === 0 && <p className={css.state}>{t('card.loading')}</p>}
      {thread.status === 'failed' && thread.failure !== undefined && (
        <div className={css.failure}>
          <p className={css.state}>{zhihuPanelFailureLine(t, thread.failure)}</p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setThread(previous => ({ ...previous, status: 'loading' }))
              setAttempt(count => count + 1)
            }}
          >
            {t('panel.retry')}
          </Button>
        </div>
      )}
      {thread.status === 'ready' && thread.items.length === 0 && <p className={css.state}>{t('comments.empty')}</p>}
      {thread.items.length > 0 && (
        <ul className={css.replyList}>
          {thread.items.map(item => (
            <li key={item.id} className={css.reply}>
              <p className={css.commentText}>{item.text}</p>
              <span className={css.meta}>
                {item.author === '' ? t('panel.anonymous') : item.author}
                {' · '}{item.likes === 1 ? t('read.upvotesOne') : t('read.upvotes', { count: item.likes })}
              </span>
            </li>
          ))}
        </ul>
      )}
      {thread.status === 'ready' && !thread.exhausted && (
        <Button
          variant="outline"
          size="sm"
          onClick={() => { setThread(previous => ({ ...previous, limit: previous.limit + REPLY_STEP })) }}
        >
          {t('comments.more')}
        </Button>
      )}
    </div>
  )
}

/**
 * Render one opened row: its title, body, author line, and the refusal path.
 * @param props.state - the open row, its content, or its refusal.
 * @param props.t - copy of the Zhihu namespace.
 * @param props.onRetry - called when the reader retries a refused read.
 * @param props.onAsk - drafts a conversation about this row; omitted where the seat has no Workspace.
 * @param props.onComments - reads the row's thread; omitted where the seat has no comment lane.
 * @param props.onReplies - reads a comment's replies; omitted where the seat has no reply lane.
 * @returns the opened row.
 */
export function ZhihuOpenedContent<R extends ZhihuFeedRow>({ state, t, onRetry, onAsk, onComments, onReplies }: {
  readonly state: ZhihuOpenedRow<R>
  readonly t: ZhihuTranslate
  readonly onRetry: () => void
  readonly onAsk?: () => void
  readonly onComments?: (row: ZhihuFeedRow, limit: number) => Promise<ZhihuPageOutcome<ZhihuCommentsResult>>
  readonly onReplies?: (commentId: string, limit: number) => Promise<ZhihuPageOutcome<ZhihuCommentsResult>>
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
      {onComments !== undefined && (
        <ZhihuComments
          row={state.row}
          t={t}
          load={onComments}
          {...(onReplies === undefined ? {} : { loadReplies: onReplies })}
        />
      )}
    </div>
  )
}
