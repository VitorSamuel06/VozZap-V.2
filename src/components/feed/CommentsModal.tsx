import { useState, useEffect, useRef } from 'react'
import { X, Send, Trash2 } from 'lucide-react'
import { useAuthStore } from '@/stores/authStore'
import { supabase } from '@/services/supabaseClient'
import { formatTimeAgo, getInitials } from '@/utils/formatters'
import type { Publication, Comment } from '@/types'

interface CommentsModalProps {
  publication: Publication
  currentUserId?: string
  onClose: () => void
  onCommentChange?: (id: string, delta: number, options?: { force?: boolean }) => void
}

export default function CommentsModal({ publication, currentUserId, onClose, onCommentChange }: CommentsModalProps) {
  const { user } = useAuthStore()
  const [comments, setComments] = useState<Comment[]>([])
  const [newComment, setNewComment] = useState('')
  const [commentError, setCommentError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editText, setEditText] = useState('')
  const [loading, setLoading] = useState(true)
  const knownCommentIdsRef = useRef<Set<string>>(new Set())
  const ignoredCommentIdsRef = useRef<Set<string>>(new Set())

  const upsertComment = (comment: Comment | null | undefined) => {
    if (!comment?.id) return false

    const id = comment.id
    const alreadyKnown = knownCommentIdsRef.current.has(id)
    if (alreadyKnown) {
      setComments(prev => prev.map(c => (c.id === id ? { ...c, ...comment } : c)))
      return false
    }

    knownCommentIdsRef.current.add(id)
    setComments(prev => {
      if (prev.some(c => c.id === id)) {
        return prev.map(c => (c.id === id ? { ...c, ...comment } : c))
      }
      return [comment as any, ...prev]
    })

    return true
  }

  useEffect(() => {
    const loadComments = async () => {
      try {
        const { data, error } = await supabase
          .from('comments')
          .select('*, user:users(*)')
          .eq('publication_id', publication.id)
          .eq('is_deleted', false)
          .order('created_at', { ascending: false })

        if (!error && data) {
          const commentsData = data as Comment[]
          setComments(commentsData)
          knownCommentIdsRef.current = new Set(commentsData.map(comment => comment.id))

          const visibleCount = commentsData.length
          const missingCount = visibleCount - publication.comments_count
          if (missingCount !== 0) {
            onCommentChange?.(publication.id, missingCount, { force: true })
          }
        }
      } catch (err) {
        console.error('Erro ao carregar comentários:', err)
      } finally {
        setLoading(false)
      }
    }

    loadComments()

    const channel = supabase
      .channel(`publication-comments-${publication.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'comments', filter: `publication_id=eq.${publication.id}` }, payload => {
        if (payload.new.is_deleted) return
        const commentId = payload.new.id
        if (knownCommentIdsRef.current.has(commentId)) return

        // Immediately show the incoming comment to minimize perceived delay.
        // The realtime payload may not include joined `user` relation, so
        // display payload immediately and then fetch the full comment with
        // its `user` relation in background to patch avatar/name.
        const minimal = payload.new as any
        upsertComment(minimal)

        // Background reconcile to fetch user relation and update the item.
        (async () => {
          try {
            const { data: fetched, error: fetchError } = await supabase
              .from('comments')
              .select('*, user:users(*)')
              .eq('id', commentId)
              .maybeSingle()

            if (!fetchError && fetched) {
              // replace minimal with fetched full comment
              setComments(prev => prev.map(c => c.id === commentId ? (fetched as any) : c))
              knownCommentIdsRef.current.add(commentId)
            }
          } catch (e) {
            // ignore background fetch errors
          }
        })()
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'comments', filter: `publication_id=eq.${publication.id}` }, payload => {
        if (!payload.new) return
        const commentId = payload.new.id
        const deleted = payload.new.is_deleted && !payload.old?.is_deleted
        if (deleted) {
          if (ignoredCommentIdsRef.current.has(commentId)) {
            ignoredCommentIdsRef.current.delete(commentId)
            return
          }
          knownCommentIdsRef.current.delete(commentId)
          setComments(prev => prev.filter(c => c.id !== commentId))
          onCommentChange?.(publication.id, -1)
          return
        }
        if (knownCommentIdsRef.current.has(commentId)) {
          setComments(prev => prev.map(c => (c.id === commentId ? { ...c, ...payload.new } : c)))
        } else {
          upsertComment(payload.new as any)
        }
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'comments', filter: `publication_id=eq.${publication.id}` }, payload => {
        const commentId = payload.old.id
        if (ignoredCommentIdsRef.current.has(commentId)) {
          ignoredCommentIdsRef.current.delete(commentId)
          return
        }
        knownCommentIdsRef.current.delete(commentId)
        setComments(prev => prev.filter(c => c.id !== commentId))
        onCommentChange?.(publication.id, -1)
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [publication.id])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (isSubmitting) return
    setCommentError('')
    if (!newComment.trim()) {
      setCommentError('Escreva algo antes de enviar.')
      return
    }
    if (!user) {
      setCommentError('Você precisa estar logado para comentar.')
      return
    }

    setIsSubmitting(true)
    try {
      const { data, error } = await supabase
        .from('comments')
        .insert({
          user_id: user.id,
          publication_id: publication.id,
          content: newComment.trim(),
        })
        .select('*, user:users(*)')
        .single()

      if (error) {
        console.error('Erro ao criar comentário:', error)
        setCommentError('Não foi possível enviar o comentário. Tente novamente.')
        return
      }

      if (data) {
        const inserted = upsertComment(data as any)
        if (inserted) {
          onCommentChange?.(publication.id, 1)
        } else if (!comments.some(comment => comment.id === data.id)) {
          setComments(prev => [data as any, ...prev])
          onCommentChange?.(publication.id, 1)
        }
        setNewComment('')
      }
    } catch (err) {
      console.error('Erro ao criar comentário:', err)
      setCommentError('Não foi possível enviar o comentário. Tente novamente.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDelete = async (id: string) => {
    try {
      await supabase
        .from('comments')
        .update({ is_deleted: true })
        .eq('id', id)

      ignoredCommentIdsRef.current.add(id)
      knownCommentIdsRef.current.delete(id)
      setComments(prev => prev.filter(c => c.id !== id))
      onCommentChange?.(publication.id, -1)
    } catch (err) {
      console.error('Erro ao deletar comentário:', err)
    }
  }

  const handleEdit = (comment: Comment) => {
    setEditingId(comment.id)
    setEditText(comment.content)
  }

  const handleSaveEdit = async (id: string) => {
    try {
      await supabase
        .from('comments')
        .update({ content: editText })
        .eq('id', id)

      setComments(prev =>
        prev.map(c => c.id === id ? { ...c, content: editText } : c)
      )
      setEditingId(null)
    } catch (err) {
      console.error('Erro ao editar comentário:', err)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-full sm:w-[480px] sm:max-w-full bg-white dark:bg-[#1C1C1C] sm:rounded-2xl rounded-t-2xl max-h-[85vh] flex flex-col animate-fade-in">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-[#ECE5DD] dark:border-[#30363D]">
          <div>
            <h3 className="font-bold text-[#111827] dark:text-[#E6E6E6]">Comentários</h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 truncate max-w-[280px]">{publication.title}</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-[#ECE5DD] dark:hover:bg-[#30363D] text-gray-400 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Comments List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {comments.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-4xl mb-2">💬</p>
              <p className="text-gray-500 dark:text-gray-400">Seja o primeiro a comentar!</p>
            </div>
          ) : (
            comments.map(comment => (
              <div key={comment.id} className="flex gap-3">
                <div className="w-9 h-9 rounded-full bg-[#25D366] flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                  { (comment.user?.avatar_url ?? (comment as any).author_avatar_url) ? (
                    <img
                      src={comment.user?.avatar_url ?? (comment as any).author_avatar_url}
                      alt={(comment.user?.username ?? (comment as any).author_username) || 'user'}
                      className="w-full h-full rounded-full object-cover"
                    />
                  ) : (
                    getInitials((comment.user?.full_name ?? (comment as any).author_full_name) ?? null, (comment.user?.username ?? (comment as any).author_username) ?? 'U')
                  )}
                </div>
                <div className="flex-1">
                  <div className="bg-[#ECE5DD] dark:bg-[#0D1117] rounded-2xl px-3 py-2">
                    <p className="text-xs font-semibold text-[#111827] dark:text-[#E6E6E6]">
                      {(comment.user?.full_name ?? (comment as any).author_full_name) || (comment.user?.username ?? (comment as any).author_username)}
                    </p>
                    {editingId === comment.id ? (
                      <div className="flex gap-2 mt-1">
                        <input
                          value={editText}
                          onChange={e => setEditText(e.target.value)}
                          className="flex-1 bg-white dark:bg-[#1C1C1C] rounded-lg px-2 py-1 text-sm border border-[#25D366]"
                          autoFocus
                        />
                        <button
                          onClick={() => handleSaveEdit(comment.id)}
                          className="text-[#25D366] text-xs font-semibold"
                        >
                          Salvar
                        </button>
                        <button
                          onClick={() => setEditingId(null)}
                          className="text-gray-400 text-xs"
                        >
                          Cancelar
                        </button>
                      </div>
                    ) : (
                      <p className="text-sm text-[#111827] dark:text-[#E6E6E6] mt-0.5">{comment.content}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-3 mt-1 px-1">
                    <span className="text-xs text-gray-400">{formatTimeAgo(comment.created_at)}</span>
                    {(currentUserId === comment.user_id || currentUserId === 'current-user') && (
                      <>
                        <button
                          onClick={() => handleEdit(comment)}
                          className="text-xs text-gray-400 hover:text-[#25D366] transition-colors"
                        >
                          Editar
                        </button>
                        <button
                          onClick={() => handleDelete(comment.id)}
                          className="text-xs text-red-400 hover:text-red-600 transition-colors flex items-center gap-1"
                        >
                          <Trash2 size={10} />
                          Excluir
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Input */}
        {user && (
          <form onSubmit={handleSubmit} className="p-4 border-t border-[#ECE5DD] dark:border-[#30363D]">
            <div className="flex gap-2">
              <div className="w-9 h-9 rounded-full bg-[#25D366] flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                {getInitials(user.full_name, user.username)}
              </div>
              <div className="flex-1 flex flex-col gap-2 bg-[#ECE5DD] dark:bg-[#0D1117] rounded-full px-4 py-2">
                <div className="flex items-center gap-2">
                  <input
                    value={newComment}
                    onChange={e => { setNewComment(e.target.value); setCommentError('') }}
                    placeholder="Escreva um comentário..."
                    className="flex-1 bg-transparent text-sm text-[#111827] dark:text-[#E6E6E6] placeholder-gray-400 outline-none"
                  />
                  <button
                    type="submit"
                    disabled={!newComment.trim() || isSubmitting}
                    className="text-[#25D366] disabled:text-gray-300 dark:disabled:text-gray-600 transition-colors"
                  >
                    <Send size={18} />
                  </button>
                </div>
                {commentError && <p className="text-red-500 text-xs px-1">{commentError}</p>}
              </div>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
