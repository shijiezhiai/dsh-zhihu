/**
 * Persisted reading state of the Zhihu page: the lane on screen, the pages every lane has loaded,
 * the search text with its results, and where the list was left.
 *
 * Only settled content lives here. A request in flight, a continuation in progress and a refusal
 * stay in the component that issues them, so a reopened page restores what the reader had and
 * never revives an error or asks for a page on its own.
 */
import { defineStore, type EngineStoreHandle } from '@deepseek-ai/dsh-client-store'
import type { ZhihuFeedRow } from '@deepseek-ai/dsh-zhihu-plugin/types'
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
   * The Session each row's discussion runs in, keyed by {@link zhihuRowKey}.
   * A state persisted before discussions existed restores without the field, so readers default it.
   */
  discussions?: Record<string, string>
  /**
   * How each row moved in the latest read of its lane, keyed by lane and then by {@link zhihuRowKey}.
   * Only a row that was new, climbed or fell carries an entry, so the field stays small and the
   * list marks nothing for a row that held its place or a lane read for the first time.
   * A state persisted before rank tracking existed restores without the field, so readers default it.
   */
  moves?: Partial<Record<ZhihuFeedTab, Readonly<Record<string, ZhihuRankMove>>>>
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
   * Remember the Session one row's discussion runs in.
   * @param draft - the current state.
   * @param key - the row's discussion key.
   * @param sessionId - the identity the page retained.
   */
  remember(draft: ZhihuPageState, key: string, sessionId: string): void
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
      remember: (draft, key, sessionId) => { draft.discussions = { ...draft.discussions, [key]: sessionId } },
    },
  })
}
