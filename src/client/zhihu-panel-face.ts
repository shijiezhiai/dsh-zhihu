/**
 * The panel's asynchronous half: one Remote request per segment, its outcome
 * written through the store's own actions.
 *
 * The component never awaits anything. It asks for a segment and this face
 * performs the request; the newest request for a tab and segment wins, so a slow
 * answer never overwrites a newer one. Cleanup rides the tab's lifetime signal,
 * armed once by that tab's first request: the abort forgets the tab's bucket and
 * this bookkeeping, and a request is not made for a record that already ended.
 *
 * The Remote namespace is resolved per request rather than captured at plugin
 * activation: a Client whose Host never publishes `remote.zhihu` still gets the
 * tab, and its first load reports the missing namespace instead of hanging.
 */
import type { ClientRemote } from '@deepseek-ai/dsh-api-gateway/client'
import type { BoundActions } from '@deepseek-ai/dsh-client-store'
import type { TabId } from '@deepseek-ai/dsh-client-ui-dockkit'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
// Type-only: pulls the generated 'zhihu' TypertRemoteNamespaceMap merge.
import type {} from '@deepseek-ai/dsh-zhihu-plugin/remote'
import { RemoteError } from '@deepseek-ai/dsh-typert-protocol'
import type {
  ZhihuCollectQuery, ZhihuCollectResult, ZhihuCollectionsResult,
  ZhihuCommentsResult, ZhihuFeedRow, ZhihuReadItem, ZhihuVoteQuery, ZhihuVoteResult,
} from '@deepseek-ai/dsh-zhihu-plugin/types'
import type { ZhihuPageOutcome } from './zhihu-page-face.ts'
import type { ZhihuAskOutcome } from './zhihu-ask.ts'
import type { ZhihuPanelSegment, ZhihuPanelStore } from './zhihu-panel-store.ts'

/** Rows requested per feed: a fixed product cap, not a deployment setting. */
const FEED_LIMIT = 20

/** What the panel body calls to read one segment and to open one row. */
export interface ZhihuPanelInjected {
  /**
   * Request one segment of one tab.
   * @param tabId - the tab whose bucket receives the outcome.
   * @param segment - which feed to request.
   * @param signal - the tab's lifetime signal; an ended record records nothing.
   */
  load(tabId: TabId, segment: ZhihuPanelSegment, signal: AbortSignal): void
  /**
   * Open one row inside the panel, fetching its body when the row has one.
   *
   * An article has no body the provider serves, so it opens as its excerpt. The newest open of a
   * tab wins, the same way a feed request does.
   * @param tabId - the tab listing the row.
   * @param row - the row the reader opened.
   * @param signal - the tab's lifetime signal; an ended record records nothing.
   */
  read(tabId: TabId, row: ZhihuFeedRow, signal: AbortSignal): void
  /**
   * Read one slice of the open row's root comments.
   * @param row - the row the reader has open.
   * @param limit - comments requested; omitted reads the default slice.
   * @returns the comments and the thread's size, or the refusal.
   */
  comments(row: ZhihuFeedRow, limit?: number): Promise<ZhihuPageOutcome<ZhihuCommentsResult>>
  /**
   * Read one slice of the replies under a root comment.
   * @param commentId - the root comment whose replies to read.
   * @param limit - replies requested; omitted reads the default slice.
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
   * @param limit - collections requested; omitted reads the default slice.
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
   * Draft a conversation about the open row into a Workspace session.
   * @param row - the row the reader has open.
   * @param item - its body when the read produced one; the draft then carries the text.
   */
  ask(row: ZhihuFeedRow, item: ZhihuReadItem | undefined): Promise<ZhihuAskOutcome>
}

/**
 * Hold the Zhihu namespace as the Client's inject seat attaches it, so a face built before the
 * namespace appears still reads it when a request arrives.
 * @returns the writer the inject callback calls and the reader the face holds.
 */
export function zhihuRemoteReader(): {
  readonly attach: (remote: ClientRemote['zhihu']) => void
  readonly read: () => ClientRemote['zhihu'] | undefined
} {
  let remote: ClientRemote['zhihu'] | undefined
  return {
    attach: (next) => { remote = next },
    read: () => remote,
  }
}

/**
 * Bind a face factory to the slot's `inject` seat, which passes the session id first.
 * @param face - factory produced by {@link zhihuPanelFace}.
 * @returns the callback a `sidebar.right.pane.tab` registration declares.
 */
export function zhihuPanelInject(
  face: (actions: BoundActions<ZhihuPanelStore>) => ZhihuPanelInjected,
): (_sessionId: SessionId, actions: BoundActions<ZhihuPanelStore>) => ZhihuPanelInjected {
  return (_sessionId, actions) => face(actions)
}

/**
 * Build the panel body's injected face.
 * @param resolveRemote - reads the Zhihu Remote namespace, or undefined while the Host does not publish it.
 * @param ask - sends the row's discussion draft and reports what happened to it.
 * @returns the face the `sidebar.right.pane.tab` registration exposes.
 */
