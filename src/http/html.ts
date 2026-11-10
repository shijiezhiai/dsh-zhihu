/**
 * Minimal HTML-to-text conversion for Zhihu content. Hand-written rather than a dependency: the
 * provider only needs readable text for a model, so script and style bodies, comments, and tags are
 * dropped, block boundaries become newlines, the common entities are decoded, and runs of
 * whitespace collapse.
 * @module @deepseek-ai/dsh-zhihu-plugin/http/html
 */

/** Block-level tag names whose boundaries separate paragraphs. */
const BLOCK_TAGS = 'p|div|br|li|ul|ol|tr|table|section|article|header|footer|blockquote|pre|h[1-6]'
const BLOCK_BOUNDARY = new RegExp(`</?(?:${BLOCK_TAGS})\\b[^>]*>`, 'gi')
const SCRIPT_OR_STYLE = /<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi
const COMMENT = /<!--[\s\S]*?-->/g
const ANY_TAG = /<[^>]+>/g
const NUMERIC_ENTITY = /&#(\d+);/g
const HEX_ENTITY = /&#x([\da-f]+);/gi
const NAMED_ENTITY = /&([a-z]+);/gi
const HORIZONTAL_SPACE = /[ \t\f\v\u00a0]+/g
const SPACE_AROUND_NEWLINE = /[ ]*\n[ ]*/g
const BLANK_RUN = /\n{3,}/g

/** Named entities Zhihu content actually uses. */
const NAMED: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
  mdash: '—',
  ndash: '–',
  hellip: '…',
  ldquo: '“',
  rdquo: '”',
  lsquo: '‘',
  rsquo: '’',
  middot: '·',
  times: '×',
}

/** The largest code point `String.fromCodePoint` accepts. */
const MAX_CODE_POINT = 0x10ffff

/**
 * Convert one HTML fragment into readable plain text.
 * @param html - the rich-text fragment from a Zhihu payload.
 * @returns text with markup removed and whitespace collapsed.
 */
export function toPlainText(html: string): string {
  const withoutScripts = html.replace(SCRIPT_OR_STYLE, '').replace(COMMENT, '')
  const withBreaks = withoutScripts.replace(BLOCK_BOUNDARY, '\n')
  const withoutTags = withBreaks.replace(ANY_TAG, '')
  const decoded = decodeEntities(withoutTags)
  return decoded
    .replace(HORIZONTAL_SPACE, ' ')
    .replace(SPACE_AROUND_NEWLINE, '\n')
    .replace(BLANK_RUN, '\n\n')
    .trim()
}

/**
 * Convert one search field into plain text.
 *
 * Search highlights arrive either as raw markup or entity-escaped, so the text is unescaped before
 * its tags are dropped; a body keeps {@link toPlainText} alone, where an escaped tag is content.
 * @param markup - the search title or excerpt from a Zhihu payload.
 * @returns text with highlight markup removed and whitespace collapsed.
 */
export function toSearchText(markup: string): string {
  return toPlainText(decodeEntities(markup))
}

/**
 * Cap plain text to a character budget.
 * @param text - plain text to cap.
 * @param limit - maximum number of characters to keep.
 * @returns the capped text plus whether anything was dropped.
 */
export function capText(text: string, limit: number): { readonly text: string; readonly truncated: boolean } {
  if (text.length <= limit) return { text, truncated: false }
  return { text: text.slice(0, limit), truncated: true }
}

/**
 * Decode numeric and common named HTML entities.
 * @param text - text containing entity references.
 * @returns text with known entities replaced; unknown ones stay literal.
 */
export function decodeEntities(text: string): string {
  return text
    .replace(NUMERIC_ENTITY, (_match, code: string) => fromCodePoint(Number(code)))
    .replace(HEX_ENTITY, (_match, code: string) => fromCodePoint(Number.parseInt(code, 16)))
    .replace(NAMED_ENTITY, (match, name: string) => NAMED[name.toLowerCase()] ?? match)
}

/**
 * Render one code point.
 * @param code - the referenced code point.
 * @returns the character, or U+FFFD when the reference is not a code point.
 */
function fromCodePoint(code: number): string {
  if (!Number.isFinite(code) || code < 0 || code > MAX_CODE_POINT) return '\uFFFD'
  return String.fromCodePoint(code)
}
