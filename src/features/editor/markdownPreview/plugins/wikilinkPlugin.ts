import MarkdownIt from 'markdown-it'

/**
 * A wikilink target resolved against the vault's note index (used to
 * distinguish a real note from a dangling reference — Obsidian dims
 * unresolved links rather than treating them as errors).
 */
export interface WikilinkResolution {
  path: string
  title: string
}

export interface WikilinkPluginOptions {
  /** Resolve a link target (the part before `|alias`) against the vault's notes. */
  resolve?: (target: string) => WikilinkResolution | null
  /** Build a fetchable `src` for an embed target (`![[target]]`). */
  embedSrc?: (target: string) => string
}

interface WikilinkMeta {
  target: string
  resolved: WikilinkResolution | null
}

interface EmbedMeta {
  target: string
  src: string
}

// `[[target]]`, `[[target|alias]]`, and the embed form `![[target]]`.
// Deliberately excludes `]` and `|` from the target/alias so a stray
// `[[` never runs away and swallows the rest of a paragraph.
const WIKILINK_RE = /^(!)?\[\[([^\]\n|]+)(?:\|([^\]\n]+))?\]\]/

/**
 * markdown-it plugin for Obsidian-style wikilinks — not part of any
 * markdown spec, so this hand-rolls the inline rule rather than reusing
 * the standard `link`/`image` rules (which require `(url)`/`[ref]`
 * syntax `[[...]]` doesn't have).
 */
// `@types/markdown-it`'s ESM typings (resolved under `moduleResolution:
// "bundler"`) don't re-export `StateInline` as a named type from the
// package root — only the constructor's own instance methods (like
// `ruler.before`) know its shape. Pulling the parameter type back out of
// that method signature avoids a deep import into markdown-it's internal
// module layout, which isn't part of its public type surface.
type InlineRule = Parameters<MarkdownIt['inline']['ruler']['before']>[2]

export function wikilinkPlugin(md: MarkdownIt, options: WikilinkPluginOptions = {}): void {
  const tokenize: InlineRule = (state, silent) => {
    const ch = state.src.charCodeAt(state.pos)
    if (ch !== 0x21 /* ! */ && ch !== 0x5b /* [ */) return false

    const rest = state.src.slice(state.pos)
    const match = WIKILINK_RE.exec(rest)
    if (!match) return false

    if (!silent) {
      const isEmbed = Boolean(match[1])
      const target = match[2].trim()
      const alias = match[3]?.trim()

      if (isEmbed) {
        const token = state.push('wikilink_embed', '', 0)
        token.meta = { target, src: options.embedSrc?.(target) ?? '' } satisfies EmbedMeta
      } else {
        const token = state.push('wikilink', '', 0)
        token.content = alias && alias.length > 0 ? alias : target
        token.meta = { target, resolved: options.resolve?.(target) ?? null } satisfies WikilinkMeta
      }
    }

    state.pos += match[0].length
    return true
  }

  // Ahead of `link` so `[[...]]` never gets a chance to be misread by
  // the standard link/image rules (both of which also key off `[`/`!`).
  md.inline.ruler.before('link', 'wikilink', tokenize)

  md.renderer.rules.wikilink = (tokens, idx) => {
    const { target, resolved } = tokens[idx].meta as WikilinkMeta
    const label = md.utils.escapeHtml(tokens[idx].content)
    const classes = resolved ? 'wikilink' : 'wikilink wikilink-unresolved'
    const pathAttr = resolved ? ` data-path="${md.utils.escapeHtml(resolved.path)}"` : ''
    return `<a class="${classes}" href="#" data-wikilink-target="${md.utils.escapeHtml(target)}"${pathAttr}>${label}</a>`
  }

  md.renderer.rules.wikilink_embed = (tokens, idx) => {
    const { target, src } = tokens[idx].meta as EmbedMeta
    const alt = md.utils.escapeHtml(target)
    if (!src) return `<span class="embed-missing">![[${alt}]]</span>`
    return `<img class="embed-image" src="${md.utils.escapeHtml(src)}" alt="${alt}" loading="lazy" />`
  }
}
