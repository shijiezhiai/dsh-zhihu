/**
 * Minimal HTML-to-text conversion for Zhihu content. Hand-written rather than a dependency: the
 * provider only needs readable text for a model, so script and style bodies, comments, and tags are
 * dropped, block boundaries become newlines, the common entities are decoded, and runs of
 * whitespace collapse.
 * @module @deepseek-ai/dsh-zhihu-plugin/http/html
 */
/**
 * Convert one HTML fragment into readable plain text.
 * @param html - the rich-text fragment from a Zhihu payload.
 * @returns text with markup removed and whitespace collapsed.
 */
export declare function toPlainText(html: string): string;
/**
 * Convert one search field into plain text.
 *
 * Search highlights arrive either as raw markup or entity-escaped, so the text is unescaped before
 * its tags are dropped; a body keeps {@link toPlainText} alone, where an escaped tag is content.
 * @param markup - the search title or excerpt from a Zhihu payload.
 * @returns text with highlight markup removed and whitespace collapsed.
 */
export declare function toSearchText(markup: string): string;
/**
 * Cap plain text to a character budget.
 * @param text - plain text to cap.
 * @param limit - maximum number of characters to keep.
 * @returns the capped text plus whether anything was dropped.
 */
export declare function capText(text: string, limit: number): {
    readonly text: string;
    readonly truncated: boolean;
};
/**
 * Decode numeric and common named HTML entities.
 * @param text - text containing entity references.
 * @returns text with known entities replaced; unknown ones stay literal.
 */
export declare function decodeEntities(text: string): string;
//# sourceMappingURL=html.d.ts.map