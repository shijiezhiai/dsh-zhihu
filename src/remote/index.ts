/** Authenticated Client access to the Zhihu feed capability. */
import { Context } from '@deepseek-ai/cordis'
import z from '@deepseek-ai/schemastery'
import { Remote, RemoteError, TypertRemoteService } from '@deepseek-ai/dsh-typert-protocol'
import { ZhihuError } from '../service/index.ts'
import type { ZhihuErrorCode, ZhihuFeedRequest, ZhihuReadRequest } from '../service/index.ts'
import { credentialRef } from '@deepseek-ai/dsh-credentials'
import type {
  ZhihuExportQuery, ZhihuExportResult, ZhihuFailureTarget, ZhihuFeedQuery, ZhihuFeedResult,
  ZhihuReadItem, ZhihuReadQuery, ZhihuRemoteFailureCode, ZhihuSearchQuery, ZhihuSearchResult,
} from './types.ts'
import { noteName, notePath, noteText, ObsidianError, putNote } from './obsidian.ts'

export type * from './types.ts'

declare module '@deepseek-ai/cordis' {
  interface Context {
    /** Experimental Zhihu Remote controller. */
    zhihuController: ZhihuController
  }
}

/** Deployment limits resolved before a request reaches `ctx.zhihu`. */
export interface Config {
  /** Items returned when a request omits `limit`. */
  readonly defaultLimit: number
  /** Hard cap applied to every requested limit. */
  readonly maxLimit: number
  /** Base URL of the Obsidian Local REST API that receives captured notes. */
  readonly obsidianUrl: string
  /** Vault folder that receives captured notes; empty writes to the vault root. */
  readonly obsidianFolder: string
  /** Credentials reference holding the Local REST API token. */
  readonly obsidianCredential: string
}

/** Seam failure codes this Remote can name; anything else stays a carrier failure. */
const FAILURE_CODES: Readonly<Record<ZhihuErrorCode, ZhihuRemoteFailureCode | undefined>> = {
  ZHIHU_LOGIN_REQUIRED: 'zhihu/login-required',
  ZHIHU_RATE_LIMITED: 'zhihu/rate-limited',
  ZHIHU_BLOCKED: 'zhihu/blocked',
  ZHIHU_NOT_FOUND: 'zhihu/not-found',
  ZHIHU_BAD_RESPONSE: 'zhihu/bad-response',
  ZHIHU_PROVIDER_UNAVAILABLE: 'zhihu/unavailable',
  ZHIHU_PROVIDER_CONFIGURED_MISSING: 'zhihu/unavailable',
  ZHIHU_PROVIDER_CONFIGURED_UNAVAILABLE: 'zhihu/unavailable',
  ZHIHU_PROVIDER_AMBIGUOUS: 'zhihu/unavailable',
  ZHIHU_DUPLICATE_PROVIDER: undefined,
}

/**
 * Reject a wire limit the seam cannot honour.
 * @param limit - limit supplied by the Client.
 * @returns the same limit once it is a positive integer.
 */
function requireLimit(limit: number): number {
  if (!Number.isSafeInteger(limit) || limit < 1) {
    throw new RemoteError('gateway/bad-request', `limit must be a positive integer, received ${String(limit)}`, {})
  }
  return limit
}

/**
 * Translate one seam failure into its declared Remote code.
 * @param error - value thrown by `ctx.zhihu.feed` or `ctx.zhihu.read`.
 * @param kind - the request the failed call named.
 * @returns the Remote failure, or undefined when the code stays unclassified.
 */
function seamFailure(error: unknown, kind: ZhihuFailureTarget): RemoteError<ZhihuRemoteFailureCode> | undefined {
  if (!(error instanceof ZhihuError)) return undefined
  const code = FAILURE_CODES[error.code]
  if (code === undefined) return undefined
  return new RemoteError(code, error.message, { kind }, { cause: error })
}

/**
 * Render the day a capture was saved, in the reader's own time zone.
 * @param now - the moment the capture landed.
 * @returns `YYYY-MM-DD`.
 */
