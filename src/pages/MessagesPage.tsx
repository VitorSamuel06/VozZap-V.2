import { useState, useEffect, useRef } from 'react'
import { Search, Send, Mic, ArrowLeft, Check, CheckCheck, Edit2, Trash2, X, Save } from 'lucide-react'
import { useAuthStore } from '@/stores/authStore'
import { supabase } from '@/services/supabaseClient'
import { formatTimeAgo, getInitials } from '@/utils/formatters'
import type { Conversation, Message, User } from '@/types'
import AudioPlayer from '@/components/feed/AudioPlayer'

export default function MessagesPage() {
  const { user: currentUser } = useAuthStore()
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [selectedConv, setSelectedConv] = useState<Conversation | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [messageText, setMessageText] = useState('')
  const [messageError, setMessageError] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [isRecording, setIsRecording] = useState(false)
  const [recordingTime, setRecordingTime] = useState(0)
  const [showNewChat, setShowNewChat] = useState(false)
  const [loading, setLoading] = useState(true)
  const [availableUsers, setAvailableUsers] = useState<User[]>([])
  const [usersLoading, setUsersLoading] = useState(false)
  const [recordedAudioBlob, setRecordedAudioBlob] = useState<Blob | null>(null)
  const [recordedAudioUrl, setRecordedAudioUrl] = useState<string | null>(null)
  const [recordedAudioDuration, setRecordedAudioDuration] = useState<number | undefined>(undefined)
  const [isUploadingAudio, setIsUploadingAudio] = useState(false)
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null)
  const [editingContent, setEditingContent] = useState<string>('')
  const recordingStartRef = useRef<number | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const messagesContainerRef = useRef<HTMLDivElement>(null)
  const shouldScrollToBottomRef = useRef(true)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const recordingChunksRef = useRef<BlobPart[]>([])
  const recordingMimeTypeRef = useRef<string>('audio/webm')
  const realtimeSubscriptionRef = useRef<any>(null)
  const pollingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const selectedConvRef = useRef<Conversation | null>(null)
  const conversationsRef = useRef<Conversation[]>([])
  const messageDurationsRef = useRef<Map<string, number>>(new Map())

  useEffect(() => {
    conversationsRef.current = conversations
  }, [conversations])

  const loadConversations = async () => {
    if (!currentUser?.id) return

    try {
      const { data, error } = await supabase
        .from('conversations')
        .select('*, user_one:user_one_id(*), user_two:user_two_id(*), last_message:direct_messages(*)')
        .or(`user_one_id.eq.${currentUser.id},user_two_id.eq.${currentUser.id}`)
        .order('updated_at', { ascending: false })

      if (error) {
        throw error
      }

      const conversationsWithCount = data as Conversation[]

      const partnerIds = conversationsWithCount.map(conv =>
        conv.user_one_id === currentUser.id ? conv.user_two_id : conv.user_one_id
      )

      const { data: unreadMessages, error: unreadError } = await supabase
        .from('direct_messages')
        .select('sender_id, recipient_id')
        .eq('recipient_id', currentUser.id)
        .eq('is_read', false)
        .in('sender_id', partnerIds)

      if (unreadError) {
        throw unreadError
      }

      const unreadMap = new Map<string, number>()
      unreadMessages?.forEach(msg => {
        const count = unreadMap.get(msg.sender_id) ?? 0
        unreadMap.set(msg.sender_id, count + 1)
      })

      const enriched = conversationsWithCount.map(conv => {
        const partnerId = conv.user_one_id === currentUser.id ? conv.user_two_id : conv.user_one_id
        return {
          ...conv,
          unread_count: unreadMap.get(partnerId) ?? 0,
        }
      })

      conversationsRef.current = enriched
      setConversations(enriched)
    } catch (err) {
      console.error('Erro ao carregar conversas:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadConversations()
  }, [currentUser?.id])

  useEffect(() => {
    const fetchAvailableUsers = async () => {
      if (!currentUser?.id) return
      setUsersLoading(true)

      try {
        const { data, error } = await supabase
          .from('users')
          .select('*')
          .neq('id', currentUser.id)
          .eq('is_private', false)
          .order('full_name', { ascending: true })
          .limit(50)

        if (!error && data) {
          setAvailableUsers(data)
        }
      } catch (err) {
        console.error('Erro ao carregar usuários para chat:', err)
      } finally {
        setUsersLoading(false)
      }
    }

    fetchAvailableUsers()
  }, [currentUser?.id])

  const isAtBottom = () => {
    const container = messagesContainerRef.current
    if (!container) return true
    return container.scrollHeight - container.scrollTop - container.clientHeight < 32
  }

  const handleMessagesScroll = () => {
    shouldScrollToBottomRef.current = isAtBottom()
  }

  useEffect(() => {
    if (!messagesEndRef.current) return
    if (shouldScrollToBottomRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages])

  useEffect(() => {
    if (!currentUser?.id) return

    const channel = supabase.channel('direct_messages_realtime')

    const buildConversationPreviewUpdates = (message: any, prev: Conversation[]) => {
      const partnerId = message.sender_id === currentUser.id ? message.recipient_id : message.sender_id
      const next = prev.map(conv => {
        const convPartnerId = conv.user_one_id === currentUser.id ? conv.user_two_id : conv.user_one_id
        if (convPartnerId !== partnerId) return conv

        return {
          ...conv,
          last_message: {
            id: message.id,
            sender_id: message.sender_id,
            recipient_id: message.recipient_id,
            content: message.content,
            message_type: message.message_type,
            audio_url: message.audio_url,
            is_read: message.is_read,
            created_at: message.created_at,
            updated_at: message.created_at,
            sender: conv.user_one_id === currentUser.id ? conv.user_two : conv.user_one,
            recipient: currentUser,
          },
          updated_at: message.created_at,
        }
      })

      const exists = next.some(c => {
        const convPartnerId = c.user_one_id === currentUser.id ? c.user_two_id : c.user_one_id
        return convPartnerId === partnerId
      })

      if (!exists) {
        return [
          {
            id: message.conversation_id ?? `${message.sender_id}-${message.recipient_id}`,
            user_one_id: currentUser.id < partnerId ? currentUser.id : partnerId,
            user_two_id: currentUser.id < partnerId ? partnerId : currentUser.id,
            user_one: currentUser.id < partnerId ? currentUser : { ...message.sender, ...{ id: partnerId } },
            user_two: currentUser.id < partnerId ? { ...message.sender, ...{ id: partnerId } } : currentUser,
            last_message: message,
            updated_at: message.created_at,
            unread_count: 0,
          },
          ...next,
        ]
      }

      return next.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
    }

    const updateConversationPreview = async (message: any) => {
      setConversations(prev => {
        const nextConversations = buildConversationPreviewUpdates(message, prev)
        conversationsRef.current = nextConversations
        return nextConversations
      })
    }

    const markConversationMessagesRead = async (otherUserId: string) => {
      if (!currentUser?.id) return

      const { data: updatedData, error: updateError } = await supabase
        .from('direct_messages')
        .update({ is_read: true, read_at: new Date().toISOString() })
        .eq('recipient_id', currentUser.id)
        .eq('sender_id', otherUserId)
        .eq('is_read', false)
        .select('id')

      if (updateError) {
        console.error('[Realtime] Erro ao marcar mensagens como lidas:', updateError)
      } else {
        console.log('[Realtime] Mensagens marcadas como lidas via realtime:', updatedData?.length)
      }
    }

    channel.on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'direct_messages' }, async payload => {
      const newMessage = payload.new
      console.log('[Realtime] payload recebido:', payload)
      if (!newMessage) return

      await updateConversationPreview(newMessage)
      await refreshUnreadCounts(conversationsRef.current)
      await loadConversations()

      const currentConv = selectedConvRef.current
      if (!currentConv) return

      const otherUser = getOtherUser(currentConv)
      if (!otherUser) return

      const currentUserId = currentUser.id
      const otherUserId = otherUser.id

      const isRelevant =
        (newMessage.sender_id === currentUserId && newMessage.recipient_id === otherUserId) ||
        (newMessage.sender_id === otherUserId && newMessage.recipient_id === currentUserId)

      if (!isRelevant) return

      console.log('[Realtime] Nova mensagem relevante:', newMessage)
      setMessages(prev => prev.some(msg => msg.id === newMessage.id) ? prev : [...prev, newMessage])

      if (newMessage.recipient_id === currentUserId) {
        markConversationMessagesRead(otherUserId)
        refreshUnreadCounts(conversationsRef.current)
        loadConversations()
      }
    })
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'direct_messages' }, async payload => {
      console.log('[Realtime] UPDATE payload recebido:', payload)
      if (payload.new?.recipient_id === currentUser.id || payload.old?.recipient_id === currentUser.id) {
        await refreshUnreadCounts()
        await loadConversations()
      }
    })

    const subscription = channel.subscribe()
    console.log('[Realtime] subscription subscribe ok', subscription)
    realtimeSubscriptionRef.current = subscription
    console.log('[MessagesPage] subscription realtime criada', subscription)

    return () => {
      try {
        supabase.removeChannel(subscription)
      } catch (err) {
        console.error('[MessagesPage] Erro ao remover channel realtime:', err)
      }
    }
  }, [currentUser?.id])

  useEffect(() => {
    selectedConvRef.current = selectedConv
  }, [selectedConv])

  useEffect(() => {
    if (!selectedConv || !currentUser?.id) return

    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current)
    }

    pollingIntervalRef.current = setInterval(() => {
      if (selectedConv) {
        fetchMessagesForConversation(selectedConv, false)
      }
    }, 1000)

    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current)
      }
    }
  }, [selectedConv?.id, currentUser?.id])

  const getOtherUser = (conv: Conversation): User | undefined => {
    return conv.user_one_id === currentUser?.id ? (conv.user_two as any) : (conv.user_one as any)
  }

  const getPartnerId = (conv: Conversation): string | null => {
    if (!currentUser?.id) return null
    return conv.user_one_id === currentUser.id ? conv.user_two_id : conv.user_one_id
  }

  const refreshUnreadCounts = async (conversationList: Conversation[] = conversationsRef.current) => {
    if (!currentUser?.id || conversationList.length === 0) return

    const partnerIds = conversationList.map(conv => getPartnerId(conv)).filter(Boolean) as string[]
    if (partnerIds.length === 0) return

    try {
      const { data, error } = await supabase
        .from('direct_messages')
        .select('sender_id')
        .eq('recipient_id', currentUser.id)
        .eq('is_read', false)
        .in('sender_id', partnerIds)

      if (error) {
        throw error
      }

      const unreadMap = new Map<string, number>()
      data?.forEach(msg => {
        const count = unreadMap.get(msg.sender_id) ?? 0
        unreadMap.set(msg.sender_id, count + 1)
      })

      const updatedConversations = conversationList.map(conv => {
        const partnerId = getPartnerId(conv)
        if (!partnerId) return conv
        return { ...conv, unread_count: unreadMap.get(partnerId) ?? 0 }
      })

      conversationsRef.current = updatedConversations
      setConversations(updatedConversations)

      if (selectedConv) {
        const selectedPartnerId = getPartnerId(selectedConv)
        if (selectedPartnerId) {
          const updatedCount = unreadMap.get(selectedPartnerId) ?? 0
          setSelectedConv(prev => prev ? { ...prev, unread_count: updatedCount } : prev)
        }
      }
    } catch (err) {
      console.error('Erro ao atualizar contadores de mensagens não lidas:', err)
    }
  }

  const fetchMessagesForConversation = async (conv: Conversation, markRead = false) => {
    try {
      const otherUser = getOtherUser(conv)
      const currentUserId = currentUser?.id
      const otherUserId = otherUser?.id
      if (!currentUserId || !otherUserId) return

      console.log('[FetchMessages] carregando mensagens para:', { currentUserId, otherUserId })

      const { data, error } = await supabase
        .from('direct_messages')
        .select('*, sender:sender_id(*), recipient:recipient_id(*)')
        .or(
          `and(sender_id.eq.${currentUserId},recipient_id.eq.${otherUserId}),and(sender_id.eq.${otherUserId},recipient_id.eq.${currentUserId})`
        )
        .eq('is_deleted', false)
        .order('created_at', { ascending: true })

      console.log('[FetchMessages] response:', { data, error, count: data?.length })

      if (error) {
        console.error('[FetchMessages] erro:', error)
        setMessageError(`Erro ao carregar mensagens: ${error.message}`)
        return
      }

      if (data) {
          const durationMap = new Map<string, number>(messageDurationsRef.current)
          const enrichedMessages = (data as any[]).map(msg => {
            if (msg.message_type === 'audio' && !msg.duration && msg.id && durationMap.has(msg.id)) {
              return { ...msg, duration: durationMap.get(msg.id) }
            }
            return msg
          })

          setMessages(enrichedMessages as any)
      }

      if (markRead) {
        const { data: updatedData, error: updateError } = await supabase
          .from('direct_messages')
          .update({ is_read: true, read_at: new Date().toISOString() })
          .eq('recipient_id', currentUserId)
          .eq('sender_id', otherUserId)
          .eq('is_read', false)
          .select('id')

        if (updateError) {
          console.error('[FetchMessages] Erro ao marcar como lido:', updateError)
        } else {
          console.log('[FetchMessages] Mensagens marcadas como lidas:', updatedData?.length)
        }

        const updatedConversations = conversationsRef.current.map(existingConv => {
          const convPartnerId = existingConv.user_one_id === currentUser.id ? existingConv.user_two_id : existingConv.user_one_id
          if (convPartnerId !== otherUserId) return existingConv
          return { ...existingConv, unread_count: 0 }
        })

        conversationsRef.current = updatedConversations
        setConversations(updatedConversations)

        if (selectedConv?.id === conv.id) {
          setSelectedConv(prev => prev ? { ...prev, unread_count: 0 } : prev)
        }

        await refreshUnreadCounts(conversationsRef.current)
        await loadConversations()

        const refreshedConv = conversationsRef.current.find(c => c.id === conv.id)
        if (refreshedConv) {
          selectedConvRef.current = refreshedConv
          setSelectedConv(refreshedConv)
        }
      }
    } catch (err) {
      console.error('[FetchMessages] exception:', err)
    }
  }

  const handleSelectConversation = async (conv: Conversation) => {
    selectedConvRef.current = conv
    setSelectedConv(conv)
    shouldScrollToBottomRef.current = true

    try {
      await fetchMessagesForConversation(conv, true)
    } catch (err) {
      console.error('[SelectConversation] Exception:', err)
      setMessageError(`Erro: ${String(err)}`)
    }
  }

  const startEditMessage = (msg: Message) => {
    if (msg.message_type !== 'text') return
    setEditingMessageId(msg.id)
    setEditingContent(msg.content || '')
  }

  const cancelEdit = () => {
    setEditingMessageId(null)
    setEditingContent('')
  }

  const saveEditMessage = async (msgId: string) => {
    try {
      const newText = editingContent.trim()
      if (!newText) return alert('Mensagem vazia não é permitida')
      const { data, error } = await supabase
        .from('direct_messages')
        .update({ content: newText })
        .eq('id', msgId)
        .select('*, sender:sender_id(*), recipient:recipient_id(*)')
        .maybeSingle()

      if (error) throw error

      if (data) {
        setMessages(prev => prev.map(m => m.id === msgId ? { ...m, content: newText } : m))
      }
    } catch (err) {
      console.error('Erro ao editar mensagem:', err)
      const message = (err as any)?.message || JSON.stringify(err)
      alert('Erro ao editar mensagem: ' + message)
    } finally {
      cancelEdit()
    }
  }

  const deleteMessage = async (msgId: string) => {
    if (!confirm('Deseja apagar esta mensagem?')) return
    try {
      const { error } = await supabase
        .from('direct_messages')
        .delete()
        .eq('id', msgId)

      if (error) throw error
      setMessages(prev => prev.filter(m => m.id !== msgId))
    } catch (err) {
      console.error('Erro ao apagar mensagem:', err)
      alert('Erro ao apagar mensagem')
    }
  }

  const openOrCreateConversation = async (user: User) => {
    if (!currentUser?.id) return

    const existingConv = conversations.find(
      conv => conv.user_one_id === user.id || conv.user_two_id === user.id
    )

    if (existingConv) {
      setShowNewChat(false)
      handleSelectConversation(existingConv)
      return
    }

    const [firstUserId, secondUserId] = currentUser.id < user.id
      ? [currentUser.id, user.id]
      : [user.id, currentUser.id]

    try {
      const { data, error } = await supabase
        .from('conversations')
        .insert({
          user_one_id: firstUserId,
          user_two_id: secondUserId,
          updated_at: new Date().toISOString(),
        })
        .select('id, user_one_id, user_two_id, updated_at')
        .single()

      if (!error && data) {
        const newConv: Conversation = {
          id: data.id,
          user_one_id: data.user_one_id,
          user_two_id: data.user_two_id,
          last_message_id: null,
          updated_at: data.updated_at,
          user_one: firstUserId === currentUser.id ? currentUser : user,
          user_two: secondUserId === currentUser.id ? currentUser : user,
          unread_count: 0,
        }

        setConversations(prev => [newConv, ...prev])
        setShowNewChat(false)
        handleSelectConversation(newConv)
      }
    } catch (err) {
      console.error('Erro ao criar conversa:', err)
    }
  }

  const uploadAudioFile = async (blob: Blob) => {
    const userId = currentUser?.id
    if (!userId) throw new Error('Usuário não autenticado')

    const extension = blob.type.includes('webm') ? 'webm' : blob.type.includes('mp4') ? 'mp4' : 'ogg'
    const fileName = `messages/${userId}/${Date.now()}.${extension}`

    const { data: uploadData, error: uploadError } = await supabase
      .storage
      .from('audios')
      .upload(fileName, blob, { cacheControl: '3600', upsert: false })

    if (uploadError) {
      throw uploadError
    }

    const { data: publicUrlData, error: publicUrlError } = await supabase
      .storage
      .from('audios')
      .getPublicUrl(fileName)

    if (publicUrlError) {
      throw publicUrlError
    }

    return publicUrlData.publicUrl
  }

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault()
    if ((!messageText.trim() && !recordedAudioBlob) || !currentUser || !selectedConv) return

    const otherUser = getOtherUser(selectedConv)
    if (!otherUser) {
      console.error('[SendMessage] Outro usuário não encontrado')
      setMessageError('Erro: Outro usuário não encontrado')
      return
    }

    try {
      let payload: { sender_id: string; recipient_id: string; content: string; message_type: 'text' | 'audio'; audio_url?: string | null; duration?: number } = {
        sender_id: currentUser.id,
        recipient_id: otherUser.id,
        content: messageText.trim() || '',
        message_type: 'text',
      }

      if (recordedAudioBlob) {
        setIsUploadingAudio(true)
        const audioUrl = await uploadAudioFile(recordedAudioBlob)
        payload = {
          sender_id: currentUser.id,
          recipient_id: otherUser.id,
          content: messageText.trim() || 'Áudio',
          message_type: 'audio',
          audio_url: audioUrl,
        }
      }

      console.log('[SendMessage] Enviando:', payload)

      const { data, error } = await supabase
        .from('direct_messages')
        .insert(payload)
        .select('*, sender:sender_id(*), recipient:recipient_id(*)')
        .single()
      console.log('[SendMessage] Response:', { data, error })

      if (error) {
        console.error('[SendMessage] Erro na query:', error)
        setMessageError(`Erro ao enviar: ${error.message}`)
        return
      }

      if (data) {
        console.log('[SendMessage] Mensagem salva com sucesso:', data.id)
        const messageWithDuration = {
          ...(data as any),
          duration: recordedAudioBlob ? (recordedAudioDuration ?? recordingTime) : data?.duration ?? undefined,
        }
        if (messageWithDuration.duration) {
          messageDurationsRef.current.set(messageWithDuration.id, messageWithDuration.duration)
        }
        shouldScrollToBottomRef.current = true
        setMessages(prev => [...prev, messageWithDuration])
        setMessageText('')
        setMessageError('')
        setRecordedAudioBlob(null)
        if (recordedAudioUrl) {
          URL.revokeObjectURL(recordedAudioUrl)
          setRecordedAudioUrl(null)
        }
      }
    } catch (err) {
      console.error('[SendMessage] Exception:', err)
      setMessageError(`Erro: ${String(err)}`)
    } finally {
      setIsUploadingAudio(false)
    }
  }

  const startRecording = async () => {
    try {
      setRecordedAudioDuration(undefined)
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mimeType = MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/mp4'
      recordingMimeTypeRef.current = mimeType
      const mediaRecorder = new MediaRecorder(stream, { mimeType })
      mediaRecorderRef.current = mediaRecorder
      recordingChunksRef.current = []

      mediaRecorder.ondataavailable = e => {
        if (e.data.size > 0) {
          recordingChunksRef.current.push(e.data)
        }
      }

      mediaRecorder.onstop = () => {
        stream.getTracks().forEach(t => t.stop())
        if (timerRef.current) clearInterval(timerRef.current)

        const audioBlob = new Blob(recordingChunksRef.current, { type: recordingMimeTypeRef.current })
        const url = URL.createObjectURL(audioBlob)
        setRecordedAudioBlob(audioBlob)
        setRecordedAudioUrl(url)
        setRecordedAudioDuration(undefined)
        setMessageText('')

        const tempAudio = new Audio(url)
        tempAudio.preload = 'metadata'
        tempAudio.addEventListener('loadedmetadata', () => {
          if (Number.isFinite(tempAudio.duration) && tempAudio.duration > 0) {
            setRecordedAudioDuration(Math.max(1, Math.ceil(tempAudio.duration)))
          }
        })
        tempAudio.load()
      }

      mediaRecorder.start(100)
      recordingStartRef.current = Date.now()
      setIsRecording(true)
      setRecordingTime(0)
      timerRef.current = setInterval(() => setRecordingTime(p => p + 1), 1000)
    } catch {
      alert('Não foi possível acessar o microfone.')
    }
  }

  const stopRecording = () => {
    mediaRecorderRef.current?.stop()
    setIsRecording(false)
    if (timerRef.current) clearInterval(timerRef.current)
  }

  useEffect(() => {
    if (!recordedAudioUrl) return

    const tempAudio = new Audio(recordedAudioUrl)
    tempAudio.preload = 'metadata'
    tempAudio.onloadedmetadata = () => {
      if (Number.isFinite(tempAudio.duration) && tempAudio.duration > 0) {
        setRecordedAudioDuration(Math.max(1, Math.ceil(tempAudio.duration)))
      }
    }
    tempAudio.load()

    return () => {
      tempAudio.src = ''
    }
  }, [recordedAudioUrl])

  const filteredConversations = conversations.filter(conv => {
    const other = getOtherUser(conv)
    if (!searchQuery) return true
    const lq = searchQuery.toLowerCase()
    return other?.username.toLowerCase().includes(lq) ||
      other?.full_name?.toLowerCase().includes(lq)
  })

  const otherUser = selectedConv ? getOtherUser(selectedConv) : null

  return (
    <div className="flex h-[calc(100vh-56px)] bg-[#ECE5DD] dark:bg-[#0D1117]">
      {/* Conversations List */}
      <div className={`${selectedConv ? 'hidden md:flex' : 'flex'} w-full md:w-80 flex-shrink-0 min-w-0 flex-col bg-white dark:bg-[#1C1C1C] border-r border-[#ECE5DD] dark:border-[#30363D]`}>
        {/* Header */}
        <div className="p-4 border-b border-[#ECE5DD] dark:border-[#30363D]">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-bold text-[#111827] dark:text-[#E6E6E6]">Mensagens</h2>
            <button
              onClick={() => setShowNewChat(true)}
              className="w-8 h-8 bg-[#25D366] rounded-full flex items-center justify-center text-white hover:bg-[#075E54] transition-colors"
            >
              +
            </button>
          </div>
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Buscar conversas..."
              className="w-full pl-9 pr-4 py-2 rounded-xl bg-[#ECE5DD] dark:bg-[#0D1117] text-sm text-[#111827] dark:text-[#E6E6E6] placeholder-gray-400 border-none outline-none focus:ring-1 focus:ring-[#25D366]"
            />
          </div>
        </div>

        {/* Conversation List */}
        <div className="flex-1 overflow-y-auto">
          {filteredConversations.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 text-center px-4">
              <p className="text-4xl mb-2">💬</p>
              <p className="text-sm text-gray-500 dark:text-gray-400">Nenhuma conversa ainda</p>
            </div>
          ) : (
            filteredConversations.map(conv => {
              const other = getOtherUser(conv)
              const isActive = selectedConv?.id === conv.id
              return (
                <button
                  key={conv.id}
                  onClick={() => handleSelectConversation(conv)}
                  className={`w-full flex items-center gap-3 p-4 hover:bg-[#ECE5DD] dark:hover:bg-[#30363D] transition-colors text-left ${isActive ? 'bg-[#ECE5DD] dark:bg-[#30363D]' : ''}`}
                >
                  <div className="relative">
                    <div className="w-12 h-12 rounded-full bg-[#25D366] flex items-center justify-center text-white font-bold flex-shrink-0">
                      {other?.avatar_url ? (
                        <img src={other.avatar_url} alt={other.username} className="w-full h-full rounded-full object-cover" />
                      ) : (
                        getInitials(other?.full_name ?? null, other?.username ?? 'U')
                      )}
                    </div>
                    <div className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-[#25D366] rounded-full border-2 border-white dark:border-[#1C1C1C]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-0.5">
                      <p className="font-semibold text-[#111827] dark:text-[#E6E6E6] text-sm truncate">
                        {other?.full_name || other?.username}
                      </p>
                      <span className="text-xs text-gray-400 flex-shrink-0 ml-2">
                        {formatTimeAgo(conv.updated_at)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                        {conv.last_message?.content || 'Iniciar conversa'}
                      </p>
                    </div>
                  </div>
                </button>
              )
            })
          )}
        </div>
      </div>

      {/* Chat Window */}
      {selectedConv ? (
        <div className="flex-1 flex flex-col">
          {/* Chat Header */}
          <div className="bg-white dark:bg-[#1C1C1C] border-b border-[#ECE5DD] dark:border-[#30363D] p-4 flex items-center gap-3">
            <button
              onClick={() => setSelectedConv(null)}
              className="md:hidden p-1.5 rounded-full hover:bg-[#ECE5DD] dark:hover:bg-[#30363D] text-gray-400 transition-colors"
            >
              <ArrowLeft size={20} />
            </button>
            <div className="w-10 h-10 rounded-full bg-[#25D366] flex items-center justify-center text-white font-bold flex-shrink-0">
              {otherUser?.avatar_url ? (
                <img src={otherUser.avatar_url} alt={otherUser.username} className="w-full h-full rounded-full object-cover" />
              ) : (
                getInitials(otherUser?.full_name ?? null, otherUser?.username ?? 'U')
              )}
            </div>
            <div>
              <p className="font-semibold text-[#111827] dark:text-[#E6E6E6] text-sm">
                {otherUser?.full_name || otherUser?.username}
              </p>
              <p className="text-xs text-[#25D366]">Online agora</p>
            </div>
          </div>

          {/* Messages */}
          <div
            ref={messagesContainerRef}
            onScroll={handleMessagesScroll}
            className="flex-1 overflow-y-auto p-4 space-y-3 min-w-0"
            style={{ background: 'url("data:image/svg+xml,...")' }}
          >
            {messages.map(msg => {
              const isOwn = msg.sender_id === currentUser?.id
              const inEdit = editingMessageId === msg.id
              return (
                <div key={msg.id} className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[80%] sm:max-w-[75%] md:max-w-[65%] ${isOwn ? 'message-own dark:message-own' : 'message-other dark:message-other'} px-4 py-2 shadow-sm break-words w-full`}>
                    {inEdit ? (
                      <div className="flex flex-col gap-2">
                        <textarea
                          value={editingContent}
                          onChange={e => setEditingContent(e.target.value)}
                          className="w-full bg-transparent text-sm text-[#111827] dark:text-[#E6E6E6] placeholder-gray-400 outline-none resize-none border border-transparent focus:border-[#25D366] rounded-md p-2"
                          rows={3}
                        />
                        <div className="flex items-center gap-2 justify-end">
                          <button type="button" onClick={cancelEdit} className="px-3 py-1 rounded-md text-sm bg-gray-200 dark:bg-[#202227]">
                            <X size={14} />
                          </button>
                          <button type="button" onClick={() => saveEditMessage(msg.id)} className="px-3 py-1 rounded-md text-sm bg-[#25D366] text-white">
                            <Save size={14} />
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        {msg.message_type === 'audio' && msg.audio_url ? (
                          <AudioPlayer src={msg.audio_url} compact duration={msg.duration} />
                        ) : (
                          <p className="text-sm text-[#111827] dark:text-[#E6E6E6] leading-relaxed">{msg.content}</p>
                        )}

                        <div className={`flex items-center gap-2 mt-1 ${isOwn ? 'justify-end' : 'justify-start'}`}>
                          <span className="text-[10px] text-gray-400">
                            {new Date(msg.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                          </span>

                          {isOwn && (
                            <div className="flex items-center gap-1">
                              {msg.message_type === 'text' && (
                                <button onClick={() => startEditMessage(msg)} title="Editar" className="p-1 rounded hover:bg-gray-200 dark:hover:bg-[#202227]">
                                  <Edit2 size={14} />
                                </button>
                              )}
                              <button onClick={() => deleteMessage(msg.id)} title="Apagar" className="p-1 rounded hover:bg-gray-200 dark:hover:bg-[#202227]">
                                <Trash2 size={14} />
                              </button>
                              <CheckCheck size={12} className={msg.is_read ? 'text-[#25D366]' : 'text-gray-400'} />
                            </div>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                </div>
              )
            })}
            <div ref={messagesEndRef} />
          </div>

          {/* Message Input */}
          <div className="bg-white dark:bg-[#1C1C1C] border-t border-[#ECE5DD] dark:border-[#30363D] p-3">
            {messageError && (
              <div className="mb-2 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-xs px-3 py-2 rounded-lg border border-red-200 dark:border-red-800">
                {messageError}
              </div>
            )}
            {isRecording ? (
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2 flex-1 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-full px-4 py-2.5">
                  <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                  <span className="text-sm text-red-600 font-mono">{String(Math.floor(recordingTime / 60)).padStart(2, '0')}:{String(recordingTime % 60).padStart(2, '0')}</span>
                  <span className="text-xs text-red-500">Gravando...</span>
                </div>
                <button
                  onClick={stopRecording}
                  className="w-11 h-11 bg-red-500 rounded-full flex items-center justify-center text-white hover:bg-red-600 transition-colors"
                >
                  ■
                </button>
              </div>
            ) : (
              <form onSubmit={handleSendMessage} className="flex flex-col sm:flex-row items-end gap-2 w-full">
                <div className="flex-1 flex flex-col gap-2 w-full min-w-0">
                  {recordedAudioUrl && (
                    <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-[#111827] rounded-2xl px-4 py-2.5 border border-[#1F2937] w-full">
                      <div className="flex-1 min-w-0 w-full">
                        <AudioPlayer
                          src={recordedAudioUrl}
                          compact
                          duration={recordedAudioDuration ?? recordingTime}
                          onLoadedMetadata={(duration) => setRecordedAudioDuration(duration)}
                        />
                        <p className="text-xs text-gray-400 mt-2">
                          Duração{recordedAudioDuration ? '' : ' aprox.'}: {String(Math.floor((recordedAudioDuration ?? recordingTime) / 60)).padStart(2, '0')}:{String(Math.floor((recordedAudioDuration ?? recordingTime) % 60)).padStart(2, '0')}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          if (recordedAudioUrl) URL.revokeObjectURL(recordedAudioUrl)
                          setRecordedAudioBlob(null)
                          setRecordedAudioUrl(null)
                        }}
                        className="text-sm text-red-600 dark:text-red-400"
                      >
                        Cancelar
                      </button>
                    </div>
                  )}
                  <div className="flex items-center bg-[#ECE5DD] dark:bg-[#0D1117] rounded-2xl px-4 py-2.5 min-h-[44px] w-full">
                    <input
                      type="text"
                      value={messageText}
                      onChange={e => setMessageText(e.target.value)}
                      placeholder={recordedAudioBlob ? 'Envio de áudio ativo. Cancele para digitar.' : 'Escreva uma mensagem...'}
                      disabled={!!recordedAudioBlob}
                      className={`flex-1 bg-transparent text-sm text-[#111827] dark:text-[#E6E6E6] placeholder-gray-400 outline-none resize-none w-full ${recordedAudioBlob ? 'opacity-70 cursor-not-allowed' : ''}`}
                    />
                  </div>
                </div>

                {recordedAudioBlob || messageText.trim() ? (
                  <button
                    type="submit"
                    disabled={isUploadingAudio}
                    className="w-11 h-11 bg-[#25D366] rounded-full flex items-center justify-center text-white hover:bg-[#075E54] transition-colors flex-shrink-0 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isUploadingAudio ? '...' : <Send size={18} />}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={startRecording}
                    className="w-11 h-11 bg-[#25D366] rounded-full flex items-center justify-center text-white hover:bg-[#075E54] transition-colors flex-shrink-0"
                  >
                    <Mic size={18} />
                  </button>
                )}
              </form>
            )}
          </div>
        </div>
      ) : (
        <div className="hidden md:flex flex-1 items-center justify-center bg-[#ECE5DD] dark:bg-[#0D1117]">
          <div className="text-center px-4">
            <div className="text-7xl mb-4">💬</div>
            <h3 className="text-xl font-bold text-[#111827] dark:text-[#E6E6E6] mb-2">
              Suas mensagens
            </h3>
            <p className="text-gray-500 dark:text-gray-400 text-sm max-w-xs">
              Selecione uma conversa para começar a trocar áudios e mensagens!
            </p>
          </div>
        </div>
      )}

      {/* New Chat Modal */}
      {showNewChat && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="w-80 bg-white dark:bg-[#1C1C1C] rounded-2xl shadow-xl overflow-hidden animate-fade-in">
            <div className="flex items-center justify-between p-4 border-b border-[#ECE5DD] dark:border-[#30363D]">
              <h3 className="font-bold text-[#111827] dark:text-[#E6E6E6]">Nova conversa</h3>
              <button onClick={() => setShowNewChat(false)} className="text-gray-400 hover:text-gray-600">✕</button>
            </div>
            <div className="max-h-80 overflow-y-auto divide-y divide-[#ECE5DD] dark:divide-[#30363D]">
              {usersLoading ? (
                Array.from({ length: 4 }).map((_, index) => (
                  <div key={index} className="p-4">
                    <div className="h-12 rounded-xl skeleton bg-[#ECE5DD] dark:bg-[#30363D]" />
                  </div>
                ))
              ) : availableUsers.length === 0 ? (
                <div className="p-4 text-sm text-gray-500 dark:text-gray-400">
                  Nenhum usuário disponível para iniciar conversa.
                </div>
              ) : (
                availableUsers.map(u => (
                  <button
                    key={u.id}
                    onClick={() => openOrCreateConversation(u)}
                    className="w-full flex items-center gap-3 p-4 hover:bg-[#ECE5DD] dark:hover:bg-[#30363D] transition-colors text-left"
                  >
                    <div className="w-10 h-10 rounded-full bg-[#25D366] flex items-center justify-center text-white font-bold text-sm">
                      {getInitials(u.full_name, u.username)}
                    </div>
                    <div>
                      <p className="font-semibold text-[#111827] dark:text-[#E6E6E6] text-sm">{u.full_name || u.username}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">@{u.username}</p>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
