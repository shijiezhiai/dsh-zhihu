import type { ZhihuExportQuery } from './types.ts';
/** Where a note lands and who may write it; resolved from plugin config and credentials. */
export interface ObsidianTarget {
    /** Base URL of the Local REST API, such as `https://127.0.0.1:27124`. */
    readonly url: string;
    /** Vault folder holding the notes; empty writes to the vault root. */
    readonly folder: string;
    /** Bearer token from the Local REST API plugin. */
    readonly token: string;
}
/** A vault write that did not land, named by what the caller can act on. */
export declare class ObsidianError extends Error {
    constructor(message: string, options?: ErrorOptions);
}
/**
 * Quote one YAML scalar the way the vault's queries expect.
 * @param value - text as the provider returned it.
 * @returns a double-quoted scalar with quotes and control characters neutralized.
 */
export declare function yamlScalar(value: string): string;
/**
 * Turn a title into a file name the vault accepts on every platform.
 * @param title - note title as read from Zhihu.
 * @param id - content id, used when the title carries nothing usable.
 * @returns one path segment without separators or trailing dots.
 */
export declare function noteName(title: string, id: string): string;
/**
 * Vault-relative path of one capture.
 * @param folder - configured vault folder.
 * @param name - note name without its extension.
 * @returns `<folder>/<name>.md`, or `<name>.md` for a root folder.
 */
export declare function notePath(folder: string, name: string): string;
/**
 * The note text: frontmatter the vault can query, then the body, then the
 * conclusion the reader reached about it. A capture the provider cut records
 * `truncated: true` in the frontmatter, so the body stays plain Markdown.
 * @param entry - capture as the Client sent it.
 * @param day - `YYYY-MM-DD` the capture was saved.
 * @returns Markdown written as one request body.
 */
export declare function noteText(entry: ZhihuExportQuery, day: string): string;
/**
 * Encode a vault path so each segment survives the request line.
 * @param path - vault-relative path with `/` separators.
 * @returns the same path with every non-unreserved byte escaped per segment.
 */
export declare function encodeVaultPath(path: string): string;
/**
 * Write one note with a single PUT, so the vault holds either the whole note or nothing.
 * @param target - endpoint, folder and token.
 * @param path - vault-relative note path.
 * @param text - note Markdown.
 * @returns the vault path that was written.
 * @throws ObsidianError when the endpoint refuses or cannot be reached.
 */
export declare function putNote(target: ObsidianTarget, path: string, text: string): Promise<string>;
//# sourceMappingURL=obsidian.d.ts.map