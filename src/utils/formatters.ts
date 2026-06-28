import { formatDistanceToNow, format } from 'date-fns'
import { ptBR } from 'date-fns/locale'

export const formatTimeAgo = (date: string): string => {
  try {
    return formatDistanceToNow(new Date(date), { addSuffix: true, locale: ptBR })
  } catch {
    return 'Agora'
  }
}

export const formatDate = (date: string): string => {
  try {
    return format(new Date(date), "dd 'de' MMM 'de' yyyy", { locale: ptBR })
  } catch {
    return ''
  }
}

export const formatTime = (seconds: number): string => {
  if (!seconds || !Number.isFinite(seconds) || isNaN(seconds)) return '0:00'
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

export const formatDuration = (seconds: number): string => {
  if (!seconds || !Number.isFinite(seconds) || isNaN(seconds)) return '0:00'
  const hours = Math.floor(seconds / 3600)
  const mins = Math.floor((seconds % 3600) / 60)
  const secs = Math.floor(seconds % 60)
  if (hours > 0) {
    return `${hours}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

export const formatCount = (count: number): string => {
  const safeCount = Math.max(0, count)
  if (safeCount >= 1000000) return `${(safeCount / 1000000).toFixed(1)}M`
  if (safeCount >= 1000) return `${(safeCount / 1000).toFixed(1)}K`
  return safeCount.toString()
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const debounce = <T extends (...args: any[]) => any>(
  func: T,
  wait: number
): ((...args: Parameters<T>) => void) => {
  let timeout: ReturnType<typeof setTimeout>
  return (...args: Parameters<T>) => {
    clearTimeout(timeout)
    timeout = setTimeout(() => func(...args), wait)
  }
}

export const getInitials = (name: string | null, username: string): string => {
  if (name && name.trim()) {
    return name.trim().split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
  }
  return username.slice(0, 2).toUpperCase()
}

export const getCategoryColor = (category: string): string => {
  const colors: Record<string, string> = {
    podcast: '#6366f1',
    musica: '#f59e0b',
    fala: '#3b82f6',
    comedia: '#f97316',
    educacao: '#10b981',
    outro: '#6b7280',
  }
  return colors[category] || '#6b7280'
}

export const getCategoryLabel = (category: string): string => {
  const labels: Record<string, string> = {
    podcast: 'Podcast',
    musica: 'Música',
    fala: 'Fala',
    comedia: 'Comédia',
    educacao: 'Educação',
    outro: 'Outro',
  }
  return labels[category] || category
}
