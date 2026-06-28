import { useState, useEffect } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { Search, Bell, Sun, Moon, LogOut, User, Mic } from 'lucide-react'
import { useAuthStore } from '@/stores/authStore'
import { useThemeStore } from '@/stores/themeStore'
import { getInitials } from '@/utils/formatters'
import { supabase } from '@/services/supabaseClient'

export default function Header() {
  const { user, logout } = useAuthStore()
  const { isDark, toggleTheme } = useThemeStore()
  const navigate = useNavigate()
  const location = useLocation()
  const isFeedRoute = location.pathname === '/feed'
  const [showMenu, setShowMenu] = useState(false)
  const [unreadNotifications, setUnreadNotifications] = useState(0)

  useEffect(() => {
    let mounted = true
    if (!user?.id) {
      setUnreadNotifications(0)
      return
    }

    const loadUnread = async () => {
      try {
        const res = await supabase
          .from('notifications')
          .select('id', { head: true, count: 'exact' })
          .eq('user_id', user.id)
          .eq('is_read', false)

        const unreadCount = res.count ?? (Array.isArray(res.data) ? res.data.length : 0)
        if (mounted) setUnreadNotifications(Math.max(0, unreadCount))
      } catch (e) {
        if (mounted) setUnreadNotifications(0)
      }
    }

    loadUnread()

    const handleLocalRead = () => {
      setUnreadNotifications(n => Math.max(0, n - 1))
    }
    const handleNotificationsOpened = () => {
      setUnreadNotifications(0)
    }
    window.addEventListener('vozzap-notification-read', handleLocalRead)
    window.addEventListener('vozzap-notifications-opened', handleNotificationsOpened)

    const channel = supabase
      .channel(`notifications-badge-${user.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` }, () => {
        setUnreadNotifications(n => n + 1)
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` }, payload => {
        const oldRow = payload.old
        const newRow = payload.new
        if (newRow && newRow.is_read === true && (oldRow?.is_read === false || oldRow?.is_read == null)) {
          setUnreadNotifications(n => Math.max(0, n - 1))
        }
      })
      .subscribe()

    return () => {
      mounted = false
      window.removeEventListener('vozzap-notification-read', handleLocalRead)
      window.removeEventListener('vozzap-notifications-opened', handleNotificationsOpened)
      try { supabase.removeChannel(channel) } catch (e) {}
    }
  }, [user?.id])

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  return (
    <header className="fixed inset-x-0 top-0 z-40 bg-white dark:bg-[#1C1C1C] border-b border-[#ECE5DD] dark:border-[#30363D] shadow-sm">
      <div className="grid grid-cols-[auto_1fr_auto] items-center gap-2 px-2 sm:px-4 lg:px-4 h-14">
        <Link to="/feed" className="flex items-center gap-2 flex-shrink-0 z-10">
          <div className="w-8 h-8 bg-[#25D366] rounded-full flex items-center justify-center">
            <Mic size={16} className="text-white" />
          </div>
          <span className="font-bold text-lg text-[#111827] dark:text-[#E6E6E6] block">
            VozZap
          </span>
        </Link>

        <div className="flex justify-center min-w-0">
          {isFeedRoute && (
            <Link
              to="/search"
              className="hidden md:inline-flex items-center gap-2 w-full max-w-[720px] min-w-0 bg-[#ECE5DD] dark:bg-[#0D1117] rounded-full px-3 py-2 text-gray-400 hover:bg-gray-200 dark:hover:bg-[#30363D] transition-colors overflow-hidden z-20"
            >
              <Search size={18} />
              <span className="text-sm truncate whitespace-nowrap">Buscar usuários...</span>
            </Link>
          )}
          {isFeedRoute && (
            <Link
              to="/search"
              className="md:hidden inline-flex items-center justify-start gap-2 w-full max-w-[240px] sm:max-w-[320px] min-w-0 bg-[#ECE5DD] dark:bg-[#0D1117] rounded-full px-3 py-2 text-gray-400 hover:bg-gray-200 dark:hover:bg-[#30363D] transition-colors overflow-hidden z-20"
              aria-label="Buscar usuários"
            >
              <Search size={16} className="text-[#111827] dark:text-[#E6E6E6]" />
              <span className="text-[11px] sm:text-sm text-gray-600 dark:text-gray-400 truncate">Buscar usuários...</span>
            </Link>
          )}
        </div>

        <div className="flex items-center justify-end gap-0.5 sm:gap-1 z-10">

          <button
            onClick={toggleTheme}
            className="p-2 rounded-full bg-white dark:bg-[#111827] border border-[#ECE5DD] dark:border-[#30363D] text-[#111827] dark:text-[#E6E6E6] hover:bg-[#F3F4F6] dark:hover:bg-[#30363D] transition-colors"
            title={isDark ? 'Modo Claro' : 'Modo Escuro'}
            aria-label={isDark ? 'Modo Claro' : 'Modo Escuro'}
          >
            {isDark ? (
              <Sun size={18} />
            ) : (
              <Moon size={18} />
            )}
          </button>

          {/* Notifications */}
          <button
            onClick={() => {
              window.dispatchEvent(new Event('vozzap-notifications-opened'))
              navigate('/notifications')
            }}
            className="hidden sm:block p-2 rounded-full hover:bg-[#ECE5DD] dark:hover:bg-[#30363D] transition-colors relative"
            title="Notificações"
            aria-label="Notificações"
          >
            <Bell size={18} className="text-[#111827] dark:text-[#E6E6E6]" />
            {unreadNotifications > 0 && (
              <span className="absolute top-1 right-1 w-2 h-2 bg-[#25D366] rounded-full" aria-hidden />
            )}
          </button>

          {/* User Menu */}
          <div className="relative">
            <button
              onClick={() => setShowMenu(!showMenu)}
              className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-[#25D366] flex items-center justify-center text-white font-bold text-xs sm:text-sm ml-1 hover:bg-[#075E54] transition-colors"
            >
              {user?.avatar_url ? (
                <img src={user.avatar_url} alt={user.username} className="w-9 h-9 rounded-full object-cover" />
              ) : (
                getInitials(user?.full_name ?? null, user?.username ?? 'U')
              )}
            </button>

            {showMenu && (
              <div className="absolute right-0 top-10 w-48 sm:w-52 bg-white dark:bg-[#1C1C1C] rounded-xl shadow-xl border border-[#ECE5DD] dark:border-[#30363D] overflow-hidden animate-fade-in">
                <div className="px-4 py-3 border-b border-[#ECE5DD] dark:border-[#30363D]">
                  <p className="font-semibold text-[#111827] dark:text-[#E6E6E6] text-sm">{user?.full_name || user?.username}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">@{user?.username}</p>
                </div>
                <Link
                  to={`/profile/${user?.username}`}
                  onClick={() => setShowMenu(false)}
                  className="flex items-center gap-3 px-4 py-3 hover:bg-[#ECE5DD] dark:hover:bg-[#30363D] text-sm text-[#111827] dark:text-[#E6E6E6] transition-colors"
                >
                  <User size={16} />
                  Meu Perfil
                </Link>
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-red-50 dark:hover:bg-red-900/20 text-sm text-red-600 transition-colors"
                >
                  <LogOut size={16} />
                  Sair
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Overlay to close menu */}
      {showMenu && (
        <div className="fixed inset-0 z-[-1]" onClick={() => setShowMenu(false)} />
      )}
    </header>
  )
}
