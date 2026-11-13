/**
 * The passage a reader points at, and the instruction that carries it into the
 * row's discussion.
 *
 * The quoted text is the locator. The reader renders one body (`contentMarkdown`)
 * while the model reads another (`contentText`), so a line number counted on the
 * rendered text would name nothing on the model's side; text that appears in both
 * does.
 */
import type { ZhihuFeedRow } from '@deepseek-ai/dsh-zhihu-plugin/types'
import type { ZhihuTranslate } from './ZhihuContent.tsx'
import { zhihuRowKey } from './zhihu-row-key.ts'

/** The longest passage one instruction carries; the full body stays one `zhihu_read` away. */
export const QUOTE_MAX_CHARS = 1200

/** Blocks a click without a selection can quote whole. */
const BLOCK_SELECTOR = 'p, li, blockquote, pre, figcaption, td, th, h1, h2, h3, h4, h5, h6'

// The bubble's measured size, kept here so placement is a pure calculation.
const QUOTE_WIDTH = 340
const QUOTE_HEIGHT = 200
const QUOTE_GAP = 8
const QUOTE_MARGIN = 8

/** One passage the reader pointed at, placed in viewport pixels. */
export interface ZhihuPassage {
  /** The text the instruction quotes, whitespace collapsed and capped. */
  readonly text: string
  /** Left edge of the bubble. */
  readonly left: number
  /** Top edge of the bubble. */
  readonly top: number
}

/** A rectangle in viewport pixels; a `DOMRect` satisfies it. */
export interface QuoteRect {
  readonly left: number
  readonly top: number
  readonly bottom: number
}

/** The visible viewport in CSS pixels. */
export interface QuoteViewport {
  readonly width: number
  readonly height: number
}

/**
 * Hold a passage to what one instruction carries, marking where it was cut.
 * @param text - the collapsed passage.
 * @returns the passage as the instruction quotes it.
 */
function cap(text: string): string {
  return text.length > QUOTE_MAX_CHARS ? text.slice(0, QUOTE_MAX_CHARS) + '…' : text
}

/**
 * Collapse a passage for one instruction, keeping its paragraph breaks.
 * @param text - raw text from the selection or the clicked block.
 * @returns the carried text, or undefined when the gesture named no text.
 */
function passageText(text: string): string | undefined {
  const collapsed = text.replace(/[ \t]+/gu, ' ').replace(/\n{3,}/gu, '\n\n').trim()
  return collapsed === '' ? undefined : cap(collapsed)
}

/**
 * Add a passage to the ones an instruction quotes, or take back one it already has.
 * @param segments - the passages quoted so far, in the order they were pointed at.
 * @param text - the passage this gesture named.
 * @returns the passages to quote next; naming a quoted passage again removes it.
 */
export function toggleSegment(segments: readonly string[], text: string): readonly string[] {
  return segments.includes(text) ? segments.filter(segment => segment !== text) : [...segments, text]
}

/**
 * Join the passages one instruction quotes into the text it carries.
 * @param segments - the passages quoted, in the order they were pointed at.
 * @returns the passages separated by a blank line, capped as a whole.
 */
export function segmentsText(segments: readonly string[]): string {
  return cap(segments.join('\n\n'))
}

/** Passages a comparison holds, grouped by the item they were read in. */
export interface ZhihuQuoteSource {
  /** The row the passages came from. */
  readonly row: ZhihuFeedRow
  /** The passages quoted from that row, in the order they were pointed at. */
  readonly segments: readonly string[]
}

/**
 * Add passages read in one row to the comparison.
 * @param sources - the comparison so far.
 * @param row - the row the passages came from.
 * @param segments - the passages this gesture named.
 * @returns the comparison carrying those passages, deduplicated; a row already quoted keeps its place.
 */
export function collectQuote(
  sources: readonly ZhihuQuoteSource[],
  row: ZhihuFeedRow,
  segments: readonly string[],
): readonly ZhihuQuoteSource[] {
  const key = zhihuRowKey(row)
  const at = sources.findIndex(source => zhihuRowKey(source.row) === key)
  if (at === -1) return [...sources, { row, segments }]
  const current = sources[at]
  const merged = current === undefined
    ? segments
    : [...current.segments, ...segments.filter(segment => !current.segments.includes(segment))]
  return sources.map((source, index) => (index === at ? { row, segments: merged } : source))
}

/**
 * Place the bubble against the passage, keeping it inside the viewport.
 * @param rect - the passage's viewport rectangle.
 * @param viewport - the visible viewport.
 * @returns the bubble's fixed left and top.
 */
export function placePassage(rect: QuoteRect, viewport: QuoteViewport): { left: number; top: number } {
  const left = Math.min(
    Math.max(rect.left, QUOTE_MARGIN),
    Math.max(QUOTE_MARGIN, viewport.width - QUOTE_WIDTH - QUOTE_MARGIN),
  )
  const below = rect.bottom + QUOTE_GAP
  const top = below + QUOTE_HEIGHT + QUOTE_MARGIN <= viewport.height
    ? below
    : Math.max(QUOTE_MARGIN, rect.top - QUOTE_GAP - QUOTE_HEIGHT)
  return { left, top }
}

/**
 * Read a block's text; a range reports text as a string, where textContent admits null.
 * @param block - the block whose text the reader pointed at.
 * @returns the block's text.
 */
function blockText(block: Element): string {
  const range = document.createRange()
  range.selectNodeContents(block)
  return range.toString()
}

/**
 * Read the passage the reader just pointed at: the text they selected, or the
 * block they clicked when nothing is selected.
 * @param target - the element the gesture landed on.
 * @returns the passage and where its bubble goes, or undefined when the gesture named no text.
 */
export function readPassage(target: EventTarget | null): ZhihuPassage | undefined {
  const viewport = { width: window.innerWidth, height: window.innerHeight }
  const selection = window.getSelection()
  if (selection !== null && !selection.isCollapsed && selection.rangeCount > 0) {
    const text = passageText(selection.toString())
    if (text === undefined) return undefined
    return { text, ...placePassage(selection.getRangeAt(0).getBoundingClientRect(), viewport) }
  }
  const block = target instanceof Element ? target.closest(BLOCK_SELECTOR) : null
  if (block === null) return undefined
  const text = passageText(blockText(block))
  if (text === undefined) return undefined
  return { text, ...placePassage(block.getBoundingClientRect(), viewport) }
}

/**
 * Ask about one passage, quoting it so the model can find it in the body.
 * @param t - copy of the Zhihu namespace.
 * @param passage - the text the reader pointed at.
 * @param instruction - what the reader asked about it.
 * @returns the instruction, with the passage marked as a quote.
 */
export function zhihuQuotedInstruction(t: ZhihuTranslate, passage: string, instruction: string): string {
  const quote = passage.split('\n').map(line => '> ' + line).join('\n')
  return t('quote.quoted', { quote, instruction })
}
