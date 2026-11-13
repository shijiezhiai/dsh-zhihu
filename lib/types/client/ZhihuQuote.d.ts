import type { ReactNode } from 'react';
import type { ZhihuTranslate } from './ZhihuContent.tsx';
import type { ZhihuPassage } from './zhihu-quote.ts';
/** Inputs for {@link ZhihuQuoteBox}. */
export interface ZhihuQuoteBoxProps {
    /** The passage and where its bubble sits. */
    readonly passage: ZhihuPassage;
    /** How many blocks the reader merged into that passage; one means a single block. */
    readonly count: number;
    /** Copy of the Zhihu namespace. */
    readonly t: ZhihuTranslate;
    /** Called with what to ask about the passage. */
    readonly onAsk: (instruction: string) => void;
    /** Called when the reader files the passage into the comparison instead of asking about it. */
    readonly onCollect: () => void;
}
/**
 * Render the passage bubble. The page owns everything that dismisses it, so the
 * bubble only collects the question.
 * @param props - the passage, the copy and the ask handler.
 * @returns the bubble, carrying the passage above its questions.
 */
export declare function ZhihuQuoteBox({ passage, count, t, onAsk, onCollect }: ZhihuQuoteBoxProps): ReactNode;
//# sourceMappingURL=ZhihuQuote.d.ts.map