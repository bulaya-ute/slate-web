import { describe, expect, it } from 'vitest'
import { parseHeadings } from './headingParser'

describe('parseHeadings', () => {
  it('returns nothing for content with no headings', () => {
    expect(parseHeadings('just some text\nmore text')).toEqual([])
  })

  it('parses ATX headings of every level with correct line numbers', () => {
    const content = ['# One', 'body', '## Two', '### Three', '#### Four', '##### Five', '###### Six'].join('\n')
    expect(parseHeadings(content)).toEqual([
      { level: 1, text: 'One', line: 1 },
      { level: 2, text: 'Two', line: 3 },
      { level: 3, text: 'Three', line: 4 },
      { level: 4, text: 'Four', line: 5 },
      { level: 5, text: 'Five', line: 6 },
      { level: 6, text: 'Six', line: 7 },
    ])
  })

  it('strips optional trailing closing hashes', () => {
    expect(parseHeadings('## Heading ##')).toEqual([{ level: 2, text: 'Heading', line: 1 }])
  })

  it('ignores a bare hash with no title text', () => {
    expect(parseHeadings('#\nreal text\n##   ')).toEqual([])
  })

  it('does not treat an inline tag (`#word`, no space) as a heading', () => {
    expect(parseHeadings('#tag at line start\n# Real Heading')).toEqual([{ level: 1, text: 'Real Heading', line: 2 }])
  })

  it('does not treat 7+ leading hashes as a heading', () => {
    expect(parseHeadings('####### Not a heading')).toEqual([])
  })

  it('ignores headings inside a fenced code block (backtick fence)', () => {
    const content = ['# Real Heading', '', '```', '# Not a heading', '## Also not one', '```', '', '## Another real heading'].join('\n')
    expect(parseHeadings(content)).toEqual([
      { level: 1, text: 'Real Heading', line: 1 },
      { level: 2, text: 'Another real heading', line: 8 },
    ])
  })

  it('ignores headings inside a fenced code block (tilde fence) and honors an info string', () => {
    const content = ['~~~markdown', '# Not a heading either', '~~~', '# Real Heading'].join('\n')
    expect(parseHeadings(content)).toEqual([{ level: 1, text: 'Real Heading', line: 4 }])
  })

  it('treats an unclosed fence as swallowing the rest of the document', () => {
    const content = ['# Before', '```', '# Inside, never closed', '## Still inside'].join('\n')
    expect(parseHeadings(content)).toEqual([{ level: 1, text: 'Before', line: 1 }])
  })

  it('does not let a tilde fence close a backtick fence or vice versa', () => {
    const content = ['```', '~~~', '# Still inside the backtick fence', '```', '# Real Heading'].join('\n')
    expect(parseHeadings(content)).toEqual([{ level: 1, text: 'Real Heading', line: 5 }])
  })

  it('tolerates up to 3 leading spaces before a heading (CommonMark allows this before it becomes an indented code block)', () => {
    expect(parseHeadings('   # Slightly indented')).toEqual([{ level: 1, text: 'Slightly indented', line: 1 }])
  })
})
