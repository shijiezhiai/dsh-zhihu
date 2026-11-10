/** Authenticated Client access to the Zhihu feed capability. */
import { Context } from '@deepseek-ai/cordis';
import z from '@deepseek-ai/schemastery';
import { TypertRemoteService } from '@deepseek-ai/dsh-typert-protocol';
import type { ZhihuExportQuery, ZhihuExportResult, ZhihuFeedQuery, ZhihuFeedResult, ZhihuReadItem, ZhihuReadQuery, ZhihuSearchQuery, ZhihuSearchResult } from './types.ts';
export type * from './types.ts';
declare module '@deepseek-ai/cordis' {
    interface Context {
        /** Experimental Zhihu Remote controller. */
        zhihuController: ZhihuController;
    }
}
/** Deployment limits resolved before a request reaches `ctx.zhihu`. */
export interface Config {
    /** Items returned when a request omits `limit`. */
    readonly defaultLimit: number;
    /** Hard cap applied to every requested limit. */
    readonly maxLimit: number;
    /** Base URL of the Obsidian Local REST API that receives captured notes. */
    readonly obsidianUrl: string;
    /** Vault folder that receives captured notes; empty writes to the vault root. */
    readonly obsidianFolder: string;
    /** Credentials reference holding the Local REST API token. */
    readonly obsidianCredential: string;
}
/** Zhihu feed rows for browser clients; reading and search stay tool capabilities. */
export default class ZhihuController extends TypertRemoteService {
    private readonly config;
    static inject: string[];
    static Config: z<Config>;
    constructor(ctx: Context, config: Config);
    /**
     * Read one bounded feed page from the selected provider.
     * @param request - feed kind and an optional item limit.
     * @returns rows carrying ids, titles, heat labels, excerpts and canonical URLs.
     */
    feed(request: ZhihuFeedQuery): Promise<ZhihuFeedResult>;
    /**
     * Read one question or answer as plain text.
     * @param request - content kind, lossless id, an article's title, and an optional answer count.
     * @returns the title, body text, author, upvotes and canonical URL.
     */
    read(request: ZhihuReadQuery): Promise<ZhihuReadItem>;
    /**
     * Search Zhihu content.
     * @param request - query text, an optional hit count, and an optional continuation token.
     * @returns one page of matching rows with nothing removed.
     */
    search(request: ZhihuSearchQuery): Promise<ZhihuSearchResult>;
    /**
     * File one capture into the Obsidian vault.
     * @param request - the opened row plus the body the reader already holds.
     * @returns the vault path that was written.
     */
    export(request: ZhihuExportQuery): Promise<ZhihuExportResult>;
    /**
     * Validate one capture before it reaches the vault.
     * @param request - capture as the Client sent it.
     * @returns the same capture once every field a note needs is present.
     */
    private resolveExport;
    /**
     * Read the Local REST API token from the credentials service.
     * @param kind - capture kind, so a refusal names what the reader was filing.
     * @returns the token bytes.
     */
    private obsidianToken;
    /**
     * Apply this deployment's limits to one wire request.
     * @param request - request as the Client sent it.
     * @returns the request `ctx.zhihu` must serve.
     */
    private resolve;
    /**
     * Validate one search request against this deployment's limits.
     * @param request - request as the Client sent it.
     * @returns the request `ctx.zhihu` must serve.
     */
    private resolveSearch;
    /**
     * Validate one read request against this deployment's limits.
     * @param request - request as the Client sent it.
     * @returns the request `ctx.zhihu` must serve.
     */
    private resolveRead;
}
//# sourceMappingURL=index.d.ts.map