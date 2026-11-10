// The Zhihu feed panel body: a segment switch, the selected feed, and the states a
// request can leave it in. All state lives in the panel store and all fetching
// lives in the injected face, so this file renders and listens only.
import { useCallback, useEffect } from 'react'
import type { ReactNode } from 'react'
import { Button, SegmentedControl } from '@deepseek-ai/dsh-client-ui-primitives'
import type { SegmentedControlOption } from '@deepseek-ai/dsh-client-ui-primitives'
// Type-only: declares the 'sidebar.right.pane.tab' seat this body renders into.
import type {} from '@deepseek-ai/dsh-client-ui-sidebar-right/client'
import type { InjectFace, PropsLocale, PropsRuntime, PropsStore } from '@deepseek-ai/dsh-client-ui-slots'
import type { ZhihuPanelInjected } from './zhihu-panel-face.ts'
import { zhihuPanelFailureLine } from './zhihu-panel-failure.ts'
import type { ZhihuPanelDetail, ZhihuPanelFeed, ZhihuPanelSegment, ZhihuPanelStore } from './zhihu-panel-store.ts'
import type { ZhihuKey } from './locales.ts'
import { ZhihuOpenedContent, ZhihuRowList } from './ZhihuContent.tsx'
import css from './ZhihuPanel.module.css'

/** The segments in display order. */
const SEGMENTS: readonly ZhihuPanelSegment[] = ['hot', 'recommend', 'follow']

/** The copy key of each segment label. */
const SEGMENT_KEYS = {
  hot: 'panel.segment.hot',
  recommend: 'panel.segment.recommend',
  follow: 'panel.segment.follow',
} as const satisfies Record<ZhihuPanelSegment, ZhihuKey>

/** The state of a segment nothing has been requested for yet. */
const IDLE_FEED: ZhihuPanelFeed = { status: 'idle' }

/** The list view a tab nothing has opened shows. */
const IDLE_DETAIL: ZhihuPanelDetail = { status: 'closed' }

/** The panel body's props: the slot's own seats plus this package's store and face. */
export type ZhihuPanelProps = PropsRuntime<'sidebar.right.pane.tab'>
  & PropsStore<ZhihuPanelStore>
  & InjectFace<ZhihuPanelInjected>
  & PropsLocale<'zhihu'>

/**
 * Render the Zhihu feed panel of one tab.
 * @param props - the slot's runtime seats, the panel store, the injected face, and copy.
 * @returns the panel element.
 */
// oxlint-disable-next-line typescript/unbound-method -- the injected face methods are closures that never read `this`.
export function ZhihuPanel({ useTabInfo, useStore, actions, load, read, ask, t }: ZhihuPanelProps): ReactNode {
  const { tab } = useTabInfo()
  const state = useStore(snapshot => snapshot.byTab[tab.id])
  const segment = state?.segment ?? 'hot'
  const feed = state?.feeds[segment] ?? IDLE_FEED
  const detail = state?.detail ?? IDLE_DETAIL
  const base = 'zhihu-feed-' + tab.id
  const loading = feed.status === 'loading'

  const request = useCallback(() => {
    load(tab.id, segment, tab.signal)
  }, [load, segment, tab.id, tab.signal])

  // Only an untouched segment is fetched on its own: a segment that already
  // answered is shown as it is until the reader asks for fresher rows.
  useEffect(() => {
    if (feed.status === 'idle') request()
  }, [feed.status, request])

  const options: readonly SegmentedControlOption<ZhihuPanelSegment>[] = SEGMENTS.map(kind => ({
    value: kind,
    label: t(SEGMENT_KEYS[kind]),
  }))

  if (detail.status !== 'closed') {
    return (
      <section className={css.panel} data-state={detail.status}>
        <div className={css.toolbar}>
          <Button variant="ghost" size="sm" onClick={() => { actions.close(tab.id) }}>
            {t('panel.back')}
          </Button>
        </div>
        <div className={css.content}>
          <ZhihuOpenedContent
            state={detail}
            t={t}
            onRetry={() => { read(tab.id, detail.row, tab.signal) }}
            onAsk={() => { void ask(detail.row, detail.status === 'ready' ? detail.item : undefined) }}
          />
        </div>
      </section>
    )
  }

  return (
    <section className={css.panel} data-state={feed.status}>
      <div className={css.toolbar}>
        <SegmentedControl
          id={base}
          value={segment}
          options={options}
          onChange={(next) => { actions.select(tab.id, next) }}
          label={t('panel.segments')}
        />
        <Button variant="outline" size="sm" onClick={request} disabled={loading}>
          {t('panel.refresh')}
        </Button>
      </div>
      <div
        role="tabpanel"
        id={base + '-' + segment + '-panel'}
        aria-labelledby={base + '-' + segment}
        className={css.content}
      >
        {loading && <p className={css.state}>{t('card.loading')}</p>}
        {feed.status === 'failed' && (
          <div className={css.failure}>
            <p className={css.state}>{zhihuPanelFailureLine(t, feed.failure)}</p>
            <Button variant="outline" size="sm" onClick={request}>{t('panel.retry')}</Button>
          </div>
        )}
        {feed.status === 'ready' && (
          <ZhihuRowList rows={feed.rows} t={t} onOpen={(row) => { read(tab.id, row, tab.signal) }} />
        )}
      </div>
    </section>
  )
}
