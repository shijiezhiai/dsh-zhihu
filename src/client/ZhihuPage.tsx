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
import type {
  ZhihuExportDiscussion, ZhihuExportExcerpt, ZhihuFeedRow, ZhihuFeedSort, ZhihuFeedTimeWindow,
  ZhihuSyncReadResult,
} from '@deepseek-ai/dsh-zhihu-plugin/types'
import type { ZhihuKey } from './locales.ts'
import { readableBody } from './zhihu-ask.ts'
import { copyZhihuText } from './zhihu-clipboard.ts'
import type { ZhihuDetailAction, ZhihuDetailRegistry } from './zhihu-detail.ts'
import {
  DISCUSSION_PANEL_TIMEOUT_MS,
  lastAnswerLine,
  zhihuCompareKey,
  zhihuComparePrompt,
  zhihuDiscussionPrompt,
  type ZhihuDiscussion,
  type ZhihuDiscussionSeat,
  type ZhihuDiscussionTurn,
} from './zhihu-discussion.ts'
import { zhihuRowKey } from './zhihu-row-key.ts'
import { zhihuPanelFailureLine } from './zhihu-panel-failure.ts'
import {
  collectQuote,
  QUOTE_MAX_CHARS,
  readPassage,
  segmentsText,
  toggleSegment,
  zhihuCitation,
  zhihuQuotedInstruction,
  type ZhihuPassage,
  type ZhihuQuoteSource,
} from './zhihu-quote.ts'
import { ZhihuQuoteBox } from './ZhihuQuote.tsx'
import type { ZhihuFeedLane, ZhihuPageFace, ZhihuPageOutcome } from './zhihu-page-face.ts'
import {
  readSyncMarker,
  SYNC_PUSH_DELAY,
  writeSyncMarker,
  zhihuSyncDocument,
  zhihuSyncEqual,
  zhihuSyncIsNewer,
  zhihuSyncJson,
  zhihuSyncedState,
} from './zhihu-page-sync.ts'
import {
  zhihuDiscussionEntry,
  zhihuDiscussionSession,
  zhihuLane,
  zhihuSearchTabs,
  type ZhihuFeedTab,
  type ZhihuPageLane,
  type ZhihuPageStore,
  type ZhihuPageTab,
  type ZhihuSearchTab,
} from './zhihu-page-store.ts'
import { ZhihuOpenedContent, ZhihuRowList, type ZhihuOpenedRow, type ZhihuTranslate } from './ZhihuContent.tsx'
import { ZhihuThreads, type ZhihuThread, type ZhihuThreadArchive } from './ZhihuThreads.tsx'
import css from './ZhihuPage.module.css'

/** The feeds that page; search is a lane of its own. */
type FeedTab = ZhihuFeedTab

/** The page's lanes, recommended first. */
type PageTab = ZhihuPageTab

const LANES: readonly PageTab[] = ['recommend', 'hot', 'follow', 'topic', 'search']

/** The comparison a fresh or pre-comparison state holds. One instance, so the bar's identity is stable. */
const EMPTY_COMPARISON: readonly ZhihuQuoteSource[] = []

/** The orders the topic lane offers, Zhihu's own relevance order first. */
const TOPIC_SORTS: readonly ZhihuFeedSort[] = ['relevance', 'newest', 'top']

/** The time windows the topic lane offers; leaving one out keeps every age. */
const TOPIC_WINDOWS: readonly ZhihuFeedTimeWindow[] = ['day', 'week', 'month', 'year']

/** The menu id that names no window, so the lane reads entries of every age. */
const ANY_WINDOW = 'any'

/** Copy naming each order the topic lane offers. */
const TOPIC_SORT_KEYS: Readonly<Record<ZhihuFeedSort, ZhihuKey>> = {
  relevance: 'page.topicSortRelevance',
  newest: 'page.topicSortNewest',
  top: 'page.topicSortTop',
}

/** Copy naming each time window the topic lane offers. */
const TOPIC_WINDOW_KEYS: Readonly<Record<ZhihuFeedTimeWindow, ZhihuKey>> = {
  day: 'page.topicWindowDay',
  week: 'page.topicWindowWeek',
  month: 'page.topicWindowMonth',
  year: 'page.topicWindowYear',
}

/**
 * Read one order back from a menu id.
 * @param id - the id the menu reported.
 * @returns the order, or undefined when the id names none.
 */
function readTopicSort(id: string): ZhihuFeedSort | undefined {
  return TOPIC_SORTS.find(candidate => candidate === id)
}

/**
 * Read one time window back from a menu id.
 * @param id - the id the menu reported.
 * @returns the window, or undefined for {@link ANY_WINDOW} and for any id that names none.
 */
function readTopicWindow(id: string): ZhihuFeedTimeWindow | undefined {
  return TOPIC_WINDOWS.find(candidate => candidate === id)
}

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
  topic: 'panel.segment.topic',
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
 * @param lane - what a `topic` lane reads; absent for every other lane.
 * @returns the lane's page, whether a continuation is in flight, whether the lane opened with stored rows, and the two requests.
 */
