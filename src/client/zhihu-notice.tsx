/**
 * Where an action reports itself: a banner on the shell overlay, so the outcome
 * shows wherever the reader has moved to since the click.
 */
import type { ReactNode } from 'react'
import { createSnapshotStore } from '@deepseek-ai/dsh-client-store'
import { Toast } from '@deepseek-ai/dsh-client-ui-primitives'
import type { HostObservable, InjectFace, PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import { NS } from './locales.ts'

/** One announcement; `seq` keys the banner so a repeat restarts its lifetime. */
export interface ZhihuNoticeState {
  /** Copy already localized by the action that reported it. */
  readonly text: string
  /** Monotonic number that distinguishes two announcements of the same text. */
  readonly seq: number
}

/** The announcement store the actions write and the overlay entry shows. */
export interface ZhihuNotice {
  /** Observable the `shell.overlay` entry reads. */
  readonly hooks: { readonly notice: HostObservable<ZhihuNoticeState | null> }
  /**
   * Show one announcement, replacing whatever is on screen.
   * @param text - localized copy describing what the action did.
   */
  readonly announce: (text: string) => void
  /** Clear the shown announcement. */
  readonly dismiss: () => void
}

/**
 * Create the one store every action reports into.
 * @returns the announcement observable with its announce and dismiss actions.
 */
export function createZhihuNotice(): ZhihuNotice {
  const store = createSnapshotStore<ZhihuNoticeState | null>(null)
  let seq = 0
  return {
    hooks: { notice: store },
    announce: (text) => {
      seq += 1
      store.set({ text, seq })
    },
    dismiss: () => { store.set(null) },
  }
}

/**
 * The seat registration of the overlay entry, apart from the component that reads it.
 * @param notice - the announcement store the entry shows.
 * @returns the injected face the entry receives when rendered.
 */
export function zhihuToastSeat(notice: ZhihuNotice): {
  readonly inject: () => Omit<ZhihuNotice, 'announce'>
} {
  return { inject: () => ({ hooks: notice.hooks, dismiss: notice.dismiss }) }
}

/** Props of the `shell.overlay` entry: the announcement hook, its dismissal, and localized copy. */
export type ZhihuToastProps = PropsRuntime<'shell.overlay'>
  & PropsLocale<typeof NS>
  & InjectFace<Omit<ZhihuNotice, 'announce'>>

/**
 * Render the outcome announcement.
 * @param props - the announcement hook, its dismissal, and the locale seat.
 * @returns the banner on display, or null.
 */
export function ZhihuToast({ useNotice, dismiss }: ZhihuToastProps): ReactNode {
  const notice = useNotice(current => current)
  if (notice === null) return null
  return <Toast key={`zhihu-notice-${String(notice.seq)}`} text={notice.text} holdMs={5000} onDone={dismiss} />
}
