/**
 * Copy text for the reader, through the async clipboard where the shell offers
 * it and through a selection otherwise.
 */

/**
 * Copy one string to the clipboard.
 * @param text - the text to copy; an empty string copies nothing.
 * @returns whether a copy was issued.
 */
export function copyZhihuText(text: string): boolean {
  if (text === '') return false
  const clipboard = navigator.clipboard as Clipboard | undefined
  if (clipboard !== undefined) {
    void clipboard.writeText(text).catch(() => { copyThroughSelection(text) })
    return true
  }
  return copyThroughSelection(text)
}

/**
 * Copy by selecting a detached textarea: the path a shell without the async
 * clipboard still supports.
 * @param text - the text to copy.
 * @returns whether the copy command reported success.
 */
function copyThroughSelection(text: string): boolean {
  // oxlint-disable-next-line typescript/no-deprecated -- the fallback for a WebView that exposes no async clipboard
  if (typeof document.execCommand !== 'function') return false
  const area = document.createElement('textarea')
  area.value = text
  area.setAttribute('readonly', '')
  area.style.position = 'fixed'
  area.style.opacity = '0'
  document.body.append(area)
  area.select()
  // oxlint-disable-next-line typescript/no-deprecated -- the fallback for a WebView that exposes no async clipboard
  const copied = document.execCommand('copy')
  area.remove()
  return copied
}
