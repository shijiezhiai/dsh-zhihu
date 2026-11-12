// The Zhihu page behind the left navigation entry: four lanes (recommended, hot,
// follow, search), each feed paging as the reader scrolls, and one opened row.
// All fetching is the injected face's; this file owns only the reader's state.
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { Button, Input, Menu, SegmentedControl } from '@deepseek-ai/dsh-client-ui-primitives'
import type { MenuEntry, SegmentedControlOption } from '@deepseek-ai/dsh-client-ui-primitives'
import type { RemoteFailure } from '@deepseek-ai/dsh-api-remotes/client'
// Type-only: declares the 'main' seat this page renders into.
import type {} from '@deepseek-ai/dsh-client-ui-layout/client'
import type { PropsLocale, PropsRenderSlots, PropsRuntime, PropsStore } from '@deepseek-ai/dsh-client-ui-slots'
import type { ZhihuFeedRow } from '@deepseek-ai/dsh-zhihu-plugin/types'
import type { ZhihuKey } from './locales.ts'
import { readableBody } from './zhihu-ask.ts'
import { copyZhihuText } from './zhihu-clipboard.ts'
import type { ZhihuDetailAction, ZhihuDetailRegistry } from './zhihu-detail.ts'
import {
  DISCUSSION_PANEL_TIMEOUT_MS,
  zhihuDiscussionPrompt,
  type ZhihuDiscussion,
  type ZhihuDiscussionSeat,
} from './zhihu-discussion.ts'
import { zhihuRowKey } from './zhihu-row-key.ts'
import { zhihuPanelFailureLine } from './zhihu-panel-failure.ts'
import { readPassage, segmentsText, toggleSegment, zhihuQuotedInstruction, type ZhihuPassage } from './zhihu-quote.ts'
import { ZhihuQuoteBox } from './ZhihuQuote.tsx'
import type { ZhihuPageFace } from './zhihu-page-face.ts'
import type { ZhihuFeedTab, ZhihuPageStore, ZhihuPageTab } from './zhihu-page-store.ts'
import { ZhihuOpenedContent, ZhihuRowList, type ZhihuOpenedRow, type ZhihuTranslate } from './ZhihuContent.tsx'
import css from './ZhihuPage.module.css'

/** The feeds that page; search is a lane of its own. */
type FeedTab = ZhihuFeedTab

/** The page's lanes, recommended first. */
type PageTab = ZhihuPageTab

const LANES: readonly PageTab[] = ['recommend', 'hot', 'follow', 'search']

/** Where the context menu opens, in viewport pixels. */
interface MenuAt {
  readonly x: number
  readonly y: number
}

/** The two surfaces of an open row: its body, and the conversation about it. */
/** The passage quoted for the reader, and the blocks it was merged from. */
interface ZhihuQuote extends ZhihuPassage {
  /** The blocks the reader pointed at, in the order they were named. */
  readonly segments: readonly string[]
}

type DetailSurface = 'body' | 'discussion'

const SURFACES: readonly DetailSurface[] = ['body', 'discussion']

/** The copy key of each surface label. */
const SURFACE_KEYS = {
  body: 'read.body',
  discussion: 'discussion.surface',
} as const satisfies Record<DetailSurface, ZhihuKey>

/** The instructions a reader can send without typing one. */
const CHIPS = ['discussion.summary', 'discussion.evidence', 'discussion.doubt'] as const satisfies readonly ZhihuKey[]

/** The copy key of each lane label. */
const TAB_KEYS = {
  recommend: 'panel.segment.recommend',
  hot: 'panel.segment.hot',
  follow: 'panel.segment.follow',
  search: 'panel.segment.search',
} as const satisfies Record<PageTab, ZhihuKey>

/** A feed lane with nothing to refuse: not requested yet, in flight, or listing rows. */
interface FeedLane {
  readonly status: 'idle' | 'loading' | 'ready'
  readonly rows: readonly ZhihuFeedRow[]
  readonly cursor?: string
  /** A continuation that failed after the rows already arrived; the rows stay readable. */
  readonly failure?: RemoteFailure
}

/** One feed lane's state: its current page and the token that continues it. */
type FeedPage = FeedLane | {
  readonly status: 'failed'
  readonly rows: readonly ZhihuFeedRow[]
  readonly cursor?: string
  readonly failure: RemoteFailure
}

