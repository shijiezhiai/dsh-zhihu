/**
 * The discussion segment: the shared Conversation content, rendered for the
 * Session the page retained for the open row, at sidebar-column width.
 */
import type { ReactNode } from 'react'
import type { ConversationViewsProps } from '@deepseek-ai/dsh-client-ui-conversation/client'
import type { PropsRenderFactories, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import css from './ZhihuPage.module.css'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface SlotMap {
    /** The discussion of the open row, rendered for the Session the page retained. */
    'zhihu.discussion': { kind: 'single'; scope: 'session' }
  }
}

/** Props the chat view reads; a Conversation passes the whole view set. */
export type ChatViewProps = Pick<ConversationViewsProps, 'renderSlot'>

/**
 * The Conversation view this panel renders: the chat view.
 * @param props - the slot renderer of the Conversation.
 * @returns the chat view of the discussion Session.
 */
export function ChatView({ renderSlot }: ChatViewProps): ReactNode {
  return <>{renderSlot('conversation.session', { view: 'chat' })}</>
}

/** Props supplied to the discussion seat. */
export type ZhihuDiscussionPanelProps =
  PropsRuntime<'zhihu.discussion'>
  & PropsRenderFactories

/**
 * Render one discussion Session's Conversation inside the Zhihu panel.
 * @param props - runtime props of the retained discussion Session.
 * @returns the embedded Conversation.
 */
export function ZhihuDiscussionPanel({ renderFactorySlot }: ZhihuDiscussionPanelProps): ReactNode {
  // A blank Session renders no hero: its landing screen asks for a workspace and offers no composer,
  // while this panel's first instruction is sent from the page's own chips and input.
  return (
    <div className={css.conversation}>
      {renderFactorySlot(
        'conversation.content',
        { variant: 'embedded', phase: 'active', hero: false },
        { slots: { views: ChatView } },
      )}
    </div>
  )
}
