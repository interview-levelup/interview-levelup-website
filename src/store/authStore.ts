import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { User } from '@/types'
import * as authApi from '@/api/auth'

interface AuthState {
  token: string | null
  user: User | null
  login: (email: string, password: string) => Promise<void>
  register: (email: string, password: string) => Promise<void>
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>
  logout: () => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      user: null,

      login: async (email, password) => {
        const { data } = await authApi.login(email, password)
        localStorage.setItem('token', data.token)
        set({ token: data.token, user: data.user })
      },

      register: async (email, password) => {
        await authApi.register(email, password)
        const { data } = await authApi.login(email, password)
        localStorage.setItem('token', data.token)
        set({ token: data.token, user: data.user })
      },

      logout: () => {
        localStorage.removeItem('token')
        set({ token: null, user: null })
      },

      changePassword: async (currentPassword, newPassword) => {
        await authApi.changePassword(currentPassword, newPassword)
      },
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({ token: state.token, user: state.user }),
    },
  ),
)
