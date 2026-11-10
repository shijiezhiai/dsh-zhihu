/**
 * Lossless JSON parsing for Zhihu payloads. Zhihu ids are decimal strings of varying length, and an
 * id beyond `Number.MAX_SAFE_INTEGER` is silently rounded by `JSON.parse` (2101831171671904273
 * becomes 2101831171671904300), so every id-keyed request built from a rounded id answers with an
 * empty page. Integer literals of 15 or more digits are therefore rewritten as JSON strings before
 * parsing; `JSON.parse` never consumes a response body directly.
 * @module @deepseek-ai/dsh-zhihu-plugin/http/lossless-json
 */

/** Digit count at which a JSON integer literal is rewritten as a string. */
const FIRST_UNSAFE_DIGITS = 15

/**
 * Quote every integer literal of 15 or more digits so the value survives parsing.
 *
 * The scan tracks JSON string state, so digits inside a string value or an object key are left
 * untouched; decimals and exponent forms stay numbers because they keep their magnitude.
 * @param text - raw JSON text.
 * @returns the same JSON with long integer literals wrapped in quotes.
 */
export function quoteLargeIntegers(text: string): string {
  let out = ''
  let index = 0
  let inString = false
  while (index < text.length) {
    const char = text.charAt(index)
    if (inString) {
      out += char
      index += 1
      if (char === '\\') {
        out += text.charAt(index)
        index += 1
      } else if (char === '"') {
        inString = false
      }
      continue
    }
    if (char === '"') {
      inString = true
      out += char
      index += 1
      continue
    }
    if (char === '-' || isDigit(char)) {
      const start = index
      if (char === '-') index += 1
      const digitStart = index
      while (isDigit(text.charAt(index))) index += 1
      const digits = index - digitStart
      const literal = text.slice(start, index)
      const following = text.charAt(index)
      const unsafe = digits >= FIRST_UNSAFE_DIGITS && following !== '.' && following !== 'e' && following !== 'E'
      out += unsafe ? '"' + literal + '"' : literal
      continue
    }
    out += char
    index += 1
  }
  return out
}

/**
 * Parse JSON text without rounding long integer ids.
 * @param text - raw JSON text from a Zhihu response.
 * @returns the parsed body; callers assert the wire members they read.
 */
export function parseLosslessJson(text: string): unknown {
  return JSON.parse(quoteLargeIntegers(text))
}

/**
 * Whether a character is an ASCII decimal digit.
 * @param char - one character, or the empty string past the end.
 * @returns true for `0`-`9`.
 */
function isDigit(char: string): boolean {
  return char >= '0' && char <= '9'
}
