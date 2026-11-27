/** Reading the page two machines share out of the vault's JSON, with every field checked. */
import { RemoteError } from '@deepseek-ai/dsh-typert-protocol'
import type {
  ZhihuFeedRow, ZhihuSyncDensity, ZhihuSyncDiscussion, ZhihuSyncDocument, ZhihuSyncMove,
  ZhihuSyncReading, ZhihuSyncState, ZhihuSyncTab,
} from './types.ts'

/** Format version this Host writes and reads. */
export const STATE_VERSION = 1

const TABS: readonly ZhihuSyncTab[] = ['recommend', 'hot', 'follow', 'topic', 'search']

const DENSITIES: readonly ZhihuSyncDensity[] = ['compact', 'comfortable']

const ROW_KINDS: readonly ZhihuFeedRow['kind'][] = ['question', 'answer', 'article']

/**
 * Tell whether a parsed value is a JSON object.
 * @param value - value from `JSON.parse`.
 * @returns true when the value carries named fields.
 */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/**
 * Read a required string.
 * @param value - value from the stored document.
 * @returns the string, or undefined when the value is anything else.
 */
function text(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined
}

/**
 * Read a finite number.
 * @param value - value from the stored document.
 * @returns the number, or undefined when the value is anything else.
 */
function count(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined
}

/**
 * Read one row: what the lists need to render it again without asking Zhihu.
 * @param value - value from the stored document.
 * @returns the row, or undefined when a field it needs is missing or has the wrong type.
 */
function readRow(value: unknown): ZhihuFeedRow | undefined {
  if (!isRecord(value)) return undefined
  const kind = ROW_KINDS.find(candidate => candidate === value.kind)
  const id = text(value.id)
  const title = text(value.title)
  const excerpt = text(value.excerpt)
  const url = text(value.url)
  if (kind === undefined || id === undefined || title === undefined) return undefined
  if (excerpt === undefined || url === undefined) return undefined
  const heatLabel = text(value.heatLabel)
  const voteupCount = count(value.voteupCount)
  return {
    kind,
    id,
    title,
    excerpt,
    url,
    ...(heatLabel === undefined ? {} : { heatLabel }),
    ...(voteupCount === undefined ? {} : { voteupCount }),
  }
}

/**
 * Read how one row moved in the latest read of its lane.
 * @param value - value from the stored document.
 * @returns the move, or undefined when it names nothing this page can draw.
 */
function readMove(value: unknown): ZhihuSyncMove | undefined {
  if (!isRecord(value)) return undefined
  if (value.kind === 'new') return { kind: 'new' }
  const places = count(value.places)
  if (places === undefined) return undefined
  if (value.kind === 'up') return { kind: 'up', places }
  if (value.kind === 'down') return { kind: 'down', places }
  return undefined
}

/**
 * Read one discussion, which the page stores either as the entry or as the Session id alone.
 * @param value - value from the stored document.
 * @returns the record, or undefined when nothing readable is left of it.
 */
function readDiscussion(value: unknown): ZhihuSyncDiscussion | string | undefined {
  const known = text(value)
  if (known !== undefined) return known
  if (!isRecord(value)) return undefined
  const sessionId = text(value.sessionId)
  const row = readRow(value.row)
  const openedAt = count(value.openedAt)
  if (sessionId === undefined || row === undefined || openedAt === undefined) return undefined
  return { sessionId, row, openedAt }
}

/**
 * Read the discussion map, keeping the entries that still name a Session and a row.
 * @param value - value from the stored document.
 * @returns the map, or undefined when the field is not an object.
 */
function readDiscussions(value: unknown): Readonly<Record<string, ZhihuSyncDiscussion | string>> | undefined {
  if (!isRecord(value)) return undefined
  const kept: Record<string, ZhihuSyncDiscussion | string> = {}
  for (const [key, entry] of Object.entries(value)) {
    const discussion = readDiscussion(entry)
    if (discussion !== undefined) kept[key] = discussion
  }
  return kept
}

/**
 * Read the rank moves, keeping the lanes and rows that still name a move.
 * @param value - value from the stored document.
 * @returns the map, or undefined when the field is not an object.
 */
function readMoves(value: unknown): Readonly<Record<string, Readonly<Record<string, ZhihuSyncMove>>>> | undefined {
  if (!isRecord(value)) return undefined
  const kept: Record<string, Readonly<Record<string, ZhihuSyncMove>>> = {}
  for (const [lane, laneValue] of Object.entries(value)) {
    if (!isRecord(laneValue)) continue
    const moves: Record<string, ZhihuSyncMove> = {}
    for (const [row, moveValue] of Object.entries(laneValue)) {
      const move = readMove(moveValue)
      if (move !== undefined) moves[row] = move
    }
    kept[lane] = moves
  }
  return kept
}

/**
 * Read the row one machine left open.
 * @param value - value from the stored document.
 * @returns the row and its offset, or undefined when none is stored or it cannot be read.
 */
function readReading(value: unknown): ZhihuSyncReading | undefined {
  if (!isRecord(value)) return undefined
  const row = readRow(value.row)
  const offset = count(value.offset)
  if (row === undefined || offset === undefined) return undefined
  return { row, offset: Math.max(0, offset) }
}

/**
 * Read the fields two machines share.
 * @param value - `state` from the stored document.
 * @returns the state, or undefined when it cannot say which lane and density the page shows.
 */
export function readSyncState(value: unknown): ZhihuSyncState | undefined {
  if (!isRecord(value)) return undefined
  const tab = TABS.find(candidate => candidate === value.tab)
  const density = DENSITIES.find(candidate => candidate === value.density)
  if (tab === undefined || density === undefined) return undefined
  const reading = readReading(value.reading)
  return {
    tab,
    density,
    topic: text(value.topic) ?? '',
    scrollTop: Math.max(0, count(value.scrollTop) ?? 0),
    discussions: readDiscussions(value.discussions) ?? {},
    moves: readMoves(value.moves) ?? {},
    ...(reading === undefined ? {} : { reading }),
  }
}

/**
 * Read one stored document, envelope included.
 * @param source - JSON the vault holds.
 * @returns the document, or undefined when it is not JSON this Host understands.
 */
export function readStateDocument(source: string): ZhihuSyncDocument | undefined {
  let parsed: unknown
  try {
    parsed = JSON.parse(source)
  } catch {
    return undefined
  }
  if (!isRecord(parsed) || parsed.version !== STATE_VERSION) return undefined
  const savedAt = text(parsed.savedAt)
  if (savedAt === undefined || Number.isNaN(Date.parse(savedAt))) return undefined
  const state = readSyncState(parsed.state)
  return state === undefined ? undefined : { version: STATE_VERSION, savedAt, state }
}

/**
 * Refuse a document the vault must not store.
 * @param document - document a Client asked to store.
 * @throws RemoteError when the envelope names another version or an unreadable write instant.
 */
export function assertStateDocument(document: ZhihuSyncDocument): void {
  if (document.version !== STATE_VERSION) {
    throw new RemoteError('gateway/bad-request', `version must be ${String(STATE_VERSION)}`, {})
  }
  if (Number.isNaN(Date.parse(document.savedAt))) {
    throw new RemoteError('gateway/bad-request', 'savedAt must be an ISO instant', {})
  }
}
