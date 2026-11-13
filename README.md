---
description: "Zhihu inside DeepSeek Harness: feeds, question and column reading, in-site search, a sidebar panel, a per-item discussion Session and Obsidian capture, shipped as one installable package."
kind: "package-bundle"
---

# @deepseek-ai/dsh-zhihu-plugin

English | [中文](README.zh.md)

## Summary

One installable package puts Zhihu inside the harness: three model tools read the hot and recommendation feeds, one answer or column post and search results, and the same package draws a sidebar panel where a reader opens those rows, quotes a passage, discusses the item in a real Session and writes it to Obsidian. Nothing model-facing appears until a profile enables the plugin.

## Table of Contents

- [Use this package](#use-this-package)
- [Understand the implementation](#understand-the-implementation)
- [Further Exploration](#further-exploration)
- [Model Experience](#model-experience)
- [Known Limitations and Deferred Work](#known-limitations-and-deferred-work)
- [Dev Note](#dev-note)

-----

<a id="use-this-package"></a>
## Use this package

Add the package to a profile's bundles and enable one plugin:

```jsonc
// <profile>/package.json
{
  "dsh": { "profile": { "bundles": ["@deepseek-ai/dsh-base", "@deepseek-ai/dsh-web-app", "@your-scope/dsh-zhihu"] } }
}
```

Each release publishes a prebuilt tarball at `https://github.com/shijiezhiai/dsh-zhihu/releases/download/v<version>/dsh-zhihu.tgz`, and the plugin-market entry pins the current version's URL. `dsh plugin --profile <name> add <that url>` installs it into a profile; pnpm records a tarball dependency by URL, so re-adding an installed URL stays on the version already there.

Store the signed-in cookie under the ref the provider reads, `zhihu` by default:

```sh
dsh credentials set zhihu   # Cookie header value of a signed-in www.zhihu.com request
```

Zhihu answers 401 to anonymous callers, so the tools and the panel stay unavailable until that credential exists. Host plugins load at startup: enabling or updating this package needs a restart, and the browser panel arrives with it.

Every setting has a default and is validated at load:

| Field | Default | Meaning |
| --- | --- | --- |
| `http.credential` | `zhihu` | Credential ref holding the cookie |
| `http.userAgent` | Chrome 126 on macOS | User-Agent sent to Zhihu |
| `http.requestTimeoutMs` | `20000` | One request's deadline |
| `http.minIntervalMs` | `1000` | Spacing between calls to Zhihu |
| `http.maxContentChars` | `30000` | Longest body the provider keeps |
| `http.pageSize` | `20` | Rows per feed page |
| `http.maxFeedPages` | `3` | Pages one feed call may walk |
| `http.answerLimit` | `1` | Answers read with one question |
| `tool.maxItems` | `20` | Entries one tool call returns |
| `tool.maxAnswerLimit` | `5` | Answers a tool call may ask for |
| `tool.excerptMaxChars` | `200` | Excerpt length in feed rows |
| `tool.timeoutMs` | `30000` | One tool call's deadline |
| `remote.defaultLimit` | `20` | Rows a panel request returns |
| `remote.maxLimit` | `50` | Largest limit the Remote accepts |
| `remote.obsidianUrl` | `https://127.0.0.1:27124` | Obsidian REST endpoint |
| `remote.obsidianFolder` | `zhihu` | Vault folder that notes land in |
| `remote.obsidianCredential` | `OBSIDIAN_API_KEY` | Credential ref holding the Obsidian key |

What the reader gets: lanes for hot, recommendation, follow and search that page as you scroll and restore the lane you left, with the rows that are new, climbed or fell since that lane was last read marked beside them; a reader with right-click copy, and an export that files the item's whole discussion, question and answer in turn, under the note body and records a body the capture limit cut as frontmatter rather than a line in the note; a passage bubble that merges several blocks into one quote; a Discussion segment that keeps one Session per item; and a My discussions list that reopens any of them or files one away.

-----

<a id="understand-the-implementation"></a>
## Understand the implementation

<details>
<summary>Implementation internals — click to expand</summary>

`src/index.ts` is the only Host entry: its `apply` mounts the `ctx.zhihu` seam, the credentialed HTTP provider, the model tools and the authenticated Remote, while `package.json` declares the browser half through `dsh.client`, so one install covers both planes. The seam answers feeds, reads and search; the provider owns the cookie, the spacing between calls and the typed failures; the tools render what the model reads; and the Remote serves bounded rows to the panel, which never calls Zhihu itself.

| Source | Contents |
|---|---|
| [`src/service/`](src/service/) | The `ctx.zhihu` seam: requests, typed failures, provider selection |
| [`src/http/`](src/http/) | Credentialed provider: cookie, rate limit, Markdown and text extraction |
| [`src/tool/`](src/tool/) | `zhihu_feed`, `zhihu_read`, `zhihu_search` and their rendering |
| [`src/remote/`](src/remote/) | Authenticated Remote, Obsidian capture, panel projections |
| [`src/client/`](src/client/) | Panel, reader, passage quoting, discussion segment, discussion list, tool cards |
| [`tests/`](tests/) | Provider, tool, Remote and client tests |

</details>

-----

<a id="further-exploration"></a>
## Further Exploration

- [Tools](../../core/tools/README.md) — declarations, step admission and result rendering.
- [Session projections](../../session/session-projection/README.md) — the panel state the browser reads.

<a id="model-experience"></a>
## Model Experience

### Feed tool

#### What the model sees

`zhihu_feed` is declared once per Session of a profile that enables the plugin, with `kind` (`hot`, `recommend`, `follow`) and `limit`. A call returns the untrusted-content notice, a labelled list with one link per entry, and a follow-up that names `zhihu_read` for the entry the model picks. Excerpts are cut at `tool.excerptMaxChars`, and a failure carries its reason instead of rows.

#### Token effect

The declaration rides every request of that Session; a call adds the notice, up to `tool.maxItems` rows and their links. Nothing accumulates: no page is kept in the conversation, so a second call costs what the first did.

#### KV Cache effect

The declarations never change between steps of a Session, so the cached prefix survives every call and results append to the log as ordinary tool results.

### Read tool

#### What the model sees

`zhihu_read` takes `kind` (`question`, `answer`, `article`), the id exactly as a listing returned it, the title for an article and `answerLimit`. Ids are decimal strings of varying length, so the description tells the model to pass one back verbatim rather than reconstruct it. The body arrives as text under the untrusted-content notice, cut at `http.maxContentChars`.

#### Token effect

One read costs the notice, the header and up to `http.maxContentChars` characters of body — the largest single result of the three tools. A question read adds up to `tool.maxAnswerLimit` answers.

#### KV Cache effect

Same as the feed tool: a static declaration and an appended result, so the prefix is reused.

### Search tool

#### What the model sees

`zhihu_search` takes `query`, `limit` and an optional `cursor`. Hits carry a title, a link and an excerpt; the returned cursor resumes the same query, and a page that ends returns none.

#### Token effect

A call adds the notice and up to `tool.maxItems` hits with their excerpts; the cursor is a short string, so paging costs about what one page does.

#### KV Cache effect

Same as the other two: nothing in the declaration moves, and each page appends its result.

## Known Limitations and Deferred Work

<a id="known-limitations-and-deferred-work"></a>

- The provider needs a signed-in cookie. Without it every tool call and every panel request answers 401, so the credential is a precondition rather than a fallback.
- A discussion keeps one Session per item in the page's persisted state, and the My discussions list is that same record. Clearing site data forgets the mapping and empties the list, and the next instruction opens a new Session instead of resuming the old one.
- Rank marks compare a lane against the rows that lane last listed, and both live in the same browser storage: clearing site data resets the marks, and a lane read for the first time marks nothing because it has nothing to compare against.
- A passage question quotes the reader's rendered text, which is not the `contentText` the model reads, so a quote is capped at 1200 characters and a longer selection is cut.
- An export files the discussion only while that item's Discussion segment is open in the panel; a discussion resumed later is not read back for the note.
- Zhihu throttles: the provider spaces calls by `http.minIntervalMs` and the tools report the failure rather than retrying, so a burst of calls can surface an error the reader has to repeat.
- An installed tarball is recorded by URL, so a profile upgrades only when it is handed the new release's URL; the plugin-market entry pins one version at a time.
- The Host half loads at startup, so enabling, disabling or updating the package needs a restart.

<a id="dev-note"></a>
### Dev Note

<details>
<summary>Working context for maintainers — click to expand</summary>

Releasing:

1. Bump `version` here, add that version's section to `CHANGELOG.md`, and mirror both in the publishing repository.
2. Rebuild the artifacts, then `node scripts/pack-dist.mjs --name @mayangyang/dsh-zhihu --out <dir>` and copy `src/`, `lib/`, `locale/`, `cordis.patch.yml`, `package.json`, `README.md` and `CHANGELOG.md` into the publishing repository.
3. Commit, then `git tag v<version>` and push the tag. The workflow refuses a tag that disagrees with `package.json`, publishes `dsh-zhihu.tgz`, and installs that URL into a throwaway profile before it passes.
4. Open a catalog pull request that points the plugin-market entry at the new pinned URL.

</details>
