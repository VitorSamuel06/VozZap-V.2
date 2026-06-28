import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Mic, Eye, EyeOff, Mail, Lock, User, AtSign } from 'lucide-react'
import { useAuthStore } from '@/stores/authStore'
import { supabase } from '@/services/supabaseClient'

export default function SignupPage() {
  const navigate = useNavigate()
  const { setUser } = useAuthStore()
  const [formData, setFormData] = useState({
    fullName: '',
    username: '',
    email: '',
    password: '',
    confirmPassword: '',
  })
  const [showPassword, setShowPassword] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [isLoading, setIsLoading] = useState(false)
  const [generalError, setGeneralError] = useState('')

  const validate = () => {
    const newErrors: Record<string, string> = {}

    if (!formData.fullName.trim()) newErrors.fullName = 'Nome é obrigatório'
    if (!formData.username.trim()) newErrors.username = 'Username é obrigatório'
    if (formData.username.length < 3) newErrors.username = 'Username deve ter ao menos 3 caracteres'
    if (!/^[a-zA-Z0-9_]+$/.test(formData.username)) newErrors.username = 'Apenas letras, números e _'
    if (!formData.email.trim()) newErrors.email = 'Email é obrigatório'
    if (!/\S+@\S+\.\S+/.test(formData.email)) newErrors.email = 'Email inválido'
    if (formData.password.length < 6) newErrors.password = 'Mínimo 6 caracteres'
    if (formData.password !== formData.confirmPassword) newErrors.confirmPassword = 'Senhas não coincidem'

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validate()) return

    setIsLoading(true)
    setGeneralError('')

    try {
      // 1. Criar conta de autenticação
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
      })

      if (authError) {
        setGeneralError(authError.message)
        setIsLoading(false)
        return
      }

      if (!authData.user) {
        setGeneralError('Erro ao criar conta')
        setIsLoading(false)
        return
      }

      // 2. Criar perfil do usuário na tabela users
      const { data: userData, error: userError } = await supabase
        .from('users')
        .insert({
          auth_id: authData.user.id,
          username: formData.username.toLowerCase(),
          email: formData.email,
          full_name: formData.fullName,
          bio: null,
          avatar_url: null,
          cover_url: null,
          is_private: false,
          is_verified: false,
          role: 'user',
          followers_count: 0,
          following_count: 0,
          publications_count: 0,
        })
        .select()
        .single()

      if (userError) {
        setGeneralError('Erro ao criar perfil: ' + userError.message)
        setIsLoading(false)
        return
      }

      // 3. Buscar usuário completo para armazenar no store
      const { data: profile } = await supabase
        .from('users')
        .select('*')
        .eq('auth_id', authData.user.id)
        .single()

      if (profile) {
        setUser(profile)
      }

      setIsLoading(false)
      navigate('/feed')
    } catch (err) {
      console.error('Erro ao criar conta:', err)
      setGeneralError('Erro ao criar conta. Tente novamente.')
      setIsLoading(false)
    }
  }

  const handleChange = (field: string) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData(prev => ({ ...prev, [field]: e.target.value }))
    if (errors[field]) setErrors(prev => ({ ...prev, [field]: '' }))
  }

  return (
    <div className="min-h-screen bg-[#ECE5DD] dark:bg-[#0D1117] flex flex-col items-center justify-center p-4">
      {/* Logo */}
      <div className="flex flex-col items-center mb-6">
        <div className="w-16 h-16 bg-[#25D366] rounded-2xl flex items-center justify-center shadow-xl mb-3">
          <Mic size={30} className="text-white" />
        </div>
        <h1 className="text-2xl font-bold text-[#111827] dark:text-[#E6E6E6]">VozZap</h1>
      </div>

      {/* Card */}
      <div className="w-full max-w-sm bg-white dark:bg-[#1C1C1C] rounded-3xl shadow-xl p-6 space-y-4">
        <h2 className="text-xl font-bold text-[#111827] dark:text-[#E6E6E6]">Criar conta</h2>

        {generalError && (
          <div className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm px-4 py-3 rounded-xl border border-red-200 dark:border-red-800">
            {generalError}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Full Name */}
          <div>
            <label className="block text-sm font-medium text-[#111827] dark:text-[#E6E6E6] mb-1">Nome completo</label>
            <div className="relative">
              <User size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={formData.fullName}
                onChange={handleChange('fullName')}
                placeholder="Seu nome"
                className={`w-full pl-10 pr-4 py-3 rounded-xl border ${errors.fullName ? 'border-red-400' : 'border-[#ECE5DD] dark:border-[#30363D]'} bg-[#ECE5DD] dark:bg-[#0D1117] text-[#111827] dark:text-[#E6E6E6] placeholder-gray-400 text-sm focus:outline-none focus:border-[#25D366] focus:ring-1 focus:ring-[#25D366] transition-colors`}
              />
            </div>
            {errors.fullName && <p className="text-red-500 text-xs mt-1">{errors.fullName}</p>}
          </div>

          {/* Username */}
          <div>
            <label className="block text-sm font-medium text-[#111827] dark:text-[#E6E6E6] mb-1">Username</label>
            <div className="relative">
              <AtSign size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={formData.username}
                onChange={handleChange('username')}
                placeholder="seunome"
                className={`w-full pl-10 pr-4 py-3 rounded-xl border ${errors.username ? 'border-red-400' : 'border-[#ECE5DD] dark:border-[#30363D]'} bg-[#ECE5DD] dark:bg-[#0D1117] text-[#111827] dark:text-[#E6E6E6] placeholder-gray-400 text-sm focus:outline-none focus:border-[#25D366] focus:ring-1 focus:ring-[#25D366] transition-colors`}
              />
            </div>
            {errors.username && <p className="text-red-500 text-xs mt-1">{errors.username}</p>}
          </div>

          {/* Email */}
          <div>
            <label className="block text-sm font-medium text-[#111827] dark:text-[#E6E6E6] mb-1">Email</label>
            <div className="relative">
              <Mail size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="email"
                value={formData.email}
                onChange={handleChange('email')}
                placeholder="seu@email.com"
                className={`w-full pl-10 pr-4 py-3 rounded-xl border ${errors.email ? 'border-red-400' : 'border-[#ECE5DD] dark:border-[#30363D]'} bg-[#ECE5DD] dark:bg-[#0D1117] text-[#111827] dark:text-[#E6E6E6] placeholder-gray-400 text-sm focus:outline-none focus:border-[#25D366] focus:ring-1 focus:ring-[#25D366] transition-colors`}
              />
            </div>
            {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email}</p>}
          </div>

          {/* Password */}
          <div>
            <label className="block text-sm font-medium text-[#111827] dark:text-[#E6E6E6] mb-1">Senha</label>
            <div className="relative">
              <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type={showPassword ? 'text' : 'password'}
                value={formData.password}
                onChange={handleChange('password')}
                placeholder="••••••••"
                className={`w-full pl-10 pr-10 py-3 rounded-xl border ${errors.password ? 'border-red-400' : 'border-[#ECE5DD] dark:border-[#30363D]'} bg-[#ECE5DD] dark:bg-[#0D1117] text-[#111827] dark:text-[#E6E6E6] placeholder-gray-400 text-sm focus:outline-none focus:border-[#25D366] focus:ring-1 focus:ring-[#25D366] transition-colors`}
              />
              <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400">
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            {errors.password && <p className="text-red-500 text-xs mt-1">{errors.password}</p>}
          </div>

          {/* Confirm Password */}
          <div>
            <label className="block text-sm font-medium text-[#111827] dark:text-[#E6E6E6] mb-1">Confirmar senha</label>
            <div className="relative">
              <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="password"
                value={formData.confirmPassword}
                onChange={handleChange('confirmPassword')}
                placeholder="••••••••"
                className={`w-full pl-10 pr-4 py-3 rounded-xl border ${errors.confirmPassword ? 'border-red-400' : 'border-[#ECE5DD] dark:border-[#30363D]'} bg-[#ECE5DD] dark:bg-[#0D1117] text-[#111827] dark:text-[#E6E6E6] placeholder-gray-400 text-sm focus:outline-none focus:border-[#25D366] focus:ring-1 focus:ring-[#25D366] transition-colors`}
              />
            </div>
            {errors.confirmPassword && <p className="text-red-500 text-xs mt-1">{errors.confirmPassword}</p>}
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-[#25D366] hover:bg-[#075E54] disabled:bg-gray-300 dark:disabled:bg-gray-700 text-white rounded-xl py-3.5 font-semibold transition-colors flex items-center justify-center"
          >
            {isLoading ? (
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              'Criar conta'
            )}
          </button>
        </form>

        <p className="text-center text-sm text-gray-500 dark:text-gray-400">
          Já tem uma conta?{' '}
          <Link to="/login" className="text-[#25D366] hover:text-[#075E54] font-semibold transition-colors">
            Entrar
          </Link>
        </p>
      </div>
    </div>
  )
}
