const STORAGE_KEY = 'slate.device-id'

function generateUuid(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  // Fallback for environments without `crypto.randomUUID` (very old
  // browsers) — good enough since this only needs to be unique per
  // browser install, not cryptographically strong.
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    const v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

/**
 * Stable per-browser identifier sent with every note save
 * (`PutNoteContentRequest.deviceId`) so the server/other clients can tell
 * "my other tab/device" apart from "someone else". Generated once and
 * persisted to `localStorage`.
 */
export function getDeviceId(): string {
  const existing = localStorage.getItem(STORAGE_KEY)
  if (existing) return existing
  const id = generateUuid()
  localStorage.setItem(STORAGE_KEY, id)
  return id
}
