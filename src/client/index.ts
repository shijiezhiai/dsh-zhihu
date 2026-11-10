/**
 * Zhihu browser half: the three keyed toolview cards for `zhihu_feed`,
 * `zhihu_read`, and `zhihu_search`, plus the Zhihu feed panel as a right-Sidebar
 * tab type.
 *
 * Both halves are registered eagerly, before the Zhihu Remote is reachable. The
 * Host assembly mounts a fixed list of namespaces, so a capability outside it
 * carries its own generated descriptors and this plugin mounts them itself; the
 * panel asks for the namespace when a tab loads instead of waiting for it during
 * plugin activation, because a registration that waits for a namespace the Host
 * never publishes leaves no card, no tab, and no diagnostic.
 *
 * The panel reaches the Sidebar through its public path only: the definition into
 * `ctx.sidebarRightTabs`, the body into the keyed `sidebar.right.pane.tab` seat
 * under the definition's id. The chip title needs no registration because the
 * definition's title thunk is the fallback.
 */
import type { Context as ClientContext } from '@deepseek-ai/cordis'
import zhihuRemote from '@deepseek-ai/dsh-zhihu-plugin/remote'
import type { ClientRemote } from '@deepseek-ai/dsh-api-gateway/client'
import type {} from '@deepseek-ai/dsh-api-remotes/client'
import type { MainPanelId } from '@deepseek-ai/dsh-client-ui-layout/client'
// Type-only: pulls the sidebar shell's Context merge (ctx.sidebarRightTabs' peer).
import type {} from '@deepseek-ai/dsh-client-ui-sidebar/client'
// Type-only: pulls the locale plugin's Context merge (ctx.locale).
import type {} from '@deepseek-ai/dsh-client-locale/client'
// Type-only: pulls the SlotRegistry service merge (ctx.slots).
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
// Type-only: pulls the sidebar tab registry merge (ctx.sidebarRightTabs).
import type {} from '@deepseek-ai/dsh-client-ui-sidebar-right/client'
// Type-only: pulls the application command merge (ctx.shortcuts).
import type {} from '@deepseek-ai/dsh-client-shortcuts/client'
// Type-only: pulls the workspace navigation merge (ctx.uiWorkspace).
import type {} from '@deepseek-ai/dsh-client-ui-workspace/client'
import { ZhihuFeedCard } from './ZhihuFeedCard.tsx'
import { ZhihuReadCard } from './ZhihuReadCard.tsx'
import { ZhihuSearchCard } from './ZhihuSearchCard.tsx'
import { ZhihuPanel } from './ZhihuPanel.tsx'
import { de, en, es, fr, ja, NS, pt, ru, zh, type ZhihuKey } from './locales.ts'
import { ZHIHU_PANEL_ID, zhihuPanelDefinition } from './zhihu-panel-definition.ts'
import { zhihuPanelFace, zhihuPanelInject, zhihuRemoteReader } from './zhihu-panel-face.ts'
import { createZhihuPageStore } from './zhihu-page-store.ts'
import { createZhihuPanelStore } from './zhihu-panel-store.ts'
import { zhihuPageFace } from './zhihu-page-face.ts'
import { ZhihuPanelIcon } from './ZhihuPanelIcon.tsx'
import { zhihuPageFor } from './ZhihuPage.tsx'
import { ZhihuDiscussionPanel } from './ZhihuDiscussion.tsx'
import { createZhihuDetailRegistry } from './zhihu-detail.ts'
import { registerZhihuDetailShortcuts, zhihuKeycaps } from './zhihu-shortcuts.ts'
import { zhihuAsk } from './zhihu-ask.ts'
import { createZhihuDiscussionSeat } from './zhihu-discussion.ts'
import { copyZhihuText } from './zhihu-clipboard.ts'
import { readComposerText, typeComposerText } from './zhihu-composer.ts'
import { createZhihuNotice, ZhihuToast, zhihuToastSeat } from './zhihu-notice.tsx'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    /** Copy for the Zhihu cards and the feed panel. */
    zhihu: ZhihuKey
  }
}

/** Main panel id of the Zhihu page, shared by the left navigation entry and the page seat. */
export const ZHIHU_PAGE_ID = 'zhihu' as MainPanelId

/**
 * Required services: the registries, copy, the command registry, workspace
 * navigation, the Session controller, and the Remote service this plugin mounts into.
 */
export const inject = ['slots', 'locale', 'sidebarRightTabs', 'shortcuts', 'uiWorkspace', 'sessions', 'remote']

/**
 * Mount the Zhihu Remote and register the cards and the panel.
 * @param ctx - client root context.
 * @returns disposer unmounting the Remote contribution.
 */
