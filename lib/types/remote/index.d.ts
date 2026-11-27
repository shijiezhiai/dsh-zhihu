/** Authenticated Client access to the Zhihu feed capability. */
import { Context } from '@deepseek-ai/cordis';
import z from '@deepseek-ai/schemastery';
import { TypertRemoteService } from '@deepseek-ai/dsh-typert-protocol';
import type { ZhihuClientSettings, ZhihuCommentsQuery, ZhihuCommentsResult, ZhihuExportQuery, ZhihuExportResult, ZhihuFeedQuery, ZhihuFeedResult, ZhihuReadItem, ZhihuReadQuery, ZhihuRepliesQuery, ZhihuSearchQuery, ZhihuSearchResult, ZhihuSyncDocument, ZhihuSyncReadResult, ZhihuSyncSaveResult } from './types.ts';
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
    /** Longest passage one quoted instruction carries, in characters. */
    readonly quoteMaxChars: number;
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
     * Report the deployment settings the browser half applies.
     * @returns the passage cap this deployment sets.
     */
    settings(): Promise<ZhihuClientSettings>;
    /**
     * Read the page state another machine stored in the vault.
     * @returns the stored document; a vault that holds none or cannot be reached answers with nothing.
     */
    state(): Promise<ZhihuSyncReadResult>;
    /**
     * Store the page state so another machine opens the same page.
     * @param document - the fields two machines share, with the format version and write instant.
     * @returns whether the vault took the document; a vault that refuses leaves the local copy in charge.
     */
    saveState(document: ZhihuSyncDocument): Promise<ZhihuSyncSaveResult>;
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
     * Read one slice of a content's root comments, ranked by Zhihu's own hotness score.
     * @param request - content kind, lossless id, and an optional comment count.
     * @returns the comments with their authors, likes, replies and dates.
     */
    comments(request: ZhihuCommentsQuery): Promise<ZhihuCommentsResult>;
    /**
     * Read the replies under one root comment.
     * @param request - the root comment id and an optional reply limit.
     * @returns one slice of the replies and the thread size when the payload names it.
     */
    replies(request: ZhihuRepliesQuery): Promise<ZhihuCommentsResult>;
    /**
     * File one capture into the Obsidian vault, adding a marked passage to the note it came from.
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
     * Read the Local REST API token, without naming a refusal.
     * @returns the token bytes, or undefined when the deployment stores none.
     */
    private storedObsidianToken;
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
     * Validate one comments request against this deployment's limits.
     * @param request - request as the Client sent it.
     * @returns the request `ctx.zhihu` must serve.
     */
    /**
     * Validate one replies request and apply the deployment's limit.
     * @param request - the wire request.
     * @returns the seam request.
     */
    private resolveReplies;
    private resolveComments;
    /**
     * Validate one read request against this deployment's limits.
     * @param request - request as the Client sent it.
     * @returns the request `ctx.zhihu` must serve.
     */
    private resolveRead;
}
//# sourceMappingURL=index.d.ts.map