import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://placeholder.supabase.co'
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'placeholder-key'

export const supabase = createClient(supabaseUrl, supabaseKey)

export type Database = {
  users: {
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
  }
  publications: {
    id: string
    user_id: string
    title: string
    description: string | null
    category: string
    audio_url: string
    duration: number
    visibility: string
    likes_count: number
    comments_count: number
    plays_count: number
    created_at: string
    updated_at: string
  }
}
