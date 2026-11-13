/**
 * HTML-to-Markdown conversion for Zhihu content bodies. Zhihu returns rich text as one HTML
 * fragment, the harness renders Markdown, and the exported note wants the same formatting, so the
 * provider converts once here and both consumers read the result.
 *
 * Hand-written rather than a dependency: the fragment uses a narrow tag dialect, and the converter
 * only names the constructs Zhihu emits. An unknown element passes its children through, so an
 * unfamiliar wrapper degrades to its text instead of disappearing.
 * @module @deepseek-ai/dsh-zhihu-plugin/http/markdown
 */

import { decodeEntities } from './html.ts'

/** One parsed element; a text node is a plain string. */
interface Element {
  readonly name: string
  readonly attributes: ReadonlyMap<string, string>
  /** Mutable while parsing; the render pass only reads it. */
  children: Node[]
  readonly parent: Element
}

/** A parsed node: an element or its text. */
type Node = Element | string

/** The parse root, which is its own parent so the close walk never meets an absent ancestor. */
class RootFrame implements Element {
  readonly name = '#root'

  readonly attributes: ReadonlyMap<string, string> = new Map()

  readonly children: Node[] = []

  /** @returns this root, which terminates the walk up the open elements. */
  get parent(): Element {
    return this
  }
}

