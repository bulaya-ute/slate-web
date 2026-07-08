import type MarkdownIt from 'markdown-it'

// A deliberately small, dependency-free tokenizer — not a full grammar
// per language, just enough (comments/strings/numbers/keywords) to make
// fenced code in the split preview read as code rather than a gray
// block. The CM6 editor pane gets real lezer-grade highlighting (see
// `../../setup.ts`); this is the lightweight preview-only counterpart.
const KEYWORDS: Record<string, readonly string[]> = {
  javascript: [
    'const', 'let', 'var', 'function', 'return', 'if', 'else', 'for', 'while', 'do', 'class', 'extends',
    'import', 'from', 'export', 'default', 'new', 'this', 'typeof', 'instanceof', 'await', 'async', 'try',
    'catch', 'finally', 'throw', 'switch', 'case', 'break', 'continue', 'null', 'undefined', 'true', 'false',
    'static', 'super', 'yield', 'of', 'in', 'interface', 'type', 'enum', 'implements', 'public', 'private',
    'protected', 'readonly', 'as',
  ],
  python: [
    'def', 'return', 'if', 'elif', 'else', 'for', 'while', 'class', 'import', 'from', 'as', 'try', 'except',
    'finally', 'with', 'lambda', 'pass', 'break', 'continue', 'None', 'True', 'False', 'and', 'or', 'not',
    'in', 'is', 'yield', 'raise', 'global', 'nonlocal', 'async', 'await',
  ],
  csharp: [
    'using', 'namespace', 'class', 'public', 'private', 'protected', 'internal', 'static', 'void', 'var',
    'new', 'return', 'if', 'else', 'for', 'foreach', 'while', 'do', 'switch', 'case', 'break', 'continue',
    'try', 'catch', 'finally', 'throw', 'async', 'await', 'readonly', 'const', 'string', 'int', 'bool',
    'null', 'true', 'false', 'interface', 'enum', 'struct',
  ],
  go: [
    'package', 'import', 'func', 'return', 'if', 'else', 'for', 'range', 'switch', 'case', 'break',
    'continue', 'var', 'const', 'type', 'struct', 'interface', 'go', 'chan', 'select', 'defer', 'nil',
    'true', 'false',
  ],
  rust: [
    'fn', 'let', 'mut', 'return', 'if', 'else', 'for', 'while', 'loop', 'match', 'struct', 'enum', 'impl',
    'trait', 'pub', 'use', 'mod', 'crate', 'self', 'Self', 'true', 'false', 'None', 'Some',
  ],
  bash: [
    'if', 'then', 'elif', 'else', 'fi', 'for', 'do', 'done', 'while', 'function', 'echo', 'export', 'local',
    'return', 'case', 'esac', 'in',
  ],
  sql: [
    'select', 'from', 'where', 'insert', 'into', 'values', 'update', 'set', 'delete', 'join', 'on', 'group',
    'by', 'order', 'having', 'create', 'table', 'and', 'or', 'not', 'null', 'as',
  ],
  json: [],
  css: [],
}

const ALIASES: Record<string, string> = {
  js: 'javascript',
  jsx: 'javascript',
  mjs: 'javascript',
  ts: 'javascript',
  tsx: 'javascript',
  typescript: 'javascript',
  py: 'python',
  sh: 'bash',
  shell: 'bash',
  zsh: 'bash',
  cs: 'csharp',
}

function keywordsFor(lang: string): readonly string[] {
  const key = ALIASES[lang.toLowerCase()] ?? lang.toLowerCase()
  return KEYWORDS[key] ?? []
}

function escapeHtml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

// Capture groups, in order: //comment, #comment, /* */comment,
// "string", 'string', `string`, number, keyword(optional last).
function buildTokenRegex(keywords: readonly string[]): RegExp {
  const parts = [
    '(//[^\\n]*)',
    '(#[^\\n]*)',
    '(/\\*[\\s\\S]*?\\*/)',
    '("(?:[^"\\\\]|\\\\.)*")',
    "('(?:[^'\\\\]|\\\\.)*')",
    '(`(?:[^`\\\\]|\\\\.)*`)',
    '(\\b\\d+(?:\\.\\d+)?\\b)',
  ]
  if (keywords.length > 0) parts.push(`(\\b(?:${keywords.join('|')})\\b)`)
  return new RegExp(parts.join('|'), 'g')
}

const KIND_BY_GROUP = ['comment', 'comment', 'comment', 'string', 'string', 'string', 'number', 'keyword'] as const

/** Pure tokenizer, exported for testing — wraps recognized tokens in `<span class="tok-*">`, escapes everything else. */
export function highlightCode(code: string, lang: string): string {
  // Comments/strings/numbers still get highlighted even for a language
  // with no keyword list above (e.g. json/css) or one we don't
  // recognize at all — only the trailing keyword alternative is skipped.
  const keywords = keywordsFor(lang)
  const regex = buildTokenRegex(keywords)
  let out = ''
  let lastIndex = 0
  let match: RegExpExecArray | null
  while ((match = regex.exec(code))) {
    out += escapeHtml(code.slice(lastIndex, match.index))
    const groupIndex = match.slice(1).findIndex((g) => g !== undefined)
    const kind = KIND_BY_GROUP[groupIndex] ?? 'text'
    out += `<span class="tok-${kind}">${escapeHtml(match[0])}</span>`
    lastIndex = match.index + match[0].length
  }
  out += escapeHtml(code.slice(lastIndex))
  return out
}

/** Overrides the `fence` render rule to run fenced code through `highlightCode`. */
export function highlightPlugin(md: MarkdownIt): void {
  md.renderer.rules.fence = (tokens, idx) => {
    const token = tokens[idx]
    const lang = token.info.trim().split(/\s+/)[0] ?? ''
    const body = highlightCode(token.content, lang)
    const langClass = lang ? ` language-${md.utils.escapeHtml(lang)}` : ''
    return `<pre><code class="cm-code-block-line${langClass}">${body}</code></pre>\n`
  }
}
