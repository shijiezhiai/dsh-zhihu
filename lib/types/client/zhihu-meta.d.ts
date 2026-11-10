/**
 * Narrowing for the persisted `presentationMeta` rows of `zhihu_feed`, `zhihu_search`, and `zhihu_read`.
 * Metadata is replayed from the session log, so every reader is total and answers `undefined` for a
 * layout it does not recognize; the cards then render the compact generic presentation.
 */
import type { ContentBlock } from '@deepseek-ai/dsh-llm/types';
/** Entry kinds shared by the three Zhihu tools. */
export type ZhihuEntryKind = 'question' | 'answer' | 'article';
/** One feed or search row as the tool records it. */
export interface ZhihuEntryRow {
    readonly kind: ZhihuEntryKind;
    readonly id: string;
    readonly title: string;
    readonly url: string;
    readonly heatLabel?: string;
}
/** One read row; the answer body never lands in metadata. */
export interface ZhihuReadRow extends ZhihuEntryRow {
    readonly voteupCount: number;
    readonly author: string;
}
/** Feed rows, count, and truncation collected from `zhihu_feed` metadata. */
export interface ZhihuFeedFacts {
    readonly kind: 'hot' | 'recommend';
    readonly count: number;
    readonly truncated: boolean;
    readonly rows: readonly ZhihuEntryRow[];
}
/** Search rows, query, and truncation collected from `zhihu_search` metadata. */
export interface ZhihuSearchFacts {
    readonly kind: 'search';
    readonly query: string;
    readonly count: number;
    readonly truncated: boolean;
    readonly rows: readonly ZhihuEntryRow[];
}
/** The single item collected from `zhihu_read` metadata. */
export interface ZhihuReadFacts {
    readonly kind: ZhihuEntryKind;
    readonly id: string;
    readonly row: ZhihuReadRow;
    readonly truncated: boolean;
}
/**
 * Read feed facts from a recorded `zhihu_feed` result metadata value.
 * @param meta - the unvalidated `presentationMeta` of the result.
 * @returns the feed facts, or undefined when the metadata has another layout.
 */
export declare function feedFacts(meta: unknown): ZhihuFeedFacts | undefined;
/**
 * Read search facts from a recorded `zhihu_search` result metadata value.
 * @param meta - the unvalidated `presentationMeta` of the result.
 * @returns the search facts, or undefined when the metadata has another layout.
 */
export declare function searchFacts(meta: unknown): ZhihuSearchFacts | undefined;
/**
 * Read facts from a recorded `zhihu_read` result metadata value.
 * @param meta - the unvalidated `presentationMeta` of the result.
 * @returns the read facts, or undefined when the metadata has another layout.
 */
export declare function readFacts(meta: unknown): ZhihuReadFacts | undefined;
/**
 * Concatenate the text blocks of a recorded result.
 * @param content - the result content blocks.
 * @returns the text blocks joined by newlines.
 */
export declare function plainText(content: readonly ContentBlock[]): string;
/**
 * Recover the answer body from a `zhihu_read` result text. The tool formats that text as the
 * untrusted-content notice, one header line, the body, then one note block, all separated by blank
 * lines; body paragraphs keep their own blank lines, so only the outer blocks are trimmed.
 * @param text - the recorded result text.
 * @returns the body, or undefined when the text is not in that layout.
 */
export declare function readBody(text: string): string | undefined;
//# sourceMappingURL=zhihu-meta.d.ts.map