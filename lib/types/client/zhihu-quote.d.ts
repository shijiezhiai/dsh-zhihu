/**
 * The passage a reader points at, and the instruction that carries it into the
 * row's discussion.
 *
 * The quoted text is the locator. The reader renders one body (`contentMarkdown`)
 * while the model reads another (`contentText`), so a line number counted on the
 * rendered text would name nothing on the model's side; text that appears in both
 * does.
 */
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
}
/** A rectangle in viewport pixels; a `DOMRect` satisfies it. */
export interface QuoteRect {
    readonly left: number;
    readonly top: number;
    readonly bottom: number;
}
/** The visible viewport in CSS pixels. */
export interface QuoteViewport {
    readonly width: number;
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
/**
 * Place the bubble against the passage, keeping it inside the viewport.
 * @param rect - the passage's viewport rectangle.
 * @param viewport - the visible viewport.
 * @returns the bubble's fixed left and top.
 */
export declare function placePassage(rect: QuoteRect, viewport: QuoteViewport): {
    left: number;
    top: number;
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
//# sourceMappingURL=zhihu-quote.d.ts.map