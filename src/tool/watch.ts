/**
 * `zhihu_watch`: follow one Zhihu keyword lane through the Host Schedule
 * service, so a recurring reminder reports what arrived since the last check.
 *
 * @module @deepseek-ai/dsh-zhihu-plugin/tool/watch
 */

import type { Context } from '@deepseek-ai/cordis'
import type { ScheduleCatalogEntry, ScheduleService } from '@deepseek-ai/dsh-schedule'
import { defineTool } from '@deepseek-ai/dsh-tools'
import type { GenericCallView, GenericResultView, ToolResult } from '@deepseek-ai/dsh-tools'
import type { JsonValue } from '@deepseek-ai/dsh-util-values'
import type { ZhihuFeedItem } from '../service/index.ts'
import {
  describeZhihuFailure, formatEntryLine, readString, requireText, ZHIHU_UNTRUSTED_CONTENT_NOTICE,
} from './shared.ts'
import type { ZhihuToolLimits } from './shared.ts'

/** Registered name of the watch tool. */
export const WATCH_TOOL_NAME = 'zhihu_watch'

/** What one call does with a watched keyword. */
export type ZhihuWatchAction = 'start' | 'check' | 'stop'

/** Every action the tool offers, in schema order. */
const WATCH_ACTIONS: readonly ZhihuWatchAction[] = ['start', 'check', 'stop']

/** Smallest interval the Host Schedule service accepts, in minutes. */
const MIN_MINUTES = 1

/** Largest interval this tool accepts, in minutes: one day. */
const MAX_MINUTES = 1_440

/** How many entry ids one keyword keeps as its baseline. */
const BASELINE_IDS = 200

/** Prefix every reminder this tool creates carries, so `stop` recognizes its own. */
const TITLE_PREFIX = 'Zhihu watch: '

/** Host cap on a reminder title, in characters. */
const TITLE_MAX_CHARS = 120

/** One entry a check reported as new. */
export interface ZhihuWatchItemValue {
  /** Content kind of the entry. */
  readonly kind: 'question' | 'answer' | 'article'
  /** Zhihu content id, kept as the provider's decimal string. */
  readonly id: string
  /** Entry title. */
  readonly title: string
  /** Canonical URL of the entry. */
  readonly url: string
  /** Provider heat label, when the entry carries one. */
  readonly heatLabel?: string
}

/** The reminder a `start` call created. */
export interface ZhihuWatchScheduleValue {
  /** Host reminder id. */
  readonly id: string
  /** Reminder title, which also names the watch the call created. */
  readonly title: string
  /** Interval between checks, in seconds. */
  readonly everySeconds: number
}

/** The watch tool's canonical output value. */
export interface ZhihuWatchValue {
  /** Action this call took. */
  readonly action: ZhihuWatchAction
  /** Keyword the call watched. */
  readonly keyword: string
  /** Entries the lane held when the call read it. */
  readonly scanned: number
  /** Entries this call had not seen before, in lane order. */
  readonly items: ZhihuWatchItemValue[]
  /** True when the call recorded a baseline instead of comparing against one. */
  readonly baselineOnly: boolean
  /** Reminder the call created, for `start`. */
  readonly schedule?: ZhihuWatchScheduleValue
  /** Reminders the call removed, for `stop`. */
  readonly removed?: number
}

/** The watch tool's replayable presentation meta. */
export type ZhihuWatchMeta = {
  action: ZhihuWatchAction
  keyword: string
  scanned: number
  count: number
  baselineOnly: boolean
  items: ZhihuWatchItemValue[]
}

const WATCH_DESCRIPTION = 'Follow one Zhihu keyword lane on a schedule. action \'start\' reads the lane as it stands, records that as the baseline and asks the Host to send this Session a follow-up every everyMinutes; action \'check\' reports only the entries the lane gained since the last start or check of that keyword; action \'stop\' removes the reminder this tool created for that keyword. Each reported entry carries its title and its link, which is what the reminder has to name. The lane is the one zhihu_feed reads with kind \'topic\'. Zhihu content needs the account\'s login state. The reminder is a Host task bound to this Session, so a paused Session receives it when it resumes. A start refuses instead of duplicating a reminder that already watches the keyword.'

