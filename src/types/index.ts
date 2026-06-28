export interface User {
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

export interface Publication {
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
  users?: {
    id: string
    username: string
    full_name: string | null
    avatar_url: string | null
  }
  hasLiked?: boolean
}

export interface Comment {
  id: string
  user_id: string
  publication_id: string
  content: string
  created_at: string
  updated_at: string
  user?: {
    id: string
    username: string
    full_name: string | null
    avatar_url: string | null
  }
}

export interface Message {
  id: string
  sender_id: string
  recipient_id: string
  content: string
  message_type: 'text' | 'audio'
  audio_url: string | null
  duration?: number | null
  is_read: boolean
  created_at: string
  sender?: {
    id: string
    username: string
    avatar_url: string | null
  }
  recipient?: {
    id: string
    username: string
    avatar_url: string | null
  }
}

export interface Conversation {
  id: string
  user_one_id: string
  user_two_id: string
  last_message_id: string | null
  updated_at: string
  user_one?: User
  user_two?: User
  last_message?: Message
  unread_count?: number
}

export const CATEGORIES = [
  { value: 'podcast', label: 'Podcast', color: 'bg-indigo-500' },
  { value: 'musica', label: 'Música', color: 'bg-amber-500' },
  { value: 'fala', label: 'Fala', color: 'bg-blue-500' },
  { value: 'comedia', label: 'Comédia', color: 'bg-orange-500' },
  { value: 'educacao', label: 'Educação', color: 'bg-emerald-500' },
  { value: 'outro', label: 'Outro', color: 'bg-gray-500' },
] as const
