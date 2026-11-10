/** Write one Zhihu capture into an Obsidian vault through the Local REST API plugin. */
import { request as httpRequest } from 'node:http'
import { request as httpsRequest } from 'node:https'
import type { ZhihuExportQuery } from './types.ts'

/** Where a note lands and who may write it; resolved from plugin config and credentials. */
export interface ObsidianTarget {
  /** Base URL of the Local REST API, such as `https://127.0.0.1:27124`. */
  readonly url: string
  /** Vault folder holding the notes; empty writes to the vault root. */
  readonly folder: string
  /** Bearer token from the Local REST API plugin. */
  readonly token: string
}

/** A vault write that did not land, named by what the caller can act on. */
export class ObsidianError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options)
    this.name = 'ObsidianError'
  }
}

/** Longest note name kept from a title before the id disambiguates the note. */
const NAME_LIMIT = 80

/**
 * Quote one YAML scalar the way the vault's queries expect.
 * @param value - text as the provider returned it.
 * @returns a double-quoted scalar with quotes and control characters neutralized.
 */
export function yamlScalar(value: string): string {
  const text = value.replace(/[\\"\u0000-\u001f]/g, char => (char === '\\' ? '\\\\' : char === '"' ? '\\"' : ' '))
  return '"' + text + '"'
}

/**
 * Turn a title into a file name the vault accepts on every platform.
 * @param title - note title as read from Zhihu.
 * @param id - content id, used when the title carries nothing usable.
 * @returns one path segment without separators or trailing dots.
 */
export function noteName(title: string, id: string): string {
  const cleaned = title
    .replace(/[\\/?%*:|"<>\u0000-\u001f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, NAME_LIMIT)
    .replace(/[. ]+$/, '')
  return cleaned === '' ? `zhihu-${id}` : cleaned
}

/**
 * Vault-relative path of one capture.
 * @param folder - configured vault folder.
 * @param name - note name without its extension.
 * @returns `<folder>/<name>.md`, or `<name>.md` for a root folder.
 */
export function notePath(folder: string, name: string): string {
  const dir = folder.trim().replace(/^\/+/, '').replace(/\/+$/, '')
  return dir === '' ? `${name}.md` : `${dir}/${name}.md`
}

/**
 * The note text: frontmatter the vault can query, then the body.
 * @param entry - capture as the Client sent it.
 * @param day - `YYYY-MM-DD` the capture was saved.
 * @returns Markdown written as one request body.
 */
export function noteText(entry: ZhihuExportQuery, day: string): string {
  const front = ['---', `title: ${yamlScalar(entry.title)}`, `source: ${yamlScalar(entry.url)}`]
  if (entry.author !== undefined && entry.author !== '') front.push(`author: ${yamlScalar(entry.author)}`)
  front.push(`kind: ${yamlScalar(entry.kind)}`, `saved: ${yamlScalar(day)}`, '---', '')
  const body = entry.body.trim() === '' ? '_This capture carried no body text._' : entry.body.trim()
  const tail = entry.truncated ? ['', '> Text truncated by the capture limit.'] : []
  return [...front, body, ...tail].join('\n') + '\n'
}

/**
 * Encode a vault path so each segment survives the request line.
 * @param path - vault-relative path with `/` separators.
 * @returns the same path with every non-unreserved byte escaped per segment.
 */
export function encodeVaultPath(path: string): string {
  return path.split('/').map(segment => encodeURIComponent(segment)).join('/')
}

/**
 * Write one note with a single PUT, so the vault holds either the whole note or nothing.
 * @param target - endpoint, folder and token.
 * @param path - vault-relative note path.
 * @param text - note Markdown.
 * @returns the vault path that was written.
 * @throws ObsidianError when the endpoint refuses or cannot be reached.
 */
export async function putNote(target: ObsidianTarget, path: string, text: string): Promise<string> {
  const endpoint = `/vault/${encodeVaultPath(path)}`
  let url: URL
  try {
    url = new URL(endpoint, target.url)
  } catch (error) {
    throw new ObsidianError(`Obsidian endpoint is not a URL: ${target.url}`, { cause: error })
  }
  const send = url.protocol === 'https:' ? httpsRequest : httpRequest
  const status = await new Promise<number | undefined>((resolve, reject) => {
    const outgoing = send(url, {
      method: 'PUT',
      headers: {
        authorization: `Bearer ${target.token}`,
        'content-type': 'text/markdown; charset=utf-8',
        'content-length': Buffer.byteLength(text),
      },
      // The plugin serves a self-signed certificate on its own loopback port.
      rejectUnauthorized: false,
    }, (incoming) => {
      incoming.resume()
      incoming.on('end', () => { resolve(incoming.statusCode) })
    })
    /* v8 ignore start -- only a vault that accepts the connection and never answers reaches this timer, which the suite does not spend */
    outgoing.setTimeout(10_000, () => {
      outgoing.destroy(new ObsidianError(`Obsidian did not answer within 10s at ${target.url}`))
    })
    /* v8 ignore stop */
    outgoing.on('error', (error) => { reject(new ObsidianError(`cannot reach Obsidian at ${target.url}`, { cause: error })) })
    outgoing.end(text)
  })
  if (status !== 200 && status !== 201 && status !== 204) {
    throw new ObsidianError(`Obsidian refused the note: HTTP ${String(status)}`)
  }
  return path
}
