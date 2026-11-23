/**
 * The passage a reader points at, and the instruction that carries it into the
 * row's discussion.
 *
 * The quoted text is the locator. The reader renders one body (`contentMarkdown`)
 * while the model reads another (`contentText`), so a line number counted on the
 * rendered text would name nothing on the model's side; text that appears in both
 * does.
 */
import type { ZhihuFeedRow } from '@deepseek-ai/dsh-zhihu-plugin/types';
import type { ZhihuTranslate } from './ZhihuContent.tsx';
/** The longest passage one instruction carries; the full body stays one `zhihu_read` away. */
export declare const QUOTE_MAX_CHARS = 1200;
/** One passage the reader pointed at, placed in viewport pixels. */
export interface ZhihuPassage {
    /** The text the instruction quotes, whitespace collapsed and capped. */
    readonly text: string;
    /** Left edge of the bubble. */
    readonly left: number;
    /** Top edge of the bubble. */
    readonly top: number;
    /** Width of the bubble, capped to the area it opens in. */
    readonly width: number;
}
/** A rectangle in viewport pixels; a `DOMRect` satisfies it. */
export interface QuoteRect {
    readonly left: number;
    readonly top: number;
    readonly bottom: number;
}
/** The area the bubble must stay inside, in viewport pixels; a pane is narrower than the window. */
export interface QuoteViewport {
    /** Left edge of the area. */
    readonly left: number;
    /** Top edge of the area. */
    readonly top: number;
    /** Width of the area. */
    readonly width: number;
    /** Height of the area. */
    readonly height: number;
}
/**
 * Add a passage to the ones an instruction quotes, or take back one it already has.
 * @param segments - the passages quoted so far, in the order they were pointed at.
 * @param text - the passage this gesture named.
 * @returns the passages to quote next; naming a quoted passage again removes it.
 */
export declare function toggleSegment(segments: readonly string[], text: string): readonly string[];
/**
 * Join the passages one instruction quotes into the text it carries.
 * @param segments - the passages quoted, in the order they were pointed at.
 * @returns the passages separated by a blank line, capped as a whole.
 */
export declare function segmentsText(segments: readonly string[]): string;
/** Passages a comparison holds, grouped by the item they were read in. */
export interface ZhihuQuoteSource {
    /** The row the passages came from. */
    readonly row: ZhihuFeedRow;
    /** The passages quoted from that row, in the order they were pointed at. */
    readonly segments: readonly string[];
}
/**
 * Add passages read in one row to the comparison.
 * @param sources - the comparison so far.
 * @param row - the row the passages came from.
 * @param segments - the passages this gesture named.
 * @returns the comparison carrying those passages, deduplicated; a row already quoted keeps its place.
 */
export declare function collectQuote(sources: readonly ZhihuQuoteSource[], row: ZhihuFeedRow, segments: readonly string[]): readonly ZhihuQuoteSource[];
/**
 * Place the bubble against the passage, keeping it inside the area it opens in
 * and no wider than that area leaves room for.
 * @param rect - the passage's viewport rectangle.
 * @param area - the area the bubble must stay inside.
 * @returns the bubble's fixed left, top and width.
 */
export declare function placePassage(rect: QuoteRect, area: QuoteViewport): {
    left: number;
    top: number;
    width: number;
};
/**
 * Read the passage the reader just pointed at: the text they selected, or the
 * block they clicked when nothing is selected.
 * @param target - the element the gesture landed on.
 * @returns the passage and where its bubble goes, or undefined when the gesture named no text.
 */
export declare function readPassage(target: EventTarget | null): ZhihuPassage | undefined;
/**
 * Ask about one passage, quoting it so the model can find it in the body.
 * @param t - copy of the Zhihu namespace.
 * @param passage - the text the reader pointed at.
 * @param instruction - what the reader asked about it.
 * @returns the instruction, with the passage marked as a quote.
 */
export declare function zhihuQuotedInstruction(t: ZhihuTranslate, passage: string, instruction: string): string;
/**
 * Cite one passage the way a note records it: the text quoted, then where it came from.
 * @param text - the passage the reader selected.
 * @param title - title of the row it came from.
 * @param url - canonical URL of that row.
 * @returns the passage as a Markdown blockquote followed by a link to its source.
 */
export declare function zhihuCitation(text: string, title: string, url: string): string;
//# sourceMappingURL=zhihu-quote.d.ts.map