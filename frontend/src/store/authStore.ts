import { create } from 'zustand'
import { getMe, login as apiLogin } from '../api/auth'
import type { UserMe } from '../api/auth'

interface AuthState {
  user: UserMe | null
  loading: boolean
  login: (email: string, password: string) => Promise<void>
  logout: () => void
  fetchMe: () => Promise<void>
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  loading: false,

  login: async (email, password) => {
    const token = await apiLogin(email, password)
    localStorage.setItem('token', token)
    const user = await getMe()
    set({ user })
  },

  logout: () => {
    localStorage.removeItem('token')
    set({ user: null })
  },

  fetchMe: async () => {
    const token = localStorage.getItem('token')
    if (!token) return
    set({ loading: true })
    try {
      const user = await getMe()
      set({ user })
    } catch {
      localStorage.removeItem('token')
    } finally {
      set({ loading: false })
    }
  },
}))