/** One search lane's state. */
type SearchPage =
  | FeedLane
  | { readonly status: 'failed'; readonly rows: readonly ZhihuFeedRow[]; readonly failure: RemoteFailure }

/** The page store's read seat, as the `main` registration hands it over. */
type PageSelector = PropsStore<ZhihuPageStore>['useStore']

/** The page store's write seat, as the `main` registration hands it over. */
type PageActions = PropsStore<ZhihuPageStore>['actions']

/** The distance from the bottom, in pixels, that triggers the next page: about one screen of rows,
 * so the next page arrives before the reader reaches the end. */
const PAGE_THRESHOLD = 600

/** How long the list waits after the reader stops scrolling before its offset is persisted. */
const SCROLL_SAVE_DELAY = 150

/** The scroller of the list view, so a settled page can top the lane up before the reader reaches its end. */

/** What one lane is doing right now; its rows live in the store, so no transient state is persisted. */
type LanePhase =
  | { readonly status: 'idle' }
  | { readonly status: 'loading' }
  | { readonly status: 'ready'; readonly failure?: RemoteFailure }
  | { readonly status: 'failed'; readonly failure: RemoteFailure }

/**
 * What the pane says when its own clock gives up on a pending discussion.
 * @param seat - the seat whose latest step names where the wait stopped.
 * @param t - the page's translator.
 * @returns the line shown under the failure.
 */
function stallLine(seat: ZhihuDiscussionSeat, t: ZhihuTranslate): string {
  return t('discussion.stalled', { ms: DISCUSSION_PANEL_TIMEOUT_MS, stage: seat.stage() })
}

/**
 * Page one feed lane over the rows the store keeps.
 * @param face - the page's fetching face.
 * @param kind - which feed this lane shows.
 * @param active - whether this lane is the one on screen; an inactive lane stays untouched.
 * @param useStore - the page store's read seat.
 * @param actions - the page store's write seat.
 * @returns the lane's page, whether a continuation is in flight, whether the lane opened with stored rows, and the two requests.
 */
function useFeedLane(face: ZhihuPageFace, kind: FeedTab, active: boolean, useStore: PageSelector, actions: PageActions): {
  readonly page: FeedPage
  readonly appending: boolean
  readonly restored: boolean
  readonly reload: () => void
  readonly loadMore: () => void
} {
  const rows = useStore(state => state.feeds[kind].rows)
  const cursor = useStore(state => state.feeds[kind].cursor)
  const [phase, setPhase] = useState<LanePhase>(() => (rows.length > 0 ? { status: 'ready' } : { status: 'idle' }))
  const [appending, setAppending] = useState(false)
  /** Latest request of this lane, so an answer for an abandoned page writes nothing. */
  const generation = useRef(0)
  /** Whether a request of this lane is unanswered, so a top-up cannot ask twice for one page. */
  const inFlight = useRef(false)
  /** Whether this lane has asked for a page since it mounted. */
  const asked = useRef(false)
  /** A lane that opened with stored rows asks for nothing until the reader scrolls or refreshes. */
  const restored = rows.length > 0 && !asked.current

  const request = useCallback((continuation?: string) => {
    const current = generation.current + 1
    generation.current = current
    inFlight.current = true
    asked.current = true
    if (continuation === undefined) setPhase({ status: 'loading' })
    else setAppending(true)
    void face.feed(kind, continuation).then((result) => {
      inFlight.current = false
      if (current !== generation.current) return
      setAppending(false)
      if (!result.ok) {
        setPhase(continuation === undefined
          ? { status: 'failed', failure: result.failure }
          : { status: 'ready', failure: result.failure })
        return
      }
      // A page that carries no rows ends the lane, so a repeated cursor cannot page forever.
      const next = result.value.rows.length === 0 ? '' : result.value.cursor ?? ''
      if (continuation === undefined) actions.loaded(kind, { rows: result.value.rows, cursor: next })
      else actions.appended(kind, { rows: result.value.rows, cursor: next })
      setPhase({ status: 'ready' })
    })
  }, [actions, face, kind])

  useEffect(() => {
    if (active && phase.status === 'idle') request()
  }, [active, phase.status, request])

  const reload = useCallback(() => { request() }, [request])
  const loadMore = useCallback(() => {
    if (inFlight.current || phase.status !== 'ready' || cursor === '' || appending) return
    request(cursor)
  }, [appending, cursor, phase.status, request])

  const page = useMemo<FeedPage>(() => {
    if (phase.status === 'failed') return { status: 'failed', rows: [], failure: phase.failure }
    if (phase.status !== 'ready') return { status: phase.status, rows: [] }
    return {
      status: 'ready',
      rows,
      ...(cursor === '' ? {} : { cursor }),
      ...(phase.failure === undefined ? {} : { failure: phase.failure }),
    }
  }, [cursor, phase, rows])

  return { page, appending, restored, reload, loadMore }
}

