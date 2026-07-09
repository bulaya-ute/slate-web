import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from '../../components/ui/Toast'
import { ApiError, type AdminUser, type CreateUserRequest, type Invite, type PatchUserRequest } from '../../lib/api/types'
import * as adminApi from './adminApi'

function errorMessage(err: unknown, fallback: string): string {
  return err instanceof ApiError ? err.message : fallback
}

// ---- Users ----------------------------------------------------------------

export const USERS_QUERY_KEY = ['admin', 'users'] as const

export function useUsersQuery() {
  return useQuery({ queryKey: USERS_QUERY_KEY, queryFn: () => adminApi.fetchUsers() })
}

export function useCreateUserMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (body: CreateUserRequest) => adminApi.createUser(body),
    onSuccess: (created) => {
      queryClient.setQueryData<AdminUser[]>(USERS_QUERY_KEY, (prev) => (prev ? [...prev, created] : [created]))
      toast.success(`User "${created.username}" created`)
    },
    onError: (err) => toast.danger('Could not create user', errorMessage(err, 'Try again.')),
  })
}

export function usePatchUserMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ userId, body }: { userId: string; body: PatchUserRequest }) => adminApi.patchUser(userId, body),
    onSuccess: (updated) => {
      queryClient.setQueryData<AdminUser[]>(USERS_QUERY_KEY, (prev) =>
        prev ? prev.map((u) => (u.id === updated.id ? updated : u)) : prev,
      )
    },
    onError: (err) => toast.danger('Could not update user', errorMessage(err, 'Try again.')),
  })
}

export function useDeleteUserMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (userId: string) => adminApi.deleteUser(userId),
    onSuccess: (_data, userId) => {
      queryClient.setQueryData<AdminUser[]>(USERS_QUERY_KEY, (prev) => prev?.filter((u) => u.id !== userId))
      toast.success('User deleted')
    },
    onError: (err) => {
      // S3's fix 409s when the user still owns vaults — surface that
      // message verbatim rather than a generic "try again" (deleting
      // isn't retryable until the vaults are reassigned/removed).
      toast.danger('Could not delete user', errorMessage(err, 'Try again.'))
    },
  })
}

// ---- Invites ----------------------------------------------------------------

export const INVITES_QUERY_KEY = ['admin', 'invites'] as const

export function useInvitesQuery() {
  return useQuery({ queryKey: INVITES_QUERY_KEY, queryFn: () => adminApi.fetchInvites() })
}

export function useCreateInviteMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (role: Invite['role']) => adminApi.createInvite({ role }),
    onSuccess: (created) => {
      queryClient.setQueryData<Invite[]>(INVITES_QUERY_KEY, (prev) => (prev ? [created, ...prev] : [created]))
    },
    onError: (err) => toast.danger('Could not create invite', errorMessage(err, 'Try again.')),
  })
}

export function useDeleteInviteMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (token: string) => adminApi.deleteInvite(token),
    onSuccess: (_data, token) => {
      queryClient.setQueryData<Invite[]>(INVITES_QUERY_KEY, (prev) => prev?.filter((i) => i.token !== token))
      toast.success('Invite revoked')
    },
    onError: (err) => toast.danger('Could not revoke invite', errorMessage(err, 'Try again.')),
  })
}

// ---- Storage stats ----------------------------------------------------------------

export function useAdminStatsQuery() {
  return useQuery({ queryKey: ['admin', 'stats'], queryFn: () => adminApi.fetchAdminStats() })
}
