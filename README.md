# @deepseek-ai/dsh-zhihu-plugin

Zhihu inside DeepSeek Harness: hot and recommendation feeds, question and column reading, in-site
search, a right-sidebar panel, an in-panel discussion that runs as a real Session, and one-key
capture into Obsidian. Everything ships as one package — one Host entry, one Client bundle, one
bundle patch — so installing it is a single step.

## What it registers

| Surface | Contribution |
| --- | --- |
| `ctx.zhihu` | Content seam: feeds, reads, search, rate limiting and typed failures |
| `ctx.zhihuProvider` | Credentialed HTTP provider using a Zhihu cookie |
| `ctx.tools` | `zhihu_feed`, `zhihu_read`, `zhihu_search` |
| `ctx.zhihuController` | Authenticated Remote serving bounded rows to the browser |
| Client | Tool cards, the right-sidebar Zhihu panel, the per-item discussion segment |

## Install

1. Add the package to a profile and enable it:

   ```jsonc
   // <profile>/package.json
   {
     "dsh": { "profile": { "bundles": ["@deepseek-ai/dsh-base", "@deepseek-ai/dsh-web-app", "@your-scope/dsh-zhihu"] } }
   }
   ```

2. Store the signed-in Zhihu cookie in the credentials service under the ref the provider reads
   (`zhihu` by default):

   ```sh
   dsh credentials set zhihu   # paste the Cookie header value of a signed-in www.zhihu.com request
   ```

   Zhihu answers 401 to anonymous callers, so a signed-in cookie is required; the provider never
   writes it anywhere else.

3. Restart the app. Host plugins load at startup, so the tools and the Remote appear only after a
   full restart; the browser panel then loads from the same package.

## Configuration

```yaml
- id: zhihu
  name: '@your-scope/dsh-zhihu'
  config:
    http:
      credential: zhihu        # credential ref holding the cookie
      requestTimeoutMs: 20000
      minIntervalMs: 1000      # spacing between calls to Zhihu
      maxContentChars: 8000
      pageSize: 20
      maxFeedPages: 3
      answerLimit: 1
    tool:
      maxItems: 20
      maxAnswerLimit: 5
      excerptMaxChars: 200
      timeoutMs: 30000
    remote:
      defaultLimit: 20
      maxLimit: 50
      obsidianUrl: https://127.0.0.1:27124
      obsidianFolder: zhihu
      obsidianCredential: OBSIDIAN_API_KEY
```

## Using it

- **Panel.** Open it from the sidebar; the lanes are hot, recommendation, follow and search. Rows
  page as you scroll, and the lane you left is restored on the next open.
- **Reader.** Open a row for the body, formatted from the provider's Markdown when it has one.
  Right-click for copy title, copy link, copy body, open on Zhihu, and export to Obsidian.
- **Discussion.** The reader's Discussion segment keeps one Session per item: ask a question there
  and the model fetches the body itself with `zhihu_read` instead of receiving it in the prompt, so
  the exchange stays logged and resumable like any other conversation.
- **Obsidian.** Export writes the entry as a Markdown note through the Obsidian REST API, and
  reports the note path when it lands.

## Publishing

The workspace name is `@deepseek-ai/dsh-zhihu-plugin` because the repository's experimental gate
only admits `@deepseek-ai` names. The publishable package is assembled under your own scope:

```sh
npx tsc -b tsconfig.json && npx tsx ../../../scripts/generate-typert.ts
npx tsdown -F "@deepseek-ai/dsh-zhihu-plugin" && npx tsdown
node scripts/pack-dist.mjs --name @your-scope/dsh-zhihu --out dist/zhihu
```

`pack-dist.mjs` copies `lib/index.js`, `lib/client.js`, the Typert artifacts, `lib/types`,
`locale/` and `cordis.patch.yml`, and rewrites the package name in the manifest, the bundle patch
and the built bundles so the published package owns its Typert manifest.
