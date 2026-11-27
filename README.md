---
description: "Zhihu inside DeepSeek Harness: feeds, question and column reading, in-site search, a sidebar panel, a per-item discussion Session and Obsidian capture, shipped as one installable package."
kind: "package-bundle"
---

# @deepseek-ai/dsh-zhihu-plugin

English | [中文](README.zh.md)

## Summary

One installable package puts Zhihu inside the harness: four model tools read the hot and recommendation feeds, one answer or column post, search results and an item's root comments, a fifth follows one keyword on a schedule where the profile mounts the Host Schedule service, and the same package draws a sidebar panel where a reader opens those rows, reads the item with its root comments and the replies under any of them, quotes a passage, upvotes an answer, discusses the item in a real Session and writes it to Obsidian. Nothing model-facing appears until a profile enables the plugin.

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
| `http.commentPages` | `3` | Pages one comments call may walk |
| `http.cacheTtlMs` | `60000` | How long a repeated identical request answers from memory; `0` disables the cache |
| `http.retryCeilingMs` | `30000` | Longest `Retry-After` wait one request absorbs before it is sent once more; `0` never resends |
| `tool.maxItems` | `20` | Entries one tool call returns |
| `tool.maxAnswerLimit` | `5` | Answers a tool call may ask for |
| `tool.excerptMaxChars` | `200` | Excerpt length in feed rows |
| `tool.timeoutMs` | `30000` | One tool call's deadline |
| `remote.defaultLimit` | `20` | Rows a panel request returns |
| `remote.maxLimit` | `50` | Largest limit the Remote accepts |
| `remote.quoteMaxChars` | `1200` | Longest passage a quoted instruction carries |
| `remote.obsidianUrl` | `https://127.0.0.1:27124` | Obsidian REST endpoint |
| `remote.obsidianFolder` | `zhihu` | Vault folder that notes land in |
| `remote.obsidianCredential` | `OBSIDIAN_API_KEY` | Credential ref holding the Obsidian key |

What the reader gets: lanes for hot, recommendation, follow, a watched keyword and search that page as you scroll and restore the lane you left, every query the reader submits keeping its own search tab beside the earlier ones so a second search never replaces the hits of the first, with the rows that are new, climbed or fell since that lane was last read marked beside them and the follow lane, which ranks nothing, counting above them what arrived since its last read, while a keyword lane lists what Zhihu's own search finds for the keyword the reader submits, keeping one tab per keyword beside the earlier ones the way search does, pages it the same way, and takes the order the reader picks — Zhihu's own relevance order, the newest first, or the most upvoted — and a window of the past day, week, month or year, both picked per tab and kept with the rest of the page; the item a reader left open coming back where they left it, at the paragraph they had reached, whether they switch back to the page or reopen the panel; the lane, the packing, the discussions, the rank marks and that open row written into the reader's Obsidian vault as one small JSON file, so a second machine opens the same page; a list a reader can walk with the arrow keys or j and k, open with Enter and leave with Escape, and pack tightly or roomily, the compact setting cutting every excerpt to one line and closing the gaps between rows while the roomy one gives the excerpt two, with the choice kept for the next visit; a reader whose right-click menu copies a passage, a passage as a citation of the row it came from, or files just that passage under its own heading in the note of that row while the rest of the note stays, and an export that files the item's whole discussion, question and answer in turn, under the note body even after the reader closed the row, since the conversation is read back from the Session it was kept in, and records a body the capture limit cut as frontmatter rather than a line in the note and names the cause the Host reported when the vault refuses the note; a collection control on an opened answer or column post that files it into one of the reader's own collections and takes it out again when the same collection is picked twice; a passage bubble that opens on the text the reader selects or on a ⌘-click that names one block, merges several of those blocks into one quote rather than rising while the reader simply reads, narrowing itself to the pane it opens in and stepping aside when the window resizes, and files it into a comparison that survives a reload, so passages read in different items open one discussion whose instruction names the kind and id of every item it quotes; a Discussion segment that keeps one Session per item and one per comparison; and a My discussions list that reopens any of them, naming the item a comparison started from, or files one away.

-----

<a id="understand-the-implementation"></a>
## Understand the implementation

<details>
<summary>Implementation internals — click to expand</summary>

`src/index.ts` is the only Host entry: its `apply` mounts the `ctx.zhihu` seam, the credentialed HTTP provider, the model tools and the authenticated Remote, while `package.json` declares the browser half through `dsh.client`, so one install covers both planes. The seam answers feeds, reads, search, comments, the replies under a comment, and the page two machines share through the vault; the provider owns the cookie, the spacing between calls, the cache that answers a repeated request from memory for `http.cacheTtlMs`, the single resend it performs after a wait up to `http.retryCeilingMs`, and the typed failures, which carry the wait a throttling response named; the tools render what the model reads; and the Remote serves bounded rows to the panel, which never calls Zhihu itself.

