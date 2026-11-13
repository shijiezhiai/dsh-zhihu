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
/**
 * Convert one Zhihu rich-text fragment into GitHub-flavored Markdown.
 * @param html - the `content` field of a Zhihu payload.
 * @returns Markdown keeping headings, emphasis, lists, tables, links, images, formulas, and fenced code.
 */
export declare function toMarkdown(html: string): string;
//# sourceMappingURL=markdown.d.ts.map