/**
 * Persisted reading state of the Zhihu page: the lane on screen, the pages every lane has loaded,
 * the search text with its results, and where the list was left.
 *
 * Only settled content lives here. A request in flight, a continuation in progress and a refusal
 * stay in the component that issues them, so a reopened page restores what the reader had and
 * never revives an error or asks for a page on its own.
 */
import { defineStore, type EngineStoreHandle } from '@deepseek-ai/dsh-client-store'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import type { ZhihuFeedRow } from '@deepseek-ai/dsh-zhihu-plugin/types'
import type { ZhihuQuoteSource } from './zhihu-quote.ts'
import { zhihuRowKey } from './zhihu-row-key.ts'

/** The lanes the page pages through the feed Remote. */
export type ZhihuFeedTab = 'recommend' | 'hot' | 'follow'

/** Every lane the page switches between. */
export type ZhihuPageTab = ZhihuFeedTab | 'search'

/** One lane's loaded rows and the token that continues them; an empty cursor means nothing follows. */
export interface ZhihuPageLane {
  rows: readonly ZhihuFeedRow[]
  cursor: string
}

/** How one row moved when its lane was read, measured against that lane's previous read. */
export type ZhihuRankMove =
  | { readonly kind: 'new' }
  | { readonly kind: 'up'; readonly places: number }
  | { readonly kind: 'down'; readonly places: number }

/** One row's discussion, as the page lists it again after a reload. */
export interface ZhihuDiscussionEntry {
  /** The Session the discussion runs in. */
  readonly sessionId: SessionId
  /** The row as it was when the discussion opened, so the list reopens the same item. */
  readonly row: ZhihuFeedRow
  /**
   * Every item a comparison quotes, when the discussion compares several; absent for a discussion
   * about one row, which {@link row} already names.
   */
  readonly rows?: readonly ZhihuFeedRow[]
  /** When the discussion was last opened, in milliseconds since the epoch. */
  readonly openedAt: number
  /** The first line of the last answer the reader left it at, when one settled. */
  readonly lastLine?: string
}

/**
 * One discussion as persisted: the entry, or the Session id alone that a state written before the
 * page listed discussions carries.
 */
export type ZhihuDiscussionRecord = ZhihuDiscussionEntry | string

/**
 * Read back the entry a persisted discussion carries.
 * @param record - one discussion as the store holds it.
 * @returns the entry, or undefined for the Session id alone a legacy state wrote.
 */
export function zhihuDiscussionEntry(record: ZhihuDiscussionRecord | undefined): ZhihuDiscussionEntry | undefined {
  if (record === undefined || typeof record === 'string') return undefined
  return record
}

/**
 * Read the Session one persisted discussion runs in.
 * @param record - one discussion as the store holds it.
 * @returns its Session, or undefined when the row has no discussion.
 */
export function zhihuDiscussionSession(record: ZhihuDiscussionRecord | undefined): SessionId | undefined {
  if (record === undefined) return undefined
  return typeof record === 'string' ? record as SessionId : record.sessionId
}

/** The page's persisted state. */
export interface ZhihuPageState {
  /** The lane on screen. */
  tab: ZhihuPageTab
  /** The search text the input shows. */
  query: string
  /** The loaded content of each feed lane. */
  feeds: Record<ZhihuFeedTab, ZhihuPageLane>
  /** The loaded content of the search lane. */
  search: ZhihuPageLane
  /** Vertical offset of the list, so a reopened page resumes where the reader left it. */
  scrollTop: number
  /**
   * The discussion each row holds, keyed by {@link zhihuRowKey}.
   * A state persisted before discussions existed restores without the field, so readers default it.
   */
  discussions?: Record<string, ZhihuDiscussionRecord>
  /**
   * How each row moved in the latest read of its lane, keyed by lane and then by {@link zhihuRowKey}.
   * Only a row that was new, climbed or fell carries an entry, so the field stays small and the
   * list marks nothing for a row that held its place or a lane read for the first time.
   * A state persisted before rank tracking existed restores without the field, so readers default it.
   */
  moves?: Partial<Record<ZhihuFeedTab, Readonly<Record<string, ZhihuRankMove>>>>
  /**
   * The passages collected for the next discussion, in the order the reader added them, each
   * grouped under the row it was read in.
   * A state persisted before comparisons existed restores without the field, so readers default it.
   */
  comparison?: readonly ZhihuQuoteSource[]
}

