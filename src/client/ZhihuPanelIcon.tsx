/** Decorative occupant for the Zhihu sidebar entry. */
import { IconQuestionOutlineRegular } from '@deepseek-ai/dsh-client-ui-primitives'
import type { PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type {} from '@deepseek-ai/dsh-client-ui-sidebar/client'

/**
 * Render the question glyph at the size the sidebar asks for; the sidebar owns
 * its accessible navigation label. The glyph is the row's direct icon child, as
 * on every other panel row.
 * @param props - the sidebar's icon share: the requested size and whether the panel is selected.
 * @returns decorative question-mark icon.
 */
export function ZhihuPanelIcon({ size }: PropsRuntime<'sidebar.panellist'>) {
  return <IconQuestionOutlineRegular size={size} />
}