/**
 * Run the search lane, one query at a time, over the pages the store keeps.
 * @param face - the page's fetching face.
 * @param useStore - the page store's read seat.
 * @param actions - the page store's write seat.
 * @returns the lane's page, whether a continuation is in flight, whether the lane opened with
 * stored hits, and the three requests.
 */
function useSearchLane(face: ZhihuPageFace, useStore: PageSelector, actions: PageActions): {
  readonly page: SearchPage
  readonly appending: boolean
  readonly restored: boolean
  readonly loadMore: () => void
  readonly run: (query: string) => void
} {
  const rows = useStore(state => state.search.rows)
  const cursor = useStore(state => state.search.cursor)
  const saved = useStore(state => state.query)
  const [phase, setPhase] = useState<LanePhase>(() => (rows.length > 0 ? { status: 'ready' } : { status: 'idle' }))
  const [appending, setAppending] = useState(false)
  /** Latest query of this lane, so an answer for an abandoned search writes nothing. */
  const generation = useRef(0)
  /** Whether a request of this lane is unanswered, so a top-up cannot ask twice for one page. */
  const inFlight = useRef(false)
  /** Whether this lane has asked for a page since it mounted. */
  const asked = useRef(false)
  /** A lane that opened with stored hits asks for nothing until the reader scrolls or refreshes. */
  const restored = rows.length > 0 && !asked.current

  const request = useCallback((query: string, continuation?: string) => {
    const current = generation.current + 1
    generation.current = current
    inFlight.current = true
    asked.current = true
    if (continuation === undefined) setPhase({ status: 'loading' })
    else setAppending(true)
    void face.search(query, continuation).then((result) => {
      inFlight.current = false
      if (current !== generation.current) return
      setAppending(false)
      if (!result.ok) {
        setPhase(continuation === undefined
          ? { status: 'failed', failure: result.failure }
          : { status: 'ready', failure: result.failure })
        return
      }
      // A page that carries no rows ends the lane, so a repeated cursor cannot page forever.
      const next = result.value.rows.length === 0 ? '' : result.value.cursor ?? ''
      if (continuation === undefined) actions.loaded('search', { rows: result.value.rows, cursor: next })
      else actions.appended('search', { rows: result.value.rows, cursor: next })
      setPhase({ status: 'ready' })
    })
  }, [actions, face])

  const run = useCallback((query: string) => {
    const trimmed = query.trim()
    if (trimmed === '') return
    actions.typed(trimmed)
    request(trimmed)
  }, [actions, request])

  const loadMore = useCallback(() => {
    if (inFlight.current || phase.status !== 'ready' || cursor === '' || appending || saved === '') return
    request(saved, cursor)
  }, [appending, cursor, phase.status, request, saved])

  const page = useMemo<SearchPage>(() => {
    if (phase.status === 'failed') return { status: 'failed', rows: [], failure: phase.failure }
    if (phase.status !== 'ready') return { status: phase.status, rows: [] }
    return {
      status: 'ready',
      rows,
      ...(cursor === '' ? {} : { cursor }),
      ...(phase.failure === undefined ? {} : { failure: phase.failure }),
    }
  }, [cursor, phase, rows])

  return { page, appending, restored, loadMore, run }
}

/**
 * The opened row's context menu: the copy actions, the original page, the
 * Obsidian capture, and the way back to the list.
 * @param t - copy of the Zhihu namespace.
 * @param keycaps - the effective key labels of one action's command.
 * @returns the rows the menu draws.
 */
