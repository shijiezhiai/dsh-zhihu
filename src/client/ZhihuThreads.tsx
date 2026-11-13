/**
 * The reader's discussions as a page of its own: each entry reopens the item it was about, and
 * filing one away archives the Session the conversation ran in.
 */
import type { ReactNode } from 'react'
import { Button } from '@deepseek-ai/dsh-client-ui-primitives'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import type { ZhihuDiscussionEntry } from './zhihu-page-store.ts'
import type { ZhihuTranslate } from './ZhihuContent.tsx'
import { zhihuKindKey } from './zhihu-discussion.ts'
import css from './ZhihuPage.module.css'

/** The Workspace action that files one discussion's Session into the archive. */
export type ZhihuThreadArchive = (sessionId: SessionId) => Promise<void>

/** One listed discussion, under the row key the page remembered it by. */
export interface ZhihuThread {
  /** The row's discussion key. */
  readonly key: string
  /** What the page kept of the discussion. */
  readonly entry: ZhihuDiscussionEntry
}

/**
 * List the reader's discussions, newest first.
 * @param props - the entries, the copy, and what reopening or filing one away does.
 * @returns the list, or its empty state.
 */
export function ZhihuThreads({ threads, t, onOpen, onArchive }: {
  readonly threads: readonly ZhihuThread[]
  readonly t: ZhihuTranslate
  readonly onOpen: (thread: ZhihuThread) => void
  readonly onArchive: (thread: ZhihuThread) => void
}): ReactNode {
  if (threads.length === 0) return <p className={css.state}>{t('threads.empty')}</p>
  return (
    <ol className={css.threads}>
      {threads.map(thread => (
        <li key={thread.key} className={css.thread}>
          <button
            type="button"
            className={css.threadTitle}
            onClick={() => { onOpen(thread) }}
          >
            {thread.entry.rows !== undefined && thread.entry.rows.length > 1
              ? t('threads.compare', { title: thread.entry.row.title, count: thread.entry.rows.length - 1 })
              : thread.entry.row.title}
          </button>
          <span className={css.threadMeta}>
            <span>{t(zhihuKindKey(thread.entry.row.kind))}</span>
            <time dateTime={new Date(thread.entry.openedAt).toISOString()}>
              {new Date(thread.entry.openedAt).toLocaleString()}
            </time>
          </span>
          {thread.entry.lastLine !== undefined && <span className={css.threadLine}>{thread.entry.lastLine}</span>}
          <Button variant="ghost" size="sm" onClick={() => { onArchive(thread) }}>{t('threads.archive')}</Button>
        </li>
      ))}
    </ol>
  )
}
