/**
 * The conversation a reader holds about one Zhihu row: the Session it runs in,
 * and the instruction that points the model at the row.
 *
 * The Session belongs to the Client catalog, so the discussion outlives the
 * panel: the page only keeps a reference while the segment is on screen and
 * remembers the identity it retained.
 */
import type { ISessions, SessionReference } from '@deepseek-ai/dsh-api-session-controller/client'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import type { ZhihuFeedRow } from '@deepseek-ai/dsh-zhihu-plugin/types'
import type { ZhihuTranslate } from './ZhihuContent.tsx'

declare module '@deepseek-ai/dsh-api-session-controller/client' {
  interface SessionReferenceSourceMap {
    /** A Zhihu row's conversation, referenced while its segment is on screen. */
    zhihuDiscussion: unknown
  }
}

/** The row's kind, named by the copy that says what is being discussed. */
const KIND_KEYS = {
  answer: 'kind.answer',
  article: 'kind.article',
  question: 'kind.question',
} as const

/**
 * The identity one row's discussion is remembered under.
 * @param row - the row the reader has open.
 * @returns a key stable across page reloads.
 */
export function zhihuDiscussionKey(row: ZhihuFeedRow): string {
  return `${row.kind}:${row.id}`
}

/**
 * Compose the instruction that opens or continues a discussion.
 *
 * The model reads the body itself, so the message carries the identity the
 * Zhihu Remote accepts rather than a copy of the text.
 * @param t - copy of the Zhihu namespace.
 * @param row - the row the reader has open.
 * @param instruction - what the reader asked for, in their own copy.
 * @returns the message text.
 */
export function zhihuDiscussionPrompt(t: ZhihuTranslate, row: ZhihuFeedRow, instruction: string): string {
  return t('discussion.prompt', {
    kind: t(KIND_KEYS[row.kind]),
    title: row.title,
    url: row.url,
    source: row.kind,
    id: row.id,
    instruction,
  })
}

/** One opened discussion. */
export interface ZhihuDiscussion {
  /** The retained Client Session the embedded Conversation renders. */
  readonly reference: SessionReference
  /** Whether the discussion took an unused Session of the list instead of one created for it. */
  readonly reused: boolean
  /**
   * Send one message into the discussion.
   * @param text - prompt text, sent verbatim as one text block.
   * @returns whether the Host accepted it.
   */
  send(text: string): Promise<boolean>
  /** Drop this panel's reference; the Session and its transcript stay. */
  release(): void
}

/**
 * The step one open reached, so a pane that stalls names where it stopped instead of only how long.
 * `open` means the seat was never entered at all.
 */
export type ZhihuDiscussionStage = 'open' | 'catalog' | 'create' | 'retain'

/** The page's door to the Client Session catalog. */
export interface ZhihuDiscussionSeat {
  /**
   * Open the discussion of one row, resuming the Session it was remembered with.
   * @param row - the row the reader has open.
   * @param known - the identity a previous visit retained, when it still exists.
   * @returns the retained discussion.
   */
  open(row: ZhihuFeedRow, known: string | undefined): Promise<ZhihuDiscussion>
  /**
   * The step the current or latest open reached.
   * @returns the stage it stopped at, for a pane that has waited too long.
   */
  stage(): ZhihuDiscussionStage
}

/** How long the catalog may take before the page reports the wait instead of leaving its pane empty. */
export const DISCUSSION_OPEN_TIMEOUT_MS = 4_000

/** How long the pane shows a pending discussion before it reports the stall as a failure. */
export const DISCUSSION_PANEL_TIMEOUT_MS = 6_000

/**
 * Bound one catalog call, so a Host that never answers becomes a reported failure.
 * @param work - the call the pane waits on.
 * @param ms - how long it may take.
 * @returns the call's own settlement, or its rejection at the bound.
 */
function within<T>(work: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => { reject(new Error('the Session catalog did not answer within ' + String(ms) + ' ms')) }, ms)
    work.then(
      (value) => { clearTimeout(timer); resolve(value) },
      // The page shows whatever reason the catalog rejected with, so it reaches it unchanged.
      // oxlint-disable-next-line typescript/prefer-promise-reject-errors -- see the reason above.
      (error: unknown) => { clearTimeout(timer); reject(error) },
    )
  })
}

/** What the seat needs from the Session catalog. */
export type ZhihuDiscussionSessions = Pick<ISessions, 'create' | 'list' | 'retain'>

/**
 * Bind discussions to the Client Session catalog.
 * @param sessions - the catalog that creates and retains them.
 * @returns the page's discussion seat.
 */
export function createZhihuDiscussionSeat(sessions: ZhihuDiscussionSessions): ZhihuDiscussionSeat {
  let reached: ZhihuDiscussionStage = 'open'

  /** The first listed Session that has never been used, so a discussion opening in it starts empty. */
  function unused(): SessionId | undefined {
    const state = sessions.list.getSnapshot()
    return state.ids.find(id => state.byId[id]?.blank === true)
  }

  /** Resolve the Session one row's discussion runs in, creating it when the catalog lists none. */
  async function resolve(known: string | undefined): Promise<{ id: SessionId; reused: boolean }> {
    // A remembered identity that the catalog no longer lists was deleted on the Host.
    reached = 'catalog'
    const listed = known !== undefined && sessions.list.getSnapshot().byId[known as SessionId] !== undefined
    if (listed) return { id: known as SessionId, reused: false }
    try {
      reached = 'create'
      return { id: await within(sessions.create({}), DISCUSSION_OPEN_TIMEOUT_MS), reused: false }
    } catch (error) {
      // A Host that will not create one may still list an unused Session, which is the same reuse
      // the client's own New Session performs; only an exhausted catalog reports the failure.
      const reusable = unused()
      if (reusable === undefined) throw error
      return { id: reusable, reused: true }
    }
  }

  return {
    async open(_row, known) {
      reached = 'open'
      const { id, reused } = await resolve(known)
      reached = 'retain'
      const reference = sessions.retain(id, { source: 'zhihuDiscussion' })
      return {
        reference,
        reused,
        send: async text => (await reference.binding.session.prompt([{ type: 'text', text }], 'queue')).ok,
        release: () => { reference.release() },
      }
    },
    stage: () => reached,
  }
}
