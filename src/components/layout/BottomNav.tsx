import { useState, useEffect } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { Home, Search, PlusCircle, MessageCircle, User } from 'lucide-react'
import { useAuthStore } from '@/stores/authStore'
import { supabase } from '@/services/supabaseClient'

export default function BottomNav() {
  const { user } = useAuthStore()
  const [unreadMessages, setUnreadMessages] = useState(0)

  const location = useLocation()

  useEffect(() => {
    if (!user?.id) {
      setUnreadMessages(0)
      return
    }

    let channel: any
    const loadUnread = async () => {
      try {
        const { count, error } = await supabase
          .from('direct_messages')
          .select('id', { count: 'exact', head: true })
          .eq('recipient_id', user.id)
          .eq('is_read', false)

        if (!error) {
          setUnreadMessages(count ?? 0)
        }
      } catch (err) {
        console.error('Erro ao carregar mensagens não lidas:', err)
      }
    }

    const subscribeUnread = () => {
      channel = supabase.channel(`messages-unread-${user.id}`)
      channel.on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'direct_messages', filter: `recipient_id=eq.${user.id}` }, () => {
        loadUnread()
      })
      channel.on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'direct_messages', filter: `recipient_id=eq.${user.id}` }, () => {
        loadUnread()
      })
      channel.subscribe()
    }

    const handleChatRead = () => {
      loadUnread()
    }

    loadUnread()
    subscribeUnread()
    window.addEventListener('vozzap-chat-read', handleChatRead)

    return () => {
      if (channel) {
        supabase.removeChannel(channel)
      }
      window.removeEventListener('vozzap-chat-read', handleChatRead)
    }
  }, [user?.id])

  useEffect(() => {
    if (location.pathname === '/messages' && user?.id) {
      const loadUnread = async () => {
        try {
          const { count, error } = await supabase
            .from('direct_messages')
            .select('id', { count: 'exact', head: true })
            .eq('recipient_id', user.id)
            .eq('is_read', false)

          if (!error) {
            setUnreadMessages(count ?? 0)
          }
        } catch (err) {
          console.error('Erro ao recarregar mensagens não lidas na rota de chat:', err)
        }
      }

      loadUnread()
    }
  }, [location.pathname, user?.id])

  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-white dark:bg-[#1C1C1C] border-t border-[#ECE5DD] dark:border-[#30363D] shadow-lg bottom-nav">
      <div className="flex items-center justify-around h-16 px-1 w-full">
        <NavLink
          to="/feed"
          className={({ isActive }) =>
            `flex flex-col items-center gap-0.5 p-1.5 sm:p-2 rounded-xl transition-colors ${
              isActive ? 'text-[#25D366]' : 'text-gray-500 dark:text-gray-400'
            }`
          }
        >
          <Home size={20} />
          <span className="text-xs font-medium">Início</span>
        </NavLink>

        <NavLink
          to="/search"
          className={({ isActive }) =>
            `flex flex-col items-center gap-0.5 p-1.5 sm:p-2 rounded-xl transition-colors ${
              isActive ? 'text-[#25D366]' : 'text-gray-500 dark:text-gray-400'
            }`
          }
        >
          <Search size={20} />
          <span className="text-xs font-medium">Buscar</span>
        </NavLink>

        <NavLink
          to="/publish"
          className={({ isActive }) =>
            `flex flex-col items-center gap-0.5 transition-colors ${
              isActive ? 'text-[#25D366]' : 'text-[#25D366]'
            }`
          }
        >
          <div className="w-10 h-10 sm:w-12 sm:h-12 bg-[#25D366] rounded-full flex items-center justify-center shadow-lg -mt-5 sm:-mt-6 hover:bg-[#075E54] transition-colors">
            <PlusCircle size={20} className="text-white" />
          </div>
          <span className="text-xs font-medium text-[#25D366] mt-0.5 sm:mt-1">Publicar</span>
        </NavLink>

        <NavLink
          to="/messages"
          className={({ isActive }) =>
            `relative flex flex-col items-center gap-0.5 p-1.5 sm:p-2 rounded-xl transition-colors ${
              isActive ? 'text-[#25D366]' : 'text-gray-500 dark:text-gray-400'
            }`
          }
        >
          <MessageCircle size={20} />
          {unreadMessages > 0 && (
            <span className="absolute -top-1 -right-1 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-[#25D366] px-1.5 text-[10px] font-semibold text-white">{unreadMessages}</span>
          )}
          <span className="text-xs font-medium">Chat</span>
        </NavLink>

        <NavLink
          to={`/profile/${user?.username}`}
          className={({ isActive }) =>
            `flex flex-col items-center gap-0.5 p-1.5 sm:p-2 rounded-xl transition-colors ${
              isActive ? 'text-[#25D366]' : 'text-gray-500 dark:text-gray-400'
            }`
          }
        >
          <User size={20} />
          <span className="text-xs font-medium">Perfil</span>
        </NavLink>
      </div>
    </nav>
  )
}
