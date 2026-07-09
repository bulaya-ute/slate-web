/**
 * DTOs for the Slate REST API. JSON on the wire is camelCase; every
 * endpoint lives under `/api`. This file mirrors
 * `global-context.md`'s "Shared API contract" exactly — the server may
 * add fields later but will never rename existing ones, so widen these
 * types rather than replace them when that happens.
 */

// ---- System -------------------------------------------------------

export interface SystemInfo {
  name: string
  version: string
  apiVersion: number
  serverName: string | null
  setupRequired: boolean
}

export interface SetupRequest {
  username: string
  password: string
  displayName: string
}

// ---- Auth -----------------------------------------------------------

export type UserRole = 'Admin' | 'User'

export interface User {
  id: string
  username: string
  displayName: string
  role: UserRole
  isDisabled: boolean
}

export interface LoginRequest {
  username: string
  password: string
}

export interface LoginResponse {
  accessToken: string
  refreshToken: string
  user: User
}

export interface RefreshRequest {
  refreshToken: string
}

export interface RefreshResponse {
  accessToken: string
  refreshToken: string
}

export interface RegisterRequest {
  inviteToken: string
  username: string
  password: string
  displayName: string
}

// ---- Vaults ---------------------------------------------------------

export interface Vault {
  id: string
  name: string
  role: 'owner' | 'edit' | 'read'
  noteCount: number
  sizeBytes: number
  createdAt: string
}

export interface CreateVaultRequest {
  name: string
}

export interface NoteMeta {
  id: string
  path: string
  title: string
  hasConflict: boolean
  sizeBytes: number
  updatedAt: string
}

export interface VaultTree {
  folders: string[]
  notes: NoteMeta[]
}

export interface CreateNoteRequest {
  path: string
  content?: string
}

// ---- Notes ------------------------------------------------------------

export interface PutNoteContentRequest {
  content: string
  baseRevId: string
  deviceId: string
}

export interface PutNoteContentResponse {
  revId: string
  contentHash: string
}

export interface NoteConflictResponse {
  headRevId: string
  conflictRevId: string
}

export interface RenameNoteRequest {
  newPath: string
}

// ---- Folders ------------------------------------------------------------

export interface CreateFolderRequest {
  path: string
}

export interface RenameFolderRequest {
  path: string
  newPath: string
}

// ---- Sync / changes -----------------------------------------------------

export type RevisionKind =
  | 'create'
  | 'edit'
  | 'delete'
  | 'rename'
  | 'resolve'
  | 'attach'

export interface Revision {
  seq: number
  noteId: string
  kind: RevisionKind
  path: string
  oldPath?: string
  contentHash: string
  deviceId: string
  isConflict: boolean
  createdAt: string
}

export interface ChangesResponse {
  results: Revision[]
  lastSeq: number
}

export interface ConflictEntry {
  revId: string
  deviceId: string
  createdAt: string
}

export interface NoteConflicts {
  noteId: string
  path: string
  conflicts: ConflictEntry[]
}

export interface ResolveNoteRequest {
  content: string
  resolvedRevIds: string[]
}

export interface ResolveNoteResponse {
  revId: string
}

// ---- Search / tags / graph ------------------------------------------------

export interface SearchResult {
  noteId: string
  path: string
  title: string
  snippetHtml: string
  score: number
}

export interface TagCount {
  name: string
  count: number
}

/**
 * `GET /vaults/{v}/tags/{tag}/notes` response entry. Not spelled out in
 * the binding shared contract (only `/tags` itself is) — shaped to
 * match the other note-listing endpoints (`SearchResult`, `Backlink`)
 * that already use `noteId`/`path`/`title`. Widen rather than replace
 * if the server's actual shape differs once W2's search/tags endpoints
 * land.
 */
export interface TagNoteEntry {
  noteId: string
  path: string
  title: string
}

export interface Backlink {
  noteId: string
  path: string
  title: string
  contextSnippet: string
}

export interface GraphNode {
  id: string
  path: string
  title: string
  linkCount: number
}

export interface GraphEdge {
  source: string
  target: string
}

export interface GraphResponse {
  nodes: GraphNode[]
  edges: GraphEdge[]
}

// ---- Attachments --------------------------------------------------------

export interface AttachmentMeta {
  path: string
  sizeBytes: number
  mime: string
}

// ---- Admin ----------------------------------------------------------------

export interface AdminUser extends User {
  createdAt: string
}

export interface CreateUserRequest {
  username: string
  password: string
  displayName: string
  role: UserRole
}

export interface PatchUserRequest {
  role?: UserRole
  isDisabled?: boolean
  newPassword?: string
}

/**
 * `GET /invites` list entry. The contract only spells out the `POST`
 * response shape (`{token, expiresAt, role}`); a list necessarily also
 * needs a stable identifier to revoke by. Since `token` is the only
 * field the contract guarantees is unique, `deleteInvite` (adminApi.ts)
 * addresses `DELETE /invites/{token}` by token — a documented judgment
 * call, not a contract fact. Widen (don't rename) if the server's real
 * list shape differs once S6 lands.
 */
export interface Invite {
  token: string
  expiresAt: string
  role: UserRole
  createdAt?: string
  createdBy?: string
  usedAt?: string | null
  usedBy?: string | null
}

export interface CreateInviteRequest {
  role: UserRole
}

/**
 * `GET /system/health` (admin-only). Field names are a reasonable guess
 * at "disk, DB size, active sync connections, uptime, version" per the
 * design spec — S6 hasn't started, so this is built against the
 * *shape implied by the spec*, not a confirmed contract. The index
 * signature keeps unknown/renamed fields from being a compile error;
 * the UI treats every field as optional and shows a dash when absent.
 */
export interface SystemHealth {
  status?: 'ok' | 'degraded' | 'down' | string
  diskFreeBytes?: number
  diskTotalBytes?: number
  databaseSizeBytes?: number
  activeConnections?: number
  uptimeSeconds?: number
  version?: string
  [key: string]: unknown
}

export interface UserStorageStat {
  userId: string
  displayName: string
  sizeBytes: number
  noteCount?: number
}

export interface VaultStorageStat {
  vaultId: string
  name: string
  sizeBytes: number
  noteCount?: number
}

/**
 * `GET /admin/stats` — per-user and per-vault storage usage. Same
 * caveat as `SystemHealth`: shaped from the design spec ("storage usage
 * per user/vault"), not a confirmed S6 contract yet.
 */
export interface AdminStats {
  users: UserStorageStat[]
  vaults: VaultStorageStat[]
  [key: string]: unknown
}

// ---- Errors ---------------------------------------------------------------

export interface ApiErrorBody {
  error: {
    code: string
    message: string
  }
}

/** Thrown by the API client for any non-2xx response. */
export class ApiError extends Error {
  code: string
  status: number
  /**
   * Raw parsed JSON body, when the response had one — even when it
   * doesn't match the standard `{error:{code,message}}` envelope (e.g.
   * `PUT /api/notes/{id}/content`'s 409 body is `{headRevId,
   * conflictRevId}`). Callers that need that shape narrow this
   * themselves; everyone else can ignore it.
   */
  body?: unknown

  constructor(status: number, code: string, message: string, body?: unknown) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
    this.body = body
  }
}
