import type { CompletionContext, CompletionResult } from '@codemirror/autocomplete'
import { editorContext } from '../editorContext'

// Requires a letter immediately after `#` (same rule the live-preview tag
// matcher uses) so this never fires while typing an ATX heading's `# `.
const TAG_QUERY_RE = /#([a-zA-Z][\w/-]*)$/

/** Tag autocomplete — triggers on `#`, matches the vault's known tag names. */
export function tagCompletionSource(context: CompletionContext): CompletionResult | null {
  const match = context.matchBefore(TAG_QUERY_RE)
  if (!match) return null
  const query = match.text.slice(1).toLowerCase()

  const ctx = context.state.facet(editorContext)
  const options = ctx
    .getTagIndex()
    .filter((name) => name.toLowerCase().includes(query))
    .slice(0, 50)
    .map((name) => ({ label: name, type: 'text', apply: name }))

  if (options.length === 0) return null

  return {
    from: match.from + 1, // past the literal `#`
    options,
    filter: false,
    validFor: /^[\w/-]*$/,
  }
}
