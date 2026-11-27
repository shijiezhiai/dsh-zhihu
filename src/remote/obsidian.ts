/** Write one Zhihu capture into an Obsidian vault through the Local REST API plugin. */
import { request as httpRequest } from 'node:http'
import { request as httpsRequest } from 'node:https'
import type { ZhihuExportExcerpt, ZhihuExportQuery } from './types.ts'

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
 * Name of the vault file that carries the page two machines share. It leads with
 * no dot: the vault ignores dot files, so it neither indexes nor syncs one.
 */
export const STATE_NAME = 'zhihu-page.json'

/**
 * Vault-relative path of the shared page state.
 * @param folder - vault folder holding the notes; empty writes to the vault root.
 * @returns the document path.
 */
export function statePath(folder: string): string {
  const dir = folder.trim().replace(/^\/+/, '').replace(/\/+$/, '')
  return dir === '' ? STATE_NAME : `${dir}/${STATE_NAME}`
}

/**
 * The note text: frontmatter the vault can query, then the body, then the
 * conclusion the reader reached about it. A capture the provider cut records
 * `truncated: true` in the frontmatter, so the body stays plain Markdown.
 * @param entry - capture as the Client sent it.
 * @param day - `YYYY-MM-DD` the capture was saved.
 * @returns Markdown written as one request body.
 */
export function noteText(entry: ZhihuExportQuery, day: string): string {
  const front = ['---', `title: ${yamlScalar(entry.title)}`, `source: ${yamlScalar(entry.url)}`]
  if (entry.author !== undefined && entry.author !== '') front.push(`author: ${yamlScalar(entry.author)}`)
  front.push(`kind: ${yamlScalar(entry.kind)}`, `saved: ${yamlScalar(day)}`)
  if (entry.truncated) front.push('truncated: true')
  front.push('---', '')
  const body = entry.body.trim() === '' ? '_This capture carried no body text._' : entry.body.trim()
  const conclusion = entry.discussion
  const discussion = conclusion === undefined || conclusion.text.trim() === ''
    ? []
    : ['', `## ${conclusion.heading}`, '', conclusion.text.trim()]
  return [...front, body, ...discussion].join('\n') + '\n'
}

/**
 * The section one excerpt adds to its note.
 * @param excerpt - the passage and the heading it files under.
 * @returns Markdown holding a heading and the passage.
 */
export function excerptSection(excerpt: ZhihuExportExcerpt): string {
  return `## ${excerpt.heading}\n\n${excerpt.text.trim()}\n`
}

/**
 * Encode a vault path so each segment survives the request line.
 * @param path - vault-relative path with `/` separators.
 * @returns the same path with every non-unreserved byte escaped per segment.
 */
export function encodeVaultPath(path: string): string {
  return path.split('/').map(segment => encodeURIComponent(segment)).join('/')
}

/** One answer from the vault. */
interface VaultAnswer {
  /** Status the vault answered with; undefined when the connection closed without one. */
  readonly status: number | undefined
  /** Body the vault sent; empty for a write. */
  readonly text: string
}

/**
 * Send one request to the vault.
 * @param target - endpoint and token.
 * @param method - what to do with the note.
 * @param path - vault-relative note path.
 * @param body - content to write; omitted for a read.
 * @param media - media type the vault stores the content as.
 * @returns the status the vault answered with and the body it sent.
 * @throws ObsidianError when the endpoint is not a URL, refuses the connection or never answers.
 */
async function sendToVault(
  target: ObsidianTarget,
  method: 'GET' | 'PUT',
  path: string,
  body?: string,
  media = 'text/markdown',
): Promise<VaultAnswer> {
  const endpoint = `/vault/${encodeVaultPath(path)}`
  let url: URL
  try {
    url = new URL(endpoint, target.url)
  } catch (error) {
    throw new ObsidianError(`Obsidian endpoint is not a URL: ${target.url}`, { cause: error })
  }
  const send = url.protocol === 'https:' ? httpsRequest : httpRequest
  const headers: Record<string, string | number> = { authorization: `Bearer ${target.token}` }
  if (body === undefined) {
    headers.accept = media
  } else {
    headers['content-type'] = `${media}; charset=utf-8`
    headers['content-length'] = Buffer.byteLength(body)
  }
  return await new Promise<VaultAnswer>((resolve, reject) => {
    const outgoing = send(url, {
      method,
      headers,
      // The plugin serves a self-signed certificate on its own loopback port.
      rejectUnauthorized: false,
    }, (incoming) => {
      let text = ''
      incoming.setEncoding('utf8')
      incoming.on('data', (chunk: string) => { text += chunk })
      incoming.on('end', () => { resolve({ status: incoming.statusCode, text }) })
    })
    /* v8 ignore start -- only a vault that accepts the connection and never answers reaches this timer, which the suite does not spend */
    outgoing.setTimeout(10_000, () => {
      outgoing.destroy(new ObsidianError(`Obsidian did not answer within 10s at ${target.url}`))
    })
    /* v8 ignore stop */
    outgoing.on('error', (error) => {
      reject(new ObsidianError(`cannot reach Obsidian at ${target.url}: ${error.message}`, { cause: error }))
    })
    outgoing.end(body)
  })
}

