import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AlertTriangle, Camera, Save, ArrowLeft, Globe, Lock } from 'lucide-react'
import { useAuthStore } from '@/stores/authStore'
import { supabase } from '@/services/supabaseClient'
import { getInitials } from '@/utils/formatters'

export default function EditProfilePage() {
  const navigate = useNavigate()
  const { user, setUser } = useAuthStore()
  const [formData, setFormData] = useState({
    full_name: user?.full_name ?? '',
    username: user?.username ?? '',
    bio: user?.bio ?? '',
    is_private: user?.is_private ?? false,
  })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [isSaving, setIsSaving] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState('')
  const [saved, setSaved] = useState(false)
  const [selectedCoverFile, setSelectedCoverFile] = useState<File | null>(null)
  const [selectedAvatarFile, setSelectedAvatarFile] = useState<File | null>(null)
  const [coverPreview, setCoverPreview] = useState<string | null>(null)
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null)
  const coverInputRef = useRef<HTMLInputElement | null>(null)
  const avatarInputRef = useRef<HTMLInputElement | null>(null)

  const validate = () => {
    const newErrors: Record<string, string> = {}
    if (!formData.username.trim()) newErrors.username = 'Username é obrigatório'
    if (formData.username.length < 3) newErrors.username = 'Mínimo 3 caracteres'
    if (!/^[a-zA-Z0-9_]+$/.test(formData.username)) newErrors.username = 'Apenas letras, números e _'
    if (formData.bio && formData.bio.length > 300) newErrors.bio = 'Máximo 300 caracteres'
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const uploadProfileImage = async (bucket: 'avatars' | 'covers', file: File, userId: string) => {
    const ext = file.name.split('.').pop()?.toLowerCase() || 'png'
    const safeName = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`
    const filename = `${userId}/${safeName}`

    const { error: uploadError } = await supabase.storage
      .from(bucket)
      .upload(filename, file, { cacheControl: '3600', upsert: false })

    if (uploadError) throw uploadError

    const { data: urlData, error: urlError } = supabase.storage.from(bucket).getPublicUrl(filename)
    if (urlError) throw urlError
    if (!urlData?.publicUrl) throw new Error('Não foi possível obter a URL pública da imagem')

    return urlData.publicUrl
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validate() || !user) return

    const currentUser = user
    setIsSaving(true)

    try {
      const updates: Record<string, unknown> = {
        full_name: formData.full_name,
        username: formData.username,
        bio: formData.bio,
        is_private: formData.is_private,
        updated_at: new Date().toISOString(),
      }

      if (selectedAvatarFile) {
        updates.avatar_url = await uploadProfileImage('avatars', selectedAvatarFile, currentUser.id)
      }

      if (selectedCoverFile) {
        updates.cover_url = await uploadProfileImage('covers', selectedCoverFile, currentUser.id)
      }

      const { data, error } = await supabase
        .from('users')
        .update(updates)
        .select('*')
        .eq('id', currentUser.id)
        .single()

      setIsSaving(false)

      if (error || !data) {
        console.error('Erro ao atualizar perfil:', error)
        alert('Não foi possível salvar. Tente novamente.')
        return
      }

      setUser({
        ...currentUser,
        ...data,
      })

      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
      navigate(`/profile/${data.username}`, { replace: true })
    } catch (err) {
      setIsSaving(false)
      console.error('Erro ao salvar perfil:', err)
      alert('Não foi possível salvar. Tente novamente.')
    }
  }

  const handleDeleteAccount = async () => {
    if (!user) return
    const confirmed = window.confirm(
      'Tem certeza que deseja excluir sua conta? Esta ação é irreversível e apagará todos os seus dados.'
    )
    if (!confirmed) return

    setDeleteError('')
    setIsDeleting(true)

    try {
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession()
      if (sessionError) throw sessionError
      const accessToken = sessionData?.session?.access_token
      if (!accessToken) throw new Error('Sessão inválida. Faça login novamente.')

      const response = await fetch('/api/delete-account', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
      })

      const result = await response.json()
      if (!response.ok) throw new Error(result?.error || result?.message || 'Erro ao excluir conta')

      await supabase.auth.signOut()
      setUser(null)
      navigate('/login')
    } catch (err) {
      console.error('Erro ao excluir conta:', err)
      const message = err instanceof Error ? err.message : 'Erro ao excluir conta'
      setDeleteError(message)
      alert('Não foi possível excluir a conta. Tente novamente.')
    } finally {
      setIsDeleting(false)
    }
  }

  const handleCoverFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setSelectedCoverFile(file)
    setCoverPreview(URL.createObjectURL(file))
  }

  const handleAvatarFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setSelectedAvatarFile(file)
    setAvatarPreview(URL.createObjectURL(file))
  }

  useEffect(() => {
    return () => {
      if (coverPreview) URL.revokeObjectURL(coverPreview)
      if (avatarPreview) URL.revokeObjectURL(avatarPreview)
    }
  }, [coverPreview, avatarPreview])

  const handleChange = (field: string) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    setFormData(prev => ({ ...prev, [field]: e.target.value }))
    if (errors[field]) setErrors(prev => ({ ...prev, [field]: '' }))
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-4">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => navigate(-1)}
          className="p-2 rounded-xl hover:bg-[#ECE5DD] dark:hover:bg-[#30363D] text-gray-400 transition-colors"
        >
          <ArrowLeft size={20} />
        </button>
        <h1 className="text-xl font-bold text-[#111827] dark:text-[#E6E6E6]">Editar perfil</h1>
      </div>

      <form onSubmit={handleSave} className="space-y-4">
        {/* Cover Photo */}
        <div className="relative">
          <div className="h-32 rounded-2xl bg-gradient-to-br from-[#075E54] via-[#25D366] to-[#075E54] overflow-hidden">
            {(coverPreview || user?.cover_url) && (
              <img
                src={coverPreview || user.cover_url}
                alt="Cover"
                className="w-full h-full object-cover"
              />
            )}
          </div>
          <button
            type="button"
            onClick={() => coverInputRef.current?.click()}
            className="absolute bottom-2 right-2 w-8 h-8 bg-black/60 rounded-full flex items-center justify-center text-white hover:bg-black/80 transition-colors"
          >
            <Camera size={14} />
          </button>
          <input
            ref={coverInputRef}
            type="file"
            accept="image/*"
            onChange={handleCoverFileChange}
            className="hidden"
          />
        </div>

        {/* Avatar */}
        <div className="relative w-fit">
          <div className="w-20 h-20 rounded-full bg-[#25D366] flex items-center justify-center text-white text-xl font-bold overflow-hidden border-4 border-white dark:border-[#1C1C1C]">
            {avatarPreview ? (
              <img src={avatarPreview} alt="Avatar preview" className="w-full h-full object-cover" />
            ) : user?.avatar_url ? (
              <img src={user.avatar_url} alt={user.username} className="w-full h-full object-cover" />
            ) : (
              getInitials(user?.full_name ?? null, user?.username ?? 'U')
            )}
          </div>
          <button
            type="button"
            onClick={() => avatarInputRef.current?.click()}
            className="absolute bottom-0 right-0 w-7 h-7 bg-[#25D366] rounded-full flex items-center justify-center text-white hover:bg-[#075E54] transition-colors border-2 border-white dark:border-[#1C1C1C]"
          >
            <Camera size={12} />
          </button>
          <input
            ref={avatarInputRef}
            type="file"
            accept="image/*"
            onChange={handleAvatarFileChange}
            className="hidden"
          />
        </div>

        {/* Form Fields */}
        <div className="bg-white dark:bg-[#1C1C1C] rounded-2xl border border-[#ECE5DD] dark:border-[#30363D] p-4 space-y-4">
          {/* Full Name */}
          <div>
            <label className="block text-sm font-semibold text-[#111827] dark:text-[#E6E6E6] mb-1.5">
              Nome completo
            </label>
            <input
              type="text"
              value={formData.full_name}
              onChange={handleChange('full_name')}
              placeholder="Seu nome"
              className="w-full px-4 py-3 rounded-xl border border-[#ECE5DD] dark:border-[#30363D] bg-[#ECE5DD] dark:bg-[#0D1117] text-[#111827] dark:text-[#E6E6E6] placeholder-gray-400 text-sm focus:outline-none focus:border-[#25D366] focus:ring-1 focus:ring-[#25D366] transition-colors"
            />
          </div>

          {/* Username */}
          <div>
            <label className="block text-sm font-semibold text-[#111827] dark:text-[#E6E6E6] mb-1.5">
              Username
            </label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 text-sm">@</span>
              <input
                type="text"
                value={formData.username}
                onChange={handleChange('username')}
                placeholder="seunome"
                className={`w-full pl-8 pr-4 py-3 rounded-xl border ${errors.username ? 'border-red-400' : 'border-[#ECE5DD] dark:border-[#30363D]'} bg-[#ECE5DD] dark:bg-[#0D1117] text-[#111827] dark:text-[#E6E6E6] placeholder-gray-400 text-sm focus:outline-none focus:border-[#25D366] focus:ring-1 focus:ring-[#25D366] transition-colors`}
              />
            </div>
            {errors.username && <p className="text-red-500 text-xs mt-1">{errors.username}</p>}
          </div>

          {/* Bio */}
          <div>
            <label className="block text-sm font-semibold text-[#111827] dark:text-[#E6E6E6] mb-1.5">
              Bio
            </label>
            <textarea
              value={formData.bio}
              onChange={handleChange('bio')}
              placeholder="Fale sobre você..."
              rows={3}
              maxLength={300}
              className={`w-full px-4 py-3 rounded-xl border ${errors.bio ? 'border-red-400' : 'border-[#ECE5DD] dark:border-[#30363D]'} bg-[#ECE5DD] dark:bg-[#0D1117] text-[#111827] dark:text-[#E6E6E6] placeholder-gray-400 text-sm focus:outline-none focus:border-[#25D366] focus:ring-1 focus:ring-[#25D366] transition-colors resize-none`}
            />
            <div className="flex justify-between">
              {errors.bio ? <p className="text-red-500 text-xs">{errors.bio}</p> : <span />}
              <p className="text-xs text-gray-400">{formData.bio.length}/300</p>
            </div>
          </div>

          {/* Privacy */}
          <div>
            <label className="block text-sm font-semibold text-[#111827] dark:text-[#E6E6E6] mb-2">
              Privacidade do perfil
            </label>
            <div className="space-y-2">
              <label className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${!formData.is_private ? 'border-[#25D366] bg-[#25D366]/5' : 'border-[#ECE5DD] dark:border-[#30363D]'}`}>
                <input
                  type="radio"
                  name="privacy"
                  checked={!formData.is_private}
                  onChange={() => setFormData(p => ({ ...p, is_private: false }))}
                  className="accent-[#25D366]"
                />
                <Globe size={16} className="text-[#25D366]" />
                <div>
                  <p className="text-sm font-medium text-[#111827] dark:text-[#E6E6E6]">Público</p>
                  <p className="text-xs text-gray-500">Qualquer um pode ver seu perfil</p>
                </div>
              </label>

              <label className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${formData.is_private ? 'border-[#25D366] bg-[#25D366]/5' : 'border-[#ECE5DD] dark:border-[#30363D]'}`}>
                <input
                  type="radio"
                  name="privacy"
                  checked={formData.is_private}
                  onChange={() => setFormData(p => ({ ...p, is_private: true }))}
                  className="accent-[#25D366]"
                />
                <Lock size={16} className="text-gray-500" />
                <div>
                  <p className="text-sm font-medium text-[#111827] dark:text-[#E6E6E6]">Privado</p>
                  <p className="text-xs text-gray-500">Apenas seguidores aprovados</p>
                </div>
              </label>
            </div>
          </div>
        </div>

        {/* Save Button */}
        <button
          type="submit"
          disabled={isSaving || isDeleting}
          className={`w-full py-3.5 rounded-xl font-semibold flex items-center justify-center gap-2 transition-colors ${
            saved
              ? 'bg-[#25D366] text-white'
              : 'bg-[#25D366] hover:bg-[#075E54] disabled:bg-gray-300 dark:disabled:bg-gray-700 text-white'
          }`}
        >
          {isSaving ? (
            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : (
            <>
              <Save size={18} />
              {saved ? 'Salvo com sucesso! ✓' : 'Salvar alterações'}
            </>
          )}
        </button>

        <button
          type="button"
          disabled={isSaving || isDeleting}
          onClick={handleDeleteAccount}
          className="w-full py-3.5 rounded-xl font-semibold flex items-center justify-center gap-2 transition-colors bg-red-600 hover:bg-red-700 disabled:bg-gray-300 dark:disabled:bg-gray-700 text-white"
        >
          {isDeleting ? (
            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : (
            <>
              <AlertTriangle size={18} />
              Excluir minha conta
            </>
          )}
        </button>

        {deleteError && (
          <div className="rounded-xl bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-800 px-4 py-3 text-sm text-red-700 dark:text-red-200">
            {deleteError}
          </div>
        )}
      </form>
    </div>
  )
}
