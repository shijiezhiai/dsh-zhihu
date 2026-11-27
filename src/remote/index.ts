/** Authenticated Client access to the Zhihu feed capability. */
import { Context } from '@deepseek-ai/cordis'
import z from '@deepseek-ai/schemastery'
import { Remote, RemoteError, TypertRemoteService } from '@deepseek-ai/dsh-typert-protocol'
import { ZhihuError } from '../service/index.ts'
import type { ZhihuErrorCode, ZhihuFeedRequest, ZhihuReadRequest } from '../service/index.ts'
import { credentialRef } from '@deepseek-ai/dsh-credentials'
import type {
  ZhihuClientSettings, ZhihuCommentsQuery, ZhihuCommentsResult, ZhihuExportQuery, ZhihuExportResult,
  ZhihuFailureTarget, ZhihuFeedQuery, ZhihuFeedResult, ZhihuFeedSort, ZhihuFeedTimeWindow,
  ZhihuReadItem, ZhihuReadQuery, ZhihuRemoteFailureCode, ZhihuRepliesQuery,
  ZhihuSearchQuery, ZhihuSearchResult, ZhihuSyncDocument, ZhihuSyncReadResult, ZhihuSyncSaveResult,
} from './types.ts'
import { fileCapture, noteName, notePath, readDocument, statePath, writeDocument, ObsidianError } from './obsidian.ts'
import { assertStateDocument, readStateDocument } from './state.ts'

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
  /** Longest passage one quoted instruction carries, in characters. */
  readonly quoteMaxChars: number
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

/** Orders a `topic` feed accepts, in the order an entry is offered. */
const FEED_SORTS: readonly ZhihuFeedSort[] = ['relevance', 'newest', 'top']

/** Time windows a `topic` feed accepts, narrowest first. */
const FEED_WINDOWS: readonly ZhihuFeedTimeWindow[] = ['day', 'week', 'month', 'year']

/**
 * Read one enumerable wire value, refusing anything the seam does not accept.
 * @param allowed - the values this field accepts.
 * @param value - value the Client sent.
 * @param field - field name reported by the refusal.
 * @returns the same value once it is one of `allowed`.
 */