/** The page store's write set. A type alias, not an interface, so it satisfies `ActionsDecl`'s index signature. */
export type ZhihuPageActions = {
  /**
   * Show one lane.
   * @param draft - the current state.
   * @param tab - the lane to show.
   */
  show(draft: ZhihuPageState, tab: ZhihuPageTab): void
  /**
   * Record the search text the reader is editing.
   * @param draft - the current state.
   * @param query - the text the input now shows.
   */
  typed(draft: ZhihuPageState, query: string): void
  /**
   * Replace one lane with a first page.
   * @param draft - the current state.
   * @param tab - the lane that answered.
   * @param lane - the rows and continuation of that page.
   */
  loaded(draft: ZhihuPageState, tab: ZhihuPageTab, lane: ZhihuPageLane): void
  /**
   * Extend one lane with a continuation page.
   * @param draft - the current state.
   * @param tab - the lane that answered.
   * @param lane - the rows of the continuation and the token that follows them.
   */
  appended(draft: ZhihuPageState, tab: ZhihuPageTab, lane: ZhihuPageLane): void
  /**
   * Record where the list was left.
   * @param draft - the current state.
   * @param scrollTop - the list's vertical offset.
   */
  scrolled(draft: ZhihuPageState, scrollTop: number): void
  /**
   * Remember one row's discussion, keeping the line an earlier visit left it at.
   * @param draft - the current state.
   * @param key - the row's discussion key.
   * @param entry - the discussion as this visit opened it.
   */
  remember(draft: ZhihuPageState, key: string, entry: ZhihuDiscussionEntry): void
  /**
   * Record the answer the reader left one discussion at.
   * @param draft - the current state.
   * @param key - the row's discussion key.
   * @param line - the first line of its last answer.
   */
  noted(draft: ZhihuPageState, key: string, line: string): void
  /**
   * Drop one discussion from the page, once the Session it ran in was filed away.
   * @param draft - the current state.
   * @param key - the row's discussion key.
   */
  forgot(draft: ZhihuPageState, key: string): void
  /**
   * Replace the passages collected for the next discussion.
   * @param draft - the current state.
   * @param sources - the comparison as the page now holds it; empty clears the bar.
   */
  collected(draft: ZhihuPageState, sources: readonly ZhihuQuoteSource[]): void
}

/** The store handle the `main` registration declares and the page reads. */
export type ZhihuPageStore = EngineStoreHandle<ZhihuPageState, ZhihuPageActions>

/** One lane nobody has loaded yet. */
function emptyLane(): ZhihuPageLane {
  return { rows: [], cursor: '' }
}

/**
 * Mark how the rows of a first page moved against the rows the lane listed before it.
 * @param previous - the rows the lane held before this read, in their order; empty when nothing
 * was read yet, which leaves nothing to compare against.
 * @param rows - the first page as it arrived.
 * @returns one mark per row that is new, climbed or fell, keyed by {@link zhihuRowKey}.
 */
function rankLane(
  previous: readonly ZhihuFeedRow[],
  rows: readonly ZhihuFeedRow[],
): Record<string, ZhihuRankMove> {
  if (previous.length === 0) return {}
  const before = new Map(previous.map((row, index) => [zhihuRowKey(row), index + 1]))
  const next: Record<string, ZhihuRankMove> = {}
  rows.forEach((row, index) => {
    const rank = index + 1
    const was = before.get(zhihuRowKey(row))
    if (was === undefined) next[zhihuRowKey(row)] = { kind: 'new' }
    else if (was > rank) next[zhihuRowKey(row)] = { kind: 'up', places: was - rank }
    else if (was < rank) next[zhihuRowKey(row)] = { kind: 'down', places: rank - was }
  })
  return next
}

/**
 * Write one lane's content into its bucket.
 * @param state - the state to write.
 * @param tab - the lane to write, or `search`.
 * @param lane - the content replacing that lane.
 */
function writeLane(state: ZhihuPageState, tab: ZhihuPageTab, lane: ZhihuPageLane): void {
  if (tab === 'search') state.search = lane
  else state.feeds[tab] = lane
}

/**
 * Declare the page store, persisted so a reopened page keeps its lane, its rows and its offset.
 * @returns a fresh store handle for the `main` registration.
 */
export function createZhihuPageStore(): ZhihuPageStore {
  return defineStore({
    init: (): ZhihuPageState => ({
      tab: 'recommend',
      query: '',
      feeds: { recommend: emptyLane(), hot: emptyLane(), follow: emptyLane() },
      search: emptyLane(),
      scrollTop: 0,
      discussions: {},
      moves: {},
    }),
    persist: 'dsh.zhihu.page.v1',
    actions: {
      show: (draft, tab) => { draft.tab = tab },
      typed: (draft, query) => { draft.query = query },
      loaded: (draft, tab, lane) => {
        // Search hits answer one query and carry no standing position, so only a feed lane is ranked.
        if (tab !== 'search') {
          draft.moves = { ...draft.moves, [tab]: rankLane(draft.feeds[tab].rows, lane.rows) }
        }
        writeLane(draft, tab, lane)
      },
      appended: (draft, tab, lane) => {
        const current = tab === 'search' ? draft.search : draft.feeds[tab]
        writeLane(draft, tab, { rows: [...current.rows, ...lane.rows], cursor: lane.cursor })
      },
      scrolled: (draft, scrollTop) => { draft.scrollTop = scrollTop },
      remember: (draft, key, entry) => {
        const kept = zhihuDiscussionEntry(draft.discussions?.[key])?.lastLine
        const lastLine = entry.lastLine ?? kept
        const record = lastLine === undefined ? entry : { ...entry, lastLine }
        draft.discussions = { ...draft.discussions, [key]: record }
      },
      noted: (draft, key, line) => {
        const entry = zhihuDiscussionEntry(draft.discussions?.[key])
        if (entry === undefined) return
        draft.discussions = { ...draft.discussions, [key]: { ...entry, lastLine: line } }
      },
      collected: (draft, sources) => { draft.comparison = sources },
      forgot: (draft, key) => {
        if (draft.discussions === undefined) return
        draft.discussions = Object.fromEntries(
          Object.entries(draft.discussions).filter(([kept]) => kept !== key),
        )
      },
    },
  })
}
