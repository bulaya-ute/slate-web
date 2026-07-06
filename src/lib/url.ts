/** Strip a trailing slash so URLs can be concatenated with a leading-slash path safely. */
export function normalizeServerUrl(url: string): string {
  const trimmed = url.trim()
  return trimmed.endsWith('/') ? trimmed.slice(0, -1) : trimmed
}
