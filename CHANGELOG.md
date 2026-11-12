# Changelog

Every tag publishes the prebuilt tarball the plugin-market entry installs, at `https://github.com/shijiezhiai/dsh-zhihu/releases/download/v<version>/dsh-zhihu.tgz`; the asset name stays `dsh-zhihu.tgz`, so a version is identified by its URL.

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
