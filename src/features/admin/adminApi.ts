import { api } from '../../lib/api/client'
import type {
  AdminStats,
  AdminUser,
  CreateInviteRequest,
  CreateUserRequest,
  Invite,
  PatchUserRequest,
  SystemHealth,
} from '../../lib/api/types'

// ---- Users ----------------------------------------------------------------

export function fetchUsers(): Promise<AdminUser[]> {
  return api.get<AdminUser[]>('/api/users')
}

export function createUser(body: CreateUserRequest): Promise<AdminUser> {
  return api.post<AdminUser>('/api/users', body)
}

export function patchUser(userId: string, body: PatchUserRequest): Promise<AdminUser> {
  return api.patch<AdminUser>(`/api/users/${userId}`, body)
}

export function deleteUser(userId: string): Promise<void> {
  return api.del<void>(`/api/users/${userId}`)
}

// ---- Invites ----------------------------------------------------------------

export function fetchInvites(): Promise<Invite[]> {
  return api.get<Invite[]>('/api/invites')
}

export function createInvite(body: CreateInviteRequest): Promise<Invite> {
  return api.post<Invite>('/api/invites', body)
}

/** See the `Invite` type's doc comment — revokes by `token`, the only guaranteed-unique field. */
export function deleteInvite(token: string): Promise<void> {
  return api.del<void>(`/api/invites/${encodeURIComponent(token)}`)
}

// ---- Health / stats ----------------------------------------------------------------

export function fetchSystemHealth(): Promise<SystemHealth> {
  return api.get<SystemHealth>('/api/system/health')
}

export function fetchAdminStats(): Promise<AdminStats> {
  return api.get<AdminStats>('/api/admin/stats')
}
