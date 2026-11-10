/**
 * One installable Zhihu plugin. It mounts the `ctx.zhihu` service, its credentialed HTTP provider,
 * the model-facing tools and the authenticated Remote; the browser surface is declared by
 * `dsh.client` in package.json and loaded from the same package.
 * @module @deepseek-ai/dsh-zhihu-plugin
 */

import type { Context } from '@deepseek-ai/cordis'
import z from '@deepseek-ai/schemastery'
import type { Config as ZhihuHttpConfig } from './http/index.ts'
import * as http from './http/index.ts'
import type { Config as ZhihuRemoteConfig } from './remote/index.ts'
import Remote from './remote/index.ts'
import ZhihuService from './service/index.ts'
import type { Config as ZhihuToolConfig } from './tool/index.ts'
import * as tool from './tool/index.ts'

/** Loader name reported by plugin diagnostics. */
export const name = 'zhihu'

/** Composition config: each section is the composed plugin's own validated config. */
export interface Config {
  /** Credentialed HTTP provider settings; its schema supplies every default. */
  readonly http?: ZhihuHttpConfig
  /** Model-facing tool limits; its schema supplies every default. */
  readonly tool?: ZhihuToolConfig
  /** Remote limits and Obsidian capture settings; its schema supplies every default. */
  readonly remote?: ZhihuRemoteConfig
}

/** Schema that validates {@link Config} and fills each section from its own schema. */
export const Config: z<Config> = z.object({
  http: http.Config,
  tool: tool.Config,
  remote: Remote.Config,
})

/**
 * Mount every half of the plugin on one context.
 * @param ctx - the Host context every composed plugin registers into.
 * @param config - per-section settings; each section defaults through its own schema.
 */
export function apply(ctx: Context, config: Config): void {
  ctx.plugin(ZhihuService, {})
  ctx.plugin(http, config.http)
  ctx.plugin(tool, config.tool)
  ctx.plugin(Remote, config.remote)
}
