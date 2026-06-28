import { useState, useRef, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Upload, Mic, X, Check, ChevronDown } from 'lucide-react'
import { useAuthStore } from '@/stores/authStore'
import AudioRecorder from '@/components/publications/AudioRecorder'
import AudioPlayer from '@/components/feed/AudioPlayer'
import { formatTime } from '@/utils/formatters'
import { supabase } from '@/services/supabaseClient'

const CATEGORIES = [
  { value: 'podcast', label: '🎙️ Podcast' },
  { value: 'música', label: '🎵 Música' },
  { value: 'fala', label: '🗣️ Fala' },
  { value: 'comédia', label: '😂 Comédia' },
  { value: 'educação', label: '📚 Educação' },
  { value: 'notícia', label: '📰 Notícia' },
  { value: 'outro', label: '🔮 Outro' },
]

const VISIBILITIES = [
  { value: 'public', label: '🌍 Público', desc: 'Todos podem ver' },
  { value: 'followers', label: '👥 Seguidores', desc: 'Apenas seguidores' },
  { value: 'private', label: '🔒 Privado', desc: 'Apenas você' },
]

export default function PublishPage() {
  const navigate = useNavigate()
  const user = useAuthStore(state => state.user)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [mode, setMode] = useState<'select' | 'record' | 'upload' | 'form'>('select')
  const [_audioBlob, setAudioBlob] = useState<Blob | null>(null)
  const [audioUrl, setAudioUrl] = useState<string | null>(null)
  const [audioDuration, setAudioDuration] = useState(0)

  const normalizeDuration = (value: number | undefined | null): number => {
    if (Number.isFinite(value) && value > 0) {
      return Math.max(1, Math.ceil(value))
    }
    return 0
  }

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState('podcast')
  const [visibility, setVisibility] = useState('public')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [isPublishing, setIsPublishing] = useState(false)
  const [published, setPublished] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [isEditMode, setIsEditMode] = useState(false)
  const [searchParams] = useSearchParams()

  const handleRecordSave = (blob: Blob, duration: number) => {
    setAudioBlob(blob)
    setAudioDuration(normalizeDuration(duration))
    const url = URL.createObjectURL(blob)
    setAudioUrl(url)
    setMode('form')
  }

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (!file.type.startsWith('audio/')) {
      alert('Por favor, selecione um arquivo de áudio.')
      return
    }

    if (file.size > 50 * 1024 * 1024) {
      alert('Arquivo muito grande. Máximo 50MB.')
      return
    }

    const url = URL.createObjectURL(file)
    setAudioUrl(url)
    setAudioBlob(file)
    setAudioDuration(0)

    const audio = new Audio(url)
    audio.preload = 'metadata'
    const setLoadedDuration = (value: number) => {
      const normalized = normalizeDuration(value)
      if (normalized > 0) {
        setAudioDuration(normalized)
      }
    }

    let durationTimeout = window.setTimeout(() => {
      setAudioDuration(1)
    }, 3000)

    audio.onloadedmetadata = () => {
      setLoadedDuration(audio.duration)
      window.clearTimeout(durationTimeout)
    }
    audio.onloadeddata = () => {
      setLoadedDuration(audio.duration)
      window.clearTimeout(durationTimeout)
    }
    audio.onerror = () => {
      window.clearTimeout(durationTimeout)
      setAudioDuration(1)
    }
    audio.src = url
    audio.load()

    setMode('form')
  }

  const validate = () => {
    const newErrors: Record<string, string> = {}
    if (!title.trim()) newErrors.title = 'Título é obrigatório'
    if (title.length > 200) newErrors.title = 'Máximo 200 caracteres'
    if (!category) newErrors.category = 'Selecione uma categoria'
    if (!audioUrl && !isEditMode) newErrors.audio = 'Adicione um áudio'
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  useEffect(() => {
    const editId = searchParams.get('edit')
    if (!editId || !user) return

    const fetchPublication = async () => {
      try {
        const { data: publication, error } = await supabase
          .from('publications')
          .select('*')
          .eq('id', editId)
          .single()

        if (error || !publication) {
          alert('Não foi possível carregar a publicação para edição.')
          navigate('/feed')
          return
        }

        if (publication.user_id !== user.id) {
          alert('Você só pode editar suas próprias publicações.')
          navigate('/feed')
          return
        }

        setEditingId(editId)
        setIsEditMode(true)
        setTitle(publication.title)
        setDescription(publication.description || '')
        setCategory(publication.category)
        setVisibility(publication.visibility)
        setAudioUrl(publication.audio_url)
        setAudioDuration(publication.duration)
        setMode('form')
      } catch (err) {
        console.error('Erro ao carregar publicação para edição:', err)
        navigate('/feed')
      }
    }

    fetchPublication()
  }, [searchParams, user, navigate])

  const loadAudioDuration = async (url: string): Promise<number> => {
    return new Promise<number>(resolve => {
      const audio = new Audio()
      let resolved = false
      let timeoutId: number

      const finish = (value: number) => {
        if (resolved) return
        resolved = true
        cleanup()
        resolve(normalizeDuration(value) || 1)
      }

      const handleDuration = () => {
        if (Number.isFinite(audio.duration) && audio.duration > 0) {
          finish(audio.duration)
        }
      }

      const cleanup = () => {
        audio.removeEventListener('loadedmetadata', handleDuration)
        audio.removeEventListener('loadeddata', handleDuration)
        audio.removeEventListener('durationchange', handleDuration)
        window.clearTimeout(timeoutId)
      }

      audio.preload = 'metadata'
      audio.src = url
      audio.addEventListener('loadedmetadata', handleDuration)
      audio.addEventListener('loadeddata', handleDuration)
      audio.addEventListener('durationchange', handleDuration)
      audio.onerror = () => finish(1)
      timeoutId = window.setTimeout(() => finish(1), 3000)
      audio.load()
    })
  }

  const handlePublish = async () => {
    if (!validate()) return

    if (!user) {
      alert('Você precisa estar logado para publicar.')
      return
    }

    // Require audio for new publications. For edits, allow keeping existing audio
    if (!isEditMode) {
      if (!audioUrl || !_audioBlob) {
        setErrors(e => ({ ...e, audio: 'Áudio inválido' }))
        return
      }
    } else {
      if (!audioUrl && !_audioBlob) {
        setErrors(e => ({ ...e, audio: 'Áudio inválido' }))
        return
      }
    }

    setIsPublishing(true)

    try {
      // If editing and audio wasn't changed, just update the publication row
      if (isEditMode && editingId) {
        const updatePayload: any = {
          title: title.trim(),
          description: description || null,
          category,
          visibility,
        }

        // If a new audio blob was provided during edit, upload it and update url/duration
        if (_audioBlob) {
          const mime = (_audioBlob as Blob).type || ''
          const ext = mime.includes('webm') ? 'webm' : mime.includes('mp4') ? 'mp4' : 'm4a'
          const safeTitle = title.trim().replace(/[^a-zA-Z0-9-_\.]/g, '-').slice(0, 50)
          const filename = `${user.id}/${Date.now()}-${safeTitle}.${ext}`

          const { data: uploadData, error: uploadError } = await supabase.storage
            .from('audios')
            .upload(filename, _audioBlob as Blob, { cacheControl: '3600', upsert: false })

          if (uploadError) throw uploadError

          const { data: urlData } = supabase.storage.from('audios').getPublicUrl(filename)
          const publicUrl = urlData.publicUrl
          if (!publicUrl) throw new Error('Não foi possível obter a URL pública do áudio')

          updatePayload.audio_url = publicUrl
          updatePayload.duration = normalizeDuration(audioDuration) || 1
        }

        const { error: updateError } = await supabase
          .from('publications')
          .update(updatePayload)
          .eq('id', editingId)

        if (updateError) throw updateError

        setPublished(true)
        setIsPublishing(false)
        setTimeout(() => navigate('/feed'), 800)
        return
      }

      // determine extension
      const mime = (_audioBlob as Blob).type || ''
      const ext = mime.includes('webm') ? 'webm' : mime.includes('mp4') ? 'mp4' : 'm4a'
      const safeTitle = title.trim().replace(/[^a-zA-Z0-9-_\.]/g, '-').slice(0, 50)
      const filename = `${user.id}/${Date.now()}-${safeTitle}.${ext}`

      // ensure we have a valid duration before uploading/inserting
      let finalDuration = normalizeDuration(audioDuration)
      if (!finalDuration) {
        const shouldCreateUrl = !audioUrl
        const durationUrl = audioUrl || URL.createObjectURL(_audioBlob as Blob)
        try {
          finalDuration = await loadAudioDuration(durationUrl)
          setAudioDuration(finalDuration)
        } finally {
          if (shouldCreateUrl) URL.revokeObjectURL(durationUrl)
        }
      }

      finalDuration = normalizeDuration(finalDuration) || 1
      setAudioDuration(finalDuration)

      console.log('[PublishPage] finalDuration', finalDuration, 'audioDuration', audioDuration, 'audioUrl', audioUrl)

      // upload to storage
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('audios')
        .upload(filename, _audioBlob as Blob, { cacheControl: '3600', upsert: false })

      if (uploadError) throw uploadError

      // get public url
      const { data: urlData } = supabase.storage.from('audios').getPublicUrl(filename)
      const publicUrl = urlData.publicUrl
      if (!publicUrl) {
        throw new Error('Não foi possível obter a URL pública do áudio')
      }

      const safeDuration = Number.isFinite(finalDuration) && finalDuration > 0 ? finalDuration : 1
      const payload = [{
        user_id: user.id,
        title: title.trim(),
        description: description || null,
        category,
        audio_url: publicUrl,
        duration: safeDuration,
        visibility,
      }]
      console.log('[PublishPage] insert payload', payload)
      const { error: insertError } = await supabase
        .from('publications')
        .insert(payload)

      if (insertError) throw insertError

      setPublished(true)
      setTimeout(() => navigate('/feed'), 1200)
    } catch (err: any) {
      console.error('Publish error', err)
      alert('Erro ao publicar: ' + (err.message || JSON.stringify(err)))
    } finally {
      setIsPublishing(false)
    }
  }

  if (published) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] p-8 text-center">
        <div className="w-20 h-20 bg-[#25D366] rounded-full flex items-center justify-center mb-4 shadow-lg">
          <Check size={40} className="text-white" />
        </div>
        <h2 className="text-2xl font-bold text-[#111827] dark:text-[#E6E6E6] mb-2">Publicado! 🎉</h2>
        <p className="text-gray-500 dark:text-gray-400">Seu áudio foi publicado com sucesso!</p>
        <p className="text-sm text-[#25D366] mt-2">Redirecionando para o feed...</p>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-4">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate(-1)} className="p-2 rounded-xl hover:bg-[#ECE5DD] dark:hover:bg-[#30363D] text-gray-400 transition-colors">
          <X size={20} />
        </button>
        <h1 className="text-xl font-bold text-[#111827] dark:text-[#E6E6E6]">Novo áudio</h1>
      </div>

      {mode === 'select' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <button
            onClick={() => setMode('record')}
            className="flex flex-col items-center gap-4 p-8 bg-white dark:bg-[#1C1C1C] rounded-2xl border-2 border-[#ECE5DD] dark:border-[#30363D] hover:border-[#25D366] hover:shadow-md transition-all group"
          >
            <div className="w-16 h-16 bg-[#ECE5DD] dark:bg-[#0D1117] rounded-full flex items-center justify-center group-hover:bg-[#25D366] transition-colors">
              <Mic size={28} className="text-[#25D366] group-hover:text-white transition-colors" />
            </div>
            <div className="text-center">
              <p className="font-bold text-[#111827] dark:text-[#E6E6E6]">Gravar</p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Grave um novo áudio agora</p>
            </div>
          </button>

          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex flex-col items-center gap-4 p-8 bg-white dark:bg-[#1C1C1C] rounded-2xl border-2 border-[#ECE5DD] dark:border-[#30363D] hover:border-[#25D366] hover:shadow-md transition-all group"
          >
            <div className="w-16 h-16 bg-[#ECE5DD] dark:bg-[#0D1117] rounded-full flex items-center justify-center group-hover:bg-[#25D366] transition-colors">
              <Upload size={28} className="text-[#25D366] group-hover:text-white transition-colors" />
            </div>
            <div className="text-center">
              <p className="font-bold text-[#111827] dark:text-[#E6E6E6]">Upload</p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Envie um arquivo de áudio</p>
            </div>
          </button>

          <input
            ref={fileInputRef}
            type="file"
            accept="audio/*"
            onChange={handleFileUpload}
            className="hidden"
          />
        </div>
      )}

      {mode === 'record' && (
        <AudioRecorder
          onSave={handleRecordSave}
          onCancel={() => setMode('select')}
        />
      )}

      {mode === 'form' && audioUrl && (
        <div className="space-y-4">
          {/* Audio Preview */}
          <div className="bg-white dark:bg-[#1C1C1C] rounded-2xl border border-[#ECE5DD] dark:border-[#30363D] p-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-semibold text-[#111827] dark:text-[#E6E6E6]">🎙️ Pré-visualização</span>
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-500 bg-[#ECE5DD] dark:bg-[#0D1117] px-2 py-1 rounded-full">
                  {formatTime(audioDuration)}
                </span>
                <button
                  onClick={() => { setAudioUrl(null); setAudioBlob(null); setMode('select') }}
                  className="text-gray-400 hover:text-red-500 transition-colors text-sm"
                >
                  Trocar
                </button>
              </div>
            </div>
            <AudioPlayer src={audioUrl} duration={audioDuration} onLoadedMetadata={setAudioDuration} />
            {errors.audio && <p className="text-red-500 text-xs mt-2">{errors.audio}</p>}
          </div>

          {/* Form */}
          <div className="bg-white dark:bg-[#1C1C1C] rounded-2xl border border-[#ECE5DD] dark:border-[#30363D] p-4 space-y-4">
            {/* Title */}
            <div>
              <label className="block text-sm font-semibold text-[#111827] dark:text-[#E6E6E6] mb-1.5">
                Título <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={title}
                onChange={e => { setTitle(e.target.value); setErrors(p => ({ ...p, title: '' })) }}
                placeholder="Dê um título ao seu áudio..."
                maxLength={200}
                className={`w-full px-4 py-3 rounded-xl border ${errors.title ? 'border-red-400' : 'border-[#ECE5DD] dark:border-[#30363D]'} bg-[#ECE5DD] dark:bg-[#0D1117] text-[#111827] dark:text-[#E6E6E6] placeholder-gray-400 text-sm focus:outline-none focus:border-[#25D366] focus:ring-1 focus:ring-[#25D366] transition-colors`}
              />
              <div className="flex justify-between mt-1">
                {errors.title ? <p className="text-red-500 text-xs">{errors.title}</p> : <span />}
                <span className="text-xs text-gray-400">{title.length}/200</span>
              </div>
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-semibold text-[#111827] dark:text-[#E6E6E6] mb-1.5">
                Descrição <span className="text-gray-400 font-normal">(opcional)</span>
              </label>
              <textarea
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="Fale sobre este áudio..."
                maxLength={500}
                rows={3}
                className="w-full px-4 py-3 rounded-xl border border-[#ECE5DD] dark:border-[#30363D] bg-[#ECE5DD] dark:bg-[#0D1117] text-[#111827] dark:text-[#E6E6E6] placeholder-gray-400 text-sm focus:outline-none focus:border-[#25D366] focus:ring-1 focus:ring-[#25D366] transition-colors resize-none"
              />
              <p className="text-xs text-gray-400 mt-1 text-right">{description.length}/500</p>
            </div>

            {/* Category */}
            <div>
              <label className="block text-sm font-semibold text-[#111827] dark:text-[#E6E6E6] mb-1.5">
                Categoria <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <select
                  value={category}
                  onChange={e => setCategory(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-[#ECE5DD] dark:border-[#30363D] bg-[#ECE5DD] dark:bg-[#0D1117] text-[#111827] dark:text-[#E6E6E6] text-sm focus:outline-none focus:border-[#25D366] appearance-none cursor-pointer"
                >
                  {CATEGORIES.map(c => (
                    <option key={c.value} value={c.value}>{c.label}</option>
                  ))}
                </select>
                <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
              </div>
            </div>

            {/* Visibility */}
            <div>
              <label className="block text-sm font-semibold text-[#111827] dark:text-[#E6E6E6] mb-2">
                Visibilidade
              </label>
              <div className="space-y-2">
                {VISIBILITIES.map(v => (
                  <label key={v.value} className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${visibility === v.value ? 'border-[#25D366] bg-[#25D366]/5' : 'border-[#ECE5DD] dark:border-[#30363D] hover:border-[#25D366]/50'}`}>
                    <input
                      type="radio"
                      name="visibility"
                      value={v.value}
                      checked={visibility === v.value}
                      onChange={() => setVisibility(v.value)}
                      className="accent-[#25D366]"
                    />
                    <div>
                      <p className="text-sm font-medium text-[#111827] dark:text-[#E6E6E6]">{v.label}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">{v.desc}</p>
                    </div>
                  </label>
                ))}
              </div>
            </div>
          </div>

          {/* Publish Button */}
          <div className="flex gap-3 pb-4">
            <button
              onClick={() => { setMode('select'); setAudioUrl(null); setAudioBlob(null) }}
              className="flex-1 py-3.5 rounded-xl border border-[#ECE5DD] dark:border-[#30363D] text-[#111827] dark:text-[#E6E6E6] font-semibold hover:bg-[#ECE5DD] dark:hover:bg-[#30363D] transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={handlePublish}
              disabled={isPublishing}
              className="flex-1 py-3.5 rounded-xl bg-[#25D366] hover:bg-[#075E54] disabled:bg-gray-300 dark:disabled:bg-gray-700 text-white font-semibold transition-colors flex items-center justify-center gap-2"
            >
              {isPublishing ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Publicando...
                </>
              ) : (
                <>
                  <Mic size={18} />
                  Publicar áudio
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
