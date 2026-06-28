import { useState, useCallback, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Search, UserPlus, UserMinus, Mic, TrendingUp } from 'lucide-react'
import { useAuthStore } from '@/stores/authStore'
import { supabase } from '@/services/supabaseClient'
import { getInitials, formatCount, debounce } from '@/utils/formatters'
import type { User } from '@/types'

const TRENDING_TAGS = ['#podcast', '#música', '#educação', '#comédia', '#tecnologia', '#fala', '#cultura']

export default function SearchPage() {
  const { user: currentUser } = useAuthStore()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<User[]>([])
  const [loading, setLoading] = useState(false)
  const [following, setFollowing] = useState<string[]>([])
  const [searched, setSearched] = useState(false)
  const [suggestedUsers, setSuggestedUsers] = useState<User[]>([])

  useEffect(() => {
    const fetchFollowing = async () => {
      if (!currentUser?.id) return

      const { data } = await supabase
        .from('follows')
        .select('following_id')
        .eq('follower_id', currentUser.id)

      setFollowing(data?.map(f => f.following_id) || [])
    }

    fetchFollowing()
  }, [currentUser?.id])

  useEffect(() => {
    const fetchSuggestedUsers = async () => {
      try {
        const { data } = await supabase
          .from('users')
          .select('*')
          .eq('is_private', false)
          .order('followers_count', { ascending: false })
          .limit(4)

        setSuggestedUsers(data || [])
      } catch (err) {
        console.error('Erro ao carregar criadores sugeridos:', err)
      }
    }

    fetchSuggestedUsers()
  }, [])

  const searchUsers = useCallback(
    debounce(async (q: string) => {
      if (!q.trim()) {
        setResults([])
        setSearched(false)
        setLoading(false)
        return
      }

      setLoading(true)
      setSearched(true)

      try {
        const { data: found, error } = await supabase
          .from('users')
          .select('*')
          .or(`username.ilike.%${q}%,full_name.ilike.%${q}%,bio.ilike.%${q}%`)
          .limit(20)

        if (!error && found) {
          setResults(found)
        }
      } catch (err) {
        console.error('Erro ao buscar usuários:', err)
      }

      setLoading(false)
    }, 300),
    []
  )

  useEffect(() => {
    searchUsers(query)
  }, [query, searchUsers])

  const handleFollow = async (userId: string) => {
    if (!currentUser?.id) return

    const isFollowing = following.includes(userId)

    try {
      if (isFollowing) {
        await supabase
          .from('follows')
          .delete()
          .eq('follower_id', currentUser.id)
          .eq('following_id', userId)
      } else {
        await supabase
          .from('follows')
          .insert({
            follower_id: currentUser.id,
            following_id: userId,
          })
      }

      setFollowing(prev =>
        prev.includes(userId) ? prev.filter(id => id !== userId) : [...prev, userId]
      )
    } catch (err) {
      console.error('Erro ao seguir/deseguir usuário:', err)
    }
  }

  return (
    <div className="max-w-6xl mx-auto px-6 py-6">
      {/* Search Bar */}
      <div className="relative mb-4 sm:mb-6 flex justify-center mt-4">
        <div className="w-full max-w-5xl relative">
          <Search size={20} className="absolute left-6 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500" />
          <input
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Buscar usuários por nome, username..."
            autoFocus
            className="w-full pl-14 pr-4 py-3 rounded-full border border-[#ECE5DD] dark:border-[#30363D] bg-white dark:bg-[#0D1117] text-[#111827] dark:text-[#E6E6E6] placeholder-gray-400 focus:outline-none focus:border-[#25D366] focus:ring-1 focus:ring-[#25D366]/25 transition-colors text-sm shadow-sm"
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-lg"
            >
              ×
            </button>
          )}
        </div>
      </div>

      {/* Loading */}
      {loading && (
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="bg-white dark:bg-[#1C1C1C] rounded-2xl p-4 flex items-center gap-3">
              <div className="w-12 h-12 rounded-full skeleton" />
              <div className="flex-1 space-y-2">
                <div className="h-4 skeleton rounded-full w-32" />
                <div className="h-3 skeleton rounded-full w-48" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Results */}
      {!loading && searched && (
        <>
          {results.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="text-5xl mb-3">🔍</div>
              <p className="font-semibold text-[#111827] dark:text-[#E6E6E6] mb-1">Nenhum resultado</p>
              <p className="text-sm text-gray-500 dark:text-gray-400">Tente com outro nome ou username</p>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">
                {results.length} resultado{results.length !== 1 ? 's' : ''} para "{query}"
              </p>
              {results.map(u => (
                <UserCard
                  key={u.id}
                  user={u}
                  isCurrentUser={u.id === currentUser?.id}
                  isFollowing={following.includes(u.id)}
                  onFollow={() => handleFollow(u.id)}
                />
              ))}
            </div>
          )}
        </>
      )}

      {/* Initial State - Suggestions */}
      {!searched && !loading && (
        <div className="space-y-6">
          {/* Trending */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <TrendingUp size={18} className="text-[#25D366]" />
              <h2 className="font-bold text-[#111827] dark:text-[#E6E6E6]">Em alta</h2>
            </div>
            <div className="flex flex-wrap gap-2">
              {TRENDING_TAGS.map(tag => (
                <button
                  key={tag}
                  onClick={() => setQuery(tag.replace('#', ''))}
                  className="px-3 py-1.5 bg-white dark:bg-[#1C1C1C] border border-[#ECE5DD] dark:border-[#30363D] rounded-full text-sm text-[#111827] dark:text-[#E6E6E6] hover:border-[#25D366] hover:text-[#25D366] transition-colors"
                >
                  {tag}
                </button>
              ))}
            </div>
          </div>

          {/* Suggested Users */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Mic size={18} className="text-[#25D366]" />
              <h2 className="font-bold text-[#111827] dark:text-[#E6E6E6]">Criadores em destaque</h2>
            </div>
            <div className="space-y-3">
              {suggestedUsers.map(u => (
                <UserCard
                  key={u.id}
                  user={u}
                  isCurrentUser={u.id === currentUser?.id}
                  isFollowing={following.includes(u.id)}
                  onFollow={() => handleFollow(u.id)}
                />
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function UserCard({
  user,
  isCurrentUser,
  isFollowing,
  onFollow,
}: {
  user: User
  isCurrentUser: boolean
  isFollowing: boolean
  onFollow: () => void
}) {
  return (
    <div className="bg-white dark:bg-[#1C1C1C] rounded-2xl border border-[#ECE5DD] dark:border-[#30363D] p-4 flex items-center gap-3 hover:shadow-sm transition-shadow">
      <Link to={`/profile/${user.username}`}>
        <div className="w-12 h-12 rounded-full bg-[#25D366] flex items-center justify-center text-white font-bold flex-shrink-0 hover:ring-2 hover:ring-[#25D366] hover:ring-offset-1 transition-all">
          {user.avatar_url ? (
            <img src={user.avatar_url} alt={user.username} className="w-full h-full rounded-full object-cover" />
          ) : (
            getInitials(user.full_name, user.username)
          )}
        </div>
      </Link>

      <Link to={`/profile/${user.username}`} className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="font-semibold text-[#111827] dark:text-[#E6E6E6] text-sm truncate hover:text-[#25D366] transition-colors">
            {user.full_name || user.username}
          </p>
          {isCurrentUser && (
            <span className="text-xs bg-[#25D366] text-white px-2 py-0.5 rounded-full">Você</span>
          )}
        </div>
        <p className="text-xs text-gray-500 dark:text-gray-400">@{user.username}</p>
        {user.bio && (
          <p className="text-xs text-gray-400 dark:text-gray-500 truncate mt-0.5">{user.bio}</p>
        )}
        <div className="flex items-center gap-3 mt-1">
          <span className="text-xs text-[#25D366] font-medium">{formatCount(user.followers_count || 0)} seguidores</span>
          <span className="text-xs text-gray-400">{formatCount(user.publications_count || 0)} áudios</span>
        </div>
      </Link>

      {!isCurrentUser && (
        <button
          onClick={onFollow}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition-colors flex-shrink-0 ${
            isFollowing
              ? 'bg-[#ECE5DD] dark:bg-[#30363D] text-[#111827] dark:text-[#E6E6E6] hover:bg-red-50 hover:text-red-500'
              : 'bg-[#25D366] text-white hover:bg-[#075E54]'
          }`}
        >
          {isFollowing ? <UserMinus size={14} /> : <UserPlus size={14} />}
          {isFollowing ? 'Seguindo' : 'Seguir'}
        </button>
      )}
    </div>
  )
}
