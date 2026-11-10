/**
 * Mapping from Zhihu HTTP responses to seam failures, plus redacted cookie diagnostics. Every
 * message this module produces is safe to log: a cookie contributes its byte length and whether a
 * ticket is present, never its value.
 * @module @deepseek-ai/dsh-zhihu-plugin/http/classify
 */
import type { ZhihuErrorCode } from '../service/index.ts';
import type { ZhihuWireError } from './types.ts';
/**
 * The failure groups a Zhihu response can fall into. Zhihu reports most failures as a 401 or 403
 * with an `error.code`; the HTTP status alone is only a fallback, because the same status carries
 * different meanings (403 is both `40362` throttling and `40353` paywalled content).
 */
export type ZhihuFailureKind = 'login-required' | 'rate-limited' | 'blocked' | 'not-found' | 'bad-response';
/**
 * Map a failure group onto its seam error code.
 * @param kind - the classified failure.
 * @returns the discriminant carried by `ZhihuError.code`.
 */
export declare function zhihuErrorCode(kind: ZhihuFailureKind): ZhihuErrorCode;
/**
 * Classify one failed response. The body's API error code wins over the HTTP status, and the status
 * is used only when the body carries no recognized code.
 * @param status - HTTP status of the response.
 * @param error - the parsed `error` member, when the body carried one.
 * @returns the failure group.
 */
export declare function classifyFailure(status: number, error: ZhihuWireError | undefined): ZhihuFailureKind;
/**
 * Classify a 200 response whose body is not JSON. Zhihu answers a throttled caller with a
 * challenge page carrying `zh-zse-ck` or `unhuman` markers instead of an API error.
 * @param text - the raw response body.
 * @returns the failure group: `blocked` for a challenge page, `bad-response` otherwise.
 */
export declare function classifyBody(text: string): 'blocked' | 'bad-response';
/**
 * Describe a cookie without revealing it. Only the byte length and whether a `z_c0` or `d_c0`
 * field is present may leave this function, so the result is safe for logs and error messages.
 * @param cookie - the cookie header value, possibly empty.
 * @returns a redacted diagnostic such as `cookie bytes=812, ticket=present`.
 */
export declare function cookieDiagnostics(cookie: string): string;
//# sourceMappingURL=classify.d.ts.map