function detailMenu(t: ZhihuTranslate, keycaps: (action: ZhihuDetailAction) => readonly string[]): readonly MenuEntry[] {
  return [
    { id: 'copyTitle', label: t('menu.copyTitle'), shortcut: { keys: keycaps('copyTitle') } },
    { id: 'copyLink', label: t('menu.copyLink'), shortcut: { keys: keycaps('copyLink') } },
    { id: 'copyBody', label: t('menu.copyBody'), shortcut: { keys: keycaps('copyBody') } },
    { type: 'separator', id: 'detail-menu-ask' },
    { id: 'ask', label: t('ask.action'), shortcut: { keys: keycaps('ask') } },
    { id: 'openOriginal', label: t('panel.openOriginal'), shortcut: { keys: keycaps('openOriginal') } },
    { type: 'separator', id: 'detail-menu-export' },
    { id: 'export', label: t('menu.export'), shortcut: { keys: keycaps('export') } },
    { type: 'separator', id: 'detail-menu-back' },
    { id: 'back', label: t('panel.back'), shortcut: { keys: ['Esc'] } },
  ]
}

/**
 * Render the Zhihu page.
 * @param props.face - the page's fetching face.
 * @param props.t - copy of the Zhihu namespace.
 * @param props.details - the registry the open row is published into for its shortcuts.
 * @param props.keycaps - the effective key labels of one action's command.
 * @param props.discussion - the seat that opens and instructs the open row's conversation.
 * @param props.report - announces an outcome on the shell overlay, where the reader is looking.
 * @param props.renderSlot - renders the retained discussion Session's Conversation.
 * @param props.SessionProvider - binds that Conversation to the retained Session.
 * @param props.useStore - the page store's read seat.
 * @param props.actions - the page store's write seat.
 * @returns the lane switch, the lane on screen, or the opened row.
 */
