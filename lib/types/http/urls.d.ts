/**
 * Canonical public URLs. Zhihu payloads carry no `url` field, so every link is built here and
 * carried by the seam result; consumers never assemble one.
 * @module @deepseek-ai/dsh-zhihu-plugin/http/urls
 */
import type { ZhihuContentKind } from '../service/index.ts';
/**
 * Build the canonical public URL of one content item.
 * @param kind - content kind.
 * @param id - lossless content id.
 * @returns the absolute https URL.
 */
export declare function contentUrl(kind: ZhihuContentKind, id: string): string;
//# sourceMappingURL=urls.d.ts.map