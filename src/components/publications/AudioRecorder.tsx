import { useState, useRef, useEffect } from 'react'
import { Mic, Square, Play, Pause, X, Check, Trash2 } from 'lucide-react'
import { formatTime } from '@/utils/formatters'

interface AudioRecorderProps {
  onSave: (blob: Blob, duration: number) => void
  onCancel: () => void
}

export default function AudioRecorder({ onSave, onCancel }: AudioRecorderProps) {
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const recordingStartRef = useRef<number | null>(null)
  const recordedDurationRef = useRef<number>(0)
  const [isRecording, setIsRecording] = useState(false)
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null)
  const [audioUrl, setAudioUrl] = useState<string | null>(null)
  const [duration, setDuration] = useState(0)
  const [recordingTime, setRecordingTime] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)
  const [bars, setBars] = useState<number[]>(Array(20).fill(0.3))

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
      if (audioUrl) URL.revokeObjectURL(audioUrl)
    }
  }, [audioUrl])

  const normalizeDuration = (value: number): number => {
    if (Number.isFinite(value) && value > 0) {
      return Math.max(1, Math.ceil(value))
    }
    return 0
  }

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true }
      })

      const mimeType = MediaRecorder.isTypeSupported('audio/webm')
        ? 'audio/webm'
        : 'audio/mp4'

      const mediaRecorder = new MediaRecorder(stream, { mimeType })
      mediaRecorderRef.current = mediaRecorder

      const chunks: Blob[] = []
      mediaRecorder.ondataavailable = e => chunks.push(e.data)

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunks, { type: mimeType })
        setAudioBlob(blob)

        const url = URL.createObjectURL(blob)
        setAudioUrl(url)

        const elapsedSeconds = recordingStartRef.current
          ? Math.max(1, Math.ceil((Date.now() - recordingStartRef.current) / 1000))
          : Math.max(1, recordingTime)

        recordedDurationRef.current = elapsedSeconds
        setDuration(elapsedSeconds)
        setRecordingTime(elapsedSeconds)

        const audio = new Audio(url)
        audio.preload = 'metadata'
        audio.src = url
        const setLoadedDuration = (value: number) => {
          const loadedDuration = normalizeDuration(value) || elapsedSeconds
          recordedDurationRef.current = loadedDuration
          setDuration(loadedDuration)
          setRecordingTime(loadedDuration)
        }

        audio.onloadedmetadata = () => {
          setLoadedDuration(audio.duration)
        }
        audio.onloadeddata = () => {
          setLoadedDuration(audio.duration)
        }
        audio.onerror = () => {
          recordedDurationRef.current = elapsedSeconds
          setDuration(elapsedSeconds)
          setRecordingTime(elapsedSeconds)
        }
        audio.load()

        if (audioRef.current) {
          audioRef.current.src = url
          audioRef.current.load()
          audioRef.current.onloadedmetadata = () => {
            if (audioRef.current) {
              const loadedDuration = normalizeDuration(audioRef.current.duration) || elapsedSeconds
              setDuration(loadedDuration)
              setRecordingTime(loadedDuration)
            }
          }
        }

        stream.getTracks().forEach(track => track.stop())
      }

      mediaRecorder.start(100)
      recordingStartRef.current = Date.now()
      setIsRecording(true)
      setDuration(0)
      setRecordingTime(0)
      setAudioBlob(null)
      setAudioUrl(null)

      timerRef.current = setInterval(() => {
        const elapsed = recordingStartRef.current
          ? Math.max(1, Math.ceil((Date.now() - recordingStartRef.current) / 1000))
          : 0
        setRecordingTime(elapsed)
        setBars(Array(20).fill(0).map(() => Math.random() * 0.7 + 0.3))
      }, 250)
    } catch {
      alert('Não foi possível acessar o microfone. Verifique as permissões.')
    }
  }

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop()
      setIsRecording(false)
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }

  const togglePreview = () => {
    if (!audioRef.current) return
    if (isPlaying) {
      audioRef.current.pause()
      setIsPlaying(false)
    } else {
      audioRef.current.play()
      setIsPlaying(true)
      audioRef.current.onended = () => setIsPlaying(false)
    }
  }

  const handleSave = () => {
    if (audioBlob) {
      const sourceDuration = recordedDurationRef.current || duration || recordingTime
      const normalized = normalizeDuration(sourceDuration)
      const finalDuration = normalized || Math.max(1, recordingTime)
      onSave(audioBlob, finalDuration)
    }
  }

  const reset = () => {
    setAudioBlob(null)
    setAudioUrl(null)
    setRecordingTime(0)
    setDuration(0)
    setIsPlaying(false)
    setBars(Array(20).fill(0.3))
  }

  return (
    <div className="bg-white dark:bg-[#1C1C1C] rounded-2xl border border-[#ECE5DD] dark:border-[#30363D] p-6 space-y-5">
      <div className="flex items-center justify-between">
        <h3 className="font-bold text-[#111827] dark:text-[#E6E6E6] text-lg">🎙️ Gravar Áudio</h3>
        <button
          onClick={onCancel}
          className="p-2 rounded-full hover:bg-[#ECE5DD] dark:hover:bg-[#30363D] text-gray-400 transition-colors"
        >
          <X size={20} />
        </button>
      </div>

      {/* Visualization */}
      <div className="relative h-20 bg-[#ECE5DD] dark:bg-[#0D1117] rounded-xl flex items-center justify-center overflow-hidden">
        {isRecording ? (
          <div className="flex items-end gap-1 px-4 h-full py-3">
            {bars.map((h, i) => (
              <div
                key={i}
                className="flex-1 bg-[#25D366] rounded-t-sm recording-bar"
                style={{
                  height: `${h * 100}%`,
                  animationDelay: `${i * 60}ms`,
                  animationDuration: `${0.6 + Math.random() * 0.4}s`,
                }}
              />
            ))}
          </div>
        ) : audioBlob ? (
          <div className="flex flex-col items-center gap-2">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-[#25D366] rounded-full" />
              <span className="text-sm font-semibold text-[#25D366]">Gravação pronta!</span>
            </div>
            <span className="text-xs text-gray-500 dark:text-gray-400">
              Duração: {formatTime(duration || recordingTime)}
            </span>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2">
            <Mic size={28} className="text-gray-300 dark:text-gray-600" />
            <span className="text-xs text-gray-400">Clique em gravar para começar</span>
          </div>
        )}

        {isRecording && (
          <div className="absolute top-3 right-3 flex items-center gap-1.5">
            <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
            <span className="text-xs font-mono text-red-500 font-bold">
              {formatTime(recordingTime)}
            </span>
          </div>
        )}
      </div>

      {/* Hidden audio element for preview */}
      <audio ref={audioRef} />

      {/* Controls */}
      <div className="flex flex-col gap-3">
        {!audioBlob ? (
          <div className="flex gap-3">
            {!isRecording ? (
              <button
                onClick={startRecording}
                className="flex-1 flex items-center justify-center gap-2 bg-[#25D366] hover:bg-[#075E54] text-white rounded-xl py-3 font-semibold transition-colors"
              >
                <Mic size={18} />
                Iniciar Gravação
              </button>
            ) : (
              <button
                onClick={stopRecording}
                className="flex-1 flex items-center justify-center gap-2 bg-red-500 hover:bg-red-600 text-white rounded-xl py-3 font-semibold transition-colors"
              >
                <Square size={18} />
                Parar ({formatTime(recordingTime)})
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex gap-2">
              <button
                onClick={togglePreview}
                className="flex-1 flex items-center justify-center gap-2 bg-[#ECE5DD] dark:bg-[#0D1117] hover:bg-gray-200 dark:hover:bg-gray-800 text-[#111827] dark:text-[#E6E6E6] rounded-xl py-3 font-medium transition-colors"
              >
                {isPlaying ? <Pause size={18} /> : <Play size={18} />}
                {isPlaying ? 'Pausar' : 'Ouvir prévia'}
              </button>
              <button
                onClick={reset}
                className="px-4 flex items-center justify-center gap-2 bg-[#ECE5DD] dark:bg-[#0D1117] hover:bg-gray-200 dark:hover:bg-gray-800 text-gray-500 rounded-xl py-3 transition-colors"
                title="Apagar e regravar"
                aria-label="Apagar e regravar"
              >
                <Trash2 size={18} />
              </button>
            </div>

            <button
              onClick={handleSave}
              className="w-full flex items-center justify-center gap-2 bg-[#25D366] hover:bg-[#075E54] text-white rounded-xl py-3 font-semibold transition-colors"
            >
              <Check size={18} />
              Usar este áudio
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
