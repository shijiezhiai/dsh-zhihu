# Changelog

Every tag publishes the prebuilt tarball the plugin-market entry installs, at `https://github.com/shijiezhiai/dsh-zhihu/releases/download/v<version>/dsh-zhihu.tgz`; the asset name stays `dsh-zhihu.tgz`, so a version is identified by its URL.

## 1.17.0

### Added

- The keyword lane takes an order — Zhihu's own relevance, newest first, or most upvoted — and a time window of the past day, week, month or year, both picked from two menus under the keyword box and kept with the rest of the page. A lane on an order other than relevance, or on any window, is answered by reading several pages of Zhihu's search and keeping one slice, so it ends at that slice instead of offering more; an entry dated outside the window, or carrying no date, is left out. The Remote rejects an order or window the lane does not offer.

## 1.16.0

### Added

- An export carries the item's discussion after the reader closed the row and reopened it: the page reads the conversation back from the Session it remembered for that row, holds it only for the read, and files it under the note body. The conversation the open Discussion segment holds is still filed without that read. A Session the Host no longer lists, or one this Client cannot read, leaves the note with its body alone.

## 1.15.1

### Fixed

- The shared page is written to `zhihu-page.json` instead of a dot file, which the Obsidian vault neither lists nor syncs, and its body travels as the media type the Local REST API accepts there; `application/json` is answered with 500 on that endpoint even when the bytes land, so the page never recorded a save. A `.zhihu-page.json` that 1.15.0 could have left behind is ignored and can be deleted.

## 1.15.0

### Added

- The page two machines share: the lane on screen, the packed or roomy setting, every row's discussion, the rank marks and the row a reader left open with the paragraph they reached are written into the reader's Obsidian vault as one small JSON file, `.zhihu-page.json` in the export folder. A page that opens reads that file first and takes over the newer copy, then writes back after each change settles; `remote.state` and `remote.saveState` carry it, the Host checks the format version and the write instant, and a vault it cannot reach leaves the page on this browser's own storage.

## 1.14.0

### Added

- The item a reader leaves open and the paragraph they reached are part of the stored page state, so switching away from the page or reopening the panel comes back to that item instead of the list, at the offset it was left. Going back to the list forgets the item, and opening another one starts that body at its top. The body is read again, and the paragraph lands once it arrives.

## 1.13.0

### Added

- Every submitted search opens its own tab beside the earlier ones, so a second search no longer replaces the hits of the first. A tab the reader already has reopens with its stored hits and asks Zhihu for nothing, a repeated query reuses its tab instead of adding a second, and closing a tab steps to the one beside it. The page keeps eight tabs and drops the oldest beyond that, all of them stored with the rest of the reading state.

## 1.12.0

### Added

- A comment's replies read on demand: the panel shows how many replies a root comment has and reads ten of them only when the reader asks, with "Read more" widening that slice the same way the thread above it does. Zhihu keeps one level of replies, so a reply to a reply arrives in the same list and no third level opens. `remote.replies` serves one slice per call and refuses an empty comment id.

## 1.11.0

### Added

- A feed row shows the upvote count its payload carries, so the recommendation and follow lanes and the search results say how much an item earned before it is opened. The hot list's question targets carry no count, so those rows keep showing only their heat label, and the panel never spends a request to fill a number in.
- An opened row now lists its root comments under the body: ten are read when the row opens, each shows its author, upvotes, reply count and text, and "Read more" asks for ten more. `remote.comments` serves one slice per call, so a thread larger than `http.commentPages` pages stops growing and the button goes away; a refused read keeps the comments already shown and offers a retry.

## 1.10.0

### Added

- `remote.quoteMaxChars` (default 1200) sets how long a passage one quoted instruction carries. The page reads the cap from the Remote when it opens and quotes with the built-in 1200 only when the Host publishes no namespace, so a deployment that takes longer selections raises the cap without rebuilding the client.

## 1.9.2

### Added

