import { HighlightStyle } from '@codemirror/language'
import { EditorView } from '@codemirror/view'
import { tags } from '@lezer/highlight'

/**
 * Editor chrome + live-preview typography, built entirely from Slate's
 * design tokens (`var(--color-*)` etc — see `src/theme.css`) so the
 * editor re-skins automatically when the theme store flips
 * `data-theme`, with no need to rebuild the CM6 state.
 */
export const slateEditorTheme = EditorView.theme({
  '&': {
    color: 'var(--color-text)',
    backgroundColor: 'var(--color-bg)',
    fontSize: '15px',
    height: '100%',
  },
  '&.cm-editor.cm-focused': {
    outline: 'none',
  },
  '.cm-scroller': {
    fontFamily: 'var(--font-sans)',
    lineHeight: '1.65',
    overflow: 'auto',
    padding: '4px 0 40vh 0',
  },
  '.cm-content': {
    maxWidth: '780px',
    margin: '0 auto',
    padding: '1.5rem 2rem',
    caretColor: 'var(--color-accent)',
  },
  '.cm-line': {
    padding: '0 2px',
  },
  '.cm-gutters': {
    display: 'none',
  },
  '.cm-selectionBackground': {
    backgroundColor: 'color-mix(in srgb, var(--color-accent) 25%, transparent) !important',
  },
  '&.cm-focused .cm-selectionBackground': {
    backgroundColor: 'color-mix(in srgb, var(--color-accent) 30%, transparent) !important',
  },
  '.cm-cursor, .cm-cursor-primary': {
    borderLeftColor: 'var(--color-accent)',
  },
  '.cm-activeLine': {
    backgroundColor: 'color-mix(in srgb, var(--color-text) 4%, transparent)',
  },
  '.cm-placeholder': {
    color: 'var(--color-text-faint)',
  },

  // ---- Live-preview: hidden syntax marks (cursor left the line/range) ----
  '.cm-hidden-token': {
    display: 'none',
  },

  // ---- Live-preview: headings ----
  '.cm-heading-1': { fontSize: '1.8em', fontWeight: '700', lineHeight: '1.3' },
  '.cm-heading-2': { fontSize: '1.5em', fontWeight: '700', lineHeight: '1.3' },
  '.cm-heading-3': { fontSize: '1.28em', fontWeight: '600', lineHeight: '1.35' },
  '.cm-heading-4': { fontSize: '1.14em', fontWeight: '600', lineHeight: '1.4' },
  '.cm-heading-5': { fontSize: '1.05em', fontWeight: '600', lineHeight: '1.4' },
  '.cm-heading-6': { fontSize: '1em', fontWeight: '600', color: 'var(--color-text-muted)' },

  // ---- Live-preview: inline emphasis ----
  '.cm-strong': { fontWeight: '700' },
  '.cm-em': { fontStyle: 'italic' },
  '.cm-strike': { textDecoration: 'line-through', color: 'var(--color-text-muted)' },
  '.cm-inline-code': {
    fontFamily: 'var(--font-mono)',
    fontSize: '0.9em',
    backgroundColor: 'var(--color-surface)',
    borderRadius: 'var(--radius-sm)',
    padding: '0.1em 0.35em',
  },
  '.cm-highlight': {
    backgroundColor: 'color-mix(in srgb, var(--color-accent) 35%, transparent)',
    borderRadius: '2px',
  },

  // ---- Live-preview: wikilinks ----
  '.cm-wikilink': {
    color: 'var(--color-accent)',
    borderBottom: '1px solid color-mix(in srgb, var(--color-accent) 45%, transparent)',
    cursor: 'pointer',
    borderRadius: '3px',
    padding: '0 1px',
  },
  '.cm-wikilink:hover': {
    backgroundColor: 'color-mix(in srgb, var(--color-accent) 14%, transparent)',
  },
  '.cm-wikilink-unresolved': {
    color: 'var(--color-text-faint)',
    borderBottomStyle: 'dashed',
  },

  // ---- Live-preview: tags ----
  '.cm-tag-chip': {
    color: 'var(--color-accent)',
    backgroundColor: 'color-mix(in srgb, var(--color-accent) 12%, transparent)',
    borderRadius: '999px',
    padding: '0.05em 0.55em',
    fontSize: '0.9em',
    cursor: 'default',
  },

  // ---- Live-preview: tasks ----
  '.cm-task-checkbox': {
    cursor: 'pointer',
    verticalAlign: 'middle',
    marginRight: '0.4em',
    accentColor: 'var(--color-accent)',
    width: '14px',
    height: '14px',
  },
  '.cm-task-line-done': {
    color: 'var(--color-text-faint)',
    textDecoration: 'line-through',
  },

  // ---- Live-preview: fenced code ----
  '.cm-code-block-line': {
    fontFamily: 'var(--font-mono)',
    fontSize: '0.92em',
    backgroundColor: 'var(--color-bg-inset)',
  },
  '.cm-code-fence-mark': {
    color: 'var(--color-text-faint)',
  },

  // ---- Live-preview: embeds ----
  '.cm-embed-image-wrap': {
    display: 'block',
    margin: '0.4em 0',
  },
  '.cm-embed-image': {
    maxWidth: '100%',
    borderRadius: 'var(--radius-md)',
    border: '1px solid var(--color-border)',
  },
  '.cm-embed-missing': {
    display: 'inline-block',
    color: 'var(--color-danger)',
    backgroundColor: 'color-mix(in srgb, var(--color-danger) 12%, transparent)',
    borderRadius: 'var(--radius-sm)',
    padding: '0 0.4em',
    fontSize: '0.9em',
  },

  // Autocomplete popups
  '.cm-tooltip-autocomplete': {
    backgroundColor: 'var(--color-surface)',
    border: '1px solid var(--color-border-strong)',
    borderRadius: 'var(--radius-md)',
    boxShadow: 'var(--shadow-md)',
    overflow: 'hidden',
  },
  '.cm-tooltip-autocomplete ul li[aria-selected]': {
    backgroundColor: 'var(--color-accent)',
    color: 'var(--color-accent-contrast)',
  },
})

/**
 * Fenced-code-block token colors for the nested language parser
 * (`markdown({ codeLanguages: languages })` — see `setup.ts`). Mapped
 * from `@lezer/highlight`'s generic tags onto the same design tokens as
 * everything else, so a code block re-skins with the rest of the editor
 * instead of carrying its own fixed palette.
 */
export const slateHighlightStyle = HighlightStyle.define([
  { tag: tags.comment, color: 'var(--color-text-faint)', fontStyle: 'italic' },
  { tag: tags.string, color: 'var(--color-success)' },
  { tag: [tags.number, tags.bool, tags.atom], color: 'var(--color-warning)' },
  { tag: [tags.keyword, tags.controlKeyword, tags.moduleKeyword, tags.operatorKeyword], color: 'var(--color-accent)' },
  { tag: [tags.function(tags.variableName), tags.definition(tags.variableName)], color: 'var(--color-text)' },
  { tag: [tags.typeName, tags.className, tags.tagName], color: 'var(--color-accent-hover)' },
  { tag: tags.propertyName, color: 'var(--color-text-muted)' },
  { tag: [tags.operator, tags.punctuation, tags.bracket], color: 'var(--color-text-muted)' },
  { tag: tags.invalid, color: 'var(--color-danger)' },
])