| Source | Contents |
|---|---|
| [`src/service/`](src/service/) | The `ctx.zhihu` seam: requests, typed failures, provider selection |
| [`src/http/`](src/http/) | Credentialed provider: cookie, rate limit, response cache, Markdown and text extraction |
| [`src/tool/`](src/tool/) | `zhihu_feed`, `zhihu_read`, `zhihu_search`, `zhihu_comments`, `zhihu_watch` and their rendering |
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

`zhihu_feed` is declared once per Session of a profile that enables the plugin, with `kind` (`hot`, `recommend`, `follow` or `topic`), `limit` and an optional `cursor`; a `topic` call also carries the keyword it lists, matched by Zhihu's own search. An answer that a later page follows reports its cursor and names it, so the model continues the feed by passing that token back. A call returns the untrusted-content notice, a labelled list with one link per entry, and a follow-up that names `zhihu_read` for the entry the model picks; every row is readable that way, and an article row needs its id plus the title its own line shows. Excerpts are cut at `tool.excerptMaxChars`, and a failure carries its reason instead of rows.

#### Token effect

The declaration rides every request of that Session; a call adds the notice, up to `tool.maxItems` rows and their links. Nothing accumulates: no page is kept in the conversation, so a second call costs what the first did.

#### KV Cache effect

The declarations never change between steps of a Session, so the cached prefix survives every call and results append to the log as ordinary tool results.

### Watch tool

#### What the model sees

`zhihu_watch` appears only where the profile mounts the Host Schedule service; without it the four content tools are the whole declaration. `action` is `start`, `check` or `stop`, `keyword` names the lane, and `start` also takes `everyMinutes` from 1 through 1440. `start` reads the lane, records those ids as the baseline and creates one Host reminder titled `Zhihu watch: <keyword>` whose follow-up asks for a `check`; `check` answers only the entries the lane gained since the previous start or check, each with its title and its link; `stop` removes the reminders this tool created for that keyword. A `start` refuses rather than duplicating a reminder that already watches the keyword.

#### Token effect

The declaration rides every request of a Session in a profile that mounts the Schedule service. A `check` adds the notice, the count it scanned and one line per new entry; the baseline itself never enters the conversation, so an unchanged lane costs one line. The reminder's follow-up costs one user turn each time it fires.

#### KV Cache effect

Same as the other tools: the declaration never moves, and each call appends its result.

### Read tool

#### What the model sees

`zhihu_read` takes `kind` (`question`, `answer`, `article`), the id exactly as a listing returned it, the title for an article and `answerLimit`. Ids are decimal strings of varying length, so the description tells the model to pass one back verbatim rather than reconstruct it. The body arrives as text under the untrusted-content notice, cut at `http.maxContentChars`.

#### Token effect

One read costs the notice, the header and up to `http.maxContentChars` characters of body — the largest single result of the four tools. A question read adds up to `tool.maxAnswerLimit` answers.

#### KV Cache effect

Same as the feed tool: a static declaration and an appended result, so the prefix is reused.

### Search tool

#### What the model sees

`zhihu_search` takes `query`, `limit`, an optional `cursor`, and two narrowing arguments: `sort` (`relevance`, `newest` or `top`) and `timeWindow` (`day`, `week`, `month` or `year`). Hits carry a title, a link, an excerpt and their creation date; the returned cursor resumes the same query, and a page that ends returns none. Zhihu's search endpoint offers a single relevance order and ignores every sort and date parameter, so an ordered or windowed call reads several pages itself, answers one slice, and returns no cursor.

#### Token effect

A call adds the notice and up to `tool.maxItems` hits with their excerpts; the cursor is a short string, so paging costs about what one page does. An ordered or windowed call reads up to `http.searchScanPages` pages before it answers, which costs upstream requests but no result tokens beyond the same bounded slice.

#### KV Cache effect

Same as the other two: nothing in the declaration moves, and each page appends its result.

### Comments tool

#### What the model sees

`zhihu_comments` takes `kind` (`question`, `answer` or `article`), the id exactly as a listing returned it, `limit`, and an optional `cursor`. A call returns the untrusted-content notice, how much of the thread it covers, one line per comment with its upvote count, author, date, reply count and text, and the cursor of the page that follows, which a later call passes back to read on from there. A cursor names a whole page, so a call that asks for fewer comments than that page holds leaves the rest of it behind; asking for ten, the endpoint's own page size, keeps the thread unbroken. The follow-up states that Zhihu ranks by its own hotness score rather than by upvotes alone, and that readers' opinions are not evidence about the content.

#### Token effect

A call adds the notice and up to `tool.maxItems` comment lines cut at `tool.excerptMaxChars`. Zhihu ranks and returns at most ten root comments per page, so a larger limit reads up to `http.commentPages` pages — upstream requests, not result tokens. A cursor costs no such read: it starts a fresh page budget at the page it names, which is how a thread longer than one call allows is read to its end.

#### KV Cache effect

Same as the other tools: the declaration never moves, and each call appends its result.

## Known Limitations and Deferred Work

<a id="known-limitations-and-deferred-work"></a>