function localDay(now: Date): string {
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${String(now.getFullYear())}-${month}-${day}`
}

/** Zhihu feed rows for browser clients; reading and search stay tool capabilities. */
export default class ZhihuController extends TypertRemoteService {
  static inject = ['zhihu', 'typert']
  static Config: z<Config> = z.object({
    defaultLimit: z.natural().min(1).default(20),
    maxLimit: z.natural().min(1).default(50),
    obsidianUrl: z.string().default('https://127.0.0.1:27124'),
    obsidianFolder: z.string().default('zhihu'),
    obsidianCredential: z.string().default('OBSIDIAN_API_KEY'),
  })

  constructor(ctx: Context, private readonly config: Config) {
    super(ctx, 'zhihuController', { namespace: 'zhihu' })
  }

  /**
   * Read one bounded feed page from the selected provider.
   * @param request - feed kind and an optional item limit.
   * @returns rows carrying ids, titles, heat labels, excerpts and canonical URLs.
   */
  @Remote
  async feed(request: ZhihuFeedQuery): Promise<ZhihuFeedResult> {
    const query = this.resolve(request)
    try {
      const page = await this.ctx.zhihu.feed(query)
      return { rows: page.items, ...(page.cursor === undefined ? {} : { cursor: page.cursor }) }
    } catch (error) {
      const failure = seamFailure(error, query.kind)
      if (failure === undefined) throw error
      throw failure
    }
  }

  /**
   * Read one question or answer as plain text.
   * @param request - content kind, lossless id, an article's title, and an optional answer count.
   * @returns the title, body text, author, upvotes and canonical URL.
   */
  @Remote
  async read(request: ZhihuReadQuery): Promise<ZhihuReadItem> {
    const query = this.resolveRead(request)
    try {
      return await this.ctx.zhihu.read(query)
    } catch (error) {
      const failure = seamFailure(error, query.kind)
      if (failure === undefined) throw error
      throw failure
    }
  }

  /**
   * Search Zhihu content.
   * @param request - query text, an optional hit count, and an optional continuation token.
   * @returns one page of matching rows with nothing removed.
   */
  @Remote
  async search(request: ZhihuSearchQuery): Promise<ZhihuSearchResult> {
    const query = this.resolveSearch(request)
    try {
      const page = await this.ctx.zhihu.search(query)
      return { rows: page.items, ...(page.cursor === undefined ? {} : { cursor: page.cursor }) }
    } catch (error) {
      const failure = seamFailure(error, 'search')
      if (failure === undefined) throw error
      throw failure
    }
  }

  /**
   * File one capture into the Obsidian vault.
   * @param request - the opened row plus the body the reader already holds.
   * @returns the vault path that was written.
   */
  @Remote
  async export(request: ZhihuExportQuery): Promise<ZhihuExportResult> {
    const entry = this.resolveExport(request)
    const token = await this.obsidianToken(entry.kind)
    const path = notePath(this.config.obsidianFolder, noteName(entry.title, entry.id))
    try {
      return { path: await putNote(
        { url: this.config.obsidianUrl, folder: this.config.obsidianFolder, token },
        path,
        noteText(entry, localDay(new Date())),
      ) }
    } catch (error) {
      /* v8 ignore next 3 -- putNote reports every failure as ObsidianError */
      if (error instanceof ObsidianError) {
        throw new RemoteError('zhihu/export-failed', error.message, { kind: entry.kind }, { cause: error })
      }
      /* v8 ignore next -- the rethrow only carries a failure putNote never reports */
      throw error
    }
  }

  /**
   * Validate one capture before it reaches the vault.
   * @param request - capture as the Client sent it.
   * @returns the same capture once every field a note needs is present.
   */
  private resolveExport(request: ZhihuExportQuery): ZhihuExportQuery {
    for (const field of ['id', 'title', 'url'] as const) {
      if (request[field].trim().length === 0) {
        throw new RemoteError('gateway/bad-request', `${field} must not be empty`, {})
      }
    }
    if (request.discussion !== undefined && request.discussion.heading.trim().length === 0) {
      throw new RemoteError('gateway/bad-request', 'discussion.heading must not be empty', {})
    }
    return request
  }

  /**
   * Read the Local REST API token from the credentials service.
   * @param kind - capture kind, so a refusal names what the reader was filing.
   * @returns the token bytes.
   */
  private async obsidianToken(kind: ZhihuExportQuery['kind']): Promise<string> {
    const credentials = this.ctx.get('credentials')
    const resolved = credentials === undefined
      ? undefined
      : await credentials.resolve(credentialRef(this.config.obsidianCredential))
    if (resolved === undefined) {
      throw new RemoteError(
        'zhihu/export-failed',
        `no Obsidian token is stored under ${this.config.obsidianCredential}`,
        { kind },
      )
    }
    return resolved.value
  }

  /**
   * Apply this deployment's limits to one wire request.
   * @param request - request as the Client sent it.
   * @returns the request `ctx.zhihu` must serve.
   */
  private resolve(request: ZhihuFeedQuery): ZhihuFeedRequest {
    const limit = request.limit === undefined ? this.config.defaultLimit : requireLimit(request.limit)
    const cursor = request.cursor
    const resolved = { kind: request.kind, limit: Math.min(limit, this.config.maxLimit) }
    return cursor === undefined ? resolved : { ...resolved, cursor }
  }

  /**
   * Validate one search request against this deployment's limits.
   * @param request - request as the Client sent it.
   * @returns the request `ctx.zhihu` must serve.
   */
  private resolveSearch(request: ZhihuSearchQuery): ZhihuSearchQuery {
    if (request.query.trim().length === 0) {
      throw new RemoteError('gateway/bad-request', 'query must not be empty', {})
    }
    const limit = request.limit === undefined ? this.config.defaultLimit : requireLimit(request.limit)
    const cursor = request.cursor
    return {
      query: request.query,
      limit: Math.min(limit, this.config.maxLimit),
      ...(cursor === undefined || cursor === '' ? {} : { cursor }),
    }
  }

  /**
   * Validate one read request against this deployment's limits.
   * @param request - request as the Client sent it.
   * @returns the request `ctx.zhihu` must serve.
   */
  private resolveRead(request: ZhihuReadQuery): ZhihuReadRequest {
    if (request.id.length === 0) {
      throw new RemoteError('gateway/bad-request', 'id must not be empty', {})
    }
    const answers = request.answerLimit
    if (answers !== undefined) requireLimit(answers)
    const title = request.title
    return {
      kind: request.kind,
      id: request.id,
      ...(answers === undefined ? {} : { answerLimit: answers }),
      ...(title === undefined ? {} : { title }),
    }
  }
}
