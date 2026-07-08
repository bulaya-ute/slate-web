import { syntaxTree } from '@codemirror/language'
import {
  Decoration,
  EditorView,
  MatchDecorator,
  ViewPlugin,
  WidgetType,
  type DecorationSet,
  type ViewUpdate,
} from '@codemirror/view'
import { RangeSet } from '@codemirror/state'
import { editorContext } from '../editorContext'
import { activeLineNumbers, isRangeActive } from './activeLine'

// Same grammar as the markdown-it plugin (`markdownPreview/plugins/wikilinkPlugin.ts`):
// `[[target]]`, `[[target|alias]]`, and the embed form `![[target]]`.
const WIKILINK_RE = /(!)?\[\[([^\]\n|]+)(?:\|([^\]\n]+))?\]\]/g

// A tag is `#` immediately followed by a letter then word/`/`/`-` chars —
// deliberately requires a leading letter (so `#1` or a heading's `# `
// never match) and a word boundary before it (so `foo#bar` doesn't).
const TAG_RE = /(^|[\s(])#([a-zA-Z][\w/-]*)/g

function isInCode(view: EditorView, pos: number): boolean {
  let node = syntaxTree(view.state).resolveInner(pos, 1)
  while (node) {
    const name = node.type.name
    if (name === 'FencedCode' || name === 'CodeText' || name === 'InlineCode' || name === 'CodeBlock') return true
    node = node.parent as typeof node
  }
  return false
}

class WikilinkWidget extends WidgetType {
  readonly target: string
  readonly label: string
  readonly resolved: boolean

  constructor(target: string, label: string, resolved: boolean) {
    super()
    this.target = target
    this.label = label
    this.resolved = resolved
  }

  eq(other: WikilinkWidget): boolean {
    return other.target === this.target && other.label === this.label && other.resolved === this.resolved
  }

  toDOM(): HTMLElement {
    const span = document.createElement('span')
    span.className = this.resolved ? 'cm-wikilink' : 'cm-wikilink cm-wikilink-unresolved'
    span.textContent = this.label
    span.dataset.wikilinkTarget = this.target
    span.title = this.resolved ? this.target : `${this.target} (no matching note)`
    return span
  }

  ignoreEvent(): boolean {
    return true // handled by the view-level mousedown handler in `interactions.ts`
  }
}

class EmbedWidget extends WidgetType {
  readonly target: string
  readonly src: string

  constructor(target: string, src: string) {
    super()
    this.target = target
    this.src = src
  }

  eq(other: EmbedWidget): boolean {
    return other.target === this.target && other.src === this.src
  }

  toDOM(): HTMLElement {
    const wrap = document.createElement('span')
    wrap.className = 'cm-embed-image-wrap'
    if (!this.src) {
      wrap.appendChild(missingBadge(this.target))
      return wrap
    }
    const img = document.createElement('img')
    img.className = 'cm-embed-image'
    img.src = this.src
    img.alt = this.target
    img.loading = 'lazy'
    img.addEventListener('error', () => {
      img.replaceWith(missingBadge(this.target))
    })
    wrap.appendChild(img)
    return wrap
  }

  ignoreEvent(): boolean {
    return true
  }
}

function missingBadge(target: string): HTMLElement {
  const span = document.createElement('span')
  span.className = 'cm-embed-missing'
  span.textContent = `![[${target}]]`
  return span
}

class TagChipWidget extends WidgetType {
  readonly name: string

  constructor(name: string) {
    super()
    this.name = name
  }

  eq(other: TagChipWidget): boolean {
    return other.name === this.name
  }

  toDOM(): HTMLElement {
    const span = document.createElement('span')
    span.className = 'cm-tag-chip'
    span.textContent = `#${this.name}`
    return span
  }

  ignoreEvent(): boolean {
    return true
  }
}

const wikilinkMatcher = new MatchDecorator({
  regexp: WIKILINK_RE,
  decoration: (match, view, pos) => {
    if (isInCode(view, pos)) return null
    const active = activeLineNumbers(view.state)
    if (isRangeActive(view.state, pos, pos + match[0].length, active)) return null

    const ctx = view.state.facet(editorContext)
    const isEmbed = Boolean(match[1])
    const target = match[2].trim()

    if (isEmbed) {
      return Decoration.replace({ widget: new EmbedWidget(target, ctx.resolveAttachmentSrc(target)) })
    }
    const alias = match[3]?.trim()
    const label = alias && alias.length > 0 ? alias : target
    const resolved = ctx.resolveWikilink(target)
    return Decoration.replace({ widget: new WikilinkWidget(target, label, resolved !== null) })
  },
})

const tagMatcher = new MatchDecorator({
  regexp: TAG_RE,
  decorate: (add, from, to, match, view) => {
    if (isInCode(view, from)) return
    const tagStart = from + match[1].length // drop the captured leading boundary char
    if (tagStart >= to) return
    const active = activeLineNumbers(view.state)
    if (isRangeActive(view.state, tagStart, to, active)) return
    add(tagStart, to, Decoration.replace({ widget: new TagChipWidget(match[2]) }))
  },
})

/**
 * The regex half of live preview, for Obsidian syntax CommonMark/GFM
 * doesn't know about: `[[wikilinks]]`, `![[embeds]]`, and `#tags`. Uses
 * `MatchDecorator` (CM6's own helper for this) so re-matching on edits
 * stays incremental instead of re-scanning the whole visible range from
 * scratch every keystroke.
 */
export const wikilinksAndTags = ViewPlugin.fromClass(
  class {
    wikilinks: DecorationSet
    tags: DecorationSet
    decorations: DecorationSet

    constructor(view: EditorView) {
      this.wikilinks = wikilinkMatcher.createDeco(view)
      this.tags = tagMatcher.createDeco(view)
      this.decorations = RangeSet.join([this.wikilinks, this.tags])
    }

    update(update: ViewUpdate) {
      this.wikilinks = wikilinkMatcher.updateDeco(update, this.wikilinks)
      this.tags = tagMatcher.updateDeco(update, this.tags)
      this.decorations = RangeSet.join([this.wikilinks, this.tags])
    }
  },
  { decorations: (v) => v.decorations },
)
