import { create } from 'zustand'

export interface UserProfile {
  id: string
  auth_id: string
  username: string
  email: string
  full_name: string | null
  bio: string | null
  avatar_url: string | null
  cover_url: string | null
  is_private: boolean
  created_at: string
  updated_at: string
  followers_count?: number
  following_count?: number
  publications_count?: number
}

interface AuthState {
  user: UserProfile | null
  loading: boolean
  setUser: (user: UserProfile | null) => void
  setLoading: (loading: boolean) => void
  logout: () => void
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  loading: true,
  setUser: (user) => set({ user }),
  setLoading: (loading) => set({ loading }),
  logout: () => set({ user: null }),
}))
