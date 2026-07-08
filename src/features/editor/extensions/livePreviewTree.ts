import { syntaxTree } from '@codemirror/language'
import type { Range } from '@codemirror/state'
import { Decoration, EditorView, ViewPlugin, WidgetType, type DecorationSet, type ViewUpdate } from '@codemirror/view'
import { activeLineNumbers, isRangeActive } from './activeLine'

const HEADING_LEVEL: Record<string, number> = {
  ATXHeading1: 1,
  ATXHeading2: 2,
  ATXHeading3: 3,
  ATXHeading4: 4,
  ATXHeading5: 5,
  ATXHeading6: 6,
}

class TaskCheckboxWidget extends WidgetType {
  readonly checked: boolean
  /** Doc position of the single `x`/`X`/` ` character inside `[ ]` — what a click toggles. */
  readonly pos: number

  constructor(checked: boolean, pos: number) {
    super()
    this.checked = checked
    this.pos = pos
  }

  eq(other: TaskCheckboxWidget): boolean {
    return other.checked === this.checked && other.pos === this.pos
  }

  toDOM(): HTMLElement {
    const input = document.createElement('input')
    input.type = 'checkbox'
    input.className = 'cm-task-checkbox'
    input.checked = this.checked
    input.dataset.pos = String(this.pos)
    input.setAttribute('aria-label', this.checked ? 'Mark task as not done' : 'Mark task as done')
    return input
  }

  // Clicks are handled by the view-level `mousedown` handler in
  // `interactions.ts` (the documented CM6 pattern for interactive
  // widgets) — the widget itself stays a dumb, stateless DOM fragment.
  ignoreEvent(): boolean {
    return true
  }
}

/** Swallow one trailing space after a hidden mark so e.g. hiding `## ` doesn't leave a stray gap before the heading text. */
function extendHiddenRange(doc: EditorView['state']['doc'], from: number, to: number): [number, number] {
  if (doc.sliceString(to, to + 1) === ' ') return [from, to + 1]
  return [from, to]
}

function buildTreeDecorations(view: EditorView): DecorationSet {
  const { state } = view
  const active = activeLineNumbers(state)
  const ranges: Range<Decoration>[] = []
  const tree = syntaxTree(state)

  for (const { from, to } of view.visibleRanges) {
    tree.iterate({
      from,
      to,
      enter: (node) => {
        const name = node.type.name

        const level = HEADING_LEVEL[name]
        if (level) {
          const line = state.doc.lineAt(node.from)
          ranges.push(Decoration.line({ class: `cm-heading-${level}` }).range(line.from))
          return
        }

        if (name === 'HeaderMark') {
          if (!isRangeActive(state, node.from, node.to, active)) {
            const [hiddenFrom, hiddenTo] = extendHiddenRange(state.doc, node.from, node.to)
            ranges.push(Decoration.mark({ class: 'cm-hidden-token' }).range(hiddenFrom, hiddenTo))
          }
          return
        }

        if (name === 'StrongEmphasis') {
          ranges.push(Decoration.mark({ class: 'cm-strong' }).range(node.from, node.to))
          return
        }
        if (name === 'Emphasis') {
          ranges.push(Decoration.mark({ class: 'cm-em' }).range(node.from, node.to))
          return
        }
        if (name === 'Strikethrough') {
          ranges.push(Decoration.mark({ class: 'cm-strike' }).range(node.from, node.to))
          return
        }
        if (name === 'EmphasisMark' || name === 'StrikethroughMark') {
          if (!isRangeActive(state, node.from, node.to, active)) {
            ranges.push(Decoration.mark({ class: 'cm-hidden-token' }).range(node.from, node.to))
          }
          return
        }

        if (name === 'InlineCode') {
          ranges.push(Decoration.mark({ class: 'cm-inline-code' }).range(node.from, node.to))
          return
        }
        if (name === 'CodeMark') {
          const parentName = node.node.parent?.type.name
          if (parentName === 'InlineCode') {
            if (!isRangeActive(state, node.from, node.to, active)) {
              ranges.push(Decoration.mark({ class: 'cm-hidden-token' }).range(node.from, node.to))
            }
          } else if (parentName === 'FencedCode') {
            // Fence delimiters stay visible always — there's no "editing
            // affordance" question for a block-level marker the way
            // there is for inline emphasis.
            ranges.push(Decoration.mark({ class: 'cm-code-fence-mark' }).range(node.from, node.to))
          }
          return
        }
        if (name === 'CodeInfo') {
          ranges.push(Decoration.mark({ class: 'cm-code-fence-mark' }).range(node.from, node.to))
          return
        }

        if (name === 'FencedCode') {
          const fromLine = state.doc.lineAt(node.from).number
          const toLine = state.doc.lineAt(node.to).number
          for (let n = fromLine; n <= toLine; n++) {
            ranges.push(Decoration.line({ class: 'cm-code-block-line' }).range(state.doc.line(n).from))
          }
          return
        }

        if (name === 'TaskMarker') {
          // Always a checkbox — unlike emphasis/links, there's no raw
          // form worth typing into, so this ignores the cursor-line rule.
          const innerFrom = node.from + 1
          const innerTo = node.to - 1
          const checked = state.doc.sliceString(innerFrom, innerTo).toLowerCase() === 'x'
          ranges.push(
            Decoration.replace({ widget: new TaskCheckboxWidget(checked, innerFrom) }).range(node.from, node.to),
          )
          if (checked) {
            const line = state.doc.lineAt(node.from)
            ranges.push(Decoration.line({ class: 'cm-task-line-done' }).range(line.from))
          }
          return
        }
      },
    })
  }

  return Decoration.set(ranges, true)
}

/**
 * The syntax-tree half of live preview: everything CM6's markdown
 * language (CommonMark + GFM, see `setup.ts`) already parses into real
 * nodes — headings, bold/italic/strike, inline code, fenced code blocks,
 * task checkboxes. Wikilinks/tags/embeds aren't part of that grammar
 * (`[[...]]`/`#tag` have no CommonMark meaning), so those are handled
 * separately in `wikilinksAndTags.ts` via regex over the visible text.
 */
export const livePreviewTree = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet
    constructor(view: EditorView) {
      this.decorations = buildTreeDecorations(view)
    }
    update(update: ViewUpdate) {
      if (update.docChanged || update.selectionSet || update.viewportChanged) {
        this.decorations = buildTreeDecorations(update.view)
      }
    }
  },
  { decorations: (v) => v.decorations },
)
