/**
 * Narrowing for the persisted `presentationMeta` rows of `zhihu_feed`, `zhihu_search`, and `zhihu_read`.
 * Metadata is replayed from the session log, so every reader is total and answers `undefined` for a
 * layout it does not recognize; the cards then render the compact generic presentation.
 */
import type { ContentBlock } from '@deepseek-ai/dsh-llm/types'

/** Entry kinds shared by the three Zhihu tools. */
export type ZhihuEntryKind = 'question' | 'answer' | 'article'

/** One feed or search row as the tool records it. */
export interface ZhihuEntryRow {
  readonly kind: ZhihuEntryKind
  readonly id: string
  readonly title: string
  readonly url: string
  readonly heatLabel?: string
}

/** One read row; the answer body never lands in metadata. */
export interface ZhihuReadRow extends ZhihuEntryRow {
  readonly voteupCount: number
  readonly author: string
}

/** Feed rows, count, and truncation collected from `zhihu_feed` metadata. */
export interface ZhihuFeedFacts {
  readonly kind: 'hot' | 'recommend'
  readonly count: number
  readonly truncated: boolean
  readonly rows: readonly ZhihuEntryRow[]
}

/** Search rows, query, and truncation collected from `zhihu_search` metadata. */
export interface ZhihuSearchFacts {
  readonly kind: 'search'
  readonly query: string
  readonly count: number
  readonly truncated: boolean
  readonly rows: readonly ZhihuEntryRow[]
}

/** The single item collected from `zhihu_read` metadata. */
export interface ZhihuReadFacts {
  readonly kind: ZhihuEntryKind
  readonly id: string
  readonly row: ZhihuReadRow
  readonly truncated: boolean
}

type UnknownRecord = Record<string, unknown>

function recordOf(value: unknown): UnknownRecord | undefined {
  return typeof value === 'object' && value !== null && !Array.isArray(value) ? value as UnknownRecord : undefined
}

function stringOf(record: UnknownRecord, key: string): string | undefined {
  const value = record[key]
  return typeof value === 'string' ? value : undefined
}

function numberFieldOf(record: UnknownRecord, key: string): number | undefined {
  const value = record[key]
  return typeof value === 'number' ? value : undefined
}

function booleanFieldOf(record: UnknownRecord, key: string): boolean | undefined {
  const value = record[key]
  return typeof value === 'boolean' ? value : undefined
}

function entryKindOf(value: unknown): ZhihuEntryKind | undefined {
  return value === 'question' || value === 'answer' || value === 'article' ? value : undefined
}

function rowsOf<T extends ZhihuEntryRow>(value: unknown, read: (record: UnknownRecord) => T | undefined): readonly T[] | undefined {
  if (!Array.isArray(value)) return undefined
  const rows: T[] = []
  for (const item of value) {
    const record = recordOf(item)
    const row = record === undefined ? undefined : read(record)
    if (row === undefined) return undefined
    rows.push(row)
  }
  return rows
}

function entryRowOf(record: UnknownRecord): ZhihuEntryRow | undefined {
  const kind = entryKindOf(record.kind)
  const id = stringOf(record, 'id')
  const title = stringOf(record, 'title')
  const url = stringOf(record, 'url')
  if (kind === undefined || id === undefined || title === undefined || url === undefined) return undefined
  const heatLabel = stringOf(record, 'heatLabel')
  return heatLabel === undefined ? { kind, id, title, url } : { kind, id, title, url, heatLabel }
}

function readRowOf(record: UnknownRecord): ZhihuReadRow | undefined {
  const entry = entryRowOf(record)
  const voteupCount = numberFieldOf(record, 'voteupCount')
  const author = stringOf(record, 'author')
  if (entry === undefined || voteupCount === undefined || author === undefined) return undefined
  return { ...entry, voteupCount, author }
}

/**
 * Read feed facts from a recorded `zhihu_feed` result metadata value.
 * @param meta - the unvalidated `presentationMeta` of the result.
 * @returns the feed facts, or undefined when the metadata has another layout.
 */
export function feedFacts(meta: unknown): ZhihuFeedFacts | undefined {
  const record = recordOf(meta)
  if (record === undefined) return undefined
  const kind = record.kind === 'hot' || record.kind === 'recommend' ? record.kind : undefined
  const count = numberFieldOf(record, 'count')
  const truncated = booleanFieldOf(record, 'truncated')
  const rows = rowsOf(record.items, entryRowOf)
  if (kind === undefined || count === undefined || truncated === undefined || rows === undefined || rows.length !== count) return undefined
  return { kind, count, truncated, rows }
}

/**
 * Read search facts from a recorded `zhihu_search` result metadata value.
 * @param meta - the unvalidated `presentationMeta` of the result.
 * @returns the search facts, or undefined when the metadata has another layout.
 */
export function searchFacts(meta: unknown): ZhihuSearchFacts | undefined {
  const record = recordOf(meta)
  if (record === undefined) return undefined
  const kind = record.kind === 'search' ? record.kind : undefined
  const query = stringOf(record, 'query')
  const count = numberFieldOf(record, 'count')
  const truncated = booleanFieldOf(record, 'truncated')
  const rows = rowsOf(record.items, entryRowOf)
  if (kind === undefined || query === undefined || count === undefined || truncated === undefined
    || rows === undefined || rows.length !== count) return undefined
  return { kind, query, count, truncated, rows }
}

/**
 * Read facts from a recorded `zhihu_read` result metadata value.
 * @param meta - the unvalidated `presentationMeta` of the result.
 * @returns the read facts, or undefined when the metadata has another layout.
 */
export function readFacts(meta: unknown): ZhihuReadFacts | undefined {
  const record = recordOf(meta)
  if (record === undefined) return undefined
  const kind = entryKindOf(record.kind)
  const id = stringOf(record, 'id')
  const truncated = booleanFieldOf(record, 'contentTruncated')
  const rows = rowsOf(record.items, readRowOf)
  const row = rows?.[0]
  if (kind === undefined || id === undefined || truncated === undefined || rows?.length !== 1 || row === undefined) return undefined
  return { kind, id, row, truncated }
}

/**
 * Concatenate the text blocks of a recorded result.
 * @param content - the result content blocks.
 * @returns the text blocks joined by newlines.
 */
export function plainText(content: readonly ContentBlock[]): string {
  return content.flatMap(item => item.type === 'text' ? [item.text] : []).join('\n')
}

/**
 * Recover the answer body from a `zhihu_read` result text. The tool formats that text as the
 * untrusted-content notice, one header line, the body, then one note block, all separated by blank
 * lines; body paragraphs keep their own blank lines, so only the outer blocks are trimmed.
 * @param text - the recorded result text.
 * @returns the body, or undefined when the text is not in that layout.
 */
export function readBody(text: string): string | undefined {
  const sections = text.split('\n\n')
  if (sections.length < 4) return undefined
  return sections.slice(2, -1).join('\n\n').trim()
}