const COMMENT = /<!--[\s\S]*?-->/g
const INERT = /<(script|style|noscript|template)\b[^>]*>[\s\S]*?<\/\1>/gi
const TOKEN = /<\/?([a-zA-Z][\w-]*)((?:"[^"]*"|'[^']*'|[^"'>])*)\/?>/g
const ATTRIBUTE = /([\w:-]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+)))?/g
const VOID_TAGS = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr'])
const BLOCK_TAGS = new Set([
  'table', 'thead', 'tbody', 'tr', 'td', 'th', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'hr', 'ul', 'ol',
  'li', 'pre', 'p', 'div', 'section', 'article', 'header', 'footer', 'main', 'aside', 'figure',
  'figcaption', 'blockquote',
])
const HEADING = /^h([1-6])$/
const LANGUAGE_PREFIX = /^language-/
const LINK_HOST = /^https?:\/\/link\.zhihu\.com\//i
const TARGET_PARAM = /[?&]target=([^&]+)/
const DISPLAY_FORMULA = /\\begin\{|\\displaystyle/
const ESCAPED = /([*_[\]`<$])/g
const WHITESPACE = /\s+/g
const TRAILING_NEWLINE = /\n+$/
const BLANK_LINE = '\n\n'
const BACKTICK = '`'
/** A hard line break: the backslash form survives both Markdown renderers here. */
const HARD_BREAK = '\\\n'

/**
 * Convert one Zhihu rich-text fragment into GitHub-flavored Markdown.
 * @param html - the `content` field of a Zhihu payload.
 * @returns Markdown keeping headings, emphasis, lists, links, images, formulas, and fenced code.
 */
export function toMarkdown(html: string): string {
  const nodes = parse(html.replace(INERT, '').replace(COMMENT, ''))
  return renderBlocks(nodes).trim()
}

/**
 * Parse one fragment into a node tree, closing elements the markup leaves open.
 * @param html - the fragment with inert elements already removed.
 * @returns the top-level nodes.
 */
function parse(html: string): readonly Node[] {
  const root = new RootFrame()
  let current: Element = root

  const closeTo = (target: Element): void => {
    while (current !== target) {
      const closing: Element = current
      current = closing.parent
      current.children.push(closing)
    }
  }

  let cursor = 0
  for (const match of html.matchAll(TOKEN)) {
    const [raw = '', name = '', attributeText = ''] = match
    if (match.index > cursor) current.children.push(html.slice(cursor, match.index))
    cursor = match.index + raw.length
    const tag = name.toLowerCase()
    if (raw.startsWith('</')) {
      const open = ancestorNamed(current, tag)
      if (open !== undefined) closeTo(open.parent)
      continue
    }
    const element: Element = { name: tag, attributes: attributesOf(attributeText), children: [], parent: current }
    if (raw.endsWith('/>') || VOID_TAGS.has(tag)) {
      current.children.push(element)
      continue
    }
    current = element
  }
  if (cursor < html.length) current.children.push(html.slice(cursor))
  closeTo(root)
  return root.children
}

/**
 * Find the nearest open element of one name.
 * @param from - the innermost open element.
 * @param name - the lowercase tag name an end tag closes.
 * @returns that element, or `undefined` when no open element carries the name.
 */
function ancestorNamed(from: Element, name: string): Element | undefined {
  let frame: Element = from
  while (frame.parent !== frame) {
    if (frame.name === name) return frame
    frame = frame.parent
  }
  return undefined
}

/**
 * Read the attributes of one element.
 * @param text - everything the tag carries between its name and its closing bracket.
 * @returns the attributes by lowercase name, with entity references decoded.
 */
function attributesOf(text: string): ReadonlyMap<string, string> {
  const map = new Map<string, string>()
  text.replace(ATTRIBUTE, (_raw, name: string, doubleQuoted?: string, singleQuoted?: string, bare?: string) => {
    map.set(name.toLowerCase(), decodeEntities(doubleQuoted ?? singleQuoted ?? bare ?? ''))
    return ''
  })
  return map
}

/**
 * Render sibling nodes as blocks.
 * @param nodes - the siblings to render.
 * @returns the blocks separated by one blank line.
 */
function renderBlocks(nodes: readonly Node[]): string {
  const blocks: string[] = []
  let inline = ''
  const flush = (): void => {
    const text = inline.trim()
    inline = ''
    if (text !== '') blocks.push(text)
  }
  const endsBlock = (index: number): boolean => nodes.slice(index + 1)
    .every(rest => typeof rest === 'string' && rest.trim() === '')
  for (const [index, node] of nodes.entries()) {
    if (typeof node === 'string') {
      inline += renderText(node)
      continue
    }
    if (!BLOCK_TAGS.has(node.name)) {
      // A break at the end of its block has nothing to break, and would leave a stray escape.
      if (node.name !== 'br' || !endsBlock(index)) inline += renderInlineElement(node)
      continue
    }
    flush()
    const block = renderBlock(node)
    if (block !== '') blocks.push(block)
  }
  flush()
  return blocks.join(BLANK_LINE)
}

/**
 * Render one block-level element.
 * @param element - the element to render.
 * @returns its Markdown block, or an empty string when it carries no text.
 */
function renderBlock(element: Element): string {
  const heading = HEADING.exec(element.name)
  if (heading !== null) {
    const text = renderInline(element.children).trim()
    return text === '' ? '' : `${'#'.repeat(Number(heading[1]))} ${text}`
  }
  switch (element.name) {
    case 'hr': return '---'
    case 'pre': return renderCodeBlock(element)
    case 'blockquote': return prefixLines(renderBlocks(element.children), '> ')
    case 'ul': return renderList(element, false)
    case 'ol': return renderList(element, true)
    case 'figure': return renderFigure(element)
    case 'table': return renderTable(element)
    default: return renderBlocks(element.children).trim()
  }
}

/**
 * Render the children of one element as inline Markdown.
 * @param nodes - the siblings to render.
 * @returns their Markdown with whitespace collapsed.
 */
function renderInline(nodes: readonly Node[]): string {
  let out = ''
  for (const node of nodes) out += typeof node === 'string' ? renderText(node) : renderInlineElement(node)
  return out
}

/**
 * Render one inline element.
 * @param element - the element to render.
 * @returns its inline Markdown, or an empty string when it renders nothing.
 */
function renderInlineElement(element: Element): string {
  switch (element.name) {
    case 'br': return HARD_BREAK
    case 'img': return renderImage(element, '')
    case 'strong':
    case 'b': return emphasize(element, '**')
    case 'em':
    case 'i': return emphasize(element, '*')
    case 'del':
    case 's':
    case 'strike': return emphasize(element, '~~')
    case 'code': return inlineCode(element)
    case 'a': return renderLink(element)
    default: return renderInline(element.children)
  }
}

/**
 * Wrap one element's text in a pair of markers.
 * @param element - the element to wrap.
 * @param marker - the marker to repeat on both sides.
 * @returns the wrapped text, or an empty string when the element carries none.
 */
function emphasize(element: Element, marker: string): string {
  const inner = renderInline(element.children).trim()
  return inner === '' ? '' : `${marker}${inner}${marker}`
}

/**
 * Render one inline code span.
 * @param element - the element to render.
 * @returns the fenced span, with a wider fence when the text itself carries a backtick.
 */
function inlineCode(element: Element): string {
  const text = rawText(element.children).trim()
  if (text === '') return ''
  if (!text.includes(BACKTICK)) return `${BACKTICK}${text}${BACKTICK}`
  return `\`\` ${text} \`\``
}

/**
 * Render one anchor, resolving Zhihu's redirect wrapper.
 * @param element - the element to render.
 * @returns a Markdown link, or bare text when the anchor carries no target.
 */
function renderLink(element: Element): string {
  const text = renderInline(element.children).trim()
  const href = element.attributes.get('href')
  if (href === undefined || href === '') return text
  const url = resolveHref(href)
  const poster = element.attributes.get('data-poster')
  if (poster !== undefined && poster !== '') {
    // A video link plays nowhere outside Zhihu, so its cover stands in for the player.
    return `![${VIDEO_LABEL}](${poster})\n\n[${text === '' ? VIDEO_LABEL : text}](${url})`
  }
  return text === '' ? url : `[${text}](${url})`
}

/** Names the cover of a video Zhihu will only play on its own site. */
const VIDEO_LABEL = 'video'

/**
 * Resolve one anchor target.
 * @param href - the raw `href`.
 * @returns the target of Zhihu's redirect wrapper, or `href` unchanged for every other link.
 */
function resolveHref(href: string): string {
  if (!LINK_HOST.test(href)) return href
  const target = TARGET_PARAM.exec(href)
  if (target?.[1] === undefined) return href
  try {
    return decodeURIComponent(target[1])
  } catch {
    // A malformed escape is not worth a broken link: keep the wrapper the page handed us.
    return href
  }
}

/**
 * Render one image, or the formula an equation image carries.
 * @param element - the element to render.
 * @param caption - the caption of the enclosing figure, used when the image has no alt text.
 * @returns an image or formula, or an empty string when the element carries no source.
 */
function renderImage(element: Element, caption: string): string {
  const src = imageSource(element)
  const alt = element.attributes.get('alt') ?? ''
  if (alt !== '' && isEquation(element, src)) return formula(alt)
  if (src === undefined || src === '') return ''
  return `![${escapeText(alt === '' ? caption : alt)}](${src})`
}

/**
 * Pick the picture an image element draws.
 *
 * A lazy image ships an inline SVG placeholder in `src` and the real URL elsewhere, so the
 * placeholder is never a candidate: a reader who sees its markup would see a broken picture.
 * @param element - the image element.
 * @returns the http(s) source, or `undefined` when the element only carries a placeholder.
 */
function imageSource(element: Element): string | undefined {
  const candidates = [element.attributes.get('data-actualsrc'), element.attributes.get('data-original'), element.attributes.get('src')]
  const source = candidates.find(value => value !== undefined && value !== '' && !PLACEHOLDER.test(value))
  return source?.startsWith('//') === true ? `https:${source}` : source
}

/** The inline SVG Zhihu ships in `src` until its lazy loader swaps the real picture in. */
const PLACEHOLDER = /^data:/i

/** Zhihu's equation endpoint: the LaTeX lives in `alt`, and the image only draws it. */
const EQUATION_SRC = /^https?:\/\/(?:www\.)?zhihu\.com\/equation\?/

/**
 * Whether one image draws a formula instead of a picture.
 * @param element - the image element.
 * @param src - its source, when it carries one.
 * @returns true for Zhihu's equation images, which are readable as LaTeX only through `alt`.
 */
function isEquation(element: Element, src: string | undefined): boolean {
  return element.attributes.get('eeimg') !== undefined || (src !== undefined && EQUATION_SRC.test(src))
}

/**
 * Render one LaTeX formula.
 * @param latex - the LaTeX source Zhihu keeps in the image's alt text.
 * @returns a display formula for multi-line math, an inline one otherwise.
 */
function formula(latex: string): string {
  return DISPLAY_FORMULA.test(latex) ? `$$${BLANK_LINE}${latex}${BLANK_LINE}$$` : `$${latex}$`
}

/**
 * Render one figure, using its caption as the image's alt text.
 * @param element - the figure to render.
 * @returns the image plus any caption the figure carries without an image.
 */
function renderFigure(element: Element): string {
  const captionElement = element.children.find(
    (child): child is Element => typeof child !== 'string' && child.name === 'figcaption',
  )
  const caption = captionElement === undefined ? '' : renderInline(captionElement.children).trim()
  const blocks: string[] = []
  for (const child of element.children) {
    if (child === captionElement) continue
    const block = typeof child === 'string' || child.name !== 'img'
      ? renderBlocks([child]).trim()
      : renderImage(child, caption)
    if (block !== '') blocks.push(block)
  }
  if (blocks.length > 0) return blocks.join(BLANK_LINE)
  return caption
}

/**
 * Render one table as a pipe table.
 *
 * Zhihu marks its header cells with `th` inside a plain `tbody`, so the first row is the header
 * whether or not the markup says so: a pipe table cannot exist without one.
 * @param element - the `table` element to render.
 * @returns the pipe table, or an empty string when the table carries no cells.
 */
function renderTable(element: Element): string {
  const rows = tableRows(element)
  const widest = rows.reduce((width, cells) => Math.max(width, cells.length), 0)
  if (widest === 0) return ''
  const line = (cells: readonly string[]): string =>
    `| ${Array.from({ length: widest }, (_, index) => cells[index] ?? '').join(' | ')} |`
  const divider = line(Array.from({ length: widest }, () => '---'))
  const [header = [], ...body] = rows
  return [line(header), divider, ...body.map(cells => line(cells))].join('\n')
}

/**
 * Collect the rows of one table, wherever it keeps them.
 * @param element - the `table` element.
 * @returns the rows, in document order.
 */
function tableRows(element: Element): readonly (readonly string[])[] {
  const rows: (readonly string[])[] = []
  for (const child of element.children) {
    if (typeof child === 'string') continue
    if (child.name === 'tr') rows.push(tableRow(child))
    else if (child.name === 'thead' || child.name === 'tbody' || child.name === 'tfoot') rows.push(...tableRows(child))
  }
  return rows
}

/**
 * Render one table row.
 * @param element - the `tr` element.
 * @returns its cells as inline Markdown, one entry per cell.
 */
function tableRow(element: Element): readonly string[] {
  return element.children.flatMap(child =>
    typeof child !== 'string' && (child.name === 'td' || child.name === 'th') ? [tableCell(child)] : [])
}

/**
 * Render one table cell as the single line a pipe row allows.
 * @param element - the `td` or `th` element.
 * @returns its inline Markdown, with line breaks as `<br>` and pipes escaped.
 */
function tableCell(element: Element): string {
  return renderInline(element.children)
    .replaceAll(HARD_BREAK, '<br>')
    .replace(WHITESPACE, ' ')
    .replaceAll('|', '\\|')
    .trim()
}

/**
 * Render one list.
 * @param element - the list to render.
 * @param ordered - whether the items are numbered.
 * @returns one Markdown line per item, with nested blocks indented under their marker.
 */
function renderList(element: Element, ordered: boolean): string {
  const lines: string[] = []
  let index = 1
  for (const child of element.children) {
    if (typeof child === 'string' || child.name !== 'li') continue
    const marker = ordered ? `${index}. ` : '- '
    index += 1
    const body = renderBlocks(child.children).trim()
    if (body === '') continue
    const [head = '', ...rest] = body.split(BLANK_LINE)
    lines.push(`${marker}${head}${rest.map(part => `\n${prefixLines(part, ' '.repeat(marker.length))}`).join('')}`)
  }
  return lines.join('\n')
}

/**
 * Render one fenced code block.
 * @param element - the `pre` element to render.
 * @returns the fenced block, with a wider fence when the code itself carries one.
 */
function renderCodeBlock(element: Element): string {
  const code = element.children.find((child): child is Element => typeof child !== 'string' && child.name === 'code')
  const language = (code?.attributes.get('class') ?? '').replace(LANGUAGE_PREFIX, '')
  const text = rawText(code === undefined ? element.children : code.children).replace(TRAILING_NEWLINE, '')
  const fence = text.includes('```') ? '````' : '```'
  return `${fence}${language === 'text' ? '' : language}\n${text}\n${fence}`
}

/**
 * Collect the literal text of one subtree, keeping its line breaks.
 * @param nodes - the nodes to read.
 * @returns the decoded text with no Markdown syntax applied.
 */
function rawText(nodes: readonly Node[]): string {
  let out = ''
  for (const node of nodes) {
    if (typeof node === 'string') {
      out += decodeEntities(node)
      continue
    }
    out += node.name === 'br' ? '\n' : rawText(node.children)
  }
  return out
}

/**
 * Render one text node.
 * @param text - the raw text node.
 * @returns the decoded text with whitespace collapsed and Markdown markers escaped.
 */
function renderText(text: string): string {
  return escapeText(decodeEntities(text).replace(WHITESPACE, ' '))
}

/**
 * Escape the Markdown markers that may appear inside prose.
 * @param text - the text to escape.
 * @returns the text with emphasis, link, code, and angle brackets neutralized.
 */
function escapeText(text: string): string {
  return text.replace(ESCAPED, '\\$1')
}

/**
 * Prefix every line of one block.
 * @param text - the block to prefix.
 * @param prefix - the marker to put before each line.
 * @returns the block with every line prefixed, blank lines keeping the marker alone.
 */
function prefixLines(text: string, prefix: string): string {
  return text.split('\n').map(line => line === '' ? prefix.trimEnd() : `${prefix}${line}`).join('\n')
}
