import { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { Heart, MessageCircle, Play, MoreVertical, Trash2, Edit2, Share2, Eye } from 'lucide-react'
import AudioPlayer from './AudioPlayer'
import CommentsModal from './CommentsModal'
import { formatTimeAgo, formatCount, getCategoryColor, getCategoryLabel, getInitials } from '@/utils/formatters'
import type { Publication } from '@/types'
import { supabase } from '@/services/supabaseClient'

interface PublicationCardProps {
  publication: Publication
  currentUserId?: string
  onLike: (id: string, liked: boolean, likesCount?: number, options?: { skipDebounce?: boolean }) => void
  onPlay?: (id: string) => void
  onCommentChange?: (id: string, delta: number) => void
  onDelete?: (id: string) => void
  onEdit?: (pub: Publication) => void
}

export default function PublicationCard({
  publication,
  currentUserId,
  onLike,
  onPlay,
  onCommentChange,
  onDelete,
  onEdit,
}: PublicationCardProps) {
  const [showMenu, setShowMenu] = useState(false)
  const [showComments, setShowComments] = useState(false)
  const [heartAnim, setHeartAnim] = useState(false)
  const likeInFlightRef = useRef(false)

  const [localLiked, setLocalLiked] = useState(publication.hasLiked ?? false)
  const [localLikesCount, setLocalLikesCount] = useState(publication.likes_count)
  const isLiked = localLiked
  const isOwner = currentUserId === publication.user_id
  const author = publication.users
  const authorDisplayName = author?.full_name || author?.username
  const [isFollowing, setIsFollowing] = useState<boolean>(false)
  const [followLoading, setFollowLoading] = useState(false)

  useEffect(() => {
    setLocalLiked(publication.hasLiked ?? false)
    setLocalLikesCount(publication.likes_count)
  }, [publication.hasLiked, publication.likes_count])

  const handleLike = async () => {
    if (likeInFlightRef.current) return

    likeInFlightRef.current = true
    setHeartAnim(true)
    setTimeout(() => setHeartAnim(false), 400)

    const previousLiked = isLiked
    const nextLiked = !previousLiked
    const previousLikesCount = localLikesCount
    const optimisticLikesCount = Math.max(0, previousLikesCount + (nextLiked ? 1 : -1))

    setLocalLiked(nextLiked)
    setLocalLikesCount(optimisticLikesCount)
    onLike(publication.id, nextLiked, optimisticLikesCount, { skipDebounce: false })

    const persistLike = async () => {
      try {
        let resolvedUserId = currentUserId

        if (!resolvedUserId) {
          const { data: authData } = await supabase.auth.getUser()
          if (!authData.user?.id) {
            throw new Error('Usuário não autenticado')
          }

          const { data: profileData, error: profileError } = await supabase
            .from('users')
            .select('id')
            .eq('auth_id', authData.user.id)
            .maybeSingle()

          if (!profileError) {
            resolvedUserId = profileData?.id ?? null
          }
        }

        if (!resolvedUserId) {
          throw new Error('Não foi possível encontrar o perfil do usuário para curtir')
        }

        try {
          const { data, error } = await supabase.rpc('toggle_like', {
            publication_id: publication.id,
            user_id: resolvedUserId,
          }) as any

          if (!error) {
            const response = data
            const result = Array.isArray(response) ? response[0] : response
            if (result) {
              setLocalLiked(Boolean(result.liked))
              setLocalLikesCount(Number(result.likes_count))
              onLike(publication.id, Boolean(result.liked), Number(result.likes_count), { skipDebounce: true })
              return
            }
          } else {
            console.warn('Like RPC failed, trying direct likes table fallback:', error)
          }
        } catch (rpcError) {
          console.warn('Like RPC threw, trying direct likes table fallback:', rpcError)
        }

        const { data: existingLike, error: existingError } = await supabase
          .from('likes')
          .select('id')
          .eq('publication_id', publication.id)
          .eq('user_id', resolvedUserId)
          .maybeSingle()

        if (existingError) throw existingError

        if (existingLike?.id) {
          const { error: deleteError } = await supabase
            .from('likes')
            .delete()
            .eq('publication_id', publication.id)
            .eq('user_id', resolvedUserId)

          if (deleteError) throw deleteError
        } else {
          const { error: insertError } = await supabase
            .from('likes')
            .insert({
              publication_id: publication.id,
              user_id: resolvedUserId,
            })

          if (insertError) throw insertError
        }

        const nextLiked = !existingLike?.id
        const nextLikesCount = Math.max(0, localLikesCount + (nextLiked ? 1 : -1))

        setLocalLiked(nextLiked)
        setLocalLikesCount(nextLikesCount)
        onLike(publication.id, nextLiked, nextLikesCount, { skipDebounce: true })
      } catch (err) {
        console.error('Erro ao persistir like:', err)
        setLocalLiked(previousLiked)
        setLocalLikesCount(previousLikesCount)
        onLike(publication.id, previousLiked, previousLikesCount, { skipDebounce: true })
      } finally {
        likeInFlightRef.current = false
      }
    }

    void persistLike()
  }

  const handlePlay = () => {
    onPlay?.(publication.id)
  }

  useEffect(() => {
    // check follow state (if current user exists and not owner)
    if (!currentUserId || currentUserId === publication.user_id) return
    let mounted = true
    ;(async () => {
      try {
        const { data } = await supabase.from('follows').select('id').eq('follower_id', currentUserId).eq('following_id', publication.user_id).maybeSingle()
        if (mounted) setIsFollowing(!!data)
      } catch (err) {
        // ignore
      }
    })()
    return () => { mounted = false }
  }, [currentUserId, publication.user_id])

  const handleFollow = async () => {
    if (!currentUserId) return alert('Você precisa estar logado para seguir usuários')
    setFollowLoading(true)
    try {
      if (!isFollowing) {
        const { error } = await supabase.from('follows').insert({ follower_id: currentUserId, following_id: publication.user_id }).select().maybeSingle()
        if (error) throw error
        setIsFollowing(true)
        // create notification for the followed user
        // Notifications are created server-side by DB triggers; no frontend insert.
      } else {
        const { error } = await supabase.from('follows').delete().eq('follower_id', currentUserId).eq('following_id', publication.user_id)
        if (error) throw error
        setIsFollowing(false)
      }
    } catch (err) {
      console.error('Erro ao seguir/unfollow:', err)
      alert('Erro ao atualizar seguimento')
    } finally {
      setFollowLoading(false)
    }
  }

  return (
    <>
      <article className="bg-white dark:bg-[#1C1C1C] rounded-2xl border border-[#ECE5DD] dark:border-[#30363D] overflow-hidden shadow-sm hover:shadow-md transition-shadow animate-fade-in mb-4">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start gap-3 p-4 pb-3">
          <Link to={`/profile/${author?.username}`}>
            <div className="w-11 h-11 rounded-full bg-[#25D366] flex items-center justify-center text-white font-bold text-sm flex-shrink-0 overflow-hidden hover:ring-2 hover:ring-[#25D366] hover:ring-offset-1 transition-all">
              {author?.avatar_url ? (
                <img src={author.avatar_url} alt={author.username} className="w-full h-full object-cover" />
              ) : (
                getInitials(author?.full_name ?? null, author?.username ?? 'U')
              )}
            </div>
          </Link>

          <div className="flex-1 min-w-0">
            <div className="flex flex-col sm:flex-row sm:items-center gap-2 w-full">
              <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
                <Link
                  to={`/profile/${author?.username}`}
                  className="font-semibold text-[#111827] dark:text-[#E6E6E6] hover:text-[#25D366] transition-colors text-sm truncate max-w-full"
                >
                  {authorDisplayName}
                </Link>
                {isOwner && (
                  <span className="text-xs bg-[#25D366] text-white px-2 py-0.5 rounded-full font-medium">Você</span>
                )}
              </div>
              <span
                className="text-xs text-white px-2 py-0.5 rounded-full font-medium inline-block w-full sm:w-auto max-w-full sm:max-w-[220px] truncate"
                style={{ backgroundColor: getCategoryColor(publication.category) }}
                title={getCategoryLabel(publication.category)}
              >
                {getCategoryLabel(publication.category)}
              </span>

              {!isOwner && (
                <button
                  onClick={handleFollow}
                  disabled={followLoading}
                  className={`w-full sm:w-auto sm:ml-2 text-xs px-2 py-1 rounded-xl font-semibold transition-colors ${isFollowing ? 'bg-white dark:bg-[#1C1C1C] text-[#111827] dark:text-[#E6E6E6] border border-[#ECE5DD]' : 'bg-[#25D366] text-white'}`}
                >
                  {isFollowing ? 'Seguindo' : 'Seguir'}
                </button>
              )}
            </div>
            <p className="mt-2 sm:mt-1 text-xs text-gray-500 dark:text-gray-400">
              @{author?.username} · {formatTimeAgo(publication.created_at)}
            </p>
          </div>

          {/* Menu */}
          {isOwner && (
            <div className="relative">
              <button
                onClick={() => setShowMenu(!showMenu)}
                className="p-1.5 rounded-full hover:bg-[#ECE5DD] dark:hover:bg-[#30363D] text-gray-400 hover:text-[#111827] dark:hover:text-[#E6E6E6] transition-colors"
              >
                <MoreVertical size={18} />
              </button>

              {showMenu && (
                <div className="absolute right-0 top-8 w-40 bg-white dark:bg-[#1C1C1C] rounded-xl shadow-xl border border-[#ECE5DD] dark:border-[#30363D] overflow-hidden z-10 animate-fade-in">
                  <button
                    onClick={() => { onEdit?.(publication); setShowMenu(false) }}
                    className="w-full flex items-center gap-3 px-4 py-3 text-sm text-[#111827] dark:text-[#E6E6E6] hover:bg-[#ECE5DD] dark:hover:bg-[#30363D] transition-colors"
                  >
                    <Edit2 size={14} />
                    Editar
                  </button>
                  <button
                    onClick={() => { onDelete?.(publication.id); setShowMenu(false) }}
                    className="w-full flex items-center gap-3 px-4 py-3 text-sm text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                  >
                    <Trash2 size={14} />
                    Excluir
                  </button>
                </div>
              )}

              {showMenu && <div className="fixed inset-0 z-[-1]" onClick={() => setShowMenu(false)} />}
            </div>
          )}
        </div>

        {/* Content */}
        <div className="px-4 pb-3">
          <h3 className="font-bold text-[#111827] dark:text-[#E6E6E6] text-base leading-tight mb-1">
            {publication.title}
          </h3>
          {publication.description && (
            <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-2 leading-relaxed">
              {publication.description}
            </p>
          )}
        </div>

        {/* Audio Player */}
        <div className="px-4 pb-3">
          <AudioPlayer
            src={publication.audio_url}
            duration={publication.duration}
            onPlay={handlePlay}
          />
        </div>

        {/* Stats */}
        <div className="flex flex-wrap items-center gap-3 px-4 py-2 text-xs text-gray-400 dark:text-gray-500 border-t border-[#ECE5DD] dark:border-[#30363D]">
          <span className="flex items-center gap-1 whitespace-nowrap">
            <Play size={12} />
            {formatCount(publication.plays_count)} plays
          </span>
          <span className="flex items-center gap-1 whitespace-nowrap">
            <Eye size={12} />
            {formatCount(localLikesCount)} curtidas
          </span>
          <span className="flex items-center gap-1 whitespace-nowrap">
            <MessageCircle size={12} />
            {formatCount(publication.comments_count)} comentários
          </span>
        </div>

        {/* Actions */}
        <div className="grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-[#ECE5DD] dark:divide-[#30363D] border-t border-[#ECE5DD] dark:border-[#30363D]">
          <button
            onClick={handleLike}
            className={`w-full flex items-center justify-center gap-2 py-3 text-sm font-medium transition-colors hover:bg-[#ECE5DD] dark:hover:bg-[#30363D] ${
              isLiked ? 'text-[#25D366]' : 'text-gray-500 dark:text-gray-400'
            }`}
          >
            <Heart
              size={18}
              fill={isLiked ? '#25D366' : 'none'}
              className={heartAnim ? 'animate-heart-beat' : ''}
            />
            <span className="whitespace-nowrap">{formatCount(localLikesCount)}</span>
          </button>

          <button
            onClick={() => setShowComments(true)}
            className="w-full flex items-center justify-center gap-2 py-3 text-sm font-medium text-gray-500 dark:text-gray-400 hover:text-[#25D366] hover:bg-[#ECE5DD] dark:hover:bg-[#30363D] transition-colors"
          >
            <MessageCircle size={18} />
            <span className="whitespace-nowrap">{formatCount(publication.comments_count)}</span>
          </button>

          <button
            className="w-full flex items-center justify-center gap-2 py-3 text-sm font-medium text-gray-500 dark:text-gray-400 hover:text-[#25D366] hover:bg-[#ECE5DD] dark:hover:bg-[#30363D] transition-colors"
            onClick={() => navigator.share?.({ title: publication.title, url: window.location.href })}
          >
            <Share2 size={18} />
            <span className="whitespace-nowrap">Compartilhar</span>
          </button>
        </div>
      </article>

      {showComments && (
        <CommentsModal
          publication={publication}
          currentUserId={currentUserId}
          onClose={() => setShowComments(false)}
          onCommentChange={onCommentChange}
        />
      )}
    </>
  )
}
