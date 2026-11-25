# Changelog

Every tag publishes the prebuilt tarball the plugin-market entry installs, at `https://github.com/shijiezhiai/dsh-zhihu/releases/download/v<version>/dsh-zhihu.tgz`; the asset name stays `dsh-zhihu.tgz`, so a version is identified by its URL.

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
