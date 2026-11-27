/**
 * The page fields two machines share through the reader's vault, and the marker that orders the
 * two copies. Loaded rows and search hits stay on the machine that read them.
 */
import type { ZhihuSyncDocument, ZhihuSyncMove, ZhihuSyncState } from '@deepseek-ai/dsh-zhihu-plugin/types'
import type { ZhihuPageState } from './zhihu-page-store.ts'

/** Browser key holding the write instant of the copy this machine last read or wrote. */
const SYNC_MARKER_KEY = 'dsh.zhihu.page.v1.sync'

/** Wait after the last change before the shared page is written, so one scroll writes once. */
export const SYNC_PUSH_DELAY = 1_000

/** Format this Client writes; the Host refuses any other one. */
const DOCUMENT_VERSION = 1

/**
 * Collect the fields one page contributes to the copy two machines share.
 * @param state - the page's persisted state.
 * @returns the fields, with this page's defaults filled in.
 */
export function zhihuSyncedState(state: ZhihuPageState): ZhihuSyncState {
  const moves: Record<string, Readonly<Record<string, ZhihuSyncMove>>> = {}
  for (const [lane, laneMoves] of Object.entries(state.moves ?? {})) moves[lane] = laneMoves
  return {
    tab: state.tab,
    topic: state.topic ?? '',
    density: state.density ?? 'comfortable',
    scrollTop: state.scrollTop,
    discussions: state.discussions ?? {},
    moves,
    ...(state.reading === undefined ? {} : { reading: state.reading }),
  }
}

/**
 * Write a shared state as JSON.
 * @param state - fields two machines share.
 * @returns the JSON the vault holds.
 */
export function zhihuSyncJson(state: ZhihuSyncState): string {
  return JSON.stringify(state)
}

/**
 * Tell whether two shared states say the same thing, so a selection keeps one identity.
 * @param left - one shared state.
 * @param right - the other shared state.
 * @returns true when both name the same page.
 */
export function zhihuSyncEqual(left: ZhihuSyncState, right: ZhihuSyncState): boolean {
  return zhihuSyncJson(left) === zhihuSyncJson(right)
}

/**
 * Build the document the vault keeps.
 * @param state - fields two machines share.
 * @param savedAt - ISO instant of the write.
 * @returns the document to store.
 */
export function zhihuSyncDocument(state: ZhihuSyncState, savedAt: string): ZhihuSyncDocument {
  return { version: DOCUMENT_VERSION, savedAt, state }
}

/**
 * Tell whether a stored document is newer than the copy this machine last read or wrote.
 * @param document - document read from the vault.
 * @param marker - write instant this machine last saw, or undefined when it has seen none.
 * @returns true when the stored document wins.
 */
export function zhihuSyncIsNewer(document: ZhihuSyncDocument, marker: string | undefined): boolean {
  if (marker === undefined) return true
  return Date.parse(document.savedAt) > Date.parse(marker)
}

/**
 * Read the write instant this machine last saw.
 * @returns the ISO instant, or undefined when no marker is stored or it cannot be read.
 */
export function readSyncMarker(): string | undefined {
  try {
    const stored = localStorage.getItem(SYNC_MARKER_KEY)
    if (stored === null) return undefined
    const value: unknown = JSON.parse(stored)
    if (typeof value !== 'object' || value === null || !('savedAt' in value)) return undefined
    return typeof value.savedAt === 'string' ? value.savedAt : undefined
  } catch {
    // A browser that refuses storage, or a marker it cannot parse, leaves the documents to order
    // themselves on the next read.
    return undefined
  }
}

/**
 * Record the write instant of the copy this machine last read or wrote.
 * @param savedAt - ISO instant of that write.
 */
export function writeSyncMarker(savedAt: string): void {
  try {
    localStorage.setItem(SYNC_MARKER_KEY, JSON.stringify({ savedAt }))
  } catch {
    // A browser that refuses storage costs one redundant vault write, and nothing else.
  }
}
