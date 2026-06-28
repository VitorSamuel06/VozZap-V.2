import React, { useEffect, useState } from 'react'
import { Bell } from 'lucide-react'
import { supabase } from '@/services/supabaseClient'
import { useAuthStore } from '@/stores/authStore'
import { formatTimeAgo } from '@/utils/formatters'
import { useNavigate } from 'react-router-dom'

type NotificationType = 'like' | 'comment' | 'follow' | 'mention' | 'system'

interface NotificationItem {
  id: string
  type: NotificationType
  actor?: { id: string; username: string; full_name?: string | null; avatar_url?: string | null }
  publication_id?: string | null
  from_user_id?: string | null
  title: string
  description?: string | null
  created_at: string
  read?: boolean
}

function mapRowToItem(row: any): NotificationItem {
  return {
    id: row.id,
    type: row.type as NotificationType,
    actor: row.actor ?? undefined,
    publication_id: row.publication_id ?? null,
    from_user_id: row.from_user_id ?? null,
    title: row.title ?? '',
    description: row.description ?? null,
    created_at: row.created_at,
    read: !!row.is_read,
  }
}

export default function NotificationsPage() {
  const { user } = useAuthStore()
  const [items, setItems] = useState<NotificationItem[]>([])
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  useEffect(() => {
    let mounted = true

    const load = async () => {
      if (!user?.id) {
        if (mounted) {
          setItems([])
          setLoading(false)
        }
        return
      }

      try {
        const { data, error } = await supabase
          .from('notifications')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(50)

        if (!error && data) {
          const mapped = data.map(mapRowToItem)
          // fetch actors details in batch if needed
          const actorIds = Array.from(new Set(mapped.filter(m => m.from_user_id).map(m => m.from_user_id)))
          if (actorIds.length > 0) {
            const { data: actors } = await supabase.from('users').select('id, username, full_name, avatar_url').in('id', actorIds)
            const actorsById = (actors || []).reduce((acc: any, a: any) => ({ ...acc, [a.id]: a }), {})
            mapped.forEach(m => {
              if (m.from_user_id && actorsById[m.from_user_id]) {
                m.actor = actorsById[m.from_user_id]
              }
            })
          }
          if (mounted) setItems(mapped)
        } else {
          if (mounted) setItems([])
        }
      } catch (e) {
        if (mounted) setItems([])
      } finally {
        if (mounted) setLoading(false)
      }
    }

    load()

    const markAllAsRead = async () => {
      try {
        const { error } = await supabase
          .from('notifications')
          .update({ is_read: true })
          .eq('user_id', user.id)
          .eq('is_read', false)

        if (!error) {
          if (mounted) {
            setItems(prev => prev.map(item => ({ ...item, read: true })))
          }
          window.dispatchEvent(new Event('vozzap-notifications-opened'))
        }
      } catch (e) {
        // ignore
      }
    }

    markAllAsRead()

    let channel: any = null
    if (user?.id) {
      channel = supabase
        .channel(`notifications-user-${user.id}`)
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` }, async payload => {
          try {
            const newRow = payload.new
            let item = mapRowToItem(newRow)
            if (!item.actor && newRow.from_user_id) {
              const { data: actorData } = await supabase.from('users').select('id, username, full_name, avatar_url').eq('id', newRow.from_user_id).maybeSingle()
              if (actorData) item.actor = actorData
            }
            if (mounted) setItems(prev => [item, ...prev])
          } catch (e) {
            // ignore
          }
        })
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` }, payload => {
          const updated = payload.new
          const item = mapRowToItem(updated)
          if (mounted) setItems(prev => prev.map(p => p.id === item.id ? item : p))
        })
        .subscribe()
    }

    return () => {
      mounted = false
      if (channel) try { supabase.removeChannel(channel) } catch (e) { }
    }
  }, [user?.id])

  const handleClick = async (it: NotificationItem) => {
    try {
      if (it.read === false) {
        const { error } = await supabase.from('notifications').update({ is_read: true }).eq('id', it.id)
        if (!error) {
          setItems(prev => prev.map(item => item.id === it.id ? { ...item, read: true } : item))
          window.dispatchEvent(new CustomEvent('vozzap-notification-read', { detail: { id: it.id } }))
        }
      }
    } catch (e) {
      // ignore
    }

    if (it.publication_id) {
      navigate('/feed')
      return
    }
    if (it.actor?.username) {
      navigate(`/profile/${it.actor.username}`)
      return
    }
  }

  return (
    <div className="min-h-screen py-8">
      <div className="max-w-3xl mx-auto px-4">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 rounded-lg bg-[#25D366] flex items-center justify-center text-white">
            <Bell />
          </div>
          <h1 className="text-2xl font-bold text-[#111827] dark:text-[#E6E6E6]">Notificações</h1>
        </div>

        <div className="bg-white dark:bg-[#0D1117] rounded-xl border border-[#ECE5DD] dark:border-[#30363D] p-0 overflow-hidden">
          {loading ? (
            <div className="p-6 text-sm text-gray-500 dark:text-gray-400">Carregando...</div>
          ) : items.length === 0 ? (
            <div className="p-6 text-sm text-gray-500 dark:text-gray-400">Nenhuma notificação ainda.</div>
          ) : (
            <ul>
              {items.map(it => (
                <li key={it.id} className={`flex items-start gap-3 p-4 border-b border-[#ECE5DD] dark:border-[#202227] ${it.read ? 'opacity-70' : ''}`}>
                  <button onClick={() => handleClick(it)} className="flex items-start gap-3 text-left w-full">
                    <div className="w-10 h-10 rounded-md bg-[#F3F4F6] dark:bg-[#0B1113] flex items-center justify-center text-sm font-semibold text-[#111827] dark:text-[#E6E6E6]">
                      {it.actor?.username ? it.actor.username.charAt(0).toUpperCase() : 'Z'}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between gap-3">
                        <div className="text-sm text-[#111827] dark:text-[#E6E6E6]">
                          <div>{it.title || (it.actor ? `${it.actor.username} enviou uma notificação` : 'Notificação')}</div>
                          {it.description ? (
                            <div className="text-gray-500 dark:text-gray-400 mt-1 text-sm">{it.description}</div>
                          ) : null}
                        </div>
                        <div className="text-xs text-gray-400 dark:text-gray-500 whitespace-nowrap">{formatTimeAgo(it.created_at)}</div>
                      </div>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}
