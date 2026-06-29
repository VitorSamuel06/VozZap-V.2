import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { RefreshCw, Flame, Users, Filter } from 'lucide-react'
import PublicationCard from '@/components/feed/PublicationCard'
import PublicationSkeleton from '@/components/feed/PublicationSkeleton'
import { useAuthStore } from '@/stores/authStore'
import { supabase } from '@/services/supabaseClient'
import type { Publication } from '@/types'

const CATEGORIES = ['Todos', 'Podcast', 'Música', 'Fala', 'Comédia', 'Educação', 'Outro']

export default function FeedPage() {
  const { user } = useAuthStore()
  const [publications, setPublications] = useState<Publication[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'all' | 'following'>('all')
  const [selectedCategory, setSelectedCategory] = useState('Todos')
  const tabRef = useRef<'all' | 'following'>(tab)
  const categoryRef = useRef<string>(selectedCategory)
  const userIdRef = useRef<string | undefined>(user?.id)
  const [_page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const sentinelRef = useRef<HTMLDivElement>(null)
  const lastRealtimeEventRef = useRef<number>(Date.now())
  const suppressSyncUntilRef = useRef<number>(0)
  const recentActionRef = useRef<Record<string, number>>({})
  const pendingLikeRef = useRef<Record<string, number>>({})

  const enrichPublicationsWithUserLikes = async (publications: Publication[]) => {
    if (!user?.id || publications.length === 0) {
      return publications.map(pub => ({ ...pub, hasLiked: false }))
    }

    try {
      const publicationIds = publications.map(pub => pub.id)
      const { data: likes, error } = await supabase
        .from('likes')
        .select('publication_id')
        .eq('user_id', user.id)
        .in('publication_id', publicationIds)

      if (error) {
        console.error('Erro ao carregar likes do usuário:', error)
        return publications.map(pub => ({ ...pub, hasLiked: false }))
      }

      const likedIds = new Set(likes?.map(like => like.publication_id) ?? [])
      return publications.map(pub => ({ ...pub, hasLiked: likedIds.has(pub.id) }))
    } catch (err) {
      console.error('Erro ao carregar likes do usuário:', err)
      return publications.map(pub => ({ ...pub, hasLiked: false }))
    }
  }

  const loadPublications = useCallback(async (reset = false, options: { silent?: boolean } = {}) => {
    const { silent = false } = options

    if (reset && !silent) {
      setLoading(true)
    }

    try {
      let query = supabase
        .from('publications')
        .select('*, users(*)')
        .eq('is_deleted', false)
        .eq('visibility', 'public')
        .order('created_at', { ascending: false })

      if (tab === 'following' && user?.id) {
        const { data: following } = await supabase
          .from('follows')
          .select('following_id')
          .eq('follower_id', user.id)

        const followingIds = following?.map(f => f.following_id) || []
        if (followingIds.length === 0) {
          if (reset) {
            setPublications([])
            setPage(1)
            setHasMore(false)
          }
          if (!silent) setLoading(false)
          setRefreshing(false)
          return
        }
        query = query.in('user_id', followingIds)
      }

      if (selectedCategory !== 'Todos') {
        const catMap: Record<string, string> = {
          'Podcast': 'podcast',
          'Música': 'música',
          'Fala': 'fala',
          'Comédia': 'comédia',
          'Educação': 'educação',
          'Outro': 'outro'
        }
        query = query.eq('category', catMap[selectedCategory])
      }

      const { data: pubs, error } = await query.limit(reset ? 10 : 3)

      if (error) {
        console.error('Erro ao carregar publicações:', error)
        if (!silent) {
          setLoading(false)
        }
        setRefreshing(false)
        return
      }

      const enrichedPubs = await enrichPublicationsWithUserLikes(pubs || [])

      if (reset) {
        setPublications(enrichedPubs)
        setPage(1)
        setHasMore((enrichedPubs?.length || 0) > 10)
      } else {
        setPublications(prev => {
          const existingIds = new Set(prev.map(pub => pub.id))
          const uniqueNew = enrichedPubs.filter(pub => !existingIds.has(pub.id))
          return [...prev, ...uniqueNew]
        })
        setHasMore(false)
      }

      lastRealtimeEventRef.current = Date.now()
      if (!silent) {
        setLoading(false)
      }
      setRefreshing(false)
    } catch (err) {
      console.error('Erro ao carregar publicações:', err)
      if (!silent) {
        setLoading(false)
      }
      setRefreshing(false)
    }
  }, [tab, selectedCategory, user?.id])

  useEffect(() => {
    loadPublications(true)
  }, [tab, selectedCategory, user?.id])

  // keep refs up-to-date for use inside the single subscription
  useEffect(() => { tabRef.current = tab }, [tab])
  useEffect(() => { categoryRef.current = selectedCategory }, [selectedCategory])
  useEffect(() => { userIdRef.current = user?.id }, [user?.id])

  useEffect(() => {
    // Create separate persistent subscriptions for publications, likes and comments
    console.log('[Feed] subscribing to realtime channels...')

    const publicationChannel = supabase
      .channel('feed-publications-realtime')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'publications' }, async payload => {
        try {
          lastRealtimeEventRef.current = Date.now()
          console.log('[Feed][PUBLICATION INSERT] payload:', payload)
          const newId = payload.new.id
          const { data: newPub, error: fetchError } = await supabase.from('publications').select('*, users(*)').eq('id', newId).single()
          if (!newPub || fetchError) {
            console.warn('[Feed] could not fetch full publication after realtime payload, using payload as fallback', fetchError)
            const fallback = { ...payload.new, users: { username: payload.new.user_id, full_name: null, avatar_url: null } }
            setPublications(prev => [fallback as any, ...prev])
            return
          }

          if (newPub.is_deleted) return
          if (newPub.visibility !== 'public') return

          if (categoryRef.current !== 'Todos') {
            const catMap: Record<string, string> = {
              'Podcast': 'podcast',
              'Música': 'música',
              'Fala': 'fala',
              'Comédia': 'comédia',
              'Educação': 'educação',
              'Outro': 'outro'
            }
            if (newPub.category !== catMap[categoryRef.current]) return
          }

          if (tabRef.current === 'following' && userIdRef.current) {
            const { data: following } = await supabase
              .from('follows')
              .select('following_id')
              .eq('follower_id', userIdRef.current)

            const followingIds = following?.map(f => f.following_id) || []
            if (!followingIds.includes(newPub.user_id)) return
          }

          setPublications(prev => [newPub, ...prev])
        } catch (e) {
          console.error('Realtime publication INSERT handler error', e)
        }
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'publications' }, payload => {
        lastRealtimeEventRef.current = Date.now()
        console.log('[Feed][PUBLICATION UPDATE] payload:', payload)

        const updated = payload.new ?? payload.old
        if (!updated) return

        // If the row becomes invisible due to RLS/visibility changes or deletion,
        // some realtime update payloads may omit `new`. In that case, remove it.
        if (!payload.new) {
          setPublications(prev => prev.filter(p => p.id !== updated.id))
          return
        }

        if (updated.is_deleted) {
          setPublications(prev => prev.filter(p => p.id !== updated.id))
          return
        }

        const recentLocalAction = updated.id && recentActionRef.current[updated.id]
        if (recentLocalAction && Date.now() - recentActionRef.current[updated.id] < 1500) {
          return
        }

        const pendingLikeTs = updated.id && pendingLikeRef.current[updated.id]
        if (pendingLikeTs && Date.now() - pendingLikeTs < 5000) {
          return
        }

        setPublications(prev => prev.map(p => {
          if (p.id !== updated.id) return p
          return {
            ...p,
            ...updated,
            hasLiked: p.hasLiked,
          }
        }))
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'publications' }, payload => {
        lastRealtimeEventRef.current = Date.now()
        console.log('[Feed][PUBLICATION DELETE] payload:', payload)
        const deleted = payload.old
        if (!deleted) return
        setPublications(prev => prev.filter(p => p.id !== deleted.id))
      })
      .subscribe()

    const likesChannel = supabase
      .channel('feed-likes-realtime')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'likes' }, payload => {
        lastRealtimeEventRef.current = Date.now()
        const row = payload.new
        if (!row?.publication_id) return

        const pubId = row.publication_id
        const ownChange = row.user_id === userIdRef.current
        if (ownChange && pendingLikeRef.current[pubId] && Date.now() - pendingLikeRef.current[pubId] < 5000) {
          return
        }

        setPublications(prev => prev.map(p => {
          if (p.id !== pubId) return p
          return {
            ...p,
            likes_count: p.likes_count + 1,
            hasLiked: ownChange ? true : p.hasLiked,
          }
        }))
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'likes' }, payload => {
        lastRealtimeEventRef.current = Date.now()
        const row = payload.old
        if (!row?.publication_id) return

        const pubId = row.publication_id
        const ownChange = row.user_id === userIdRef.current
        if (ownChange && pendingLikeRef.current[pubId] && Date.now() - pendingLikeRef.current[pubId] < 5000) {
          return
        }

        setPublications(prev => prev.map(p => {
          if (p.id !== pubId) return p
          return {
            ...p,
            likes_count: Math.max(0, p.likes_count - 1),
            hasLiked: ownChange ? false : p.hasLiked,
          }
        }))
      })
      .subscribe()

    // Fallback channel: feed_events ensures reliable realtime delivery even when
    // publications realtime notifications are missed due to RLS or replication nuances.
    const commentsChannel = supabase
      .channel('feed-comments-realtime')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'comments' }, payload => {
        const row = payload.new as any
        if (!row?.publication_id || row.is_deleted || row.user_id === userIdRef.current) return
        setPublications(prev => prev.map(p => p.id === row.publication_id ? { ...p, comments_count: Math.max(0, p.comments_count + 1) } : p))
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'comments' }, payload => {
        const row = payload.new as any
        const oldRow = payload.old as any
        if (!row?.publication_id) return
        if (row.user_id === userIdRef.current || oldRow?.user_id === userIdRef.current) return
        const deleted = Boolean(row.is_deleted) && !Boolean(oldRow?.is_deleted)
        if (deleted) {
          setPublications(prev => prev.map(p => p.id === row.publication_id ? { ...p, comments_count: Math.max(0, p.comments_count - 1) } : p))
        } else if (!row.is_deleted && Boolean(oldRow?.is_deleted)) {
          setPublications(prev => prev.map(p => p.id === row.publication_id ? { ...p, comments_count: p.comments_count + 1 } : p))
        }
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'comments' }, payload => {
        const row = payload.old as any
        if (!row?.publication_id || row.user_id === userIdRef.current) return
        setPublications(prev => prev.map(p => p.id === row.publication_id ? { ...p, comments_count: Math.max(0, p.comments_count - 1) } : p))
      })
      .subscribe()

    const feedEventsChannel = supabase
      .channel('feed-events-realtime')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'feed_events' }, async payload => {
        try {
          lastRealtimeEventRef.current = Date.now()
          console.log('[Feed][FEED_EVENT INSERT] payload:', payload)
          const pubId = payload.new?.publication_id
          if (!pubId) return
          const { data: newPub, error: fetchError } = await supabase.from('publications').select('*, users(*)').eq('id', pubId).single()
          if (!newPub || fetchError) {
            console.warn('[Feed] could not fetch publication from feed_event', fetchError)
            return
          }

          if (newPub.is_deleted) return
          if (newPub.visibility !== 'public') return

          if (categoryRef.current !== 'Todos') {
            const catMap: Record<string, string> = {
              'Podcast': 'podcast',
              'Música': 'música',
              'Fala': 'fala',
              'Comédia': 'comédia',
              'Educação': 'educação',
              'Outro': 'outro'
            }
            if (newPub.category !== catMap[categoryRef.current]) return
          }

          if (tabRef.current === 'following' && userIdRef.current) {
            const { data: following } = await supabase
              .from('follows')
              .select('following_id')
              .eq('follower_id', userIdRef.current)

            const followingIds = following?.map(f => f.following_id) || []
            if (!followingIds.includes(newPub.user_id)) return
          }

          setPublications(prev => [newPub, ...prev])
        } catch (e) {
          console.error('Realtime feed_event INSERT handler error', e)
        }
      })
      .subscribe()

    // The publication subscription already receives all row updates, including count changes from likes/comments triggers.
    // That makes separate likes/comments channels unnecessary and avoids stale counter behavior.

    console.log('[Feed] persistent subscription created')

    return () => {
      console.log('[Feed] unsubscribing persistent realtime channels')
      try { supabase.removeChannel(publicationChannel) } catch (e) { console.error('Error removing publication channel', e) }
      try { supabase.removeChannel(likesChannel) } catch (e) { console.error('Error removing likes channel', e) }
      try { supabase.removeChannel(commentsChannel) } catch (e) { console.error('Error removing comments channel', e) }
      try { supabase.removeChannel(feedEventsChannel) } catch (e) { console.error('Error removing feed events channel', e) }
    }
  }, [])

  useEffect(() => {
    if (!user?.id) return

    const syncFeed = () => {
      if (Date.now() < suppressSyncUntilRef.current) return
      loadPublications(true, { silent: true })
      lastRealtimeEventRef.current = Date.now()
    }

    const fallbackInterval = window.setInterval(() => {
      if (Date.now() - lastRealtimeEventRef.current > 1000) {
        console.warn('[Feed] syncing feed automatically in background')
        syncFeed()
      }
    }, 1000)

    const handleVisibilityChange = () => {
      if (!document.hidden) {
        syncFeed()
      }
    }

    window.addEventListener('focus', handleVisibilityChange)
    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      window.clearInterval(fallbackInterval)
      window.removeEventListener('focus', handleVisibilityChange)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [loadPublications, user?.id])

  useEffect(() => {
    const observer = new IntersectionObserver(
      entries => {
        if (entries[0].isIntersecting && hasMore && !loading) {
          setPage(p => p + 1)
          loadPublications(false)
        }
      },
      { threshold: 0.1 }
    )

    if (sentinelRef.current) observer.observe(sentinelRef.current)
    return () => observer.disconnect()
  }, [hasMore, loading])

  const refreshPublication = async (id: string) => {
    try {
      const likePromise = user?.id
        ? supabase
            .from('likes')
            .select('id')
            .eq('publication_id', id)
            .eq('user_id', user.id)
            .maybeSingle()
        : Promise.resolve({ data: null, error: null } as { data: null; error: null })

      const likesCountPromise = supabase
        .from('likes')
        .select('id', { count: 'exact', head: true })
        .eq('publication_id', id)

      const [pubResponse, likeResponse, likesCountResponse] = await Promise.all([
        supabase
          .from('publications')
          .select('likes_count, comments_count, plays_count')
          .eq('id', id)
          .single(),
        likePromise,
        likesCountPromise,
      ])

      const pubData = pubResponse.data
      const pubError = pubResponse.error
      const likeData = likeResponse?.data
      const likeError = likeResponse?.error
      const serverLikesCount = Number(likesCountResponse.count ?? 0)

      if (!pubError && pubData) {
        setPublications(prev => prev.map(p =>
          p.id === id
            ? {
                ...p,
                likes_count: Number.isFinite(serverLikesCount) ? serverLikesCount : pubData.likes_count,
                comments_count: pubData.comments_count,
                plays_count: pubData.plays_count,
                hasLiked: !!likeData?.id,
              }
            : p
        ))
      }
      if (pubError) {
        console.error('Erro ao recarregar publicação:', pubError)
      }
      if (likeError) {
        console.error('Erro ao recarregar estado de like:', likeError)
      }
    } catch (err) {
      console.error('Erro ao recarregar publicação:', err)
    }
  }

  const updatePublicationCounter = async (id: string, field: 'likes_count' | 'comments_count' | 'plays_count', delta: number) => {
    if (delta === 0) return

    try {
      if (field === 'plays_count') {
        const { error } = await supabase.rpc('increment_publication_play_count', { publication_id: id })
        if (error) throw error
        return
      }

      const { data: currentRow, error: fetchError } = await supabase
        .from('publications')
        .select(field)
        .eq('id', id)
        .single()

      if (fetchError) throw fetchError

      const currentValue = Number((currentRow as Record<string, number> | null)?.[field] ?? 0)
      const nextValue = Math.max(0, currentValue + delta)

      const { error: updateError } = await supabase
        .from('publications')
        .update({ [field]: nextValue })
        .eq('id', id)

      if (updateError) throw updateError
    } catch (err) {
      console.error(`Erro ao atualizar ${field} da publicação:`, err)
    }
  }

  const handleLike = async (
    id: string,
    liked: boolean,
    likesCount?: number,
    options?: { skipDebounce?: boolean }
  ) => {
    const now = Date.now()
    const skipDebounce = options?.skipDebounce ?? false
    if (!skipDebounce && recentActionRef.current[id] && now - recentActionRef.current[id] < 1500) return
    if (!skipDebounce) recentActionRef.current[id] = now
    // reduce suppress period so reconciliation happens sooner
    suppressSyncUntilRef.current = now + 2000

    // Optimistically update local like state using the canonical count returned
    // by the atomic RPC. This avoids local delta math and duplicate increments.
    setPublications(prev =>
      prev.map(p => {
        if (p.id !== id) return p

        const nextLiked = liked

        return {
          ...p,
          hasLiked: nextLiked,
          likes_count: typeof likesCount === 'number'
            ? Math.max(0, likesCount)
            : p.likes_count,
        }
      })
    )

    if (!skipDebounce) {
      pendingLikeRef.current[id] = now
      window.setTimeout(() => {
        if (pendingLikeRef.current[id] === now) {
          delete pendingLikeRef.current[id]
        }
      }, 2000)
    }

    lastRealtimeEventRef.current = Date.now()

    if (skipDebounce) {
      void refreshPublication(id)
    }
  }

  const handlePlay = async (id: string) => {
    const now = Date.now()
    if (recentActionRef.current[id] && now - recentActionRef.current[id] < 1500) return
    recentActionRef.current[id] = now
    suppressSyncUntilRef.current = now + 1500

    let updatedPlaysCount = 0
    setPublications(prev =>
      prev.map(p => {
        if (p.id !== id) return p
        updatedPlaysCount = p.plays_count + 1
        return { ...p, plays_count: updatedPlaysCount }
      })
    )

    try {
      await updatePublicationCounter(id, 'plays_count', 1)
      await refreshPublication(id)
    } catch (err) {
      console.error('Erro ao atualizar plays da publicação:', err)
      await refreshPublication(id)
    }
  }

  const handleCommentChange = async (id: string, delta: number, options?: { force?: boolean }) => {
    if (delta === 0) return

    const now = Date.now()
    const canSkipDebounce = options?.force === true
    if (!canSkipDebounce && recentActionRef.current[id] && now - recentActionRef.current[id] < 1500) return
    if (!canSkipDebounce) recentActionRef.current[id] = now
    if (!canSkipDebounce) {
      suppressSyncUntilRef.current = now + 1500
    }

    setPublications(prev =>
      prev.map(p =>
        p.id === id
          ? {
              ...p,
              comments_count: Math.max(0, p.comments_count + delta),
            }
          : p
      )
    )

    lastRealtimeEventRef.current = Date.now()

    if (!canSkipDebounce) {
      window.setTimeout(() => {
        void refreshPublication(id)
      }, 1500)
    }
  }

  const navigate = useNavigate()

  const handleDelete = (id: string) => {
    if (!confirm('Tem certeza que deseja excluir esta publicação?')) return

    const now = Date.now()
    lastRealtimeEventRef.current = now
    suppressSyncUntilRef.current = now + 1500

    ;(async () => {
      try {
        // optimistic UI: remove immediately
        setPublications(prev => prev.filter(p => p.id !== id))

        const { error } = await supabase
          .from('publications')
          .update({ is_deleted: true })
          .eq('id', id)

        if (error) {
          console.error('Erro ao deletar publicação:', error)
          // revert by reloading feed
          await loadPublications(true)
        }
      } catch (err) {
        console.error('Erro ao deletar publicação:', err)
        await loadPublications(true)
      }
    })()
  }

  const handleRefresh = async () => {
    setRefreshing(true)
    await loadPublications(true)
  }

  return (
    <div className="max-w-2xl mx-auto px-2 sm:px-4 py-3 sm:py-4">
      {/* Feed Tabs */}
      <div className="relative mb-4">
        <div className="flex flex-wrap justify-center gap-2">
          <button
            onClick={() => setTab('all')}
            className={`flex items-center gap-2 px-3 sm:px-4 py-2 rounded-xl text-sm font-semibold transition-colors ${
              tab === 'all'
                ? 'bg-[#25D366] text-white shadow-sm'
                : 'bg-white dark:bg-[#1C1C1C] text-[#111827] dark:text-[#E6E6E6] border border-[#ECE5DD] dark:border-[#30363D] hover:bg-[#ECE5DD] dark:hover:bg-[#30363D]'
            }`}
          >
            <Flame size={16} />
            Descobrir
          </button>
          <button
            onClick={() => setTab('following')}
            className={`flex items-center gap-2 px-3 sm:px-4 py-2 rounded-xl text-sm font-semibold transition-colors ${
              tab === 'following'
                ? 'bg-[#25D366] text-white shadow-sm'
                : 'bg-white dark:bg-[#1C1C1C] text-[#111827] dark:text-[#E6E6E6] border border-[#ECE5DD] dark:border-[#30363D] hover:bg-[#ECE5DD] dark:hover:bg-[#30363D]'
            }`}
          >
            <Users size={16} />
            Seguindo
          </button>
        </div>

        <button
          onClick={handleRefresh}
          className="absolute right-0 top-0 p-2 rounded-xl bg-white dark:bg-[#1C1C1C] border border-[#ECE5DD] dark:border-[#30363D] text-gray-500 hover:text-[#25D366] hover:bg-[#ECE5DD] dark:hover:bg-[#30363D] transition-colors"
          title="Atualizar"
        >
          <RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* Category Filter */}
      <div className="flex gap-2 overflow-x-auto pb-2 mb-4 scrollbar-hide justify-center flex-wrap">
        {CATEGORIES.map(cat => (
          <button
            key={cat}
            onClick={() => setSelectedCategory(cat)}
            className={`flex-shrink-0 px-2 sm:px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
              selectedCategory === cat
                ? 'bg-[#25D366] text-white'
                : 'bg-white dark:bg-[#1C1C1C] text-[#111827] dark:text-[#E6E6E6] border border-[#ECE5DD] dark:border-[#30363D] hover:border-[#25D366]'
            }`}
          >
            <Filter size={10} className="inline mr-1" />
            {cat}
          </button>
        ))}
      </div>

      {/* Feed Content */}
      {loading ? (
        <>
          <PublicationSkeleton />
          <PublicationSkeleton />
          <PublicationSkeleton />
        </>
      ) : publications.length === 0 ? (
        <div className="flex flex-col items-center justify-center text-center min-h-[60vh] py-12 space-y-3">
          <div className="text-8xl leading-none">🎙️</div>
          <h3 className="text-2xl font-bold text-[#111827] dark:text-[#E6E6E6]">
            {tab === 'following' ? 'Nenhum áudio dos seguidos' : 'Nenhum áudio encontrado'}
          </h3>
          <p className="text-gray-500 dark:text-gray-400 text-sm max-w-md">
            {tab === 'following'
              ? 'Siga usuários para ver os áudios deles aqui!'
              : 'Seja o primeiro a publicar um áudio!'}
          </p>
        </div>
      ) : (
        <>
          {publications.map(pub => (
            <PublicationCard
              key={pub.id}
              publication={pub}
              currentUserId={user?.id}
              onLike={handleLike}
              onPlay={handlePlay}
              onCommentChange={handleCommentChange}
              onDelete={handleDelete}
              onEdit={publication => navigate(`/publish?edit=${publication.id}`)}
            />
          ))}

          {/* Sentinel for infinite scroll */}
          <div ref={sentinelRef} className="h-4" />

          {!hasMore && publications.length > 0 && (
            <div className="text-center py-8 text-gray-400 dark:text-gray-600 text-sm">
              🎙️ Você viu todos os áudios!
            </div>
          )}
        </>
      )}
    </div>
  )
}
