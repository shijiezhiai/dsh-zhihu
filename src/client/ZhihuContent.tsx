// Shared Zhihu content pieces: the untrusted-content notice, one feed list, and
// one opened row. The right Sidebar tab and the full page render the same
// markup, so a row reads the same wherever it is opened.
import { Fragment, useEffect, useMemo, useRef, useState } from 'react'
import type { KeyboardEvent, ReactNode } from 'react'
import { Button, MarkdownText, Menu, Tag } from '@deepseek-ai/dsh-client-ui-primitives'
import type { MarkdownLabels } from '@deepseek-ai/dsh-client-ui-primitives'
import type { RemoteFailure } from '@deepseek-ai/dsh-api-remotes/client'
import type { PropsLocale } from '@deepseek-ai/dsh-client-ui-slots'
import type {
  ZhihuCollectQuery, ZhihuCollectResult, ZhihuCollectionRow, ZhihuCollectionsResult,
  ZhihuCommentRow, ZhihuCommentsResult, ZhihuFeedRow, ZhihuReadItem, ZhihuVoteQuery, ZhihuVoteResult,
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

/** What one vote call left behind: the count it named, the state, and a refusal to report. */
interface ZhihuVoteState {
  readonly count: number
  readonly voted: boolean
  readonly busy: boolean
  readonly failure?: RemoteFailure
}

/**
 * Render one row's upvote count, with the reader's own vote button when the seat offers one.
 *
 * Zhihu names the vote to hold rather than a toggle, so a second click withdraws the first; a
 * repeated `up` leaves the account where it was. The payload of a read never says whether this
 * reader already voted, so the button starts as a plain upvote and reports the state the answer
 * named once one has been cast.
 * @param props.kind - content kind the row links to; a question is followed, not voted on.
 * @param props.id - lossless content id.
 * @param props.count - upvote count the read reported.
 * @param props.t - copy of the Zhihu namespace.
 * @param props.cast - casts or withdraws the reader's vote; omitted where the seat cannot vote.
 * @returns the count, and the button when a vote is possible.
 */
function ZhihuVote({ kind, id, count, t, cast }: {
  readonly kind: ZhihuFeedRow['kind']
  readonly id: string
  readonly count: number
  readonly t: ZhihuTranslate
  readonly cast?: (query: ZhihuVoteQuery) => Promise<ZhihuPageOutcome<ZhihuVoteResult>>
}): ReactNode {
  const [state, setState] = useState<ZhihuVoteState>({ count, voted: false, busy: false })
  const votable = cast !== undefined && kind !== 'question'
  const label = (total: number): string => total === 1 ? t('read.upvotesOne') : t('read.upvotes', { count: total })
  const send = (vote: 'up' | 'none'): void => {
    if (cast === undefined || state.busy || kind === 'question') return
    setState(previous => ({ ...previous, busy: true }))
    void cast({ kind, id, vote }).then((outcome) => {
      if (!outcome.ok) {
        setState(previous => ({ ...previous, busy: false, failure: outcome.failure }))
        return
      }
      setState({
        count: outcome.value.voteupCount ?? state.count,
        voted: outcome.value.voted,
        busy: false,
      })
    })
  }
  return (
    <>
      <span>{label(state.count)}</span>
      {votable && (
        <Button
          variant="ghost"
          size="sm"
          disabled={state.busy}
          onClick={() => { send(state.voted ? 'none' : 'up') }}
        >
          {state.voted ? t('read.upvoted') : t('read.upvote')}
        </Button>
      )}
      {state.failure !== undefined && <span className={css.writeFailure}>{zhihuPanelFailureLine(t, state.failure)}</span>}
    </>
  )
}

/** Collections the reader's own account holds, as the menu needs them. */
interface ZhihuCollectionList {
  readonly status: 'idle' | 'loading' | 'ready'
  readonly items: readonly ZhihuCollectionRow[]
}

/** What one collection change left behind: the collection holding the row, and a refusal to report. */
interface ZhihuCollectState {
  readonly saved?: ZhihuCollectionRow
  readonly busy: boolean
  readonly failure?: RemoteFailure
}

/** Menu id that names no collection, so a row with nothing to pick still closes the menu. */
const NO_COLLECTION = ''

/**
 * Render the collection control of one opened row: a button that files the row into one of the
 * reader's collections, and takes it out again when that same collection is picked twice.
 *
 * A read names no item's memberships, so the check mark follows what this surface did itself; a
 * collection filled on another machine or in the Zhihu app reads as untouched.
 * @param props.kind - content kind the row links to; a question is followed, not collected.
 * @param props.id - lossless content id.
 * @param props.t - copy of the Zhihu namespace.
 * @param props.collections - lists the reader's own collections.
 * @param props.collect - adds the row to a collection or removes it again.
 * @returns the button, its menu of collections, and any refusal.
 */
function ZhihuCollect({ kind, id, t, collections, collect }: {
  readonly kind: ZhihuCollectQuery['kind']
  readonly id: string
  readonly t: ZhihuTranslate
  readonly collections: () => Promise<ZhihuPageOutcome<ZhihuCollectionsResult>>
  readonly collect: (query: ZhihuCollectQuery) => Promise<ZhihuPageOutcome<ZhihuCollectResult>>
}): ReactNode {
  const [open, setOpen] = useState(false)
  const [list, setList] = useState<ZhihuCollectionList>({ status: 'idle', items: [] })
  const [state, setState] = useState<ZhihuCollectState>({ busy: false })
  // The list is asked for once per opening: the request settles after the effect ran, so its own
  // status change must not restart it.
  const asked = useRef(false)
  useEffect(() => {
    if (!open || asked.current) return
    asked.current = true
    let live = true
    setList({ status: 'loading', items: [] })
    void collections().then((outcome) => {
      if (!live) return
      if (!outcome.ok) {
        setList({ status: 'idle', items: [] })
        setState(previous => ({
          busy: false,
          ...(previous.saved === undefined ? {} : { saved: previous.saved }),
          failure: outcome.failure,
        }))
        return
      }
      setList({ status: 'ready', items: outcome.value.items })
    })
    return () => {
      live = false
      asked.current = false
    }
  }, [collections, open])
  const pick = (collectionId: string): void => {
    if (state.busy) return
    const removing = state.saved?.id === collectionId
    setState({ busy: true, ...(state.saved === undefined ? {} : { saved: state.saved }) })
    void collect({ kind, id, collectionId, collected: !removing }).then((outcome) => {
      if (!outcome.ok) {
        setState({ busy: false, ...(state.saved === undefined ? {} : { saved: state.saved }), failure: outcome.failure })
        return
      }
      const picked = list.items.find(item => item.id === collectionId)
      setState({ busy: false, ...(outcome.value.collected && picked !== undefined ? { saved: picked } : {}) })
    })
  }
  const items = list.items.length === 0
    ? [{ id: NO_COLLECTION, label: list.status === 'loading' ? t('card.loading') : t('read.noCollections') }]
    : list.items.map(item => ({ id: item.id, label: item.title }))
  return (
    <>
      <Menu
        open={open}
        onClose={() => { setOpen(false) }}
        items={items}
        selectedId={state.saved?.id}
        onSelect={(collectionId) => {
          setOpen(false)
          if (collectionId !== NO_COLLECTION) pick(collectionId)
        }}
        portal
        anchor={(
          <Button
            variant="ghost"
            size="sm"
            disabled={state.busy}
            aria-haspopup="menu"
            aria-expanded={open}
            aria-label={t('read.collect')}
            onClick={() => { setOpen(!open) }}
          >
            {state.saved === undefined ? t('read.collect') : t('read.collected')}
          </Button>
        )}
      />
      {state.failure !== undefined && <span className={css.writeFailure}>{zhihuPanelFailureLine(t, state.failure)}</span>}
    </>
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
 * @param props.onVote - casts the reader's own upvote; omitted where the seat cannot write one.
 * @param props.onCollections - lists the reader's own collections; omitted where the seat cannot write.
 * @param props.onCollect - files the row into a collection; omitted where the seat cannot write.
 * @returns the opened row.
 */
export function ZhihuOpenedContent<R extends ZhihuFeedRow>({
  state, t, onRetry, onAsk, onComments, onReplies, onVote, onCollections, onCollect,
}: {
  readonly state: ZhihuOpenedRow<R>
  readonly t: ZhihuTranslate
  readonly onRetry: () => void
  readonly onAsk?: () => void
  readonly onComments?: (row: ZhihuFeedRow, limit: number) => Promise<ZhihuPageOutcome<ZhihuCommentsResult>>
  readonly onReplies?: (commentId: string, limit: number) => Promise<ZhihuPageOutcome<ZhihuCommentsResult>>
  readonly onVote?: (query: ZhihuVoteQuery) => Promise<ZhihuPageOutcome<ZhihuVoteResult>>
  readonly onCollections?: () => Promise<ZhihuPageOutcome<ZhihuCollectionsResult>>
  readonly onCollect?: (query: ZhihuCollectQuery) => Promise<ZhihuPageOutcome<ZhihuCollectResult>>
}): ReactNode {
  const collectable = onCollections !== undefined && onCollect !== undefined && state.row.kind !== 'question'
    ? state.row.kind
    : undefined
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
          {state.item.author === '' ? t('panel.anonymous') : state.item.author + ' · '}
          <ZhihuVote
            kind={state.row.kind}
            id={state.row.id}
            count={state.item.voteupCount}
            t={t}
            {...(onVote === undefined ? {} : { cast: onVote })}
          />
          {collectable !== undefined && onCollections !== undefined && onCollect !== undefined && (
            <ZhihuCollect
              kind={collectable}
              id={state.row.id}
              t={t}
              collections={onCollections}
              collect={onCollect}
            />
          )}
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