- The provider needs a signed-in cookie. Without it every tool call and every panel request answers 401, so the credential is a precondition rather than a fallback.
- A discussion keeps one Session per item in the page's persisted state, and the My discussions list is that same record. Clearing site data forgets the mapping and empties the list, and the next instruction opens a new Session instead of resuming the old one.
- A keyword lane reads that search endpoint's own pages only on its relevance order with no date filter. An order or a window the reader picks is answered by reading several pages of the search and keeping one slice, so such a tab stops at that slice instead of offering more, and an entry the payload dates outside the window — or does not date at all — is left out. Eight keywords are kept: the ninth drops the oldest tab. The keyword tabs, each tab's order and its window live in the same browser storage as the rest of the reading state, so they stay on this machine while the lane on screen travels through the vault.
- Search keeps eight tabs, dropping the oldest when a ninth query arrives, and every tab and its hits live in that same browser storage, so closing the browser keeps the searches and clearing the site data loses them.
- Rank marks and the follow lane's new count both compare a lane against the rows that lane last listed, and both live in the same browser storage: clearing site data resets them, and a lane read for the first time counts and marks nothing because it has nothing to compare against.
- A passage question quotes the reader's rendered text, which is not the `contentText` the model reads, so a quote is capped at `remote.quoteMaxChars` characters and a longer selection is cut. The page reads that cap from the Remote once when it opens, so a Client whose Host publishes no namespace quotes with the built-in 1200.
- A passage filed on its own reads the note first and appends one section, so the vault has to serve that note back; a vault that refuses the read reports the refusal and writes nothing. Filing the same passage twice writes nothing the second time, while the same words selected elsewhere in the item append a second section under the same heading.
- An export reads the discussion of the row it files from the Session the page remembered, so a row whose Session the Host no longer lists, or one this Client cannot read, files the note alone.
- The comments endpoint answers at most ten root comments per page in Zhihu's own hotness order, so a call answers one slice of a thread and a larger limit reads across pages from its first one; a challenge page surfaces as `ZHIHU_BLOCKED` rather than as an empty thread. The cursor a call returns names the page after the one it read, so a call that stopped partway through a page skips the rest of that page, and a cursor the tool did not issue — or one that names another content kind — reads the first page again. The panel's thread follows the same rule: it reads ten comments when a row opens and each further read asks for ten more, so a thread larger than `http.commentPages` pages stops growing and offers no more.
- The item a reader leaves open and the paragraph they reached are part of the stored page state, so both come back on the next visit. The page keeps the row rather than the answer, so the body is read again, and the paragraph lands once that body has arrived — on a slow request the reader sees the top of the body for that moment.
- The page two machines share is one JSON file in the export folder, `zhihu-page.json` (named without a leading dot, which the vault would neither list nor sync); the Host rewrites it whole after each change settles, so the copy written last wins and two machines that write at the same moment resolve on the write instant rather than merging. Without a stored Obsidian token, or with a vault it cannot reach, the page keeps working from this browser's own storage and nothing leaves the machine. Loaded rows, search hits and the passages collected for a comparison stay local, so a second machine re-reads the lanes it opens.
- A collection change is a write to the reader's own Zhihu account, offered only on an answer or a column post the panel opened, and it files the row into one of the reader's existing collections — the panel lists them and offers no way to create one, and no model tool can file anything. The menu asks for the list when it opens, so the collections it shows are the ones that endpoint returns at that moment. Zhihu's read endpoints do not report which collections hold an item, so the check mark follows only what this menu did itself: a row filed from another machine or in the Zhihu app reads as untouched, and picking that collection here files it a second time. A refused change leaves the button as it was and reports the refusal beside it.
- A row shows the upvote count only where the feed reports one: the hot list's question targets carry none, so those rows stay bare, and the panel never spends a request to fill a count in.
- The panel shows one level of replies: a comment's replies arrive behind a button that asks for ten of them, and each further read asks for ten more. A reply to a reply sits in that same list, so nothing opens a third level.
- An upvote is a write to the reader's own Zhihu account, offered only on an answer or an article the panel opened; a question row is followed rather than voted on, and no model tool can cast one. Zhihu's read endpoints do not report whether this reader already voted, so the button starts as a plain upvote and reports the state the answer named once one has been cast — a row already upvoted elsewhere therefore offers an upvote this account has already given. A refused vote leaves the count as it was and reports the refusal beside it.
- Zhihu throttles: the provider spaces calls by `http.minIntervalMs`, and a throttled response that names a `Retry-After` wait no longer than `http.retryCeilingMs` is absorbed once — the request waits that long, then is sent one more time. A longer or unnamed wait is reported instead, so a burst of calls can still surface an error the reader has to repeat; the failure message says how many seconds to wait, and cancelling the call ends the wait immediately.
- `zhihu_watch` keeps a keyword's baseline in the Host process, so a restart re-arms every check as a fresh baseline and the first check after a restart reports nothing new. The reminder belongs to the Session that created it, and the Schedule service refuses intervals shorter than one minute.
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
