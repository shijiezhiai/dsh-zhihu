/**
 * Credentialed HTTP provider for the Zhihu content seam (`ctx.zhihu`). The cookie comes from the
 * credentials service through a `CookieSource`, never from plugin config; requests refuse
 * redirects, respect a per-provider minimum interval, and every failure names the credential only by
 * its length and ticket presence.
 * @module @deepseek-ai/dsh-zhihu-plugin/http
 */
import type { Context } from '@deepseek-ai/cordis';
import z from '@deepseek-ai/schemastery';
import type { CookieSource } from './types.ts';
export { ZhihuHttpClient } from './client.ts';
export type { ZhihuHttpClientOptions } from './client.ts';
export { systemClock } from './clock.ts';
export { ZhihuHttpProvider } from './provider.ts';
export type { ZhihuHttpProviderOptions } from './provider.ts';
export type { CookieSource, ZhihuClock, ZhihuTransport } from './types.ts';
/** Browser `User-Agent` Zhihu serves without a client-upgrade error. */
export declare const DEFAULT_USER_AGENT = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";
/** Cordis plugin name used by loader diagnostics. */
export declare const name = "zhihu-http";
/** The Zhihu seam this provider registers into. */
export declare const inject: string[];
/**
 * Plugin config. The cookie itself is never a field here: `credential` names the credentials
 * reference the request resolves, so the secret stays in the credentials service.
 */
export interface Config {
    /** Credentials reference holding the Zhihu cookie. */
    readonly credential?: string;
    /** Per-request timeout in milliseconds. */
    readonly requestTimeoutMs?: number;
    /** Minimum spacing between two requests from this provider, in milliseconds. */
    readonly minIntervalMs?: number;
    /** Character cap on a read result's plain text. */
    readonly maxContentChars?: number;
    /** Items requested from a feed or search when the caller omits a limit. */
    readonly pageSize?: number;
    /** Pages one feed request may fetch; a paged feed is followed until the limit is met. */
    readonly maxFeedPages?: number;
    /** Answers requested when a question read omits `answerLimit`. */
    readonly answerLimit?: number;
    /** `user-agent` header value. */
    readonly userAgent?: string;
}
/** Config schema; every deployment-varying choice is a validated field. */
export declare const Config: z<Config>;
/**
 * Read the cookie from the credentials service for every request, so a rotated or newly stored
 * cookie applies without remounting the provider. The credentials service is read through
 * `ctx.get()`, which keeps this plugin's `inject` list to the seam it contributes to.
 * @param ctx - the plugin context.
 * @param reference - the credentials reference name, validated by the plugin config.
 * @returns a source answering the cookie, or `undefined` when no credential is stored or the
 *   credentials service is not mounted.
 */
export declare function credentialsCookieSource(ctx: Context, reference: string): CookieSource;
/**
 * Mount the HTTP provider on the Zhihu seam.
 * @param ctx - the plugin context; `ctx.zhihu` must be mounted.
 * @param config - the validated plugin config.
 */
export declare function apply(ctx: Context, config: Config): void;
//# sourceMappingURL=index.d.ts.map