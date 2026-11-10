/**
 * One readable line for a refused feed request.
 *
 * The three codes a reader can act on get their own copy; every other code,
 * including one a later Remote adds, shares the generic line, so an unfamiliar
 * failure still says what happened and offers a retry.
 */
import type { RemoteFailure } from '@deepseek-ai/dsh-api-remotes/client';
import type { ZhihuTranslate } from './ZhihuListCard.tsx';
/**
 * The line the panel shows for a failed request.
 * @param t - the panel's translate seat.
 * @param failure - the Remote failure the call returned.
 * @returns localized copy naming the cause.
 */
export declare function zhihuPanelFailureLine(t: ZhihuTranslate, failure: RemoteFailure): string;
//# sourceMappingURL=zhihu-panel-failure.d.ts.map