/**
 * Lossless JSON parsing for Zhihu payloads. Zhihu ids are decimal strings of varying length, and an
 * id beyond `Number.MAX_SAFE_INTEGER` is silently rounded by `JSON.parse` (2101831171671904273
 * becomes 2101831171671904300), so every id-keyed request built from a rounded id answers with an
 * empty page. Integer literals of 15 or more digits are therefore rewritten as JSON strings before
 * parsing; `JSON.parse` never consumes a response body directly.
 * @module @deepseek-ai/dsh-zhihu-plugin/http/lossless-json
 */
/**
 * Quote every integer literal of 15 or more digits so the value survives parsing.
 *
 * The scan tracks JSON string state, so digits inside a string value or an object key are left
 * untouched; decimals and exponent forms stay numbers because they keep their magnitude.
 * @param text - raw JSON text.
 * @returns the same JSON with long integer literals wrapped in quotes.
 */
export declare function quoteLargeIntegers(text: string): string;
/**
 * Parse JSON text without rounding long integer ids.
 * @param text - raw JSON text from a Zhihu response.
 * @returns the parsed body; callers assert the wire members they read.
 */
export declare function parseLosslessJson(text: string): unknown;
//# sourceMappingURL=lossless-json.d.ts.map