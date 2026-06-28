import { Link } from 'react-router-dom'
import { Home, Mic } from 'lucide-react'

export default function NotFoundPage() {
  return (
    <div className="min-h-screen bg-[#ECE5DD] dark:bg-[#0D1117] flex flex-col items-center justify-center p-8 text-center">
      <div className="w-24 h-24 bg-[#25D366] rounded-3xl flex items-center justify-center shadow-xl mb-6">
        <Mic size={48} className="text-white" />
      </div>

      <h1 className="text-6xl font-black text-[#25D366] mb-2">404</h1>
      <h2 className="text-2xl font-bold text-[#111827] dark:text-[#E6E6E6] mb-3">
        Página não encontrada
      </h2>
      <p className="text-gray-500 dark:text-gray-400 max-w-xs mb-8">
        Parece que você foi explorar território desconhecido! Esta página não existe no VozZap.
      </p>

      <Link
        to="/feed"
        className="flex items-center gap-2 bg-[#25D366] hover:bg-[#075E54] text-white px-6 py-3 rounded-xl font-semibold transition-colors shadow-lg"
      >
        <Home size={20} />
        Voltar ao início
      </Link>
    </div>
  )
}
