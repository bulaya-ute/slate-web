import MarkdownIt from 'markdown-it'
import { describe, expect, it } from 'vitest'
import { taskListPlugin } from './taskListPlugin'

function render(src: string): string {
  const md = new MarkdownIt()
  md.use(taskListPlugin)
  return md.render(src)
}

describe('taskListPlugin', () => {
  it('renders an unchecked task item as a disabled, unchecked checkbox', () => {
    const html = render('- [ ] buy milk')
    expect(html).toContain('<input type="checkbox" class="task-list-checkbox" disabled />')
    expect(html).toContain('buy milk')
    expect(html).not.toContain('[ ]')
  })

  it('renders a checked task item ([x] or [X]) as checked, and flags the item as done', () => {
    const htmlLower = render('- [x] done already')
    expect(htmlLower).toContain('<input type="checkbox" class="task-list-checkbox" disabled checked />')
    expect(htmlLower).toContain('task-list-item-done')

    const htmlUpper = render('- [X] also done')
    expect(htmlUpper).toContain('checked')
  })

  it('leaves a plain (non-task) list item alone', () => {
    const html = render('- just a regular item')
    expect(html).not.toContain('checkbox')
    expect(html).toContain('just a regular item')
  })

  it('handles multiple task items in one list, preserving order', () => {
    const html = render('- [ ] first\n- [x] second\n- [ ] third')
    const checkboxCount = (html.match(/task-list-checkbox/g) ?? []).length
    expect(checkboxCount).toBe(3)
    expect(html.indexOf('first')).toBeLessThan(html.indexOf('second'))
    expect(html.indexOf('second')).toBeLessThan(html.indexOf('third'))
  })
})