- The HTTP client absorbs one throttling wait: a response that names a `Retry-After` no longer than `http.retryCeilingMs` (default 30 s) is waited out and the request is sent once more, so a burst that Zhihu briefly refuses no longer surfaces as a failure. A longer or unnamed wait, or a second failure of the same request, is still reported with the seconds to wait. `0` restores the previous behaviour of reporting every throttled request immediately.
- The wait, and the request itself, end as soon as the calling tool is cancelled: the signal a tool receives now reaches the seam, the transport, and the retry wait.

## 1.9.1

### Fixed

- `zhihu_watch` now speaks the Host Schedule API that ships with the desktop application: `start` sends a typed creation request carrying its timing and its target Session plus the acting Session, both lookups read the Host catalog instead of a Session-scoped list, and `stop` deletes through an edit request. 1.9.0 was written against an earlier Schedule revision, so `start` and `stop` failed at runtime in a current Host while `check` worked.

## 1.9.0

### Added

- `zhihu_watch` follows one keyword lane on a schedule wherever the profile mounts the Host Schedule service: `start` records the lane's current ids and creates a recurring reminder, `check` reports only the entries that arrived since, each with its title and link, and `stop` removes that reminder. Nothing is declared when the service is absent.
- `zhihu_feed` takes the `cursor` an earlier answer returned and reports the cursor that continues the feed, so a keyword lane pages from the model side as it does in the panel.

## 1.8.0

### Added

- A `topic` lane watches a keyword: the page takes the keyword the reader submits, lists what Zhihu's own search finds for it, pages it the same way as the other feeds and marks what the lane gained since its last read. `zhihu_feed` serves the same lane through `kind: 'topic'` plus that keyword, continuing from the cursor of the previous page.

## 1.7.0

### Added

- The page header carries a `Compact` switch that packs the lists tightly: every excerpt drops to one line and the gaps between rows close, so a narrow pane shows more entries. The roomy setting gives the excerpt two lines. The choice is stored with the page and restored on the next visit.

## 1.6.0

### Added

- A response cache answers a repeated identical request from memory for `http.cacheTtlMs` (default 60 s, `0` disables it), so reopening a lane or rereading an item inside that window costs no upstream request; failures are never stored, so a retry after a throttle reaches Zhihu again.
- A throttled response's `Retry-After` is kept on the failure as `retryAfterSeconds` and named in its message, so the panel and the tools say how many seconds to wait instead of only that calls were too frequent.

## 1.5.0

### Added

- `zhihu_comments` reads the root comments of a question, an answer, or an article, in Zhihu's own hotness order, with each comment's upvotes, author, date, reply count, and text — the signal a reader uses to judge whether a post is worth trusting. Zhihu ranks at most ten root comments per page, so a call answers one slice of the thread and reads up to `http.commentPages` pages for a larger limit; comments are untrusted external content, and a challenge page surfaces as `ZHIHU_BLOCKED` rather than as an empty thread.

## 1.4.0

### Added

- The reader's right-click menu on an open item now copies the selection as a citation — the passage quoted, then a link to the row it came from — and files just that passage into the note of that row under its own heading, leaving the rest of the note in place. Filing reads the note back first, writes nothing when the same passage is already there, and creates the note when the reader marks the first passage.

## 1.3.8

### Added

- `zhihu_search` takes `sort` (`relevance`, `newest`, `top`) and `timeWindow` (`day`, `week`, `month`, `year`), so a question about what was published recently can be answered in one call, and every dated hit shows its creation date. Zhihu's search endpoint has one relevance order and ignores every sort and date parameter, so these calls read up to `http.searchScanPages` pages themselves, answer one slice, and return no cursor.

## 1.3.7

### Fixed

- The passage bubble stays inside the pane it opens in and never leaves its buttons off-screen: it is placed and sized from the surface the reader pointed in, so a sidebar pane narrower than the window still holds the whole card, and a window resize dismisses the bubble instead of leaving it at coordinates the rewrapped text no longer sits under.

## 1.3.6

### Changed

