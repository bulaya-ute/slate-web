import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from '../../components/ui/Toast'
import { ApiError, type Vault } from '../../lib/api/types'
import * as vaultsApi from './vaultsApi'

export const VAULTS_QUERY_KEY = ['vaults'] as const

export function useVaultsQuery() {
  return useQuery({
    queryKey: VAULTS_QUERY_KEY,
    queryFn: () => vaultsApi.fetchVaults(),
  })
}

export function useCreateVaultMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (name: string) => vaultsApi.createVault({ name }),
    onSuccess: (created) => {
      queryClient.setQueryData<Vault[]>(VAULTS_QUERY_KEY, (prev) => (prev ? [...prev, created] : [created]))
    },
    onError: (err) => {
      toast.danger(
        'Could not create vault',
        err instanceof ApiError ? err.message : 'Try again in a moment.',
      )
    },
  })
}