export async function apply(ctx: ClientContext): Promise<() => Promise<void>> {
  const unmount = await ctx.remote.$mount(zhihuRemote)
  const reader = zhihuRemoteReader()
  const published = ctx.inject(['remote.zhihu'], (inner) => { reader.attach(inner.remote.zhihu) })
  try {
    registerZhihuUi(ctx, reader.read)
  } catch (error) {
    await published.dispose()
    await unmount()
    throw error
  }
  return async () => {
    await published.dispose()
    await unmount()
  }
}

/**
 * Register the Zhihu dictionaries, one keyed toolview card per Zhihu tool, and the feed panel tab type.
 * @param ctx - client context that mounted the Zhihu Remote.
 * @param resolveRemote - reads the published namespace, or undefined until the Host publishes it.
 */
function registerZhihuUi(ctx: ClientContext, resolveRemote: () => ClientRemote['zhihu'] | undefined): void {
  ctx.effect(() => ctx.locale.register(NS, { en, zh, ja, es, fr, de, ru, pt }), 'ui-zhihu: dictionaries')
  ctx.slots.inject('tool.call.toolview', () => ctx.slots.register(
    { name: 'tool.call.toolview', key: 'zhihu_feed', locale: NS },
    ZhihuFeedCard,
  ))
  ctx.slots.inject('tool.call.toolview', () => ctx.slots.register(
    { name: 'tool.call.toolview', key: 'zhihu_read', locale: NS },
    ZhihuReadCard,
  ))
  ctx.slots.inject('tool.call.toolview', () => ctx.slots.register(
    { name: 'tool.call.toolview', key: 'zhihu_search', locale: NS },
    ZhihuSearchCard,
  ))

  const t = ctx.locale.bind(NS)
  // An action moves the reader somewhere else, so its outcome is announced on the shell overlay.
  const notice = createZhihuNotice()
  ctx.effect(() => ctx.slots.inject('shell.overlay', () => ctx.slots.register({
    name: 'shell.overlay',
    id: 'zhihu.notice',
    locale: NS,
    ...zhihuToastSeat(notice),
  }, ZhihuToast)), 'ui-zhihu: outcome notice')
  // The draft lands in a Workspace session, so the conversation is logged like any other.
  const ask = zhihuAsk(ctx.uiWorkspace, t, {
    composerText: readComposerText,
    type: typeComposerText,
    copy: copyZhihuText,
    report: notice.announce,
  })
  const store = createZhihuPanelStore()
  const face = zhihuPanelFace(resolveRemote, ask)
  ctx.effect(() => ctx.sidebarRightTabs.register(zhihuPanelDefinition(t)), 'ui-zhihu: feed panel type')
  ctx.effect(() => ctx.slots.inject('sidebar.right.pane.tab', () => ctx.slots.register(
    {
      name: 'sidebar.right.pane.tab', key: ZHIHU_PANEL_ID, locale: NS, store,
      inject: zhihuPanelInject(face),
    },
    ZhihuPanel,
  )), 'ui-zhihu: feed panel body')

  const page = zhihuPageFace(resolveRemote)
  // The page keeps the reader's lanes, rows and offset here, so a reopened page resumes them.
  const pageStore = createZhihuPageStore()
  const details = createZhihuDetailRegistry()
  registerZhihuDetailShortcuts(ctx, details, t)
  const discussion = createZhihuDiscussionSeat(ctx.sessions)
  // The menu shows whatever the reader actually bound, so it reads the effective catalog.
  ctx.effect(() => ctx.slots.inject('main', () => ctx.slots.register({
    name: 'main', key: ZHIHU_PAGE_ID, locale: NS, store: pageStore,
    children: { 'zhihu.discussion': { kind: 'single', scope: 'session' } },
  }, zhihuPageFor(page, details, zhihuKeycaps(ctx.shortcuts), discussion, notice.announce))), 'ui-zhihu: feed page')
  // The page declares the slot above; a row's discussion renders the Conversation factory's chat view inside it.
  ctx.effect(() => ctx.slots.inject('zhihu.discussion', () => ctx.slots.register(
    { name: 'zhihu.discussion', locale: NS },
    ZhihuDiscussionPanel,
  )), 'ui-zhihu: discussion body')
  ctx.effect(() => ctx.slots.inject('sidebar.panellist', () => ctx.slots.register({
    name: 'sidebar.panellist', id: ZHIHU_PAGE_ID, order: 20, locale: NS, label: () => t('panel.title'),
  }, ZhihuPanelIcon)), 'ui-zhihu: sidebar entry')
}
