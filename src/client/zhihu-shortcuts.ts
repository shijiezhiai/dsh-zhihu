/**
 * One application command per detail action: the keyboard equivalent of the
 * context menu, each resolving against whatever row the page has open.
 */
import type { Context as ClientContext } from '@deepseek-ai/cordis'
import type { ShortcutBinding, ShortcutCommand, ShortcutCommandId } from '@deepseek-ai/dsh-client-shortcuts/client'
// Type-only: pulls the shortcuts service merge (ctx.shortcuts).
import type {} from '@deepseek-ai/dsh-client-shortcuts/client'
import type { ZhihuKey } from './locales.ts'
import type { ZhihuTranslate } from './ZhihuContent.tsx'
import { zhihuShortcutId, type ZhihuDetailAction, type ZhihuDetailRegistry } from './zhihu-detail.ts'

/** One action, its default physical key, and the copy that names it in the catalog. */
const COMMANDS: readonly { readonly action: ZhihuDetailAction; readonly code: string; readonly label: ZhihuKey }[] = [
  { action: 'copyTitle', code: 'KeyT', label: 'shortcut.copyTitle' },
  { action: 'copyLink', code: 'KeyL', label: 'shortcut.copyLink' },
  // KeyC is reserved for copying the selection, and KeyB already toggles the right sidebar.
  { action: 'copyBody', code: 'KeyG', label: 'shortcut.copyBody' },
  { action: 'openOriginal', code: 'KeyP', label: 'shortcut.openOriginal' },
  { action: 'export', code: 'KeyE', label: 'shortcut.export' },
  // KeyA already archives a Session, so the discussion shortcut takes the next free letter.
  { action: 'ask', code: 'KeyK', label: 'shortcut.ask' },
]

/**
 * The detail commands, bound to primary+shift+letter in every profile.
 * @param details - the registry the page publishes its open row into.
 * @param t - copy of the Zhihu namespace.
 * @returns one command per detail action.
 */
export function zhihuDetailCommands(details: ZhihuDetailRegistry, t: ZhihuTranslate): readonly ShortcutCommand[] {
  return COMMANDS.map((command) => {
    const binding: ShortcutBinding = { code: command.code, modifiers: ['primary', 'shift'] }
    return {
      id: zhihuShortcutId(command.action),
      label: () => t(command.label),
      aliases: [],
      defaults: {
        'desktop:macos': binding,
        'desktop:windows': binding,
        'desktop:linux': binding,
        'web:macos': binding,
        'web:windows': binding,
      },
      regions: ['page'],
      modals: [],
      resolve: () => {
        const handle = details.current()
        if (handle === undefined) return { status: 'blocked', reason: t('shortcut.unavailable') }
        return { status: 'handled', run: () => { handle.run(command.action) } }
      },
    }
  })
}

/**
 * Register the detail commands.
 * @param ctx - client context providing the shortcuts service.
 * @param details - the registry the page publishes its open row into.
 * @param t - copy of the Zhihu namespace.
 */
export function registerZhihuDetailShortcuts(ctx: ClientContext, details: ZhihuDetailRegistry, t: ZhihuTranslate): void {
  for (const command of zhihuDetailCommands(details, t)) {
    ctx.effect(() => registerDetailShortcut(ctx, command), `ui-zhihu: ${command.id} shortcut`)
  }
}

/**
 * Register one command, keeping it without a default key when another plugin already owns that key.
 * A taken key costs the reader one shortcut; refusing it must not cost them the panel.
 * @param ctx - client context providing the shortcuts service.
 * @param command - the detail command to register.
 * @returns the registry disposer.
 */
function registerDetailShortcut(ctx: ClientContext, command: ShortcutCommand): () => void {
  try {
    return ctx.shortcuts.register(command)
  } catch (error) {
    console.warn(`ui-zhihu: ${command.id} keeps no default key`, error)
    return ctx.shortcuts.register({ ...command, defaults: {} })
  }
}

/**
 * Read the keycaps the reader currently has bound for one detail action.
 * @param shortcuts - the client shortcuts service.
 * @returns a reader for a menu entry's keys; empty when the action has no binding.
 */
export function zhihuKeycaps(shortcuts: {
  readonly catalog: { getSnapshot(): readonly { readonly id: ShortcutCommandId; readonly keys: readonly string[] }[] }
}): (action: ZhihuDetailAction) => readonly string[] {
  return action => shortcuts.catalog.getSnapshot()
    .find(entry => entry.id === zhihuShortcutId(action))?.keys ?? []
}
