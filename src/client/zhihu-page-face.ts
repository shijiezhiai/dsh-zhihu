/**
 * The full Zhihu page's asynchronous half: one Remote call per request, with a
 * refusal returned instead of thrown.
 *
 * The namespace is resolved per request rather than captured at plugin
 * activation, so a Client whose Host never publishes `remote.zhihu` still opens
 * the page and reports the missing namespace on its first request.
 */
import type { ClientRemote } from '@deepseek-ai/dsh-api-gateway/client'
import type { RemoteFailure } from '@deepseek-ai/dsh-api-remotes/client'
// Type-only: pulls the generated 'zhihu' TypertRemoteNamespaceMap merge.
import type {} from '@deepseek-ai/dsh-zhihu-plugin/remote'
import type {
  ZhihuClientSettings, ZhihuCollectQuery, ZhihuCollectResult, ZhihuCollectionsResult,
  ZhihuCommentsResult, ZhihuExportQuery, ZhihuExportResult, ZhihuFailureTarget,
  ZhihuFeedQuery, ZhihuFeedResult, ZhihuFeedRow, ZhihuFeedSort, ZhihuFeedTimeWindow, ZhihuReadItem,
  ZhihuSearchQuery,
  ZhihuSyncDocument, ZhihuSyncReadResult, ZhihuSyncSaveResult,
  ZhihuVoteQuery, ZhihuVoteResult,
} from '@deepseek-ai/dsh-zhihu-plugin/types'
import { RemoteError } from '@deepseek-ai/dsh-typert-protocol'

/** Rows one page requests: ten, so a recommendation page fills the viewport. */
const PAGE_LIMIT = 10

/**
 * Hits one search page requests: the endpoint caps a response at twenty entries and spends that
 * budget on promo cards too, so a full entry page is what keeps a page of results worth showing.
 */
const SEARCH_LIMIT = 20

/** Either a returned value or the Remote failure that refused it. */
export type ZhihuPageOutcome<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly failure: RemoteFailure }

/** What a `topic` lane reads: its keyword and, when the reader picked one, an order and a window. */
export interface ZhihuFeedLane {
  /** Keyword the lane lists. */
  readonly topic: string
  /** Order the rows are listed in; omitted keeps Zhihu's relevance order. */
  readonly sort?: ZhihuFeedSort
  /** Keep only rows created within this window; omitted keeps every age. */
  readonly timeWindow?: ZhihuFeedTimeWindow
}

/** What the full page calls for its feeds, its search lane, and its opened rows. */
export interface ZhihuPageFace {
  /**
   * Request one feed page.
   * @param kind - which feed to read.
   * @param cursor - continuation token from the previous page; omitted reads the first page.
   * @param lane - what a `topic` lane reads; ignored by every other kind.
   * @returns the rows and the token that continues the feed, or the refusal.
   */
  feed(kind: ZhihuFeedQuery['kind'], cursor?: string, lane?: ZhihuFeedLane): Promise<ZhihuPageOutcome<ZhihuFeedResult>>
  /**
   * Run one search.
   * @param query - non-empty query text.
   * @param cursor - continuation token from the previous page; omitted reads the first page.
   * @returns the hits and the token that continues them, or the refusal.
   */
  search(query: string, cursor?: string): Promise<ZhihuPageOutcome<ZhihuFeedResult>>
  /**
   * Read one row's body.
   * @param row - the row to read; its title is what locates an article's body.
   * @returns the content, or the refusal.
   */
  read(row: ZhihuFeedRow): Promise<ZhihuPageOutcome<ZhihuReadItem>>
  /**
   * Read one slice of a row's root comments.
   * @param row - the opened row whose thread to read.
   * @param limit - comments requested; omitted reads the page's default slice.
   * @returns the comments and the thread's size, or the refusal.
   */
  comments(row: ZhihuFeedRow, limit?: number): Promise<ZhihuPageOutcome<ZhihuCommentsResult>>
  /**
   * Read one slice of the replies under a root comment.
   * @param commentId - the root comment whose replies to read.
   * @param limit - replies requested; omitted reads the page's default slice.
   * @returns the replies and the thread's size, or the refusal.
   */
  replies(commentId: string, limit?: number): Promise<ZhihuPageOutcome<ZhihuCommentsResult>>
  /**
   * Cast or withdraw the reader's own upvote on one answer or article.
   * @param query - content kind, lossless id, and the vote to hold after the call.
   * @returns the count the vote left and the state the reader now holds, or the refusal.
   */
  vote(query: ZhihuVoteQuery): Promise<ZhihuPageOutcome<ZhihuVoteResult>>
  /**
   * Read the collections of the reader's own account.
   * @param limit - collections requested; omitted reads the page's default slice.
   * @returns the collections, or the refusal.
   */
  collections(limit?: number): Promise<ZhihuPageOutcome<ZhihuCollectionsResult>>
  /**
   * Add the open row to one collection of the reader, or take it out again.
   * @param query - content kind, lossless id, collection id, and whether it belongs there.
   * @returns the membership the call left, or the refusal.
   */
  collect(query: ZhihuCollectQuery): Promise<ZhihuPageOutcome<ZhihuCollectResult>>
  /**
   * Read the deployment settings this page applies. A Client whose Host publishes no namespace, or
   * a refused call, leaves the page on its own cap, so this reports no failure of its own.
   * @returns the settings, or undefined when the answer is unavailable.
   */
  settings(): Promise<ZhihuClientSettings | undefined>
  /**
   * Read the page another machine left in the reader's vault.
   * @returns the stored document, or the refusal; a vault without one answers with no document.
   */
  state(): Promise<ZhihuPageOutcome<ZhihuSyncReadResult>>
  /**
   * Write this page's shared fields into the reader's vault.
   * @param document - the state to store, with the instant it was written.
   * @returns whether the vault took it, or the refusal.
   */
  saveState(document: ZhihuSyncDocument): Promise<ZhihuPageOutcome<ZhihuSyncSaveResult>>
  /**
   * Write the open row into the reader's Obsidian vault.
   * @param query - the capture to write; the reader supplies the body it already holds.
   * @returns the note's vault path, or the refusal.
   */
  export(query: ZhihuExportQuery): Promise<ZhihuPageOutcome<ZhihuExportResult>>
}

