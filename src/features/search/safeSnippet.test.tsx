import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { renderSnippet, SearchSnippet } from './safeSnippet'

function textOf(nodes: ReturnType<typeof renderSnippet>): string {
  return nodes.map((n) => (n.props as { children?: string }).children ?? '').join('')
}

describe('renderSnippet', () => {
  it('renders plain text with no marks as a single unmarked run', () => {
    const nodes = renderSnippet('no highlights here')
    expect(nodes).toHaveLength(1)
    expect(nodes[0].type).toBe('span')
    expect(textOf(nodes)).toBe('no highlights here')
  })

  it('wraps a single <mark>…</mark> run in a real <mark> element', () => {
    const nodes = renderSnippet('before <mark>hit</mark> after')
    expect(nodes.map((n) => n.type)).toEqual(['span', 'mark', 'span'])
    expect(textOf(nodes)).toBe('before hit after')
  })

  it('handles multiple marks', () => {
    const nodes = renderSnippet('<mark>a</mark> middle <mark>b</mark>')
    expect(nodes.map((n) => n.type)).toEqual(['mark', 'span', 'mark'])
    expect(nodes.map((n) => (n.props as { children?: string }).children)).toEqual(['a', ' middle ', 'b'])
  })

  it('treats any other tag-shaped text as literal characters, never as markup', () => {
    const nodes = renderSnippet('<script>alert(1)</script> <mark>safe</mark>')
    // Everything up to the recognized <mark> token — including the
    // literal "<script>...</script> " text — is one plain run; it is
    // never parsed as an element.
    expect(nodes[0].type).toBe('span')
    expect((nodes[0].props as { children?: string }).children).toBe('<script>alert(1)</script> ')
    expect(nodes[1].type).toBe('mark')
  })

  it('degrades gracefully on a stray closing tag with no opener', () => {
    // Malformed input can't produce anything beyond span/mark text nodes.
    const nodes = renderSnippet('oops</mark> tail')
    expect(nodes.every((n) => n.type === 'span' || n.type === 'mark')).toBe(true)
    expect(textOf(nodes)).toBe('oops tail')
  })

  it('returns no nodes for an empty string', () => {
    expect(renderSnippet('')).toEqual([])
  })
})

describe('SearchSnippet', () => {
  it('renders a real <mark> DOM element and never executes/inserts a <script>', () => {
    const { container } = render(<SearchSnippet html="intro <mark>term</mark> and <script>window.pwned = true</script>" />)
    expect(container.querySelectorAll('mark')).toHaveLength(1)
    expect(container.querySelector('mark')?.textContent).toBe('term')
    // The "<script>" text is present only as literal characters in a
    // text node — never as an actual <script> element in the DOM.
    expect(container.querySelectorAll('script')).toHaveLength(0)
    expect(container.textContent).toContain('<script>window.pwned = true</script>')
  })
})
