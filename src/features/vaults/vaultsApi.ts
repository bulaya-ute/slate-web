import { api } from '../../lib/api/client'
import type { CreateVaultRequest, Vault } from '../../lib/api/types'

export function fetchVaults(): Promise<Vault[]> {
  return api.get<Vault[]>('/api/vaults')
}

export function createVault(body: CreateVaultRequest): Promise<Vault> {
  return api.post<Vault>('/api/vaults', body)
}
