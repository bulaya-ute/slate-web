import MarkdownIt from 'markdown-it'
import { describe, expect, it } from 'vitest'
import { wikilinkPlugin } from './wikilinkPlugin'

function render(src: string, options?: Parameters<typeof wikilinkPlugin>[1]): string {
  const md = new MarkdownIt({ html: false })
  md.use(wikilinkPlugin, options)
  return md.render(src)
}

describe('wikilinkPlugin', () => {
  it('renders a bare [[target]] as an unresolved link by default (no resolver given)', () => {
    const html = render('See [[Some Note]] for more.')
    expect(html).toContain('<a class="wikilink wikilink-unresolved" href="#" data-wikilink-target="Some Note">Some Note</a>')
  })

  it('renders [[target|alias]] using the alias as the visible label, target as the data attribute', () => {
    const html = render('See [[some-note|a nicer title]] here.')
    expect(html).toContain('data-wikilink-target="some-note"')
    expect(html).toContain('>a nicer title<')
    expect(html).not.toContain('>some-note<')
  })

  it('marks a resolved target with the plain "wikilink" class and a data-path attribute', () => {
    const html = render('[[Daily Note]]', {
      resolve: (target) => (target === 'Daily Note' ? { path: 'daily/2026-07-06.md', title: 'Daily Note' } : null),
    })
    expect(html).toContain('<a class="wikilink" href="#" data-wikilink-target="Daily Note" data-path="daily/2026-07-06.md">Daily Note</a>')
  })

  it('renders an embed ![[target]] as an <img> when embedSrc resolves', () => {
    const html = render('![[diagram.png]]', {
      embedSrc: (target) => `/api/vaults/v1/files/${target}`,
    })
    expect(html).toContain('<img class="embed-image" src="/api/vaults/v1/files/diagram.png" alt="diagram.png" loading="lazy" />')
  })

  it('renders an embed as a missing-badge span when embedSrc is absent/empty', () => {
    const html = render('![[missing.png]]')
    expect(html).toContain('<span class="embed-missing">![[missing.png]]</span>')
  })

  it('escapes HTML-significant characters in the target/label', () => {
    const html = render('[[<script>]]')
    expect(html).not.toContain('<script>')
    expect(html).toContain('&lt;script&gt;')
  })

  it('does not treat a standalone "[" or "!" as the start of a wikilink', () => {
    const html = render('a [ b ] c, and ! on its own')
    expect(html).not.toContain('wikilink')
  })

  it('leaves ordinary markdown links alone (does not swallow them)', () => {
    const html = render('[a link](https://example.com)')
    expect(html).toContain('<a href="https://example.com">a link</a>')
    expect(html).not.toContain('wikilink')
  })

  it('does not let a stray "[[" run away and swallow the rest of the paragraph', () => {
    const html = render('oops [[ this never closes and keeps going')
    expect(html).not.toContain('wikilink')
    expect(html).toContain('oops [[ this never closes and keeps going')
  })

  it('supports multiple wikilinks in the same line', () => {
    const html = render('[[One]] and [[Two]]')
    expect(html).toContain('data-wikilink-target="One"')
    expect(html).toContain('data-wikilink-target="Two"')
  })
})
