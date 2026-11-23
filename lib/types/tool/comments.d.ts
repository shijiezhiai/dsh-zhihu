/**
 * `zhihu_comments`: the root comments of one Zhihu question, answer, or article, read through the
 * `ctx.zhihu` seam as a smell test on the content itself.
 *
 * @module @deepseek-ai/dsh-zhihu-plugin/tool/comments
 */
import type { Context } from '@deepseek-ai/cordis';
import type { ZhihuComment, ZhihuContentKind } from '../service/index.ts';
import type { GenericCallView, GenericResultView, ToolResult } from '@deepseek-ai/dsh-tools';
import type { JsonValue } from '@deepseek-ai/dsh-util-values';
import type { ZhihuToolLimits } from './shared.ts';
/** Registered name of the comments tool. */
export declare const COMMENTS_TOOL_NAME = "zhihu_comments";
/** One comment in the tool's canonical value. */
export interface ZhihuCommentItemValue {
    /** Zhihu comment id, kept as the provider's decimal string. */
    readonly id: string;
    /** Comment author; empty when the payload carries none. */
    readonly author: string;
    /** Bounded comment text. */
    readonly text: string;
    /** Upvotes of the comment. */
    readonly likes: number;
    /** Replies the comment collected. */
    readonly replies: number;
    /** Creation time in epoch seconds; absent when the payload carried none. */
    readonly createdTime?: number;
}
/** The comments tool's canonical output value. */
export interface ZhihuCommentsValue {
    /** Which operation produced the value. */
    readonly kind: 'comments';
    /** The content kind the comments belong to. */
    readonly target: ZhihuContentKind;
    /** The content id the comments belong to. */
    readonly id: string;
    /** The limit this call requested, after clamping. */
    readonly limit: number;
    /** How many root comments the content has; absent when the payload carried none. */
    readonly total?: number;
    /** Returned comments, in the order the endpoint ranked them. */
    readonly items: readonly ZhihuCommentItemValue[];
    /** True when the call reached the requested limit, so more comments may exist. */
    readonly truncated: boolean;
}
/** One comment as the replayable presentation meta carries it. */
export type ZhihuCommentItemMeta = {
    id: string;
    author: string;
    likes: number;
};
/** The comments tool's replayable presentation meta: bounded facts and no comment text. */
export type ZhihuCommentsMeta = {
    kind: 'comments';
    target: ZhihuContentKind;
    id: string;
    limit: number;
    count: number;
    total?: number;
    items: ZhihuCommentItemMeta[];
    truncated: boolean;
};
/**
 * Project one seam comment into the canonical value, bounding its text so the value, the render
 * text, and the meta stay the same size.
 * @param comment - one comment from `ctx.zhihu.comments`.
 * @param excerptMaxChars - the deployment's text cap.
 * @returns the comment's canonical form.
 */
export declare function projectComment(comment: ZhihuComment, excerptMaxChars: number): ZhihuCommentItemValue;
/**
 * Reduce the canonical value to the replayable facts a card needs. Comment text stays out so the
 * meta is bounded and carries no reader-written body.
 * @param value - the canonical comments value.
 * @returns the bounded presentation meta.
 */
export declare function commentsMeta(value: ZhihuCommentsValue): JsonValue;
/**
 * Render the comments for the model: the untrusted-content notice, how much of the thread this is,
 * one line per comment, and how to read on.
 * @param value - the canonical comments value.
 * @returns the model-facing text.
 */
export declare function formatCommentsOutput(value: ZhihuCommentsValue): string;
/**
 * Present a pending `zhihu_comments` call.
 * @param args - presenter arguments from the session log.
 * @returns the generic card view, or undefined for the default card.
 */
export declare function presentCommentsCall(args: unknown): GenericCallView | undefined;
/**
 * Present a completed `zhihu_comments` result.
 * @param args - presenter arguments from the session log.
 * @param result - the final model-facing result.
 * @returns the generic card view, or undefined for the default card.
 */
export declare function presentCommentsResult(args: unknown, result: ToolResult): GenericResultView | undefined;
/**
 * Register `zhihu_comments` on the calling context.
 * @param ctx - context providing the tool registry and the Zhihu service.
 * @param limits - deployment caps resolved from the plugin config.
 */
export declare function applyZhihuCommentsTool(ctx: Context, limits: ZhihuToolLimits): void;
//# sourceMappingURL=comments.d.ts.map