/**
 * Narrow one lane to the wire fields a `topic` read carries.
 * @param lane - the keyword the reader watches and the order they picked.
 * @returns the request fields the Host reads.
 */
function laneRequest(lane: ZhihuFeedLane): Pick<ZhihuFeedQuery, 'topic' | 'sort' | 'timeWindow'> {
  return {
    topic: lane.topic,
    ...(lane.sort === undefined ? {} : { sort: lane.sort }),
    ...(lane.timeWindow === undefined ? {} : { timeWindow: lane.timeWindow }),
  }
}

/**
 * Build the page face over a lazily resolved namespace.
 * @param resolveRemote - reads the Zhihu Remote namespace, or undefined while the Host does not publish it.
 * @returns the face the page component calls.
 */
export function zhihuPageFace(resolveRemote: () => ClientRemote['zhihu'] | undefined): ZhihuPageFace {
  function unavailable<T>(kind: ZhihuFailureTarget): ZhihuPageOutcome<T> {
    return {
      ok: false,
      failure: new RemoteError(
        'zhihu/unavailable',
        'The Zhihu Remote namespace is not mounted on this Client',
        { kind },
      ),
    }
  }
  return {
    async feed(kind, cursor, lane) {
      const remote = resolveRemote()
      if (remote === undefined) return unavailable(kind)
      const request: ZhihuFeedQuery = {
        kind,
        limit: PAGE_LIMIT,
        ...(cursor === undefined ? {} : { cursor }),
        ...(kind !== 'topic' || lane === undefined ? {} : laneRequest(lane)),
      }
      const result = await remote.feed(request)
      return result.ok ? { ok: true, value: result.value } : { ok: false, failure: result.error }
    },
    async search(query, cursor) {
      const remote = resolveRemote()
      if (remote === undefined) return unavailable('search')
      const request: ZhihuSearchQuery = cursor === undefined
        ? { query, limit: SEARCH_LIMIT }
        : { query, limit: SEARCH_LIMIT, cursor }
      const result = await remote.search(request)
      return result.ok ? { ok: true, value: result.value } : { ok: false, failure: result.error }
    },
    async read(row) {
      const remote = resolveRemote()
      if (remote === undefined) return unavailable(row.kind)
      const result = await remote.read({ kind: row.kind, id: row.id, title: row.title })
      return result.ok ? { ok: true, value: result.value } : { ok: false, failure: result.error }
    },
    async comments(row, limit) {
      const remote = resolveRemote()
      if (remote === undefined) return unavailable(row.kind)
      const request = limit === undefined
        ? { kind: row.kind, id: row.id }
        : { kind: row.kind, id: row.id, limit }
      const result = await remote.comments(request)
      return result.ok ? { ok: true, value: result.value } : { ok: false, failure: result.error }
    },
    async replies(commentId, limit) {
      const remote = resolveRemote()
      if (remote === undefined) return unavailable('comments')
      const request = limit === undefined ? { commentId } : { commentId, limit }
      const result = await remote.replies(request)
      return result.ok ? { ok: true, value: result.value } : { ok: false, failure: result.error }
    },
    async vote(query) {
      const remote = resolveRemote()
      if (remote === undefined) return unavailable(query.kind)
      const result = await remote.vote(query)
      return result.ok ? { ok: true, value: result.value } : { ok: false, failure: result.error }
    },
    async collections(limit) {
      const remote = resolveRemote()
      if (remote === undefined) return unavailable('collections')
      const result = await remote.collections(limit === undefined ? {} : { limit })
      return result.ok ? { ok: true, value: result.value } : { ok: false, failure: result.error }
    },
    async collect(query) {
      const remote = resolveRemote()
      if (remote === undefined) return unavailable(query.kind)
      const result = await remote.collect(query)
      return result.ok ? { ok: true, value: result.value } : { ok: false, failure: result.error }
    },
    async settings() {
      const remote = resolveRemote()
      if (remote === undefined) return undefined
      const result = await remote.settings()
      return result.ok ? result.value : undefined
    },
    async state() {
      const remote = resolveRemote()
      if (remote === undefined) return unavailable('state')
      const result = await remote.state()
      return result.ok ? { ok: true, value: result.value } : { ok: false, failure: result.error }
    },
    async saveState(document) {
      const remote = resolveRemote()
      if (remote === undefined) return unavailable('state')
      const result = await remote.saveState(document)
      return result.ok ? { ok: true, value: result.value } : { ok: false, failure: result.error }
    },
    async export(query) {
      const remote = resolveRemote()
      if (remote === undefined) return unavailable(query.kind)
      const result = await remote.export(query)
      return result.ok ? { ok: true, value: result.value } : { ok: false, failure: result.error }
    },
  }
}
