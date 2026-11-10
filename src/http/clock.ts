/**
 * System time source for the HTTP client.
 * @module @deepseek-ai/dsh-zhihu-plugin/http/clock
 */

import type { ZhihuClock } from './types.ts'

/** Wall-clock milliseconds plus a real timer; tests inject a deterministic clock instead. */
export const systemClock: ZhihuClock = {
  now: () => Date.now(),
  sleep: ms => new Promise<void>((resolve) => {
    setTimeout(resolve, ms)
  }),
}
