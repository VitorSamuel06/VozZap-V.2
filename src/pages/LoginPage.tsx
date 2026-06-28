import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Mic, Eye, EyeOff, Mail, Lock } from 'lucide-react'
import { useAuthStore } from '@/stores/authStore'
import { supabase } from '@/services/supabaseClient'

export default function LoginPage() {
  const navigate = useNavigate()
  const { setUser, setLoading } = useAuthStore()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!email || !password) {
      setError('Preencha todos os campos')
      return
    }

    if (password.length < 6) {
      setError('Senha deve ter pelo menos 6 caracteres')
      return
    }

    setIsLoading(true)
    setLoading(true)

    try {
      const { data, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (authError) {
        setError(authError.message)
        setLoading(false)
        setIsLoading(false)
        return
      }

      if (data.user) {
        const { data: userData, error: userError } = await supabase
          .from('users')
          .select('*')
          .eq('auth_id', data.user.id)
          .single()

        if (userError) {
          setError('Erro ao carregar perfil do usuário')
          setLoading(false)
          setIsLoading(false)
          return
        }

        setUser(userData)
        setLoading(false)
        navigate('/feed')
      }
    } catch (err) {
      setError('Erro ao fazer login')
      setLoading(false)
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#ECE5DD] dark:bg-[#0D1117] flex flex-col items-center justify-center p-4">
      {/* Logo */}
      <div className="flex flex-col items-center mb-8">
        <div className="w-20 h-20 bg-[#25D366] rounded-3xl flex items-center justify-center shadow-xl mb-4">
          <Mic size={40} className="text-white" />
        </div>
        <h1 className="text-3xl font-bold text-[#111827] dark:text-[#E6E6E6]">VozZap</h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1">Rede social de áudios curtos</p>
      </div>

      {/* Card */}
      <div className="w-full max-w-[360px] sm:max-w-sm bg-white dark:bg-[#1C1C1C] rounded-3xl shadow-xl p-6 space-y-5">
        <h2 className="text-xl font-bold text-[#111827] dark:text-[#E6E6E6]">Entrar</h2>

        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm px-4 py-3 rounded-xl border border-red-200 dark:border-red-800">
            {error}
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-[#111827] dark:text-[#E6E6E6] mb-1.5">
              Email
            </label>
            <div className="relative">
              <Mail size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="seu@email.com"
                className="w-full pl-10 pr-4 py-3 rounded-xl border border-[#ECE5DD] dark:border-[#30363D] bg-[#ECE5DD] dark:bg-[#0D1117] text-[#111827] dark:text-[#E6E6E6] placeholder-gray-400 text-sm focus:outline-none focus:border-[#25D366] focus:ring-1 focus:ring-[#25D366] transition-colors"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-[#111827] dark:text-[#E6E6E6] mb-1.5">
              Senha
            </label>
            <div className="relative">
              <Lock size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full pl-10 pr-10 py-3 rounded-xl border border-[#ECE5DD] dark:border-[#30363D] bg-[#ECE5DD] dark:bg-[#0D1117] text-[#111827] dark:text-[#E6E6E6] placeholder-gray-400 text-sm focus:outline-none focus:border-[#25D366] focus:ring-1 focus:ring-[#25D366] transition-colors"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <div className="text-right">
            <Link to="/forgot-password" className="text-sm text-[#25D366] hover:text-[#075E54] font-medium transition-colors">
              Esqueceu a senha?
            </Link>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-[#25D366] hover:bg-[#075E54] disabled:bg-gray-300 dark:disabled:bg-gray-700 text-white rounded-xl py-3.5 font-semibold transition-colors flex items-center justify-center gap-2"
          >
            {isLoading ? (
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              'Entrar'
            )}
          </button>
        </form>

        <p className="text-center text-sm text-gray-500 dark:text-gray-400">
          Não tem uma conta?{' '}
          <Link to="/signup" className="text-[#25D366] hover:text-[#075E54] font-semibold transition-colors">
            Cadastre-se
          </Link>
        </p>
      </div>
    </div>
  )
}
