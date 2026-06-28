import { useState, useEffect } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { Edit2, MessageCircle, UserPlus, UserMinus, Lock, Mic, Heart, Users } from 'lucide-react'
import { useAuthStore } from '@/stores/authStore'
import { supabase } from '@/services/supabaseClient'
import { formatCount, getInitials, getCategoryColor, getCategoryLabel, formatDuration } from '@/utils/formatters'
import AudioPlayer from '@/components/feed/AudioPlayer'
import type { User, Publication } from '@/types'

export default function ProfilePage() {
  const { username } = useParams<{ username: string }>()
  const { user: currentUser } = useAuthStore()
  const navigate = useNavigate()
  const [profile, setProfile] = useState<User | null>(null)
  const [publications, setPublications] = useState<Publication[]>([])
  const [likedPublications, setLikedPublications] = useState<Publication[]>([])
  const [loading, setLoading] = useState(true)
  const [isFollowing, setIsFollowing] = useState(false)
  const [followersCount, setFollowersCount] = useState(0)
  const [showFollowers, setShowFollowers] = useState(false)
  const [showFollowing, setShowFollowing] = useState(false)
  const [activeTab, setActiveTab] = useState<'audio' | 'liked'>('audio')

  const isOwner = currentUser?.username === username

  useEffect(() => {
    const fetchProfile = async () => {
      setLoading(true)

      try {
        const { data: user, error } = await supabase
          .from('users')
          .select('*')
          .eq('username', username)
          .single()

        if (error) {
          setProfile(null)
          setLoading(false)
          return
        }

        if (user) {
          setProfile(user)
          setFollowersCount(user.followers_count || 0)

          if (currentUser?.id) {
            const { data: followData } = await supabase
              .from('follows')
              .select('id')
              .eq('follower_id', currentUser.id)
              .eq('following_id', user.id)
              .maybeSingle()

            setIsFollowing(!!followData)
          }

          const { data: pubs } = await supabase
            .from('publications')
            .select('*')
            .eq('user_id', user.id)
            .eq('is_deleted', false)
            .order('created_at', { ascending: false })

          setPublications(pubs || [])

          if (currentUser?.id && currentUser.id === user.id) {
            const { data: likesData } = await supabase
              .from('likes')
              .select('publication_id')
              .eq('user_id', user.id)

            const likedPublicationIds = likesData?.map(like => like.publication_id) || []

            if (likedPublicationIds.length > 0) {
              const { data: likedPubs } = await supabase
                .from('publications')
                .select('*, users(*)')
                .in('id', likedPublicationIds)
                .eq('is_deleted', false)
                .order('created_at', { ascending: false })

              setLikedPublications(likedPubs || [])
            } else {
              setLikedPublications([])
            }
          } else {
            setLikedPublications([])
          }
        }

        setLoading(false)
      } catch (err) {
        console.error('Erro ao carregar perfil:', err)
        setLoading(false)
      }
    }

    if (username) {
      fetchProfile()
    }
  }, [username, currentUser?.id, currentUser?.avatar_url])

  const handleFollow = () => {
    if (!currentUser) return alert('Você precisa estar logado para seguir usuários')

    ;(async () => {
      try {
        if (!isFollowing) {
          const { data, error } = await supabase.from('follows').insert({ follower_id: currentUser.id, following_id: profile!.id }).select().maybeSingle()
          if (error) throw error
          setIsFollowing(true)
          setFollowersCount(c => c + 1)
          // Notifications are created server-side by DB triggers; no frontend insert.
        } else {
          const { error } = await supabase.from('follows').delete().eq('follower_id', currentUser.id).eq('following_id', profile!.id)
          if (error) throw error
          setIsFollowing(false)
          setFollowersCount(c => c - 1)
        }
      } catch (err) {
        console.error('Erro ao seguir/unfollow:', err)
        alert('Erro ao atualizar seguimento')
      }
    })()
  }

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="h-40 bg-[#ECE5DD] dark:bg-[#1C1C1C] skeleton" />
        <div className="px-4 -mt-12 space-y-4">
          <div className="w-24 h-24 rounded-full skeleton" />
          <div className="h-6 skeleton rounded-full w-40" />
          <div className="h-4 skeleton rounded-full w-60" />
        </div>
      </div>
    )
  }

  if (!profile) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center px-4">
        <div className="text-6xl mb-4">🤷</div>
        <h2 className="text-xl font-bold text-[#111827] dark:text-[#E6E6E6] mb-2">Usuário não encontrado</h2>
        <p className="text-gray-500 dark:text-gray-400 mb-4">@{username} não existe no VozZap</p>
        <button onClick={() => navigate(-1)} className="bg-[#25D366] text-white px-6 py-2 rounded-xl font-medium hover:bg-[#075E54] transition-colors">
          Voltar
        </button>
      </div>
    )
  }

  const displayPublications = activeTab === 'liked' ? likedPublications : publications

  return (
    <div className="max-w-2xl mx-auto">
      {/* Cover */}
      <div className="relative h-32 sm:h-40 md:h-52 overflow-hidden">
        {profile.cover_url ? (
          <img src={profile.cover_url} alt="Cover" className="w-full h-full object-cover object-center" />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-[#075E54] via-[#25D366] to-[#075E54]" />
        )}
      </div>

      {/* Profile Info */}
      <div className="bg-white dark:bg-[#1C1C1C] px-2 sm:px-4 pt-0 pb-4 relative z-10">
        <div className="flex items-end justify-between -mt-12 sm:-mt-14 mb-3 sm:mb-4 gap-2">
          {/* Avatar */}
          <div className="relative z-20 w-16 sm:w-24 h-16 sm:h-24 rounded-full border-2 sm:border-4 border-white dark:border-[#1C1C1C] bg-[#25D366] flex-shrink-0 flex items-center justify-center text-white text-lg sm:text-2xl font-bold overflow-hidden shadow-lg">
            {profile.avatar_url ? (
              <img src={profile.avatar_url} alt={profile.username} className="w-full h-full object-cover" />
            ) : (
              getInitials(profile.full_name, profile.username)
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex gap-1 sm:gap-2 mt-10 sm:mt-14 flex-wrap justify-end">
            {isOwner ? (
              <Link
                to="/profile/edit"
                className="flex items-center gap-1 sm:gap-2 px-3 sm:px-4 py-1.5 sm:py-2 bg-[#ECE5DD] dark:bg-[#30363D] text-[#111827] dark:text-[#E6E6E6] rounded-xl text-xs sm:text-sm font-semibold hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
              >
                <Edit2 size={14} className="sm:size-4" />
                Editar
              </Link>
            ) : (
              <>
                <button
                  onClick={handleFollow}
                  className={`flex items-center gap-1 sm:gap-2 px-3 sm:px-4 py-1.5 sm:py-2 rounded-xl text-xs sm:text-sm font-semibold transition-colors ${
                    isFollowing
                      ? 'bg-[#ECE5DD] dark:bg-[#30363D] text-[#111827] dark:text-[#E6E6E6] hover:bg-red-50 hover:text-red-500'
                      : 'bg-[#25D366] text-white hover:bg-[#075E54]'
                  }`}
                >
                  {isFollowing ? <UserMinus size={14} className="sm:size-4" /> : <UserPlus size={14} className="sm:size-4" />}
                  <span className="hidden sm:inline">{isFollowing ? 'Seguindo' : 'Seguir'}</span>
                  <span className="sm:hidden">{isFollowing ? 'Seguindo' : '+' }</span>
                </button>
                <Link
                  to="/messages"
                  className="flex items-center gap-2 px-4 py-2 bg-[#ECE5DD] dark:bg-[#30363D] text-[#111827] dark:text-[#E6E6E6] rounded-xl text-sm font-semibold hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                >
                  <MessageCircle size={16} />
                  Mensagem
                </Link>
              </>
            )}
          </div>
        </div>

        {/* Name & Bio */}
        <div className="mb-4">
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-xl font-bold text-[#111827] dark:text-[#E6E6E6]">
              {profile.full_name || profile.username}
            </h1>
            {isOwner && (
              <span className="text-xs bg-[#25D366] text-white px-2 py-0.5 rounded-full font-medium">Você</span>
            )}
            {profile.is_private && (
              <span title="Perfil privado"><Lock size={16} className="text-gray-400" /></span>
            )}
          </div>
          <p className="text-gray-500 dark:text-gray-400 text-sm">@{profile.username}</p>
          {profile.bio && (
            <p className="text-[#111827] dark:text-[#E6E6E6] text-sm mt-2 leading-relaxed">{profile.bio}</p>
          )}
        </div>

        {/* Stats */}
        <div className="flex gap-6 border-t border-b border-[#ECE5DD] dark:border-[#30363D] py-3">
          <button onClick={() => setShowFollowers(true)} className="flex flex-col items-center hover:text-[#25D366] transition-colors">
            <span className="font-bold text-lg text-[#111827] dark:text-[#E6E6E6]">{formatCount(followersCount)}</span>
            <span className="text-xs text-gray-500 dark:text-gray-400">Seguidores</span>
          </button>
          <button onClick={() => setShowFollowing(true)} className="flex flex-col items-center hover:text-[#25D366] transition-colors">
            <span className="font-bold text-lg text-[#111827] dark:text-[#E6E6E6]">{formatCount(profile.following_count || 0)}</span>
            <span className="text-xs text-gray-500 dark:text-gray-400">Seguindo</span>
          </button>
          <div className="flex flex-col items-center">
            <span className="font-bold text-lg text-[#111827] dark:text-[#E6E6E6]">{formatCount(publications.length)}</span>
            <span className="text-xs text-gray-500 dark:text-gray-400">Áudios</span>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex mt-4 border-b border-[#ECE5DD] dark:border-[#30363D]">
          <button
            onClick={() => setActiveTab('audio')}
            className={`flex-1 flex items-center justify-center gap-2 py-3 text-sm font-semibold transition-colors border-b-2 ${
              activeTab === 'audio'
                ? 'border-[#25D366] text-[#25D366]'
                : 'border-transparent text-gray-500 hover:text-[#111827] dark:hover:text-[#E6E6E6]'
            }`}
          >
            <Mic size={16} />
            Áudios
          </button>
          <button
            onClick={() => setActiveTab('liked')}
            className={`flex-1 flex items-center justify-center gap-2 py-3 text-sm font-semibold transition-colors border-b-2 ${
              activeTab === 'liked'
                ? 'border-[#25D366] text-[#25D366]'
                : 'border-transparent text-gray-500 hover:text-[#111827] dark:hover:text-[#E6E6E6]'
            }`}
          >
            <Heart size={16} />
            Curtidos
          </button>
        </div>
      </div>

      {/* Publications */}
      <div className="px-4 py-4 space-y-3">
        {displayPublications.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="text-5xl mb-3">🎙️</div>
            <p className="text-[#111827] dark:text-[#E6E6E6] font-semibold">
              {activeTab === 'liked' ? 'Nenhum áudio curtido ainda' : 'Nenhum áudio ainda'}
            </p>
            {isOwner && activeTab === 'audio' && (
              <Link
                to="/publish"
                className="mt-4 bg-[#25D366] text-white px-6 py-2 rounded-xl font-medium hover:bg-[#075E54] transition-colors text-sm"
              >
                Publicar primeiro áudio
              </Link>
            )}
          </div>
        ) : (
          displayPublications.map(pub => (
            <div key={pub.id} className="bg-white dark:bg-[#1C1C1C] rounded-2xl border border-[#ECE5DD] dark:border-[#30363D] p-4">
              <div className="flex items-start gap-3 mb-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-[#111827] dark:text-[#E6E6E6] text-sm flex-1">{pub.title}</h3>
                    <span
                      className="text-xs text-white px-2 py-0.5 rounded-full font-medium flex-shrink-0"
                      style={{ backgroundColor: getCategoryColor(pub.category) }}
                    >
                      {getCategoryLabel(pub.category)}
                    </span>
                  </div>
                  {pub.description && (
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 line-clamp-1">{pub.description}</p>
                  )}
                </div>
              </div>

              <AudioPlayer src={pub.audio_url} duration={pub.duration} compact />

              <div className="flex items-center gap-4 mt-3 text-xs text-gray-400">
                <span className="flex items-center gap-1"><Heart size={12} />{formatCount(pub.likes_count)}</span>
                <span className="flex items-center gap-1"><Mic size={12} />{formatDuration(pub.duration)}</span>
                <span className="flex items-center gap-1"><Users size={12} />{formatCount(pub.plays_count)} plays</span>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Followers Modal */}
      {showFollowers && (
        <UserListModal
          title="Seguidores"
          users={MOCK_USERS.slice(0, 3)}
          onClose={() => setShowFollowers(false)}
        />
      )}

      {showFollowing && (
        <UserListModal
          title="Seguindo"
          users={MOCK_USERS.slice(0, 2)}
          onClose={() => setShowFollowing(false)}
        />
      )}
    </div>
  )
}

function UserListModal({ title, users, onClose }: { title: string; users: User[]; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-full sm:w-96 bg-white dark:bg-[#1C1C1C] sm:rounded-2xl rounded-t-2xl overflow-hidden animate-fade-in">
        <div className="flex items-center justify-between p-4 border-b border-[#ECE5DD] dark:border-[#30363D]">
          <h3 className="font-bold text-[#111827] dark:text-[#E6E6E6]">{title}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">✕</button>
        </div>
        <div className="max-h-80 overflow-y-auto divide-y divide-[#ECE5DD] dark:divide-[#30363D]">
          {users.map(u => (
            <Link key={u.id} to={`/profile/${u.username}`} onClick={onClose} className="flex items-center gap-3 p-4 hover:bg-[#ECE5DD] dark:hover:bg-[#30363D] transition-colors">
              <div className="w-10 h-10 rounded-full bg-[#25D366] flex items-center justify-center text-white font-bold text-sm">
                {getInitials(u.full_name, u.username)}
              </div>
              <div>
                <p className="font-semibold text-[#111827] dark:text-[#E6E6E6] text-sm">{u.full_name}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">@{u.username}</p>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}
