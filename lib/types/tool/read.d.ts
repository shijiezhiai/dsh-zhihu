/**
 * `zhihu_read`: the answer list of one question, or the full text of one answer,
 * read through the `ctx.zhihu` seam.
 *
 * @module @deepseek-ai/dsh-zhihu-plugin/tool/read
 */
import type { Context } from '@deepseek-ai/cordis';
import type { ZhihuReadKind } from '../service/index.ts';
import type { GenericCallView, GenericResultView, ToolResult } from '@deepseek-ai/dsh-tools';
import type { JsonValue } from '@deepseek-ai/dsh-util-values';
import type { ZhihuToolLimits } from './shared.ts';
/** Registered name of the read tool. */
export declare const READ_TOOL_NAME = "zhihu_read";
/** The read content in the tool's canonical value. */
export interface ZhihuReadItemValue {
    /** Content kind that was read. */
    readonly kind: ZhihuReadKind;
    /** Zhihu content id, kept as the provider's decimal string. */
    readonly id: string;
    /** Content title. */
    readonly title: string;
    /** Canonical URL of the content. */
    readonly url: string;
    /** Upvote count the provider reported. */
    readonly voteupCount: number;
    /** Author name, empty when the provider reports none. */
    readonly author: string;
}
/** The read tool's canonical output value. */
export interface ZhihuReadValue {
    /** Content kind that was read. */
    readonly kind: ZhihuReadKind;
    /** Content id that was read. */
    readonly id: string;
    /** Answer limit this call requested, when it requested one for a question. */
    readonly answerLimit?: number;
    /** The content facts, without the body text. */
    readonly item: ZhihuReadItemValue;
    /** The body text the model reads. */
    readonly contentText: string;
    /** True when the provider cut the body text at its cap. */
    readonly contentTruncated: boolean;
}
/** The read content as the replayable presentation meta carries it. */
export type ZhihuReadItemMeta = {
    kind: ZhihuReadKind;
    id: string;
    title: string;
    url: string;
    voteupCount: number;
    author: string;
};
/** The read tool's replayable presentation meta: bounded facts and no body text. */
export type ZhihuReadMeta = {
    kind: ZhihuReadKind;
    id: string;
    count: number;
    items: ZhihuReadItemMeta[];
    contentTruncated: boolean;
};
/**
 * Render the read content for the model: the untrusted-content notice, the
 * content facts, the body, and what the text is good for.
 * @param value - the canonical read value.
 * @returns the model-facing text.
 */
export declare function formatReadOutput(value: ZhihuReadValue): string;
/**
 * Reduce the canonical value to the replayable facts a card needs. The body text
 * stays out so the meta is bounded.
 * @param value - the canonical read value.
 * @returns the bounded presentation meta.
 */
export declare function readMeta(value: ZhihuReadValue): JsonValue;
/**
 * Present a pending `zhihu_read` call.
 * @param args - presenter arguments from the session log.
 * @returns the generic card view, or undefined for the default card.
 */
export declare function presentReadCall(args: unknown): GenericCallView | undefined;
/**
 * Present a completed `zhihu_read` result.
 * @param args - presenter arguments from the session log.
 * @param result - the final model-facing result.
 * @returns the generic card view, or undefined for the default card.
 */
export declare function presentReadResult(args: unknown, result: ToolResult): GenericResultView | undefined;
/**
 * Register `zhihu_read` on the calling context.
 * @param ctx - context providing the tool registry and the Zhihu service.
 * @param limits - deployment caps resolved from the plugin config.
 */
export declare function applyZhihuReadTool(ctx: Context, limits: ZhihuToolLimits): void;
//# sourceMappingURL=read.d.ts.map