- A search hit that is an article now says it needs its title too, matching what the feed already says; the id alone reads it as a question or answer.

## 1.3.5

### Changed

- Feed guidance now says how to read an article row: pass its id together with the title that row shows, so a column post arrives without opening a browser. The read path already worked; only the follow-up note and the tool description claimed otherwise.

## 1.3.4

### Added

- A list is walkable from the keyboard: the arrow keys or j and k move from row to row, Home and End jump to the ends, Enter opens the row holding focus, and Escape leaves the list. One row owns the tab stop at a time, so Tab enters the list once, and a plain letter pressed with a command modifier is left to the command it belongs to.

## 1.3.3

### Fixed

- The right-click menu of an open row opens at the pointer again. It is placed from the wrapper span's viewport rect, which the plugin now puts at the click point; host builds that predate the rect callback had measured the wrapper where it sat in the article text, so on a long article the menu opened past the fold and a right click looked like nothing happened.

## 1.3.2

### Added

- The follow lane counts what arrived since its last read, above them and under a dividing line, because that lane ranks nothing and a per-row mark would only say "new" on every row. A lane read for the first time counts nothing, and the ranked lanes keep their per-row new, climbed and fell marks.

## 1.3.1

### Added

- The right-click menu of an open row can copy the passage the reader selected, and ⌘⇧C does the same from the keyboard; the row stays visible but unavailable until something is selected, and a selection the click collapses is kept from the moment the menu opened.

## 1.3.0

### Added

- A comparison across items: a passage can be filed from the bubble into a comparison instead of asking about it right away, more passages join it from other items, and the bar under the list names how many passages from how many items it holds. Clearing it empties the bar; the bar and what it holds come back with the page.
- Discuss these opens one Session for the whole comparison and sends it as the first message: each item arrives with its kind and id so a read reaches it, and every passage is quoted under the item it came from. The same set of items always resumes the same Session, and a set of one reuses that item's own discussion.
- A comparison appears in My discussions under the item it started from, marked with how many items it adds, and reopens with every item it quotes.

## 1.2.2

### Fixed

- A note the vault refuses now says why: the line names the cause the Host reported — no stored token, an unreachable endpoint with the socket error, the HTTP status the vault answered with, or a timeout — instead of only that the write failed.

## 1.2.1

### Fixed

- A table renders as a pipe table instead of one paragraph per cell, so a benchmark or comparison inside a column post keeps its rows and columns.
- A long column post arrives whole: the default body cap rises from 8000 to 30000 characters.

## 1.2.0

### Added

- My discussions: a list of every discussion the panel remembers, each with the row it belongs to, the kind, the time it opened and the last answer's first line. Opening one returns to that row and resumes its Session instead of starting another.
- A discussion can be archived from the list: the entry leaves the list and the workspace archive keeps the Session, while a refused archive leaves both the entry and a line saying so.

## 1.1.2

### Fixed

- A note files the whole discussion, not just its closing sentence: every settled turn appears under `## <discussion heading>`, labelled as the reader's question or the model's answer, in the order they happened.

## 1.1.1

### Fixed

- A note no longer carries a quoted line about the capture limit. A capture the provider cut now records `truncated: true` in the note's frontmatter, so the note body stays the item's own text.

## 1.1.0

### Added

- Ask about a passage: selecting text in an answer or a column post, or clicking one of its paragraphs, opens a bubble over the reader with that item's quick instructions and a free-text field. The instruction quotes the passage and names the item.
- Merge several passages into one quote: clicking another paragraph appends it to the quote already in the bubble, so one instruction can cover an argument that spans them.
- File the discussion's latest answer in the exported Obsidian note, under a heading of its own, while that item's Discussion segment is open.
- Mark lane movement: after a lane is read a second time, rows that are new and the places each row climbed or fell show beside the row. The first read of a lane marks nothing.

### Fixed

- A long draft no longer closes the passage bubble, and the field grows with the text instead of clipping it.

## 1.0.1

### Fixed

- Create the pack directory before packing, so the release workflow publishes the tarball.