function readMember<T extends string>(allowed: readonly T[], value: string, field: string): T {
  const found = allowed.find(candidate => candidate === value)
  if (found === undefined) {
    throw new RemoteError('gateway/bad-request', `${field} must be one of ${allowed.join(', ')}, received ${value}`, {})
  }
  return found
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
    quoteMaxChars: z.natural().min(1).default(1200),
    obsidianUrl: z.string().default('https://127.0.0.1:27124'),
    obsidianFolder: z.string().default('zhihu'),
    obsidianCredential: z.string().default('OBSIDIAN_API_KEY'),
  })

  constructor(ctx: Context, private readonly config: Config) {
    super(ctx, 'zhihuController', { namespace: 'zhihu' })
  }

  /**
   * Report the deployment settings the browser half applies.
   * @returns the passage cap this deployment sets.
   */
  @Remote
  settings(): Promise<ZhihuClientSettings> {
    return Promise.resolve({ quoteMaxChars: this.config.quoteMaxChars })
  }

  /**
   * Read the page state another machine stored in the vault.
   * @returns the stored document; a vault that holds none or cannot be reached answers with nothing.
   */
  @Remote
  async state(): Promise<ZhihuSyncReadResult> {
    const token = await this.storedObsidianToken()
    if (token === undefined) return {}
    const target = { url: this.config.obsidianUrl, folder: this.config.obsidianFolder, token }
    let stored: string | undefined
    try {
      stored = await readDocument(target, statePath(this.config.obsidianFolder))
    } catch (error) {
      /* v8 ignore next 3 -- the vault reports every refusal as ObsidianError */
      if (error instanceof ObsidianError) return {}
      /* v8 ignore next -- the rethrow only carries a failure readNote never reports */
      throw error
    }
    const document = stored === undefined ? undefined : readStateDocument(stored)
    return document === undefined ? {} : { document }
  }

  /**
   * Store the page state so another machine opens the same page.
   * @param document - the fields two machines share, with the format version and write instant.
   * @returns whether the vault took the document; a vault that refuses leaves the local copy in charge.
   */
  @Remote
  async saveState(document: ZhihuSyncDocument): Promise<ZhihuSyncSaveResult> {
    assertStateDocument(document)
    const token = await this.storedObsidianToken()
    if (token === undefined) return { saved: false }
    const target = { url: this.config.obsidianUrl, folder: this.config.obsidianFolder, token }
    try {
      await writeDocument(target, statePath(this.config.obsidianFolder), JSON.stringify(document))
    } catch (error) {
      /* v8 ignore next 3 -- the vault reports every refusal as ObsidianError */
      if (error instanceof ObsidianError) return { saved: false }
      /* v8 ignore next -- the rethrow only carries a failure readNote never reports */
      throw error
    }
    return { saved: true }
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
   * Read one slice of a content's root comments, ranked by Zhihu's own hotness score.
   * @param request - content kind, lossless id, and an optional comment count.
   * @returns the comments with their authors, likes, replies and dates.
   */
  @Remote
  async comments(request: ZhihuCommentsQuery): Promise<ZhihuCommentsResult> {
    const query = this.resolveComments(request)
    try {
      const page = await this.ctx.zhihu.comments(query)
      return { items: page.items, ...(page.total === undefined ? {} : { total: page.total }) }
    } catch (error) {
      const failure = seamFailure(error, query.kind)
      if (failure === undefined) throw error
      throw failure
    }
  }

  /**
   * Read the replies under one root comment.
   * @param request - the root comment id and an optional reply limit.
   * @returns one slice of the replies and the thread size when the payload names it.
   */
  @Remote
  async replies(request: ZhihuRepliesQuery): Promise<ZhihuCommentsResult> {
    const query = this.resolveReplies(request)
    try {
      const page = await this.ctx.zhihu.replies(query)
      return { items: page.items, ...(page.total === undefined ? {} : { total: page.total }) }
    } catch (error) {
      const failure = seamFailure(error, 'comments')
      if (failure === undefined) throw error
      throw failure
    }
  }

  /**
   * File one capture into the Obsidian vault, adding a marked passage to the note it came from.
   * @param request - the opened row plus the body the reader already holds.
   * @returns the vault path that was written.
   */
  @Remote
  async export(request: ZhihuExportQuery): Promise<ZhihuExportResult> {
    const entry = this.resolveExport(request)
    const token = await this.obsidianToken(entry.kind)
    const path = notePath(this.config.obsidianFolder, noteName(entry.title, entry.id))
    try {
      return { path: await fileCapture(
        { url: this.config.obsidianUrl, folder: this.config.obsidianFolder, token },
        path,
        entry,
        localDay(new Date()),
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
    if (request.excerpt !== undefined) {
      if (request.excerpt.heading.trim().length === 0) {
        throw new RemoteError('gateway/bad-request', 'excerpt.heading must not be empty', {})
      }
      if (request.excerpt.text.trim().length === 0) {
        throw new RemoteError('gateway/bad-request', 'excerpt.text must not be empty', {})
      }
    }
    return request
  }

  /**
   * Read the Local REST API token from the credentials service.
   * @param kind - capture kind, so a refusal names what the reader was filing.
   * @returns the token bytes.
   */
  private async obsidianToken(kind: ZhihuExportQuery['kind']): Promise<string> {
    const token = await this.storedObsidianToken()
    if (token === undefined) {
      throw new RemoteError(
        'zhihu/export-failed',
        `no Obsidian token is stored under ${this.config.obsidianCredential}`,
        { kind },
      )
    }
    return token
  }

  /**
   * Read the Local REST API token, without naming a refusal.
   * @returns the token bytes, or undefined when the deployment stores none.
   */
  private async storedObsidianToken(): Promise<string | undefined> {
    const credentials = this.ctx.get('credentials')
    const resolved = credentials === undefined
      ? undefined
      : await credentials.resolve(credentialRef(this.config.obsidianCredential))
    return resolved?.value
  }

  /**
   * Apply this deployment's limits to one wire request.
   * @param request - request as the Client sent it.
   * @returns the request `ctx.zhihu` must serve.
   */
  private resolve(request: ZhihuFeedQuery): ZhihuFeedRequest {
    const limit = request.limit === undefined ? this.config.defaultLimit : requireLimit(request.limit)
    const cursor = request.cursor
    const capped = Math.min(limit, this.config.maxLimit)
    const continuation = cursor === undefined ? {} : { cursor }
    if (request.kind !== 'topic') return { kind: request.kind, limit: capped, ...continuation }
    const topic = request.topic?.trim() ?? ''
    if (topic.length === 0) {
      throw new RemoteError('gateway/bad-request', 'topic must not be empty for a topic feed', {})
    }
    const sort = request.sort === undefined
      ? undefined
      : readMember(FEED_SORTS, request.sort, 'sort')
    const timeWindow = request.timeWindow === undefined
      ? undefined
      : readMember(FEED_WINDOWS, request.timeWindow, 'timeWindow')
    // An ordered or windowed feed is answered from several pages into one slice, so it continues
    // none of them: the token a Client holds belongs to the unordered feed it read before.
    const ordered = (sort !== undefined && sort !== 'relevance') || timeWindow !== undefined
    return {
      kind: 'topic',
      topic,
      limit: capped,
      ...(sort === undefined ? {} : { sort }),
      ...(timeWindow === undefined ? {} : { timeWindow }),
      ...(ordered ? {} : continuation),
    }
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
   * Validate one comments request against this deployment's limits.
   * @param request - request as the Client sent it.
   * @returns the request `ctx.zhihu` must serve.
   */
  /**
   * Validate one replies request and apply the deployment's limit.
   * @param request - the wire request.
   * @returns the seam request.
   */
  private resolveReplies(request: ZhihuRepliesQuery): ZhihuRepliesQuery {
    if (request.commentId.length === 0) {
      throw new RemoteError('gateway/bad-request', 'commentId must not be empty', {})
    }
    const limit = request.limit === undefined ? this.config.defaultLimit : requireLimit(request.limit)
    return { commentId: request.commentId, limit: Math.min(limit, this.config.maxLimit) }
  }

  private resolveComments(request: ZhihuCommentsQuery): ZhihuCommentsQuery {
    if (request.id.length === 0) {
      throw new RemoteError('gateway/bad-request', 'id must not be empty', {})
    }
    const limit = request.limit === undefined ? this.config.defaultLimit : requireLimit(request.limit)
    return { kind: request.kind, id: request.id, limit: Math.min(limit, this.config.maxLimit) }
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
