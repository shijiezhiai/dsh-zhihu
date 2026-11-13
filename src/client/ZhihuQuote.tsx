/**
 * The bubble that asks what to do with the passage a reader pointed at.
 *
 * A passage reaches the row's discussion as one instruction: a prepared
 * question, or the reader's own. The bubble is placed from the passage, so it
 * never covers the text being discussed.
 */
import { useState } from 'react'
import type { ReactNode } from 'react'
import { Button } from '@deepseek-ai/dsh-client-ui-primitives'
import type { ZhihuTranslate } from './ZhihuContent.tsx'
import type { ZhihuPassage } from './zhihu-quote.ts'
import css from './ZhihuQuote.module.css'

/** The prepared questions, named by the copy the discussion chips also use. */
const QUICK_KEYS = ['discussion.summary', 'discussion.evidence', 'discussion.doubt'] as const

/**
 * Let the field show the lines typed into it, up to the height its styles cap.
 * @param field - the textarea the reader types in.
 */
function grow(field: HTMLTextAreaElement): void {
  if (field.scrollHeight <= field.clientHeight) return
  field.style.height = 'auto'
  field.style.height = String(field.scrollHeight) + 'px'
}

/** Inputs for {@link ZhihuQuoteBox}. */
export interface ZhihuQuoteBoxProps {
  /** The passage and where its bubble sits. */
  readonly passage: ZhihuPassage
  /** How many blocks the reader merged into that passage; one means a single block. */
  readonly count: number
  /** Copy of the Zhihu namespace. */
  readonly t: ZhihuTranslate
  /** Called with what to ask about the passage. */
  readonly onAsk: (instruction: string) => void
  /** Called when the reader files the passage into the comparison instead of asking about it. */
  readonly onCollect: () => void
}

/**
 * Render the passage bubble. The page owns everything that dismisses it, so the
 * bubble only collects the question.
 * @param props - the passage, the copy and the ask handler.
 * @returns the bubble, carrying the passage above its questions.
 */
export function ZhihuQuoteBox({ passage, count, t, onAsk, onCollect }: ZhihuQuoteBoxProps): ReactNode {
  const [draft, setDraft] = useState('')
  const asking = draft.trim()
  return (
    <div
      className={css.quote}
      style={{ left: passage.left, top: passage.top }}
      data-zhihu-passage=""
      role="dialog"
      aria-label={t('quote.action')}
    >
      <p className={css.passage}>{passage.text}</p>
      {count > 1 && <p className={css.count}>{t('quote.segments', { count })}</p>}
      <div className={css.quick}>
        <Button variant="outline" size="sm" onClick={() => { onCollect() }}>{t('quote.collect')}</Button>
        {QUICK_KEYS.map(key => (
          <Button key={key} variant="outline" size="sm" onClick={() => { onAsk(t(key)) }}>{t(key)}</Button>
        ))}
      </div>
      <div className={css.compose}>
        <textarea
          className={css.field}
          rows={2}
          value={draft}
          placeholder={t('quote.placeholder')}
          aria-label={t('quote.placeholder')}
          onChange={(event) => {
            setDraft(event.target.value)
            grow(event.target)
          }}
          onKeyDown={(event) => {
            if (event.key !== 'Enter' || event.shiftKey) return
            event.preventDefault()
            if (asking !== '') onAsk(asking)
          }}
        />
        <Button
          variant="primary"
          size="sm"
          disabled={asking === ''}
          onClick={() => { onAsk(asking) }}
        >{t('quote.send')}</Button>
      </div>
    </div>
  )
}