export function zhihuPanelFace(
  resolveRemote: () => ClientRemote['zhihu'] | undefined,
  ask: (row: ZhihuFeedRow, item: ZhihuReadItem | undefined) => Promise<ZhihuAskOutcome>,
): (actions: BoundActions<ZhihuPanelStore>) => ZhihuPanelInjected {
  return (actions) => {
    /** Latest request per tab and segment, so an older answer writes nothing. */
    const generations = new Map<TabId, Map<ZhihuPanelSegment, number>>()
    /** Latest open per tab, so an answer for a row the reader left writes nothing. */
    const readings = new Map<TabId, number>()
    const armed = new Set<TabId>()
    return {
      load(tabId, segment, signal) {
        if (signal.aborted) return
        const remote = resolveRemote()
        if (remote === undefined) {
          actions.failed(tabId, segment, new RemoteError(
            'zhihu/unavailable',
            'The Zhihu Remote namespace is not mounted on this Client',
            { kind: segment },
          ))
          return
        }
        if (!armed.has(tabId)) {
          armed.add(tabId)
          signal.addEventListener('abort', () => {
            armed.delete(tabId)
            generations.delete(tabId)
            readings.delete(tabId)
            actions.forget(tabId)
          }, { once: true })
        }
        const perTab = generations.get(tabId) ?? new Map<ZhihuPanelSegment, number>()
        generations.set(tabId, perTab)
        const generation = (perTab.get(segment) ?? 0) + 1
        perTab.set(segment, generation)
        actions.loading(tabId, segment)
        void remote.feed({ kind: segment, limit: FEED_LIMIT }).then((result) => {
          if (signal.aborted || perTab.get(segment) !== generation) return
          if (!result.ok) {
            actions.failed(tabId, segment, result.error)
            return
          }
          actions.loaded(tabId, segment, result.value.rows)
        })
      },
      read(tabId, row, signal) {
        if (signal.aborted) return
        const remote = resolveRemote()
        actions.open(tabId, row)
        if (remote === undefined) {
          actions.openFailed(tabId, row, new RemoteError(
            'zhihu/unavailable',
            'The Zhihu Remote namespace is not mounted on this Client',
            { kind: row.kind },
          ))
          return
        }
        const reading = (readings.get(tabId) ?? 0) + 1
        readings.set(tabId, reading)
        void remote.read({ kind: row.kind, id: row.id, title: row.title }).then((result) => {
          if (signal.aborted || readings.get(tabId) !== reading) return
          if (!result.ok) {
            // An article body is located by title; a miss still leaves its excerpt worth reading.
            if (row.kind === 'article') actions.linked(tabId, row)
            else actions.openFailed(tabId, row, result.error)
            return
          }
          actions.opened(tabId, row, result.value)
        })
      },
      comments(row, limit) {
        const remote = resolveRemote()
        if (remote === undefined) {
          return Promise.resolve({
            ok: false,
            failure: new RemoteError(
              'zhihu/unavailable',
              'The Zhihu Remote namespace is not mounted on this Client',
              { kind: row.kind },
            ),
          })
        }
        const request = limit === undefined
          ? { kind: row.kind, id: row.id }
          : { kind: row.kind, id: row.id, limit }
        return remote.comments(request).then(result => result.ok
          ? { ok: true, value: result.value }
          : { ok: false, failure: result.error })
      },
      replies(commentId, limit) {
        const remote = resolveRemote()
        if (remote === undefined) {
          return Promise.resolve({
            ok: false,
            failure: new RemoteError(
              'zhihu/unavailable',
              'The Zhihu Remote namespace is not mounted on this Client',
              { kind: 'comments' },
            ),
          })
        }
        const request = limit === undefined ? { commentId } : { commentId, limit }
        return remote.replies(request).then(result => result.ok
          ? { ok: true, value: result.value }
          : { ok: false, failure: result.error })
      },
      vote(query) {
        const remote = resolveRemote()
        if (remote === undefined) {
          return Promise.resolve({
            ok: false,
            failure: new RemoteError(
              'zhihu/unavailable',
              'The Zhihu Remote namespace is not mounted on this Client',
              { kind: query.kind },
            ),
          })
        }
        return remote.vote(query).then(result => result.ok
          ? { ok: true, value: result.value }
          : { ok: false, failure: result.error })
      },
      collections(limit) {
        const remote = resolveRemote()
        if (remote === undefined) {
          return Promise.resolve({
            ok: false,
            failure: new RemoteError(
              'zhihu/unavailable',
              'The Zhihu Remote namespace is not mounted on this Client',
              { kind: 'collections' },
            ),
          })
        }
        return remote.collections(limit === undefined ? {} : { limit }).then(result => result.ok
          ? { ok: true, value: result.value }
          : { ok: false, failure: result.error })
      },
      collect(query) {
        const remote = resolveRemote()
        if (remote === undefined) {
          return Promise.resolve({
            ok: false,
            failure: new RemoteError(
              'zhihu/unavailable',
              'The Zhihu Remote namespace is not mounted on this Client',
              { kind: query.kind },
            ),
          })
        }
        return remote.collect(query).then(result => result.ok
          ? { ok: true, value: result.value }
          : { ok: false, failure: result.error })
      },
      ask,
    }
  }
}