/**
 * Write one vault file with a single PUT, so the file holds either the whole content or nothing.
 * @param target - endpoint, folder and token.
 * @param path - vault-relative path.
 * @param text - content to store.
 * @param media - media type the content is written and read as.
 * @param what - noun naming the file in a refusal.
 * @returns the vault path that was written.
 * @throws ObsidianError when the endpoint refuses or cannot be reached.
 */
async function writeVaultFile(
  target: ObsidianTarget,
  path: string,
  text: string,
  media: string,
  what: string,
): Promise<string> {
  const { status } = await sendToVault(target, 'PUT', path, text, media)
  if (status !== 200 && status !== 201 && status !== 204) {
    throw new ObsidianError(`Obsidian refused the ${what}: HTTP ${String(status)}`)
  }
  return path
}

/**
 * Read one vault file.
 * @param target - endpoint, folder and token.
 * @param path - vault-relative path.
 * @param media - media type the file is read as.
 * @param what - noun naming the file in a refusal.
 * @returns the content, or undefined when the vault holds no file at that path.
 * @throws ObsidianError when the endpoint answers with anything but the file or its absence.
 */
async function readVaultFile(
  target: ObsidianTarget,
  path: string,
  media: string,
  what: string,
): Promise<string | undefined> {
  const { status, text } = await sendToVault(target, 'GET', path, undefined, media)
  if (status === 404) return undefined
  if (status !== 200) {
    throw new ObsidianError(`Obsidian refused the ${what}: HTTP ${String(status)}`)
  }
  return text
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
  return await writeVaultFile(target, path, text, 'text/markdown', 'note')
}

/**
 * Read one note, so a capture can add to what the vault already holds.
 * @param target - endpoint, folder and token.
 * @param path - vault-relative note path.
 * @returns the note's Markdown, or undefined when the vault holds no note at that path.
 * @throws ObsidianError when the endpoint answers with anything but the note or its absence.
 */
export async function readNote(target: ObsidianTarget, path: string): Promise<string | undefined> {
  return await readVaultFile(target, path, 'text/markdown', 'note')
}

/**
 * Media type the state document is sent as. The extension names it as JSON, and the
 * Local REST API answers `application/json` with 500 there, so the body travels as
 * Markdown type the endpoint accepts and the reader parses it by its extension.
 */
const DOCUMENT_MEDIA = 'text/markdown'

/**
 * Write the page state two machines share.
 * @param target - endpoint, folder and token.
 * @param path - vault-relative path of the state document.
 * @param text - JSON to store.
 * @returns the vault path that was written.
 * @throws ObsidianError when the endpoint refuses or cannot be reached.
 */
export async function writeDocument(target: ObsidianTarget, path: string, text: string): Promise<string> {
  return await writeVaultFile(target, path, text, DOCUMENT_MEDIA, 'reading state')
}

/**
 * Read the page state another machine stored.
 * @param target - endpoint, folder and token.
 * @param path - vault-relative path of the state document.
 * @returns the stored JSON, or undefined when the vault holds none.
 * @throws ObsidianError when the endpoint answers with anything but the document or its absence.
 */
export async function readDocument(target: ObsidianTarget, path: string): Promise<string | undefined> {
  return await readVaultFile(target, path, DOCUMENT_MEDIA, 'reading state')
}

/**
 * File one capture: the whole note, or one more section added to the note already there.
 * @param target - endpoint, folder and token.
 * @param path - vault-relative note path.
 * @param entry - capture as the Client sent it.
 * @param day - `YYYY-MM-DD` the capture was saved.
 * @returns the vault path that was written.
 * @throws ObsidianError when the endpoint refuses or cannot be reached.
 */
export async function fileCapture(
  target: ObsidianTarget,
  path: string,
  entry: ZhihuExportQuery,
  day: string,
): Promise<string> {
  if (entry.excerpt === undefined) return await putNote(target, path, noteText(entry, day))
  const section = excerptSection(entry.excerpt)
  const existing = await readNote(target, path)
  // The same passage filed twice is the same section; the second pick leaves the note alone.
  if (existing !== undefined && existing.includes(section.trim())) return path
  const base = (existing ?? noteText(entry, day)).replace(/\n+$/u, '')
  return await putNote(target, path, `${base}\n\n${section}`)
}