function useFeedLane(
  face: ZhihuPageFace, kind: FeedTab, active: boolean, useStore: PageSelector, actions: PageActions, lane?: ZhihuFeedLane,
): {
  readonly page: FeedPage
  readonly appending: boolean
  readonly restored: boolean
  readonly reload: () => void
  readonly loadMore: () => void
} {
  const stored = useStore(state => zhihuLane(state, kind))
  const rows = stored.rows
  const cursor = stored.cursor
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

  /** The keyword this lane last asked for, so a new one is read once and an unchanged one is not. */
  const wantedTopic = useRef<string | undefined>(undefined)
  /** The order this lane last asked for, so a changed one is read again. */
  const wantedOrder = useRef<string | undefined>(undefined)

  const request = useCallback((continuation?: string) => {
    const keyword = kind === 'topic' ? (lane?.topic ?? '').trim() : undefined
    // A topic lane with no keyword has nothing to read and asks for nothing.
    if (keyword === '') {
      setPhase({ status: 'idle' })
      return
    }
    wantedTopic.current = keyword
    const current = generation.current + 1
    generation.current = current
    inFlight.current = true
    asked.current = true
    if (continuation === undefined) setPhase({ status: 'loading' })
    else setAppending(true)
    const answer = kind === 'topic' && keyword !== undefined
      ? face.feed(kind, continuation, { ...lane, topic: keyword })
      : face.feed(kind, continuation)
    void answer.then((result) => {
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
  }, [actions, face, kind, lane])

  useEffect(() => {
    // A topic lane waits for the keyword the reader submits; a lane that names its own feed reads on activation.
    if (active && phase.status === 'idle' && kind !== 'topic') request()
  }, [active, kind, phase.status, request])

  useEffect(() => {
    if (kind !== 'topic') return
    // The order is read from the moment the reader changes it, and the first render only records it,
    // so a lane that opened with stored rows still asks for nothing on its own.
    const order = `${lane?.sort ?? ''}|${lane?.timeWindow ?? ''}`
    const first = wantedOrder.current === undefined
    const changed = wantedOrder.current !== order
    wantedOrder.current = order
    if (first || !changed || !active) return
    request()
  }, [active, kind, lane?.sort, lane?.timeWindow, request])


  const reload = useCallback(() => { request() }, [request])
  const loadMore = useCallback(() => {
    if (inFlight.current || phase.status !== 'ready' || cursor === '' || appending) return
    // A continuation belongs to the keyword the rows were read for, not to the one being typed.
    if (kind === 'topic' && (lane?.topic ?? '').trim() !== wantedTopic.current) return
    request(cursor)
  }, [appending, cursor, kind, lane?.topic, phase.status, request])

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

/** A search lane with nothing in it, shared so an idle tab does not allocate one per render. */
const NO_ROWS: ZhihuPageLane = { rows: [], cursor: '' }

/** The phase of a tab nobody asked about, and of one whose hits are on screen. */
const IDLE_PHASE: LanePhase = { status: 'idle' }
const READY_PHASE: LanePhase = { status: 'ready' }

/**
 * Run the search tabs, one per query, over the pages the store keeps.
 *
 * Each submitted query keeps its own tab, so a later search shows beside the earlier ones instead of
 * replacing their hits. A tab's phase is local, so a reopened page shows the stored hits and asks
 * for nothing until the reader pages or retries that tab.
 * @param face - the page's fetching face.
 * @param useStore - the page store's read seat.
 * @param actions - the page store's write seat.
 * @returns the tabs, the one on screen with its page, and the five requests.
 */
function useSearchLanes(face: ZhihuPageFace, useStore: PageSelector, actions: PageActions): {
  readonly tabs: readonly ZhihuSearchTab[]
  readonly active: ZhihuSearchTab | undefined
  readonly page: SearchPage
  readonly appending: boolean
  readonly restored: boolean
  readonly loadMore: () => void
  readonly run: (query: string) => void
  readonly retry: () => void
  readonly show: (query: string) => void
  readonly close: (query: string) => void
} {
  const searches = useStore(state => state.searches)
  const legacy = useStore(state => state.search)
  const saved = useStore(state => state.query)
  const named = useStore(state => state.activeSearch)
  const tabs = useMemo(() => zhihuSearchTabs(searches, legacy, saved), [legacy, saved, searches])
  // A state persisted before tabs existed names none, so its single search is the one on screen.
  const active = useMemo(
    () => tabs.find(tab => tab.query === (named ?? (searches === undefined ? saved : undefined))),
    [named, saved, searches, tabs],
  )
  const query = active?.query
  const lane = active?.lane ?? NO_ROWS
  const [phases, setPhases] = useState<Record<string, LanePhase>>({})
  const [appendingIn, setAppendingIn] = useState<readonly string[]>([])
  /** The queries this page has asked for, so a tab restored with hits keeps them. */
  const asked = useRef(new Set<string>())
  /** The queries whose request is unanswered, so a top-up cannot ask twice for one page. */
  const inFlight = useRef(new Set<string>())
  /** The latest request of each query, so an answer for an abandoned search writes nothing. */
  const generations = useRef(new Map<string, number>())
  const phase = query === undefined ? IDLE_PHASE : phases[query] ?? (lane.rows.length > 0 ? READY_PHASE : IDLE_PHASE)
  const appending = query !== undefined && appendingIn.includes(query)
  const restored = query !== undefined && lane.rows.length > 0 && !asked.current.has(query)

  const request = useCallback((wanted: string, continuation?: string) => {
    const generation = (generations.current.get(wanted) ?? 0) + 1
    generations.current.set(wanted, generation)
    inFlight.current.add(wanted)
    asked.current.add(wanted)
    if (continuation === undefined) setPhases(kept => ({ ...kept, [wanted]: { status: 'loading' } }))
    else setAppendingIn(kept => [...kept, wanted])
    void face.search(wanted, continuation).then((result) => {
      inFlight.current.delete(wanted)
      if (generation !== generations.current.get(wanted)) return
      setAppendingIn(kept => kept.filter(entry => entry !== wanted))
      if (!result.ok) {
        setPhases(kept => ({
          ...kept,
          [wanted]: continuation === undefined
            ? { status: 'failed', failure: result.failure }
            : { status: 'ready', failure: result.failure },
        }))
        return
      }
      // A page that carries no rows ends the tab, so a repeated cursor cannot page forever.
      const next = result.value.rows.length === 0 ? '' : result.value.cursor ?? ''
      const slice = { rows: result.value.rows, cursor: next }
      if (continuation === undefined) actions.searchLoaded(wanted, slice)
      else actions.searchAppended(wanted, slice)
      setPhases(kept => ({ ...kept, [wanted]: { status: 'ready' } }))
    })
  }, [actions, face])

  const run = useCallback((text: string) => {
    const trimmed = text.trim()
    if (trimmed === '') return
    actions.searchOpened(trimmed)
    request(trimmed)
  }, [actions, request])

  const retry = useCallback(() => {
    if (query === undefined) return
    request(query)
  }, [query, request])

  const loadMore = useCallback(() => {
    if (query === undefined || inFlight.current.has(query)) return
    if (phase.status !== 'ready' || lane.cursor === '' || appending) return
    request(query, lane.cursor)
  }, [appending, lane.cursor, phase.status, query, request])

  const page = useMemo<SearchPage>(() => {
    if (phase.status === 'failed') return { status: 'failed', rows: lane.rows, failure: phase.failure }
    if (phase.status !== 'ready') return { status: phase.status, rows: [] }
    return {
      status: 'ready',
      rows: lane.rows,
      ...(lane.cursor === '' ? {} : { cursor: lane.cursor }),
      ...(phase.failure === undefined ? {} : { failure: phase.failure }),
    }
  }, [lane.cursor, lane.rows, phase])

  const show = useCallback((wanted: string) => { actions.searchShown(wanted) }, [actions])
  const close = useCallback((wanted: string) => { actions.searchClosed(wanted) }, [actions])

  return { tabs, active, page, appending, restored, run, retry, loadMore, show, close }
}

/**
 * The key hint a menu row shows, if its action has a binding.
 * @param keys - the effective key labels of the row's command.
 * @returns the row's shortcut field, empty when nothing is bound.
 */
function keyHint(keys: readonly string[]): { shortcut?: { keys: readonly string[] } } {
  return keys.length === 0 ? {} : { shortcut: { keys } }
}

/**
 * The opened row's context menu: the copy actions, the original page, the
 * Obsidian capture, and the way back to the list.
 * @param t - copy of the Zhihu namespace.
 * @param keycaps - the effective key labels of one action's command.
 * @param hasSelection - whether the reader had text selected where they right-clicked.
 * @returns the rows the menu draws.
 */
function detailMenu(
  t: ZhihuTranslate,
  keycaps: (action: ZhihuDetailAction) => readonly string[],
  hasSelection: boolean,
): readonly MenuEntry[] {
  return [
    {
      id: 'copySelection',
      label: t('menu.copySelection'),
      // The row names what the reader pointed at, so it stays visible and says why it is unavailable.
      disabled: !hasSelection,
      shortcut: { keys: keycaps('copySelection') },
    },
    { id: 'copyCitation', label: t('menu.copyCitation'), disabled: !hasSelection, ...keyHint(keycaps('copyCitation')) },
    { id: 'copyTitle', label: t('menu.copyTitle'), shortcut: { keys: keycaps('copyTitle') } },
    { id: 'copyLink', label: t('menu.copyLink'), shortcut: { keys: keycaps('copyLink') } },
    { id: 'copyBody', label: t('menu.copyBody'), shortcut: { keys: keycaps('copyBody') } },
    { type: 'separator', id: 'detail-menu-ask' },
    { id: 'ask', label: t('ask.action'), shortcut: { keys: keycaps('ask') } },
    { id: 'openOriginal', label: t('panel.openOriginal'), shortcut: { keys: keycaps('openOriginal') } },
    { type: 'separator', id: 'detail-menu-export' },
    { id: 'export', label: t('menu.export'), shortcut: { keys: keycaps('export') } },
    { id: 'exportExcerpt', label: t('menu.exportExcerpt'), disabled: !hasSelection, ...keyHint(keycaps('exportExcerpt')) },
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
/**
 * Render the passages the reader collected, and the two decisions they lead to.
 * @param props.items - how many rows the comparison quotes.
 * @param props.segments - how many passages it holds.
 * @param props.t - copy of the Zhihu namespace.
 * @param props.onDiscuss - opens the discussion that compares the passages.
 * @param props.onClear - empties the comparison.
 * @returns the bar, pinned under whatever surface the page shows.
 */
function ZhihuCompareBar({ items, segments, t, onDiscuss, onClear }: {
  readonly items: number
  readonly segments: number
  readonly t: ZhihuTranslate
  readonly onDiscuss: () => void
  readonly onClear: () => void
}): ReactNode {
  const count = { items, segments }
  return (
    <div className={css.compare} role="region" aria-label={t('compare.tray', count)}>
      <span className={css.compareText}>{t('compare.tray', count)}</span>
      <Button variant="ghost" size="sm" onClick={onClear}>{t('compare.clear')}</Button>
      <Button variant="outline" size="sm" onClick={onDiscuss}>{t('compare.discuss')}</Button>
    </div>
  )
}

/**
 * Name the cause of a refused export, so the reader gets more than "it did not work".
 * @param message - the diagnostic the Host sent, or an empty string when it sent none.
 * @param t - the page's translate seat.
 * @returns the diagnostic, or the generic line when the Host named no cause.
 */
function exportReason(message: string, t: ZhihuTranslate): string {
  return message.trim() === '' ? t('panel.failure.generic') : message
}

export function ZhihuPage(
  { face, t, details, keycaps, discussion, archive, report, renderSlot, SessionProvider, useStore, actions }: {
    readonly face: ZhihuPageFace
    readonly t: ZhihuTranslate
    readonly details: ZhihuDetailRegistry
    readonly keycaps: (action: ZhihuDetailAction) => readonly string[]
    readonly discussion: ZhihuDiscussionSeat
    readonly archive: ZhihuThreadArchive
    readonly report: (text: string) => void
  } & PropsStore<ZhihuPageStore> & PropsRenderSlots<'zhihu.discussion'>,
): ReactNode {
  const tab = useStore(state => state.tab)
  const query = useStore(state => state.query)
  const topic = useStore(state => state.topic) ?? ''
  // A state persisted before the topic lane could be ordered restores without these, so the lane
  // starts on Zhihu's own relevance order and every age.
  const topicSort = useStore(state => state.topicSort) ?? 'relevance'
  const topicWindow = useStore(state => state.topicWindow)
  /** What the topic lane asks for: the keyword in the box and the order the reader picked. */
  const topicLane = useMemo<ZhihuFeedLane>(() => ({
    topic,
    ...(topicSort === 'relevance' ? {} : { sort: topicSort }),
    ...(topicWindow === undefined ? {} : { timeWindow: topicWindow }),
  }), [topic, topicSort, topicWindow])
  const scrollTop = useStore(state => state.scrollTop)
  const savedReading = useStore(state => state.reading)
  /** The fields this page shares with the reader's other machines. */
  const synced = useStore(state => zhihuSyncedState(state), zhihuSyncEqual)
  // A state persisted before the density switch existed restores without it, so the list starts roomy.
  const density = useStore(state => state.density) ?? 'comfortable'
  // A row the reader left open comes back on the first render, so re-entering the page does not
  // flash the list first; the read that fills its body starts in the effect below.
  const [opened, setOpened] = useState<ZhihuOpenedRow | null>(
    () => (savedReading === undefined ? null : { status: 'loading', row: savedReading.row }),
  )
  /** Whether the reader is looking at their discussions instead of the lanes. */
  const [library, setLibrary] = useState(false)
  /** Which of the topic lane's two order menus the reader has open. */
  const [orderMenu, setOrderMenu] = useState<'sort' | 'window' | undefined>(undefined)
  const [notice, setNotice] = useState<string | undefined>(undefined)
  const [menu, setMenu] = useState<MenuAt | undefined>(undefined)
  /**
   * The text the reader had selected when they opened the menu. Clicking a row
   * collapses the selection in some shells, so the menu keeps its own copy.
   */
  const [selection, setSelection] = useState('')
  const [surface, setSurface] = useState<DetailSurface>('body')
  /** The passage the reader pointed at, while its bubble is up. */
  const [quote, setQuote] = useState<ZhihuQuote | undefined>(undefined)
  /** Longest passage this deployment quotes; the Remote's answer replaces the built-in cap. */
  const [quoteLimit, setQuoteLimit] = useState(QUOTE_MAX_CHARS)
  // A state persisted before comparisons existed restores without them, so the bar starts empty.
  const comparison = useStore(state => state.comparison) ?? EMPTY_COMPARISON
  const [chat, setChat] = useState<{ status: 'idle' | 'opening' | 'ready' | 'failed'; seat?: ZhihuDiscussion; reason?: string }>({ status: 'idle' })
  /** Whole seconds the pane has been waiting, so a stall is visible instead of static. */
  const [waited, setWaited] = useState(0)
  // A state persisted before discussions existed restores without them, so a row simply has none.
  const discussions = useStore(state => state.discussions)
  /** Every discussion the page still remembers, most recently opened first. */
  const threads = useMemo(() => Object.entries(discussions ?? {})
    .flatMap(([key, record]): ZhihuThread[] => {
      const entry = zhihuDiscussionEntry(record)
      return entry === undefined ? [] : [{ key, entry }]
    })
    .sort((left, right) => right.entry.openedAt - left.entry.openedAt), [discussions])
  // A state persisted before rank tracking existed restores without it, so the list marks nothing.
  const moves = useStore(state => state.moves)
  /** What the comparison holds, as the bar counts it. */
  const collected = useMemo(() => ({
    items: comparison.length,
    segments: comparison.reduce((total, source) => total + source.segments.length, 0),
  }), [comparison])
  /** The discussion this panel holds a reference to; the Session outlives it. */
  const held = useRef<ZhihuDiscussion | null>(null)
  /** Latest open, so an answer for a row the reader left writes nothing. */
  const opening = useRef(0)

  const recommended = useFeedLane(face, 'recommend', tab === 'recommend' && opened === null, useStore, actions)
  const hot = useFeedLane(face, 'hot', tab === 'hot' && opened === null, useStore, actions)
  const follow = useFeedLane(face, 'follow', tab === 'follow' && opened === null, useStore, actions)
  const watched = useFeedLane(face, 'topic', tab === 'topic' && opened === null, useStore, actions, topicLane)
  const search = useSearchLanes(face, useStore, actions)
  const lanes: Readonly<Record<FeedTab, ReturnType<typeof useFeedLane>>> = {
    recommend: recommended,
    hot,
    follow,
    topic: watched,
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

  /** The opened body's scroller and the offset it was left at. */
  const body = useRef<HTMLDivElement | null>(null)
  const bodyOffset = useRef(savedReading?.offset ?? 0)
  const bodySaving = useRef<ReturnType<typeof setTimeout> | null>(null)
  /** The offset to drop the restored body at, until that body has rendered. */
  const pendingBodyOffset = useRef<number | null>(null)
  /** Whether the vault's copy has been read, so this page cannot write over it first. */
  const [hydrated, setHydrated] = useState(false)
  /** The shared state the vault already holds, or undefined while this page has written none. */
  const lastSynced = useRef<string | undefined>(undefined)

  /** Persist how far into the open body the reader got, coalescing a burst of scroll events into one write. */
  const saveBodyOffset = useCallback(() => {
    if (bodySaving.current !== null) return
    bodySaving.current = setTimeout(() => {
      bodySaving.current = null
      actions.readingScrolled(bodyOffset.current)
    }, SCROLL_SAVE_DELAY)
  }, [actions])

  // A page that closes while a save is pending still keeps the paragraph the reader reached.
  useEffect(() => () => {
    if (bodySaving.current === null) return
    clearTimeout(bodySaving.current)
    bodySaving.current = null
    actions.readingScrolled(bodyOffset.current)
  }, [actions])

  // The body's height is known only once its content has arrived, so the stored offset lands then.
  useLayoutEffect(() => {
    if (pendingBodyOffset.current === null || opened === null || opened.status === 'loading') return
    const element = body.current
    /* v8 ignore next -- the opened view renders its body in the same commit */
    if (element === null) return
    element.scrollTop = pendingBodyOffset.current
    bodyOffset.current = element.scrollTop
    pendingBodyOffset.current = null
  }, [opened])

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

  /** The row key the page has already shown, so a stored page resumes it once and a newer one again. */
  const resumed = useRef<string | undefined>(undefined)

  const read = useCallback((row: ZhihuFeedRow) => {
    const current = opening.current + 1
    opening.current = current
    setNotice(undefined)
    setMenu(undefined)
    setOpened({ status: 'loading', row })
    // The open row is state, so closing the page and coming back shows this one again.
    actions.readingOpened(row)
    // This row is on screen because the reader asked for it, so the resume below leaves it alone.
    resumed.current = zhihuRowKey(row)
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
  }, [actions, face])

  // The first render of a restored page shows the stored row empty; its body arrives here, and the
  // offset below drops the reader back where they were once that body has height.
  useEffect(() => {
    if (savedReading === undefined) return
    // The key, not a one-shot flag, so a row taken over from the vault is read as well.
    const key = zhihuRowKey(savedReading.row)
    if (resumed.current === key) return
    resumed.current = key
    pendingBodyOffset.current = savedReading.offset
    read(savedReading.row)
  }, [read, savedReading])

  // The page the reader's other machine left arrives once, before this one writes anything back,
  // so a slow vault cannot replace the newer copy with the older one this machine holds.
  useEffect(() => {
    let live = true
    /** Take over the stored page, then let this one write. */
    const adopt = (result: ZhihuPageOutcome<ZhihuSyncReadResult>): void => {
      const document = result.ok ? result.value.document : undefined
      if (document !== undefined && zhihuSyncIsNewer(document, readSyncMarker())) {
        writeSyncMarker(document.savedAt)
        lastSynced.current = zhihuSyncJson(document.state)
        actions.adopted(document.state)
      }
      setHydrated(true)
    }
    void face.state().then((result) => {
      if (live) adopt(result)
    }, () => {
      // A read this Client cannot describe leaves the page on the state this machine holds.
      if (live) setHydrated(true)
    })
    return () => { live = false }
  }, [actions, face])

  // Every change of the shared fields reaches the vault after a pause, so one scroll writes once.
  useEffect(() => {
    if (!hydrated) return
    const json = zhihuSyncJson(synced)
    if (json === lastSynced.current) return
    const savedAt = new Date().toISOString()
    const timer = setTimeout(() => {
      void face.saveState(zhihuSyncDocument(synced, savedAt)).then((result) => {
        if (!result.ok || !result.value.saved) return
        lastSynced.current = json
        writeSyncMarker(savedAt)
      }, () => {
        // A write this Client cannot describe leaves the next change to try again.
      })
    }, SYNC_PUSH_DELAY)
    return () => { clearTimeout(timer) }
  }, [face, hydrated, synced])

  /** Read one slice of an opened row's thread; a stable handle keeps the section from refetching. */
  const loadComments = useCallback(
    (row: ZhihuFeedRow, limit: number) => face.comments(row, limit),
    [face],
  )

  /** Read one slice of a comment's replies, requested only when the reader asks for them. */
  const loadReplies = useCallback(
    (commentId: string, limit: number) => face.replies(commentId, limit),
    [face],
  )

  /** Drop the panel's reference; the discussion Session and its transcript stay. */
  const release = useCallback(() => {
    held.current?.release()
    held.current = null
  }, [])

  const close = useCallback(() => {
    if (opened !== null && chat.status === 'ready' && chat.seat !== undefined) {
      const line = lastAnswerLine(chat.seat.transcript())
      if (line !== undefined) actions.noted(zhihuRowKey(opened.row), line)
    }
    opening.current += 1
    setNotice(undefined)
    setMenu(undefined)
    setOpened(null)
    actions.readingOpened(undefined)
    setSurface('body')
    setQuote(undefined)
    setChat({ status: 'idle' })
    release()
  }, [actions, chat, opened, release])

  // The deployment's passage cap arrives with the first Remote answer; a page that closes first drops it.
  useEffect(() => {
    let live = true
    void face.settings().then((settings) => {
      if (live && settings !== undefined) setQuoteLimit(settings.quoteMaxChars)
    })
    return () => { live = false }
  }, [face])

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
   * Show the conversation about one row or a set of rows, resuming the Session a previous
   * visit retained or creating the one it runs in.
   * @param key - the discussion's identity in the page's store: one row's key, or a comparison's.
   * @param rows - the items discussed; the first is the one the list reopens.
   */
  const openDiscussion = useCallback(async (
    key: string,
    rows: readonly ZhihuFeedRow[],
  ): Promise<ZhihuDiscussion | undefined> => {
    const head = rows[0]
    if (head === undefined) return undefined
    const known = zhihuDiscussionSession(discussions?.[key])
    setNotice(undefined)
    setSurface('discussion')
    setChat({ status: 'opening' })
    try {
      const next = await discussion.open(head, known)
      release()
      held.current = next
      actions.remember(key, {
        sessionId: next.reference.sessionId,
        row: head,
        openedAt: Date.now(),
        ...(rows.length > 1 ? { rows } : {}),
      })
      setChat({ status: 'ready', seat: next })
      return next
    } catch (error) {
      // A seat that throws on the call itself would otherwise leave the pane waiting forever.
      setChat({ status: 'failed', reason: String(error) })
      return undefined
    }
  }, [actions, discussion, discussions, release])

  /** Show the conversation about one row. */
  const discuss = useCallback(
    async (row: ZhihuFeedRow): Promise<ZhihuDiscussion | undefined> => openDiscussion(zhihuRowKey(row), [row]),
    [openDiscussion],
  )

  /** Reopen the items a listed discussion was about, straight on its conversation. */
  const resume = useCallback((thread: ZhihuThread): void => {
    setLibrary(false)
    read(thread.entry.row)
    void openDiscussion(thread.key, thread.entry.rows ?? [thread.entry.row])
  }, [openDiscussion, read])

  /** File one discussion's Session away, so it leaves the page's list with it. */
  const archiveThread = useCallback((thread: ZhihuThread): void => {
    setNotice(undefined)
    void archive(thread.entry.sessionId).then(() => { actions.forgot(thread.key) }, () => {
      setNotice(t('threads.archiveFailed'))
    })
  }, [actions, archive, t])

  /** Send one prepared message into an open discussion. */
  const send = useCallback((seat: ZhihuDiscussion, text: string): void => {
    setNotice(undefined)
    void seat.send(text).then((accepted) => {
      if (!accepted) setNotice(t('discussion.failed'))
    }, () => { setNotice(t('discussion.failed')) })
  }, [t])

  /** Send one instruction into the open discussion. */
  const instruct = useCallback((seat: ZhihuDiscussion, row: ZhihuFeedRow, instruction: string): void => {
    send(seat, zhihuDiscussionPrompt(t, row, instruction))
  }, [send, t])

  /** File the passages the reader pointed at into the comparison. */
  const collect = useCallback((row: ZhihuFeedRow, segments: readonly string[]): void => {
    setQuote(undefined)
    const next = collectQuote(comparison, row, segments)
    actions.collected(next)
    setNotice(t('compare.added', {
      segments: next.reduce((total, source) => total + source.segments.length, 0),
      items: next.length,
    }))
  }, [actions, comparison, t])

  /** Open the discussion that compares everything the reader collected, and ask for the comparison. */
  const compareCollected = useCallback(async (): Promise<void> => {
    if (comparison.length === 0) return
    const rows = comparison.map(source => source.row)
    const seat = await openDiscussion(zhihuCompareKey(rows), rows)
    if (seat === undefined) return
    send(seat, zhihuComparePrompt(t, comparison, t('compare.ask')))
  }, [comparison, openDiscussion, send, t])

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
   * The turns one row's discussion holds: the pane's own while it is that row, otherwise the
   * conversation its Session kept after the row was closed.
   * @param row - the row whose discussion is read.
   * @returns every settled turn in order, empty when the row never held one.
   */
  const settledTurns = useCallback((row: ZhihuFeedRow): readonly ZhihuDiscussionTurn[] => {
    const seat = chat.status === 'ready' ? chat.seat : undefined
    if (seat !== undefined && opened !== null && zhihuRowKey(opened.row) === zhihuRowKey(row)) {
      return seat.transcript()
    }
    const known = zhihuDiscussionSession(discussions?.[zhihuRowKey(row)])
    return known === undefined ? [] : discussion.transcript(known)
  }, [chat, discussion, discussions, opened])

  /**
   * The discussion one row carries, for the note the reader files.
   * @param row - the row being filed.
   * @returns the section to file under the body, or undefined while no turn settled.
   */
  const conclusion = useCallback((row: ZhihuFeedRow): { heading: string; text: string } | undefined => {
    const turns = settledTurns(row)
    if (turns.length === 0) return undefined
    const text = turns
      .map(turn => `${turn.role === 'user' ? t('export.question') : t('export.answer')}\n\n${turn.text}`)
      .join('\n\n')
    return { heading: t('export.discussion'), text }
  }, [settledTurns, t])

  /**
   * Quote the block the reader pointed at, or take it back when the quote already carries it.
   * @param target - the element the gesture landed on.
   */
  const quoteAt = useCallback((target: EventTarget | null): void => {
    const next = readPassage(target, quoteLimit)
    if (next === undefined) return
    setQuote((current) => {
      const segments = toggleSegment(current?.segments ?? [], next.text)
      if (segments.length === 0) return undefined
      return { segments, text: segmentsText(segments, quoteLimit), left: next.left, top: next.top, width: next.width }
    })
  }, [quoteLimit])

  /**
   * File the open row, with the sections the reader asked to carry beyond its body.
   * @param extra - the discussion, the passage, or both.
   */
  const file = useCallback((extra: { discussion?: ZhihuExportDiscussion; excerpt?: ZhihuExportExcerpt }): void => {
    if (opened === null) return
    const row = opened.row
    const item = opened.status === 'ready' ? opened.item : undefined
    const title = item !== undefined && item.title !== '' ? item.title : row.title
    setNotice(t('notice.exporting'))
    void face.export({
      kind: row.kind,
      id: row.id,
      title,
      url: row.url,
      body: readableBody(item),
      truncated: item?.contentTruncated ?? false,
      ...(item === undefined || item.author === '' ? {} : { author: item.author }),
      ...(extra.discussion === undefined ? {} : { discussion: extra.discussion }),
      ...(extra.excerpt === undefined ? {} : { excerpt: extra.excerpt }),
    }).then((result) => {
      const line = result.ok
        ? t('notice.exported', { path: result.value.path })
        : t('notice.exportFailed', { reason: exportReason(result.failure.message, t) })
      setNotice(line)
      report(line)
    }, (error: unknown) => {
      // A Remote that never answered leaves the reader with a click and no note; say so.
      const line = t('notice.exportFailed', {
        reason: error instanceof Error ? exportReason(error.message, t) : t('panel.failure.generic'),
      })
      setNotice(line)
      report(line)
    })
  }, [face, opened, report, t])

  // Built only while a row is open, so the menu and the shortcut handle always act on that row.
  const runAction = useMemo(() => {
    if (opened === null) return undefined
    const row = opened.row
    const item = opened.status === 'ready' ? opened.item : undefined
    /** The text the reader selected, live when the shell kept it and from the menu otherwise. */
    const picked = (): string => {
      const live = window.getSelection()?.toString() ?? ''
      return (live.trim() === '' ? selection : live).trim()
    }
    return (action: ZhihuDetailAction): void => {
      switch (action) {
        case 'copySelection':
          setNotice(copyZhihuText(picked()) ? t('notice.copied') : t('notice.copyFailed'))
          return
        case 'copyCitation': {
          const text = picked()
          setNotice(copyZhihuText(text === '' ? '' : zhihuCitation(text, row.title, row.url))
            ? t('notice.copied')
            : t('notice.copyFailed'))
          return
        }
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
          const filed = conclusion(row)
          file(filed === undefined ? {} : { discussion: filed })
          return
        }
        case 'exportExcerpt': {
          const text = picked()
          // Without a selection the row is disabled, so this only guards a stale menu.
          if (text === '') return
          file({ excerpt: { heading: t('export.excerpt'), text } })
          return
        }
        case 'back':
          close()
          return
      }
    }
  }, [close, conclusion, discuss, file, opened, report, selection, t])

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
    // A resize rewraps the text under the pointer, so the point that named the passage no longer points at it.
    const onResize = (): void => { dismiss() }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown, true)
    window.addEventListener('scroll', onScroll, true)
    window.addEventListener('resize', onResize)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown, true)
      window.removeEventListener('scroll', onScroll, true)
      window.removeEventListener('resize', onResize)
    }
  }, [quote])

  if (opened !== null) {
    const seat = chat.status === 'ready' ? chat.seat : undefined
    return (
      <section
        className={css.page}
        data-surface="opened"
        onContextMenu={(event) => {
          event.preventDefault()
          setSelection(window.getSelection()?.toString() ?? '')
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
              ref={body}
              className={css.scroller}
              data-zhihu-body=""
              onScroll={(event) => {
                bodyOffset.current = event.currentTarget.scrollTop
                saveBodyOffset()
              }}
              onMouseUp={(event) => { quoteAt(event.target) }}
              onKeyUp={(event) => {
                // A selection made with the keyboard raises no mouse gesture.
                if (event.shiftKey) quoteAt(event.target)
              }}
            >
              <ZhihuOpenedContent
                state={opened}
                t={t}
                onRetry={() => { read(opened.row) }}
                onComments={loadComments}
                onReplies={loadReplies}
              />
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
        {comparison.length > 0 && (
          <ZhihuCompareBar
            items={collected.items}
            segments={collected.segments}
            t={t}
            onDiscuss={() => { void compareCollected() }}
            onClear={() => {
              actions.collected(EMPTY_COMPARISON)
              setNotice(undefined)
            }}
          />
        )}
        {quote !== undefined && (
          <ZhihuQuoteBox
            passage={quote}
            count={quote.segments.length}
            t={t}
            onAsk={(instruction) => { void askPassage(opened.row, quote.text, instruction) }}
            onCollect={() => { collect(opened.row, quote.segments) }}
          />
        )}
        <span className={css.menuAnchor} style={{ left: menu?.x ?? 0, top: menu?.y ?? 0 }}>
          <Menu
            open={menu !== undefined}
            portal
            anchor={null}
            items={detailMenu(t, keycaps, selection.trim() !== '')}
            onSelect={(id) => {
              setMenu(undefined)
              runAction?.(id as ZhihuDetailAction)
            }}
            onClose={() => { setMenu(undefined) }}
          />
        </span>
      </section>
    )
  }

  if (library) {
    return (
      <section className={css.page} data-surface="threads">
        <div className={css.header}>
          <Button variant="outline" size="sm" onClick={() => { setLibrary(false) }}>{t('panel.back')}</Button>
          <h2 className={css.title}>{t('threads.title')}</h2>
        </div>
        {notice !== undefined && <p className={css.notice} role="status">{notice}</p>}
        <ZhihuThreads threads={threads} t={t} onOpen={resume} onArchive={archiveThread} />
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
        <Button
          variant="ghost"
          size="sm"
          aria-pressed={density === 'compact'}
          onClick={() => { actions.densified(density === 'compact' ? 'comfortable' : 'compact') }}
        >
          {t('page.density')}
        </Button>
        <Button variant="ghost" size="sm" onClick={() => { setLibrary(true) }}>{t('threads.title')}</Button>
      </div>
      {tab === 'topic' && (
        <>
          <form
            className={css.searchBar}
            onSubmit={(event) => {
              event.preventDefault()
              watched.reload()
            }}
          >
            <Input
              value={topic}
              placeholder={t('page.topicPlaceholder')}
              aria-label={t('page.topicPlaceholder')}
              onChange={(event) => { actions.topicTyped(event.target.value) }}
            />
            <Button variant="outline" size="sm" type="submit">{t('page.topicAction')}</Button>
          </form>
          <div className={css.orderBar}>
            <Menu
              open={orderMenu === 'sort'}
              onClose={() => { setOrderMenu(undefined) }}
              items={TOPIC_SORTS.map(id => ({ id, label: t(TOPIC_SORT_KEYS[id]) }))}
              selectedId={topicSort}
              onSelect={(id) => {
                setOrderMenu(undefined)
                const picked = readTopicSort(id)
                if (picked !== undefined) actions.topicOrdered(picked, topicWindow)
              }}
              portal
              anchor={(
                <Button
                  variant="ghost"
                  size="sm"
                  aria-haspopup="menu"
                  aria-expanded={orderMenu === 'sort'}
                  aria-label={t('page.topicSort')}
                  onClick={() => { setOrderMenu(orderMenu === 'sort' ? undefined : 'sort') }}
                >
                  {t(TOPIC_SORT_KEYS[topicSort])}
                </Button>
              )}
            />
            <Menu
              open={orderMenu === 'window'}
              onClose={() => { setOrderMenu(undefined) }}
              items={[
                { id: ANY_WINDOW, label: t('page.topicWindowAny') },
                ...TOPIC_WINDOWS.map(id => ({ id, label: t(TOPIC_WINDOW_KEYS[id]) })),
              ]}
              selectedId={topicWindow ?? ANY_WINDOW}
              onSelect={(id) => {
                setOrderMenu(undefined)
                actions.topicOrdered(topicSort, readTopicWindow(id))
              }}
              portal
              anchor={(
                <Button
                  variant="ghost"
                  size="sm"
                  aria-haspopup="menu"
                  aria-expanded={orderMenu === 'window'}
                  aria-label={t('page.topicWindow')}
                  onClick={() => { setOrderMenu(orderMenu === 'window' ? undefined : 'window') }}
                >
                  {topicWindow === undefined ? t('page.topicWindowAny') : t(TOPIC_WINDOW_KEYS[topicWindow])}
                </Button>
              )}
            />
          </div>
        </>
      )}
      {tab === 'search' && search.tabs.length > 0 && (
        <div className={css.searchTabs} role="tablist" aria-label={t('page.searchTabs')}>
          {search.tabs.map((item) => {
            const showing = item.query === search.active?.query
            return (
              <span key={item.query} className={css.searchTab} data-active={showing ? 'true' : 'false'}>
                <button
                  type="button"
                  role="tab"
                  aria-selected={showing}
                  className={css.searchTabName}
                  onClick={() => { search.show(item.query) }}
                >
                  {item.query}
                </button>
                <button
                  type="button"
                  className={css.searchTabClose}
                  aria-label={t('page.closeSearch', { query: item.query })}
                  onClick={() => { search.close(item.query) }}
                >
                  ×
                </button>
              </span>
            )
          })}
        </div>
      )}
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
            <Button variant="outline" size="sm" onClick={tab === 'search' ? search.retry : refresh}>
              {t('panel.retry')}
            </Button>
          </div>
        )}
        {page.status === 'ready' && (
          <ZhihuRowList
            rows={rows}
            t={t}
            onOpen={read}
            moves={tab === 'search' ? undefined : moves?.[tab]}
            counted={tab === 'follow'}
            density={density}
          />
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
      {comparison.length > 0 && (
        <ZhihuCompareBar
          items={collected.items}
          segments={collected.segments}
          t={t}
          onDiscuss={() => { void compareCollected() }}
          onClear={() => {
            actions.collected(EMPTY_COMPARISON)
            setNotice(undefined)
          }}
        />
      )}
    </section>
  )
}

/**
 * Bind the page to its face, in the form a `main` slot registration declares.
 * @param face - the page's fetching face.
 * @param details - the registry the open row is published into for its shortcuts.
 * @param keycaps - the effective key labels of one action's command.
 * @param discussion - the seat that opens and instructs the open row's conversation.
 * @param archive - files a discussion's Session away when the reader finishes with it.
 * @param report - announces an outcome on the shell overlay, where the reader is looking.
 * @returns the component the `main` seat renders, over the page store that registration declares.
 */
export function zhihuPageFor(
  face: ZhihuPageFace,
  details: ZhihuDetailRegistry,
  keycaps: (action: ZhihuDetailAction) => readonly string[],
  discussion: ZhihuDiscussionSeat,
  archive: ZhihuThreadArchive,
  report: (text: string) => void,
): (
  props: PropsRuntime<'main'> & PropsLocale<'zhihu'> & PropsStore<ZhihuPageStore> & PropsRenderSlots<'zhihu.discussion'>,
) => ReactNode {
  return function ZhihuMainPage({ t, useStore, actions, renderSlot, SessionProvider }) {
    return (
      <ZhihuPage
        face={face} t={t} details={details} keycaps={keycaps} discussion={discussion} archive={archive} report={report}
        renderSlot={renderSlot} SessionProvider={SessionProvider}
        useStore={useStore} actions={actions}
      />
    )
  }
}
