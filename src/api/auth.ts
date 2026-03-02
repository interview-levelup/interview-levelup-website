import client from './client'
import type { User } from '@/types'

export interface AuthResponse {
  token: string
  user: User
}

export const register = (email: string, password: string) =>
  client.post<{ user: User }>('/api/v1/auth/register', { email, password })

export const login = (email: string, password: string) =>
  client.post<AuthResponse>('/api/v1/auth/login', { email, password })
