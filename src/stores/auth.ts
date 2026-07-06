import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { User } from '../lib/api/types'

export interface AuthSession {
  accessToken: string
  refreshToken: string
  user: User
}

interface AuthState {
  accessToken: string | null
  refreshToken: string | null
  user: User | null
  /** Set after a successful login/register/setup. */
  setSession: (session: AuthSession) => void
  /** Set after a successful token refresh (user stays the same). */
  setTokens: (tokens: { accessToken: string; refreshToken: string }) => void
  /** Logout / failed-refresh cleanup. */
  clear: () => void
}

/**
 * Auth session, persisted to localStorage so a refresh doesn't force a
 * re-login. `client.ts` reads/writes this store directly via
 * `useAuth.getState()` outside of React (e.g. during the 401 retry
 * flow).
 */
export const useAuth = create<AuthState>()(
  persist(
    (set) => ({
      accessToken: null,
      refreshToken: null,
      user: null,
      setSession: ({ accessToken, refreshToken, user }) =>
        set({ accessToken, refreshToken, user }),
      setTokens: ({ accessToken, refreshToken }) =>
        set({ accessToken, refreshToken }),
      clear: () => set({ accessToken: null, refreshToken: null, user: null }),
    }),
    { name: 'slate.auth' },
  ),
)

export function isAuthenticated(): boolean {
  const { accessToken, refreshToken } = useAuth.getState()
  return Boolean(accessToken && refreshToken)
}
