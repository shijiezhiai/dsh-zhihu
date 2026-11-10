/**
 * The composer the reader types into, as the ask action sees it: whether the
 * draft landed there, and where to put the text when it did not.
 */

/** A visible editing surface, larger for the composer than for a search field. */
function area(element: HTMLElement): number {
  const rect = element.getBoundingClientRect()
  return rect.width * rect.height
}

/**
 * The editor the reader types into: the largest one the page mounts.
 * @returns that editor, or undefined while the page mounts none.
 */
function mainEditor(): HTMLElement | undefined {
  const editors = Array.from(document.querySelectorAll<HTMLElement>(
    '[contenteditable]:not([contenteditable="false"])',
  ))
  return editors.sort((left, right) => area(right) - area(left))[0]
}

/**
 * Text of the composer on screen.
 * @returns the composer's text, or an empty string when no composer is mounted.
 */
export function readComposerText(): string {
  return mainEditor()?.textContent ?? ''
}

/**
 * Type the draft into the composer, for a Session whose own draft never arrived.
 *
 * The text goes in through the browser's editing pipeline, so the editor's state
 * follows it exactly as it follows the reader's own typing. That pipeline is
 * `execCommand` alone; mutating the DOM leaves a model-backed editor out of step.
 * @param text - the draft to type.
 * @returns whether the editor took it; false when the page has no editor to type into.
 */
export function typeComposerText(text: string): boolean {
  const editor = mainEditor()
  // oxlint-disable-next-line typescript/no-deprecated -- see the contract above.
  if (editor === undefined || typeof document.execCommand !== 'function') return false
  editor.focus()
  const selection = document.getSelection()
  selection?.selectAllChildren(editor)
  selection?.collapseToEnd()
  // oxlint-disable-next-line typescript/no-deprecated -- see the contract above.
  return document.execCommand('insertText', false, text)
}
