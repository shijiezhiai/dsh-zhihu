/**
 * The conversation a reader holds about one Zhihu row: the Session it runs in,
 * and the instruction that points the model at the row.
 *
 * The Session belongs to the Client catalog, so the discussion outlives the
 * panel: the page only keeps a reference while the segment is on screen and
 * remembers the identity it retained.
 */
import type { ISessions, SessionEventSource, SessionReference } from '@deepseek-ai/dsh-api-session-controller/client'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import type { ZhihuFeedRow } from '@deepseek-ai/dsh-zhihu-plugin/types'
import type { ZhihuTranslate } from './ZhihuContent.tsx'
import type { ZhihuQuoteSource } from './zhihu-quote.ts'
import { zhihuRowKey } from './zhihu-row-key.ts'

declare module '@deepseek-ai/dsh-api-session-controller/client' {
  interface SessionReferenceSourceMap {
    /** A Zhihu row's conversation, referenced while its segment is on screen. */
    zhihuDiscussion: unknown
  }
}

/**
 * The copy key that names what kind of item a row is.
 * @param kind - the row's kind.
 * @returns the key of its label.
 */
export function zhihuKindKey(kind: ZhihuFeedRow['kind']): 'kind.question' | 'kind.answer' | 'kind.article' {
  switch (kind) {
    case 'question': return 'kind.question'
    case 'answer': return 'kind.answer'
    case 'article': return 'kind.article'
  }
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
    kind: t(zhihuKindKey(row.kind)),
    title: row.title,
    url: row.url,
    source: row.kind,
    id: row.id,
    instruction,
  })
}

/**
 * The key a comparison keeps its discussion under: the rows it quotes, in a stable order.
 * @param rows - the rows the comparison quotes.
 * @returns one row's own key when the comparison quotes a single item, otherwise a key naming the set.
 */
export function zhihuCompareKey(rows: readonly ZhihuFeedRow[]): string {
  const keys = [...new Set(rows.map(row => zhihuRowKey(row)))].sort()
  const joined = keys.join('+')
  return keys.length === 1 ? joined : `compare:${joined}`
}

/**
 * Compose the instruction that compares passages read in several rows.
 *
 * Each source block names the kind and id `zhihu_read` takes, so the model reads every item the
 * comparison quotes rather than the one the page happened to open first.
 * @param t - copy of the Zhihu namespace.
 * @param sources - the passages, grouped by the row they came from.
 * @param instruction - what the reader asked for, in their own copy.
 * @returns the message text, carrying every source and its passages.
 */
export function zhihuComparePrompt(
  t: ZhihuTranslate,
  sources: readonly ZhihuQuoteSource[],
  instruction: string,
): string {
  const blocks = sources.map((source, index) => {
    const row = source.row
    const head = t('compare.source', {
      index: index + 1,
      kind: t(zhihuKindKey(row.kind)),
      title: row.title,
      url: row.url,
      source: row.kind,
      id: row.id,
    })
    const quote = source.segments
      .map(segment => segment.split('\n').map(line => '> ' + line).join('\n'))
      .join('\n\n')
    return `${head}\n\n${quote}`
  })
  return t('compare.intro', { count: sources.length, instruction }) + '\n\n' + blocks.join('\n\n')
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
  /**
   * The exchange so far, for a note that files it.
   * @returns every settled turn in order, empty while none has settled.
   */
  transcript(): readonly ZhihuDiscussionTurn[]
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

/** One turn of a discussion, as a note files it. */
export interface ZhihuDiscussionTurn {
  /** Who said it: the reader's instruction, or the model's answer. */
  readonly role: 'user' | 'assistant'
  /** The turn's text blocks, joined; reasoning and tool calls stay out. */
  readonly text: string
}

/**
 * The text blocks of one message, trimmed; reasoning and tool calls carry none.
 * @param blocks - the message's content blocks.
 * @returns the text the message said, empty when it only acted.
 */
function textOf(blocks: readonly { readonly type: string; readonly text?: string }[]): string {
  return blocks
    .flatMap(block => (block.type === 'text' && block.text !== undefined ? [block.text] : []))
    .join('\n')
    .trim()
}

/**
 * The settled turns of a Session's event window.
 * @param source - the Session's contiguous event window.
 * @returns each turn in order, dropping messages that carry no text.
 */
function transcriptOf(source: SessionEventSource): readonly ZhihuDiscussionTurn[] {
  const turns: ZhihuDiscussionTurn[] = []
  for (const entry of source.getSnapshot().entries) {
    if (entry.type !== 'event') continue
    const event = entry.event
    if (event.type === 'user/message') {
      // Instructions, skills and runtime context reach the Session as user messages too,
      // and only the one the reader typed belongs in their note.
      if (event.data.source.kind !== 'user') continue
      const text = textOf(event.data.content)
      if (text !== '') turns.push({ role: 'user', text })
      continue
    }
    if (event.type !== 'assistant/message') continue
    const text = textOf(event.data.message.content)
    if (text !== '') turns.push({ role: 'assistant', text })
  }
  return turns
}

/** Characters of an answer the discussion list keeps as its reminder. */
export const DISCUSSION_LINE_LIMIT = 120

/**
 * The one line a discussion list shows for a conversation: its last answer, first line, plain.
 * @param turns - the settled turns of the discussion.
 * @returns that line, or undefined while no answer settled.
 */
export function lastAnswerLine(turns: readonly ZhihuDiscussionTurn[]): string | undefined {
  const answer = turns.findLast(turn => turn.role === 'assistant')
  const line = answer?.text.split('\n').map(part => part.trim()).find(part => part !== '')
  if (line === undefined) return undefined
  const plain = line.replace(/^[#>*\-\s]+/u, '')
  return plain.length > DISCUSSION_LINE_LIMIT ? plain.slice(0, DISCUSSION_LINE_LIMIT) + '…' : plain
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
        transcript: () => transcriptOf(reference.binding.eventSource),
        release: () => { reference.release() },
      }
    },
    stage: () => reached,
  }
}