/**
 * Compose the reminder title for one keyword, within the Host title cap.
 * @param keyword - the watched keyword.
 * @returns a title that `stop` recognizes.
 */
export function watchTitle(keyword: string): string {
  return `${TITLE_PREFIX}${keyword}`.slice(0, TITLE_MAX_CHARS)
}

/**
 * Compose the follow-up text a scheduled check delivers into the Session.
 * @param keyword - the watched keyword.
 * @returns the reminder prompt.
 */
export function watchPrompt(keyword: string): string {
  return `Zhihu keyword "${keyword}" may have gained entries. Call ${WATCH_TOOL_NAME} with action "check" and that keyword, then report only the entries it marks as new, each with its title and its link. When it reports none, answer in one line that nothing new arrived.`
}

/**
 * Project one lane entry into the canonical value.
 * @param item - one entry from `ctx.zhihu.feed`.
 * @returns the entry's canonical form, excerpt omitted so a reminder stays short.
 */
export function projectWatchItem(item: ZhihuFeedItem): ZhihuWatchItemValue {
  return {
    kind: item.kind,
    id: item.id,
    title: item.title,
    url: item.url,
    ...(item.heatLabel === undefined ? {} : { heatLabel: item.heatLabel }),
  }
}

/**
 * Reduce the canonical value to the replayable facts a card needs.
 * @param value - the canonical watch value.
 * @returns the bounded presentation meta.
 */
export function watchMeta(value: ZhihuWatchValue): JsonValue {
  return {
    action: value.action,
    keyword: value.keyword,
    scanned: value.scanned,
    count: value.items.length,
    baselineOnly: value.baselineOnly,
    items: value.items.map(item => ({ ...item })),
  }
}

/**
 * Render the watch result for the model.
 * @param value - the canonical watch value.
 * @returns the model-facing text.
 */
export function formatWatchOutput(value: ZhihuWatchValue): string {
  const head = `Zhihu keyword "${value.keyword}"`
  if (value.action === 'stop') {
    const removed = value.removed ?? 0
    return removed === 0
      ? `No reminder was watching ${head}.`
      : `Stopped ${head}: removed ${removed} reminder(s).`
  }
  const watching = value.schedule === undefined
    ? ''
    : ` Watching every ${Math.round(value.schedule.everySeconds / 60)} minute(s) as reminder ${value.schedule.id}.`
  if (value.baselineOnly) {
    return `Recorded ${head} as the baseline: ${value.scanned} entries. Later checks report what arrives after it.${watching}`
  }
  if (value.items.length === 0) return `Nothing new on ${head} (${value.scanned} entries scanned).${watching}`
  const body = value.items.map(item => formatEntryLine({ ...item, excerpt: '' })).join('\n')
  return [ZHIHU_UNTRUSTED_CONTENT_NOTICE, `New on ${head} (${value.scanned} entries scanned):\n\n${body}${watching}`].join('\n\n')
}

/**
 * Present a pending `zhihu_watch` call.
 * @param args - presenter arguments from the session log.
 * @returns the generic card view, or undefined for the default card.
 */
export function presentWatchCall(args: unknown): GenericCallView | undefined {
  const keyword = readString(args, 'keyword')
  if (keyword === undefined) return undefined
  return { card: 'generic', title: `Watch Zhihu for ${keyword}`, kind: 'fetch' }
}

/**
 * Present a completed `zhihu_watch` result.
 * @param args - presenter arguments from the session log.
 * @param result - the final model-facing result.
 * @returns the generic card view, or undefined for the default card.
 */
