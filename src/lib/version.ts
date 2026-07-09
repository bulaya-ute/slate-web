/**
 * Client build version, shown in Settings → About. There's no release
 * versioning pipeline wired up yet (no tag/CI-stamped value to read at
 * build time) — this is a placeholder constant, bumped by hand, rather
 * than nothing at all. Replace with an injected build-time value
 * (e.g. a Vite `define` fed from `package.json`/git describe) once the
 * release process exists.
 */
export const CLIENT_VERSION = '0.1.0'
