import { api, fetchWithHeaders } from '../../lib/api/client'
import {
  ApiError,
  type ChangesResponse,
  type NoteConflictResponse,
  type PutNoteContentRequest,
  type PutNoteContentResponse,
} from '../../lib/api/types'

export interface NoteContentResult {
  content: string
  /** From the `X-Rev-Id` response header — the revision this content reflects. */
  revId: string
  /** From the `X-Content-Hash` response header. */
  contentHash: string
}

/** `GET /notes/{id}/content` — raw markdown plus the revision headers the save loop needs. */
export async function fetchNoteContent(noteId: string): Promise<NoteContentResult> {
  const { data, headers } = await fetchWithHeaders<string>(`/api/notes/${noteId}/content`, {
    parseAs: 'text',
  })
  return {
    content: data,
    revId: headers.get('X-Rev-Id') ?? '',
    contentHash: headers.get('X-Content-Hash') ?? '',
  }
}

/**
 * Thrown by `putNoteContent` in place of the generic `ApiError` when the
 * server responds 409 — head moved since `baseRevId`. Carries the
 * `{headRevId, conflictRevId}` body the contract defines for this one
 * status code (it isn't the standard `{error:{code,message}}` envelope,
 * so the generic client can't surface it as anything but `ApiError.body`
 * — this narrows that for callers).
 */
export class ConflictError extends Error {
  headRevId: string
  conflictRevId: string

  constructor(info: NoteConflictResponse) {
    super('Save conflict: the note changed on the server since this edit started.')
    this.name = 'ConflictError'
    this.headRevId = info.headRevId
    this.conflictRevId = info.conflictRevId
  }
}

function isConflictBody(body: unknown): body is NoteConflictResponse {
  return (
    typeof body === 'object' &&
    body !== null &&
    typeof (body as Record<string, unknown>).headRevId === 'string' &&
    typeof (body as Record<string, unknown>).conflictRevId === 'string'
  )
}

/** `PUT /notes/{id}/content` — 200 adopts a new revId; 409 throws `ConflictError`. */
export async function putNoteContent(
  noteId: string,
  body: PutNoteContentRequest,
): Promise<PutNoteContentResponse> {
  try {
    return await api.put<PutNoteContentResponse>(`/api/notes/${noteId}/content`, body)
  } catch (err) {
    if (err instanceof ApiError && err.status === 409 && isConflictBody(err.body)) {
      throw new ConflictError(err.body)
    }
    throw err
  }
}

/** `GET /vaults/{v}/changes?since=` — catch-up feed, metadata only. */
export function fetchChanges(vaultId: string, since: number, limit?: number): Promise<ChangesResponse> {
  const params = new URLSearchParams({ since: String(since) })
  if (limit !== undefined) params.set('limit', String(limit))
  return api.get<ChangesResponse>(`/api/vaults/${vaultId}/changes?${params.toString()}`)
}
