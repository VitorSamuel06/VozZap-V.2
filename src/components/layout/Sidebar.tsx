import { NavLink } from 'react-router-dom'
import { Home, Search, PlusCircle, MessageCircle, User } from 'lucide-react'
import { useAuthStore } from '@/stores/authStore'

const navItems = [
  { to: '/feed', icon: Home, label: 'Início' },
  { to: '/search', icon: Search, label: 'Buscar' },
  { to: '/publish', icon: PlusCircle, label: 'Publicar' },
  { to: '/messages', icon: MessageCircle, label: 'Mensagens' },
]

export default function Sidebar() {
  const { user } = useAuthStore()

  return (
    <aside className="hidden lg:flex flex-col w-60 bg-white dark:bg-[#1C1C1C] border-r border-[#ECE5DD] dark:border-[#30363D] p-3 gap-1 fixed left-0 top-14 bottom-0 overflow-auto">
      {navItems.map(({ to, icon: Icon, label }) => (
        <NavLink
          key={to}
          to={to}
          className={({ isActive }) =>
            `flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${
              isActive
                ? 'bg-[#25D366] text-white shadow-sm'
                : 'text-[#111827] dark:text-[#E6E6E6] hover:bg-[#ECE5DD] dark:hover:bg-[#30363D]'
            }`
          }
        >
          <Icon size={20} />
          {label}
        </NavLink>
      ))}

      {user && (
        <NavLink
          to={`/profile/${user.username}`}
          className={({ isActive }) =>
            `flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${
              isActive
                ? 'bg-[#25D366] text-white shadow-sm'
                : 'text-[#111827] dark:text-[#E6E6E6] hover:bg-[#ECE5DD] dark:hover:bg-[#30363D]'
            }`
          }
        >
          <User size={20} />
          Meu Perfil
        </NavLink>
      )}

      <div className="mt-auto p-3 bg-[#ECE5DD] dark:bg-[#0D1117] rounded-xl">
        <p className="text-xs text-gray-500 dark:text-gray-400 text-center">
          🎙️ VozZap v1.0
        </p>
        <p className="text-xs text-gray-400 dark:text-gray-500 text-center mt-1">
          Rede social de áudios
        </p>
      </div>
    </aside>
  )
}