export function ZhihuPage(
  { face, t, details, keycaps, discussion, report, renderSlot, SessionProvider, useStore, actions }: {
    readonly face: ZhihuPageFace
    readonly t: ZhihuTranslate
    readonly details: ZhihuDetailRegistry
    readonly keycaps: (action: ZhihuDetailAction) => readonly string[]
    readonly discussion: ZhihuDiscussionSeat
    readonly report: (text: string) => void
  } & PropsStore<ZhihuPageStore> & PropsRenderSlots<'zhihu.discussion'>,
): ReactNode {
  const tab = useStore(state => state.tab)
  const query = useStore(state => state.query)
  const scrollTop = useStore(state => state.scrollTop)
  const [opened, setOpened] = useState<ZhihuOpenedRow | null>(null)
  const [notice, setNotice] = useState<string | undefined>(undefined)
  const [menu, setMenu] = useState<MenuAt | undefined>(undefined)
  const [surface, setSurface] = useState<DetailSurface>('body')
  /** The passage the reader pointed at, while its bubble is up. */
  const [quote, setQuote] = useState<ZhihuQuote | undefined>(undefined)
  const [chat, setChat] = useState<{ status: 'idle' | 'opening' | 'ready' | 'failed'; seat?: ZhihuDiscussion; reason?: string }>({ status: 'idle' })
  /** Whole seconds the pane has been waiting, so a stall is visible instead of static. */
  const [waited, setWaited] = useState(0)
  // A state persisted before discussions existed restores without them, so a row simply has none.
  const discussions = useStore(state => state.discussions)
  // A state persisted before rank tracking existed restores without it, so the list marks nothing.
  const moves = useStore(state => state.moves)
  /** The discussion this panel holds a reference to; the Session outlives it. */
  const held = useRef<ZhihuDiscussion | null>(null)
  /** Latest open, so an answer for a row the reader left writes nothing. */
  const opening = useRef(0)

  const recommended = useFeedLane(face, 'recommend', tab === 'recommend' && opened === null, useStore, actions)
  const hot = useFeedLane(face, 'hot', tab === 'hot' && opened === null, useStore, actions)
  const follow = useFeedLane(face, 'follow', tab === 'follow' && opened === null, useStore, actions)
  const search = useSearchLane(face, useStore, actions)
  const lanes: Readonly<Record<FeedTab, ReturnType<typeof useFeedLane>>> = {
    recommend: recommended,
    hot,
    follow,
  }
  const lane = tab === 'search' ? search : lanes[tab]
  /** Reloads the lane on screen; the search lane re-runs its form instead. */
  const refresh = tab === 'search' ? undefined : lanes[tab].reload
  const scroller = useRef<HTMLDivElement | null>(null)
  /** The list's live offset; the store hears it once the reader pauses, not once per event. */
  const offset = useRef(scrollTop)
  const saving = useRef<ReturnType<typeof setTimeout> | null>(null)

  /** Persist the offset the reader stopped at, coalescing a burst of scroll events into one write. */
  const saveOffset = useCallback(() => {
    if (saving.current !== null) return
    saving.current = setTimeout(() => {
      saving.current = null
      actions.scrolled(offset.current)
    }, SCROLL_SAVE_DELAY)
  }, [actions])

  // A page that closes while a save is pending still keeps where the reader was.
  useEffect(() => () => {
    if (saving.current === null) return
    clearTimeout(saving.current)
    saving.current = null
    actions.scrolled(offset.current)
  }, [actions])

  // The lanes view mounts its scroller again after an opened row closes; both times it resumes the stored offset.
  useLayoutEffect(() => {
    if (opened !== null) return
    const element = scroller.current
    /* v8 ignore next -- the lanes view renders the scroller in the same commit */
    if (element === null) return
    element.scrollTop = offset.current
    offset.current = element.scrollTop
  }, [opened])

  /**
   * Request the next page while the lane is short enough that the reader could reach its end first.
   * It runs after every render, so a page that lands without filling one screen continues itself.
   * @param automatic - whether the top-up asks, rather than the reader's own scroll.
   */
  const fill = useCallback((automatic: boolean) => {
    // A lane that opened with stored rows asks for nothing until the reader scrolls or refreshes.
    if (automatic && lane.restored) return
    const element = scroller.current
    if (element === null || element.scrollHeight === 0) return
    // A refused continuation is the reader's to retry; asking again on every render would not stop.
    if (lane.page.failure !== undefined) return
    const remaining = element.scrollHeight - element.scrollTop - element.clientHeight
    if (remaining > Math.max(PAGE_THRESHOLD, element.clientHeight * 2)) return
    lane.loadMore()
  }, [lane])

  useEffect(() => {
    fill(true)
  })

  const read = useCallback((row: ZhihuFeedRow) => {
    const current = opening.current + 1
    opening.current = current
    setNotice(undefined)
    setMenu(undefined)
    setOpened({ status: 'loading', row })
    void face.read(row).then((result) => {
      if (current !== opening.current) return
      if (result.ok) {
        setOpened({ status: 'ready', row, item: result.value })
        return
      }
      // An article body is located by title; a miss still leaves its excerpt worth reading.
      setOpened(row.kind === 'article'
        ? { status: 'linked', row }
        : { status: 'failed', row, failure: result.failure })
    })
  }, [face])

  /** Drop the panel's reference; the discussion Session and its transcript stay. */
  const release = useCallback(() => {
    held.current?.release()
    held.current = null
  }, [])

  const close = useCallback(() => {
    opening.current += 1
    setNotice(undefined)
    setMenu(undefined)
    setOpened(null)
    setSurface('body')
    setQuote(undefined)
    setChat({ status: 'idle' })
    release()
  }, [release])

  // A panel that closes mid-discussion still lets go of its Session reference.
  useEffect(() => release, [release])

  // The seat bounds its own catalog call; this clock keeps a pane that waits on anything else from
  // looking like a pane that is still working.
  useEffect(() => {
    if (chat.status !== 'opening') return
    const started = Date.now()
    const ticker = setInterval(() => { setWaited(Date.now() - started) }, 500)
    return () => { clearInterval(ticker) }
  }, [chat.status])
  /** Whether the pane has waited past the point where a pending discussion is still believable. */
  const stalled = chat.status === 'opening' && waited >= DISCUSSION_PANEL_TIMEOUT_MS

  /**
   * Show the conversation about the open row, resuming the Session a previous
   * visit retained or creating the one it runs in.
   */
  const discuss = useCallback(async (row: ZhihuFeedRow): Promise<ZhihuDiscussion | undefined> => {
    const key = zhihuRowKey(row)
    const known = discussions?.[key]
    setNotice(undefined)
    setSurface('discussion')
    setChat({ status: 'opening' })
    try {
      const next = await discussion.open(row, known)
      release()
      held.current = next
      if (known === undefined) actions.remember(key, next.reference.sessionId)
      setChat({ status: 'ready', seat: next })
      return next
    } catch (error) {
      // A seat that throws on the call itself would otherwise leave the pane waiting forever.
      setChat({ status: 'failed', reason: String(error) })
      return undefined
    }
  }, [actions, discussion, discussions, release])

  /** Send one instruction into the open discussion. */
  const instruct = useCallback((seat: ZhihuDiscussion, row: ZhihuFeedRow, instruction: string): void => {
    setNotice(undefined)
    void seat.send(zhihuDiscussionPrompt(t, row, instruction)).then((accepted) => {
      if (!accepted) setNotice(t('discussion.failed'))
    }, () => { setNotice(t('discussion.failed')) })
  }, [t])

  /**
   * Ask about one passage, in the discussion this row already has or the one it opens now.
   * @param row - the row the passage came from.
   * @param text - the passage the reader pointed at.
   * @param instruction - what the reader asked about it.
   */
  const askPassage = useCallback(async (row: ZhihuFeedRow, text: string, instruction: string): Promise<void> => {
    setQuote(undefined)
    setSurface('discussion')
    const seat = chat.status === 'ready' && chat.seat !== undefined ? chat.seat : await discuss(row)
    if (seat === undefined) return
    instruct(seat, row, zhihuQuotedInstruction(t, text, instruction))
  }, [chat, discuss, instruct, t])

  /**
   * The conclusion the open row's discussion reached, for the note the reader files.
   * @returns the section to file under the body, or undefined while no answer settled.
   */
  const conclusion = useCallback((): { heading: string; text: string } | undefined => {
    const text = chat.status === 'ready' ? chat.seat?.latest() : undefined
    return text === undefined ? undefined : { heading: t('export.discussion'), text }
  }, [chat, t])

  /**
   * Quote the block the reader pointed at, or take it back when the quote already carries it.
   * @param target - the element the gesture landed on.
   */
  const quoteAt = useCallback((target: EventTarget | null): void => {
    const next = readPassage(target)
    if (next === undefined) return
    setQuote((current) => {
      const segments = toggleSegment(current?.segments ?? [], next.text)
      if (segments.length === 0) return undefined
      return { segments, text: segmentsText(segments), left: next.left, top: next.top }
    })
  }, [])

  // Built only while a row is open, so the menu and the shortcut handle always act on that row.
  const runAction = useMemo(() => {
    if (opened === null) return undefined
    const row = opened.row
    const item = opened.status === 'ready' ? opened.item : undefined
    return (action: ZhihuDetailAction): void => {
      switch (action) {
        case 'copyTitle':
          setNotice(copyZhihuText(row.title) ? t('notice.copied') : t('notice.copyFailed'))
          return
        case 'copyLink':
          setNotice(copyZhihuText(row.url) ? t('notice.copied') : t('notice.copyFailed'))
          return
        case 'copyBody':
          setNotice(item !== undefined && copyZhihuText(readableBody(item)) ? t('notice.copied') : t('notice.copyFailed'))
          return
        case 'ask':
          void discuss(row)
          return
        case 'openOriginal':
          window.open(row.url, '_blank', 'noopener')
          return
        case 'export': {
          const title = item !== undefined && item.title !== '' ? item.title : row.title
          const filed = conclusion()
          setNotice(t('notice.exporting'))
          void face.export({
            kind: row.kind,
            id: row.id,
            title,
            url: row.url,
            body: readableBody(item),
            truncated: item?.contentTruncated ?? false,
            ...(item === undefined || item.author === '' ? {} : { author: item.author }),
            ...(filed === undefined ? {} : { discussion: filed }),
          }).then((result) => {
            const line = result.ok ? t('notice.exported', { path: result.value.path }) : t('notice.exportFailed')
            setNotice(line)
            report(line)
          }, () => {
            // A Remote that never answered leaves the reader with a click and no note; say so.
            setNotice(t('notice.exportFailed'))
            report(t('notice.exportFailed'))
          })
          return
        }
        case 'back':
          close()
          return
      }
    }
  }, [close, conclusion, discuss, face, opened, report, t])

  // While a row is open its actions are this page's; the shortcut commands run through the same handle.
  useEffect(() => (runAction === undefined ? undefined : details.attach({ run: runAction })), [details, runAction])

  useEffect(() => {
    if (opened === null) return undefined
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key !== 'Escape') return
      event.preventDefault()
      close()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => { document.removeEventListener('keydown', onKeyDown) }
  }, [close, opened])

  // The bubble is placed from where the reader pointed, so it goes away once that moves.
  useEffect(() => {
    if (quote === undefined) return undefined
    const dismiss = (): void => { setQuote(undefined) }
    const onPointerDown = (event: PointerEvent): void => {
      // The bubble and the body it quotes are the quote's own surfaces: a click there names a block.
      if (event.target instanceof Element && event.target.closest('[data-zhihu-passage], [data-zhihu-body]') !== null) return
      dismiss()
    }
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key !== 'Escape') return
      // The passage is the nearer surface: Escape gives it up before it closes the row.
      event.stopPropagation()
      dismiss()
    }
    const onScroll = (event: Event): void => {
      // A scroller inside the bubble is the bubble growing its own text, not the page moving under it.
      if (event.target instanceof Element && event.target.closest('[data-zhihu-passage]') !== null) return
      dismiss()
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown, true)
    window.addEventListener('scroll', onScroll, true)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown, true)
      window.removeEventListener('scroll', onScroll, true)
    }
  }, [quote])

  if (opened !== null) {
    const menuRect = menu === undefined ? null : new DOMRect(menu.x, menu.y, 0, 0)
    const seat = chat.status === 'ready' ? chat.seat : undefined
    return (
      <section
        className={css.page}
        data-surface="opened"
        onContextMenu={(event) => {
          event.preventDefault()
          setMenu({ x: event.clientX, y: event.clientY })
        }}
      >
        <div className={css.header}>
          <Button variant="ghost" size="sm" onClick={close}>{t('panel.back')}</Button>
          <SegmentedControl
            id="zhihu-detail"
            value={surface}
            options={SURFACES.map(value => ({ value, label: t(SURFACE_KEYS[value]) }))}
            onChange={(next) => {
              if (next === 'discussion') void discuss(opened.row)
              else setSurface('body')
            }}
            label={t('discussion.surfaces')}
          />
        </div>
        {notice !== undefined && <p className={css.notice} role="status">{notice}</p>}
        {surface === 'body'
          ? (
            <div
              className={css.scroller}
              data-zhihu-body=""
              onMouseUp={(event) => { quoteAt(event.target) }}
              onKeyUp={(event) => {
                // A selection made with the keyboard raises no mouse gesture.
                if (event.shiftKey) quoteAt(event.target)
              }}
            >
              <ZhihuOpenedContent state={opened} t={t} onRetry={() => { read(opened.row) }} />
            </div>
          )
          : (
            <div className={css.discussion}>
              {chat.status === 'opening' && !stalled && (
                <p className={css.state}>{t('discussion.opening')}{waited > 0 ? ' ' + t('discussion.seconds', { seconds: Math.floor(waited / 1000) }) : ''}</p>
              )}
              {(chat.status === 'failed' || stalled) && (
                <>
                  <p className={css.state}>{t('discussion.failed')}</p>
                  <p className={css.reason}>{chat.reason ?? stallLine(discussion, t)}</p>
                  <Button variant="outline" size="sm" onClick={() => { void discuss(opened.row) }}>{t('panel.retry')}</Button>
                </>
              )}
              {seat !== undefined && (
                <>
                  <div className={css.chips}>
                    {CHIPS.map(key => (
                      <Button key={key} variant="outline" size="sm" onClick={() => { instruct(seat, opened.row, t(key)) }}>{t(key)}</Button>
                    ))}
                  </div>
                  {seat.reused && <p className={css.state}>{t('discussion.reused')}</p>}
                  <SessionProvider session={seat.reference}>
                    {renderSlot('zhihu.discussion', {})}
                  </SessionProvider>
                </>
              )}
            </div>
          )}
        {quote !== undefined && (
          <ZhihuQuoteBox
            passage={quote}
            count={quote.segments.length}
            t={t}
            onAsk={(instruction) => { void askPassage(opened.row, quote.text, instruction) }}
          />
        )}
        <Menu
          open={menu !== undefined}
          portal
          anchor={null}
          items={detailMenu(t, keycaps)}
          getAnchorRect={() => menuRect}
          onSelect={(id) => {
            setMenu(undefined)
            runAction?.(id as ZhihuDetailAction)
          }}
          onClose={() => { setMenu(undefined) }}
        />
      </section>
    )
  }

  const options: readonly SegmentedControlOption<PageTab>[] = LANES.map(kind => ({
    value: kind,
    label: t(TAB_KEYS[kind]),
  }))

  const page = tab === 'search' ? search.page : lane.page
  const rows = page.rows

  return (
    <section className={css.page} data-surface="lanes">
      <div className={css.header}>
        <h2 className={css.title}>{t('page.title')}</h2>
        <SegmentedControl
          id="zhihu-page"
          value={tab}
          options={options}
          onChange={(next) => { actions.show(next) }}
          label={t('panel.segments')}
        />
        {tab !== 'search' && (
          <Button variant="outline" size="sm" onClick={refresh} disabled={page.status === 'loading'}>
            {t('panel.refresh')}
          </Button>
        )}
      </div>
      {tab === 'search' && (
        <form
          className={css.searchBar}
          onSubmit={(event) => {
            event.preventDefault()
            search.run(query)
          }}
        >
          <Input
            value={query}
            placeholder={t('page.searchPlaceholder')}
            aria-label={t('page.searchPlaceholder')}
            onChange={(event) => { actions.typed(event.target.value) }}
          />
          <Button variant="outline" size="sm" type="submit">{t('page.searchAction')}</Button>
        </form>
      )}
      <div
        className={css.scroller}
        ref={scroller}
        onScroll={(event) => {
          offset.current = event.currentTarget.scrollTop
          saveOffset()
          fill(false)
        }}
      >
        {page.status === 'loading' && <p className={css.state}>{t('card.loading')}</p>}
        {page.status === 'failed' && (
          <div className={css.failure}>
            <p className={css.state}>{zhihuPanelFailureLine(t, page.failure)}</p>
            <Button variant="outline" size="sm" onClick={tab === 'search' ? () => { search.run(query) } : refresh}>
              {t('panel.retry')}
            </Button>
          </div>
        )}
        {page.status === 'ready' && (
          <ZhihuRowList rows={rows} t={t} onOpen={read} moves={tab === 'search' ? undefined : moves?.[tab]} />
        )}
        {page.status === 'ready' && rows.length > 0 && (
          <p className={css.footer}>
            {lane.appending
              ? t('page.loadingMore')
              : page.cursor !== undefined
                ? t('page.loadMore')
                : t('page.end')}
          </p>
        )}
      </div>
    </section>
  )
}

/**
 * Bind the page to its face, in the form a `main` slot registration declares.
 * @param face - the page's fetching face.
 * @param details - the registry the open row is published into for its shortcuts.
 * @param keycaps - the effective key labels of one action's command.
 * @param discussion - the seat that opens and instructs the open row's conversation.
 * @param report - announces an outcome on the shell overlay, where the reader is looking.
 * @returns the component the `main` seat renders, over the page store that registration declares.
 */
export function zhihuPageFor(
  face: ZhihuPageFace,
  details: ZhihuDetailRegistry,
  keycaps: (action: ZhihuDetailAction) => readonly string[],
  discussion: ZhihuDiscussionSeat,
  report: (text: string) => void,
): (
  props: PropsRuntime<'main'> & PropsLocale<'zhihu'> & PropsStore<ZhihuPageStore> & PropsRenderSlots<'zhihu.discussion'>,
) => ReactNode {
  return function ZhihuMainPage({ t, useStore, actions, renderSlot, SessionProvider }) {
    return (
      <ZhihuPage
        face={face} t={t} details={details} keycaps={keycaps} discussion={discussion} report={report}
        renderSlot={renderSlot} SessionProvider={SessionProvider}
        useStore={useStore} actions={actions}
      />
    )
  }
}
