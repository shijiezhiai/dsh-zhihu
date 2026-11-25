/**
 * `zhihu_watch`: follow one Zhihu keyword lane through the Host Schedule
 * service, so a recurring reminder reports what arrived since the last check.
 *
 * @module @deepseek-ai/dsh-zhihu-plugin/tool/watch
 */
import type { Context } from '@deepseek-ai/cordis';
import type { GenericCallView, GenericResultView, ToolResult } from '@deepseek-ai/dsh-tools';
import type { JsonValue } from '@deepseek-ai/dsh-util-values';
import type { ZhihuFeedItem } from '../service/index.ts';
import type { ZhihuToolLimits } from './shared.ts';
/** Registered name of the watch tool. */
export declare const WATCH_TOOL_NAME = "zhihu_watch";
/** What one call does with a watched keyword. */
export type ZhihuWatchAction = 'start' | 'check' | 'stop';
/** One entry a check reported as new. */
export interface ZhihuWatchItemValue {
    /** Content kind of the entry. */
    readonly kind: 'question' | 'answer' | 'article';
    /** Zhihu content id, kept as the provider's decimal string. */
    readonly id: string;
    /** Entry title. */
    readonly title: string;
    /** Canonical URL of the entry. */
    readonly url: string;
    /** Provider heat label, when the entry carries one. */
    readonly heatLabel?: string;
}
/** The reminder a `start` call created. */
export interface ZhihuWatchScheduleValue {
    /** Host reminder id. */
    readonly id: string;
    /** Reminder title, which also names the watch the call created. */
    readonly title: string;
    /** Interval between checks, in seconds. */
    readonly everySeconds: number;
}
/** The watch tool's canonical output value. */
export interface ZhihuWatchValue {
    /** Action this call took. */
    readonly action: ZhihuWatchAction;
    /** Keyword the call watched. */
    readonly keyword: string;
    /** Entries the lane held when the call read it. */
    readonly scanned: number;
    /** Entries this call had not seen before, in lane order. */
    readonly items: ZhihuWatchItemValue[];
    /** True when the call recorded a baseline instead of comparing against one. */
    readonly baselineOnly: boolean;
    /** Reminder the call created, for `start`. */
    readonly schedule?: ZhihuWatchScheduleValue;
    /** Reminders the call removed, for `stop`. */
    readonly removed?: number;
}
/** The watch tool's replayable presentation meta. */
export type ZhihuWatchMeta = {
    action: ZhihuWatchAction;
    keyword: string;
    scanned: number;
    count: number;
    baselineOnly: boolean;
    items: ZhihuWatchItemValue[];
};
/**
 * Compose the reminder title for one keyword, within the Host title cap.
 * @param keyword - the watched keyword.
 * @returns a title that `stop` recognizes.
 */
export declare function watchTitle(keyword: string): string;
/**
 * Compose the follow-up text a scheduled check delivers into the Session.
 * @param keyword - the watched keyword.
 * @returns the reminder prompt.
 */
export declare function watchPrompt(keyword: string): string;
/**
 * Project one lane entry into the canonical value.
 * @param item - one entry from `ctx.zhihu.feed`.
 * @returns the entry's canonical form, excerpt omitted so a reminder stays short.
 */
export declare function projectWatchItem(item: ZhihuFeedItem): ZhihuWatchItemValue;
/**
 * Reduce the canonical value to the replayable facts a card needs.
 * @param value - the canonical watch value.
 * @returns the bounded presentation meta.
 */
export declare function watchMeta(value: ZhihuWatchValue): JsonValue;
/**
 * Render the watch result for the model.
 * @param value - the canonical watch value.
 * @returns the model-facing text.
 */
export declare function formatWatchOutput(value: ZhihuWatchValue): string;
/**
 * Present a pending `zhihu_watch` call.
 * @param args - presenter arguments from the session log.
 * @returns the generic card view, or undefined for the default card.
 */
export declare function presentWatchCall(args: unknown): GenericCallView | undefined;
/**
 * Present a completed `zhihu_watch` result.
 * @param args - presenter arguments from the session log.
 * @param result - the final model-facing result.
 * @returns the generic card view, or undefined for the default card.
 */
export declare function presentWatchResult(args: unknown, result: ToolResult): GenericResultView | undefined;
/**
 * Register `zhihu_watch` on a context that provides the Zhihu seam and the Host
 * Schedule service.
 * @param ctx - context providing the tool registry, the Zhihu seam and `schedule`.
 * @param limits - deployment caps resolved from the plugin config.
 */
export declare function applyZhihuWatchTool(ctx: Context, limits: ZhihuToolLimits): void;
//# sourceMappingURL=watch.d.ts.map