# Changelog

Every tag publishes the prebuilt tarball the plugin-market entry installs, at `https://github.com/shijiezhiai/dsh-zhihu/releases/download/v<version>/dsh-zhihu.tgz`; the asset name stays `dsh-zhihu.tgz`, so a version is identified by its URL.

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