export function presentWatchResult(args: unknown, result: ToolResult): GenericResultView | undefined {
  const keyword = readString(args, 'keyword')
  if (keyword === undefined) return undefined
  return { card: 'generic', title: `Watch Zhihu for ${keyword}`, content: result.content }
}

/** The Session id the Host Schedule service binds a reminder to. */
type WatchSessionId = NonNullable<Parameters<ScheduleService['create']>[1]>

/**
 * Resolve the interval one `start` requests.
 * @param value - the minutes the call supplied.
 * @returns the interval in seconds.
 */
function resolveMinutes(value: number | undefined): number {
  if (value === undefined) throw new Error(`everyMinutes is required for 'start': an integer from ${MIN_MINUTES} through ${MAX_MINUTES}`)
  if (!Number.isInteger(value) || value < MIN_MINUTES || value > MAX_MINUTES) {
    throw new Error(`everyMinutes must be an integer from ${MIN_MINUTES} through ${MAX_MINUTES}`)
  }
  return value * 60
}

/**
 * Register `zhihu_watch` on a context that provides the Zhihu seam and the Host
 * Schedule service.
 * @param ctx - context providing the tool registry, the Zhihu seam and `schedule`.
 * @param limits - deployment caps resolved from the plugin config.
 */
export function applyZhihuWatchTool(ctx: Context, limits: ZhihuToolLimits): void {
  const { maxItems, timeoutMs } = limits
  const baselines = new Map<string, readonly string[]>()
  const schedule = ctx.get('schedule')
  if (schedule === undefined) throw new Error('zhihu_watch needs the Host schedule service')

  /**
   * Read the keyword lane once.
   * @param keyword - the watched keyword.
   * @param limit - entries one read requests.
   * @param signal - cancellation of the outer call.
   * @returns the lane's entries, in lane order.
   */
  const readLane = async (keyword: string, limit: number, signal: AbortSignal): Promise<readonly ZhihuFeedItem[]> => {
    signal.throwIfAborted()
    try {
      return (await ctx.zhihu.feed({ kind: 'topic', topic: keyword, limit })).items
    } catch (error) {
      throw new Error(describeZhihuFailure(error), { cause: error })
    }
  }

  /**
   * Find the active reminders this keyword already carries for one Session.
   * @param title - reminder title of the keyword.
   * @param sessionId - Session the reminders deliver into.
   * @returns the active tasks with that title and destination.
   */
  const reminders = async (title: string, sessionId: WatchSessionId): Promise<readonly ScheduleCatalogEntry[]> => {
    return (await schedule.catalog()).filter(entry => entry.title === title
      && entry.status === 'active'
      && entry.target.kind === 'session'
      && entry.target.sessionId === sessionId)
  }

  /**
   * Create the reminder one keyword did not have yet.
   * @param sessionId - Session the reminder delivers into.
   * @param keyword - the watched keyword.
   * @param everySeconds - interval between checks.
   * @param signal - cancellation of the outer call.
   * @returns the reminder this call created.
   */
  const startWatch = async (
    sessionId: WatchSessionId, keyword: string, everySeconds: number, signal: AbortSignal,
  ): Promise<ZhihuWatchScheduleValue> => {
    const title = watchTitle(keyword)
    const existing = (await reminders(title, sessionId))[0]
    if (existing !== undefined) {
      throw new Error(`A reminder already watches "${keyword}" (id ${existing.id}); stop it before starting another.`)
    }
    const entry = await schedule.create({
      title,
      prompt: watchPrompt(keyword),
      timing: { kind: 'every', every_seconds: everySeconds },
      target: { kind: 'session', sessionId },
    }, sessionId, signal)
    return { id: String(entry.id), title: entry.title, everySeconds }
  }

  /**
   * Remove every reminder this tool created for one keyword.
   * @param sessionId - Session the reminders deliver into.
   * @param keyword - the watched keyword.
   * @param key - baseline key to drop with the reminders.
   * @param signal - cancellation of the outer call.
   * @returns the stop result.
   */
  const stopWatch = async (
    sessionId: WatchSessionId, keyword: string, key: string, signal: AbortSignal,
  ): Promise<ZhihuWatchValue> => {
    baselines.delete(key)
    let removed = 0
    for (const entry of await reminders(watchTitle(keyword), sessionId)) {
      const result = await schedule.edit({ id: entry.id, action: 'delete' }, sessionId, signal)
      if ('deleted' in result) removed += 1
    }
    return { action: 'stop', keyword, scanned: 0, items: [], baselineOnly: false, removed }
  }

  ctx.tools.register(defineTool({
    name: WATCH_TOOL_NAME,
    description: WATCH_DESCRIPTION,
    parameters: {
      action: {
        type: 'string',
        required: true,
        enum: [...WATCH_ACTIONS],
        description: "'start' records the lane and creates the recurring reminder; 'check' reports what the lane gained since the last start or check; 'stop' removes the reminder this tool created.",
      },
      keyword: {
        type: 'string',
        required: true,
        description: "Keyword the lane lists, matched by Zhihu's own search.",
      },
      everyMinutes: {
        type: 'number',
        description: `How often 'start' checks the lane, in minutes: an integer from ${MIN_MINUTES} through ${MAX_MINUTES}. Ignored by the other actions.`,
      },
    },
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          action: { type: 'string', required: true, enum: [...WATCH_ACTIONS] },
          keyword: { type: 'string', required: true },
          scanned: { type: 'number', required: true },
          items: {
            type: 'array',
            required: true,
            items: {
              type: 'object',
              additionalProperties: false,
              properties: {
                kind: { type: 'string', required: true, enum: ['question', 'answer', 'article'] },
                id: { type: 'string', required: true },
                title: { type: 'string', required: true },
                url: { type: 'string', required: true },
                heatLabel: { type: 'string' },
              },
            },
          },
          baselineOnly: { type: 'boolean', required: true },
          schedule: {
            type: 'object',
            additionalProperties: false,
            properties: {
              id: { type: 'string', required: true },
              title: { type: 'string', required: true },
              everySeconds: { type: 'number', required: true },
            },
          },
          removed: { type: 'number' },
        },
      },
      render: (_args, value) => [{ type: 'text', text: formatWatchOutput(value) }],
      presentationMeta: (_args, value) => watchMeta(value),
    },
    timeoutMs,
    // A check moves the baseline and a start creates a reminder, so two calls must not overlap.
    isConcurrencySafe: () => false,
    async execute(args, exec) {
      const action = WATCH_ACTIONS.find(candidate => candidate === args.action)
      if (action === undefined) throw new Error('action must be one of start, check, stop')
      const keyword = requireText(args.keyword, 'keyword')
      const agent = exec.agent
      if (agent === undefined) throw new Error('zhihu_watch needs the calling agent, so its reminder has a Session to deliver into')
      const key = `${String(agent.session.id)}\u0000${keyword}`
      if (action === 'stop') return await stopWatch(agent.session.id, keyword, key, exec.signal)
      const entries = await readLane(keyword, maxItems, exec.signal)
      const previous = baselines.get(key)
      baselines.set(key, entries.map(item => item.id).slice(0, BASELINE_IDS))
      const items = previous === undefined ? [] : entries.filter(item => !previous.includes(item.id))
      const read: ZhihuWatchValue = {
        action,
        keyword,
        scanned: entries.length,
        items: items.map(item => projectWatchItem(item)),
        baselineOnly: previous === undefined,
      }
      if (action === 'check') return read
      return { ...read, schedule: await startWatch(agent.session.id, keyword, resolveMinutes(args.everyMinutes), exec.signal) }
    },
    presentCall: presentWatchCall,
    presentResult: presentWatchResult,
  }))
}
