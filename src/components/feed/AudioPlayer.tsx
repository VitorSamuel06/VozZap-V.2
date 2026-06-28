import { useState, useRef, useEffect, useCallback } from 'react'
import { Play, Pause, Download, Volume2, VolumeX } from 'lucide-react'
import { formatTime } from '@/utils/formatters'

const activeAudioElements = new Set<HTMLAudioElement>()

const pauseAllAudio = () => {
  activeAudioElements.forEach(audio => {
    try {
      audio.pause()
    } catch {
      // ignore paused audio errors
    }
  })
}

interface AudioPlayerProps {
  src: string
  duration?: number
  onPlay?: () => void
  onLoadedMetadata?: (duration: number) => void
  compact?: boolean
}

export default function AudioPlayer({ src, duration, onPlay, onLoadedMetadata, compact = false }: AudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null)
  const progressRef = useRef<HTMLDivElement>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [volume, setVolume] = useState(0.8)
  const [isMuted, setIsMuted] = useState(false)
  const [playbackRate, setPlaybackRate] = useState(1)
  const [isLoaded, setIsLoaded] = useState(false)
  const [audioDuration, setAudioDuration] = useState<number | undefined>(duration)
  const [bars] = useState(() => Array.from({ length: 40 }, () => Math.random() * 0.7 + 0.3))
  const playActionRef = useRef(false)

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return

    const handleTimeUpdate = () => {
      const currentAudio = audioRef.current
      if (!currentAudio) return
      setCurrentTime(currentAudio.currentTime)
      const loadedDuration = currentAudio.duration
      if (Number.isFinite(loadedDuration) && loadedDuration > 0) {
        setAudioDuration(loadedDuration)
      }
    }
    const handleEnded = () => {
      setIsPlaying(false)
      setCurrentTime(0)
    }
    const handlePause = () => {
      setIsPlaying(false)
    }
    const handleCanPlay = () => setIsLoaded(true)

    const handleLoadedMetadata = () => {
      if (audioRef.current) {
        const loadedDuration = audioRef.current.duration
        if (Number.isFinite(loadedDuration) && loadedDuration > 0) {
          setAudioDuration(loadedDuration)
          onLoadedMetadata?.(Math.max(1, Math.ceil(loadedDuration)))
        }
      }
    }
    const handleLoadedData = () => {
      if (audioRef.current) {
        const loadedDuration = audioRef.current.duration
        if (Number.isFinite(loadedDuration) && loadedDuration > 0) {
          setAudioDuration(loadedDuration)
        }
      }
    }
    const handleDurationChange = () => {
      if (audioRef.current) {
        const loadedDuration = audioRef.current.duration
        if (Number.isFinite(loadedDuration) && loadedDuration > 0) {
          setAudioDuration(loadedDuration)
        }
      }
    }

    audio.crossOrigin = 'anonymous'
    activeAudioElements.add(audio)

    audio.addEventListener('timeupdate', handleTimeUpdate)
    audio.addEventListener('ended', handleEnded)
    audio.addEventListener('pause', handlePause)
    audio.addEventListener('loadedmetadata', handleLoadedMetadata)
    audio.addEventListener('loadeddata', handleLoadedData)
    audio.addEventListener('durationchange', handleDurationChange)
    audio.addEventListener('canplaythrough', handleCanPlay)

    if (audio.readyState >= 1) {
      handleLoadedMetadata()
      setIsLoaded(true)
    }

    return () => {
      audio.removeEventListener('timeupdate', handleTimeUpdate)
      audio.removeEventListener('ended', handleEnded)
      audio.removeEventListener('pause', handlePause)
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata)
      audio.removeEventListener('loadeddata', handleLoadedData)
      audio.removeEventListener('durationchange', handleDurationChange)
      audio.removeEventListener('canplaythrough', handleCanPlay)
      activeAudioElements.delete(audio)
    }
  }, [])

  useEffect(() => {
    if (duration !== undefined) {
      setAudioDuration(duration)
    }
  }, [duration])

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return

    setCurrentTime(0)
    if (duration !== undefined) {
      setAudioDuration(duration)
    }
    audio.load()
  }, [src, duration])

  const togglePlay = useCallback(async () => {
    const audio = audioRef.current
    if (!audio || playActionRef.current) return

    if (isPlaying) {
      audio.pause()
      setIsPlaying(false)
      return
    }

    pauseAllAudio()
    playActionRef.current = true

    try {
      await audio.play()
      setIsPlaying(true)
      onPlay?.()
    } catch {
      // Autoplay blocked, that's okay
    } finally {
      playActionRef.current = false
    }
  }, [isPlaying, onPlay])

  const handleProgressClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const audio = audioRef.current
    const bar = progressRef.current
    if (!audio || !bar) return

    const rect = bar.getBoundingClientRect()
    const x = e.clientX - rect.left
    const pct = Math.max(0, Math.min(1, x / rect.width))
    const currentDuration = Number.isFinite(audio.duration) && audio.duration > 0 ? audio.duration : audioDuration
    const newTime = pct * currentDuration
    audio.currentTime = newTime
    setCurrentTime(newTime)
  }

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = parseFloat(e.target.value)
    setVolume(v)
    if (audioRef.current) audioRef.current.volume = v
    setIsMuted(v === 0)
  }

  const toggleMute = () => {
    if (audioRef.current) {
      audioRef.current.muted = !isMuted
      setIsMuted(!isMuted)
    }
  }

  const handleRateChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const rate = parseFloat(e.target.value)
    setPlaybackRate(rate)
    if (audioRef.current) audioRef.current.playbackRate = rate
  }

  const handleDownload = () => {
    const a = document.createElement('a')
    a.href = src
    a.download = 'audio.mp3'
    a.click()
  }

  const rawDuration = audioRef.current?.duration ?? audioDuration
  const totalDuration = Number.isFinite(rawDuration) && rawDuration > 0 ? rawDuration : duration && duration > 0 ? duration : 0
  const progress = totalDuration > 0 && Number.isFinite(currentTime) ? (currentTime / totalDuration) * 100 : 0
  const displayDuration = totalDuration
  const formattedDuration = formatTime(displayDuration)

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return
    if (duration > 0) {
      setAudioDuration(duration)
    }
    audio.load()
  }, [src, duration])

  if (compact) {
    return (
      <div className="flex items-center gap-3 bg-[#111827] dark:bg-[#111827] rounded-full px-3 py-2 shadow-sm">
        <audio ref={audioRef} src={src} preload="auto" />
        <button
          type="button"
          onClick={togglePlay}
          className="w-8 h-8 bg-[#25D366] rounded-full flex items-center justify-center flex-shrink-0 hover:bg-[#075E54] transition-colors"
        >
          {isPlaying ? <Pause size={14} className="text-white" /> : <Play size={14} className="text-white ml-0.5" />}
        </button>
        <div
          ref={progressRef}
          onClick={handleProgressClick}
          className="flex-1 h-1.5 bg-gray-700 rounded-full cursor-pointer relative"
        >
          <div
            className="h-full bg-[#25D366] rounded-full transition-all"
            style={{ width: `${progress}%` }}
          />
        </div>
        <span className="text-xs text-gray-200 flex-shrink-0">
          {formatTime(currentTime)} / {formattedDuration}
        </span>
      </div>
    )
  }

  return (
    <div className="w-full bg-[#111827] dark:bg-[#111827] rounded-2xl p-4 space-y-3 shadow-sm">
      <audio ref={audioRef} src={src} preload="auto" />

      {/* Waveform visualization */}
      <div
        ref={progressRef}
        onClick={handleProgressClick}
        className="relative h-14 flex items-center cursor-pointer group"
      >
        <div className="absolute inset-0 flex items-center gap-[2px]">
          {bars.map((height, i) => {
            const barProgress = (i / bars.length) * 100
            const isActive = barProgress <= progress
            return (
              <div
                key={i}
                className="flex-1 rounded-full transition-colors duration-150"
                style={{
                  height: `${height * 100}%`,
                  backgroundColor: isActive
                    ? '#25D366'
                    : isPlaying && i === Math.floor((progress / 100) * bars.length)
                    ? '#075E54'
                    : '#CBD5E1',
                }}
              />
            )
          })}
        </div>

        {/* Progress overlay */}
        <div
          className="absolute left-0 top-0 bottom-0 pointer-events-none"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Controls */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <button
            onClick={togglePlay}
            disabled={!isLoaded && false}
            className="w-10 h-10 bg-[#25D366] hover:bg-[#075E54] rounded-full flex items-center justify-center transition-colors shadow-sm flex-shrink-0"
          >
            {isPlaying ? (
              <Pause size={18} className="text-white" />
            ) : (
              <Play size={18} className="text-white ml-0.5" />
            )}
          </button>

          <div className="flex flex-col">
              <span className="text-xs font-mono text-[#111827] dark:text-[#E6E6E6] font-semibold">
              {formatTime(currentTime)}
            </span>
            <span className="text-xs font-mono text-gray-400">
              {formattedDuration}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Volume */}
          <div className="hidden sm:flex items-center gap-2">
            <button onClick={toggleMute} className="text-gray-500 hover:text-[#25D366] transition-colors">
              {isMuted || volume === 0 ? <VolumeX size={16} /> : <Volume2 size={16} />}
            </button>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={isMuted ? 0 : volume}
              onChange={handleVolumeChange}
              className="w-16 h-1 accent-[#25D366] cursor-pointer"
            />
          </div>

          {/* Playback speed */}
          <select
            value={playbackRate}
            onChange={handleRateChange}
            className="text-xs px-2 py-1 rounded-lg bg-[#0F172A] dark:bg-[#0F172A] border border-[#1F2937] text-[#E6E6E6] cursor-pointer"
          >
            <option value="0.75">0.75x</option>
            <option value="1">1x</option>
            <option value="1.25">1.25x</option>
            <option value="1.5">1.5x</option>
            <option value="2">2x</option>
          </select>

          {/* Download */}
          <button
            onClick={handleDownload}
            className="p-1.5 rounded-lg hover:bg-white dark:hover:bg-[#30363D] text-gray-500 hover:text-[#25D366] transition-colors"
            title="Baixar áudio"
          >
            <Download size={16} />
          </button>
        </div>
      </div>
    </div>
  )
}
