/**
 * The identity a feed row keeps across reloads: its kind and the provider id it addresses.
 *
 * Rows are remembered under this key — the discussion each one runs in, and where it sat the
 * last time its lane was read — so the key never depends on the order a page arrived in.
 */
import type { ZhihuFeedRow } from '@deepseek-ai/dsh-zhihu-plugin/types'

/**
 * Key one row by what it points at.
 * @param row - a feed or search row.
 * @returns a key stable across reloads and unique within one lane.
 */
export function zhihuRowKey(row: Pick<ZhihuFeedRow, 'kind' | 'id'>): string {
  return `${row.kind}:${row.id}`
}
