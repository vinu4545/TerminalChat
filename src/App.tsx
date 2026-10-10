

import {

  useEffect,

  useRef,

  useState,

  type FormEvent,

  type KeyboardEvent,
  type ChangeEvent,

  type ReactNode,

} from 'react'

import { io, type Socket } from 'socket.io-client'

import {

  AlertCircle,

  ArrowLeft,

  ArrowRight,

  Check,

  CheckCheck,

  CircleHelp,

  Download,

  FileArchive,
  FileCode2,
  FileSpreadsheet,
  FileText,
  ImageIcon,

  Link2,

  LogOut,

  Moon,

  Paperclip,

  Plus,

  Send,

  ShieldAlert,

  Sparkles,

  Sun,

  UploadCloud,

  Users,

  X,

  Zap,

} from 'lucide-react'



import {

  Attachment,
  ChatMessage,

  clearTerminalSession,

  createRoom,
  deleteMessage,
  downloadAttachment,

  getAttachments,
  getMessages,

  getTerminalSession,

  joinRoom,
  leaveTerminal,
  uploadMessage,

  storeTerminalSession,

  TerminalSession,

} from './api/client'



type Page = 'home' | 'create' | 'join' | 'workspace'



type Toast = {

  type: 'success' | 'error'

  title: string

  message: string

}



type Message = {

  id: string

  author: string

  text: string

  time: string

  own?: boolean

  system?: boolean
  attachments: ChatMessage['attachments']

}



const API_URL = (

  import.meta.env.VITE_API_URL || 'http://localhost:4545'

).replace(/\/$/, '')



function toMessage(

  message: ChatMessage,

  currentMemberId: string,

): Message {

  return {

    id: message.id,

    author: message.sender.username,

    text: message.content,

    time: new Date(message.createdAt).toLocaleTimeString([], {

      hour: '2-digit',

      minute: '2-digit',

    }),

    own: message.senderId === currentMemberId,
    attachments: message.attachments,

  }

}



function mergeMessages(

  current: Message[],

  incoming: Message[],

): Message[] {

  const byId = new Map<string, Message>()



  for (const message of current) byId.set(message.id, message)

  for (const message of incoming) byId.set(message.id, message)



  return [...byId.values()].sort((a, b) => {

    const aTime = Date.parse(a.time)

    const bTime = Date.parse(b.time)



    // The server returns history in chronological order. The stable

    // insertion order is retained for messages with the same display time.

    return aTime - bTime

  })

}

function mergeAttachments(
  current: Attachment[],
  incoming: Attachment[],
): Attachment[] {
  const byId = new Map<string, Attachment>()
  for (const attachment of current) byId.set(attachment.id, attachment)
  for (const attachment of incoming) byId.set(attachment.id, attachment)
  return [...byId.values()].sort((a, b) =>
    (a.createdAt ?? '').localeCompare(b.createdAt ?? ''),
  )
}

function formatFileSize(sizeBytes: number) {
  if (sizeBytes < 1024) return `${sizeBytes} B`
  if (sizeBytes < 1024 * 1024) return `${(sizeBytes / 1024).toFixed(1)} KB`
  return `${(sizeBytes / (1024 * 1024)).toFixed(1)} MB`
}

function AttachmentIcon({ mimeType }: { mimeType: string }) {
  if (mimeType.startsWith('image/')) return <ImageIcon size={17} />
  if (mimeType.includes('zip') || mimeType.includes('tar') || mimeType.includes('gzip')) {
    return <FileArchive size={17} />
  }
  if (mimeType.includes('json') || mimeType.includes('xml') || mimeType.includes('yaml')) {
    return <FileCode2 size={17} />
  }
  if (mimeType.includes('sheet') || mimeType.includes('excel')) {
    return <FileSpreadsheet size={17} />
  }
  return <FileText size={17} />
}



function GlassCard({

  children,

  className = '',

}: {

  children: ReactNode

  className?: string

}) {

  return <section className={`glass-card ${className}`}>{children}</section>

}



function ThemeToggle({

  dark,

  onToggle,

}: {

  dark: boolean

  onToggle: () => void

}) {

  return (

    <button

      className="icon-button"

      onClick={onToggle}

      aria-label={dark ? 'Use light theme' : 'Use dark theme'}

      title={dark ? 'Light theme' : 'Dark theme'}

    >

      {dark ? <Sun size={18} /> : <Moon size={18} />}

    </button>

  )

}



function BrandHeader({

  page,

  dark,

  onToggle,

  onLeave,

  connected,

}: {

  page: Page

  dark: boolean

  onToggle: () => void

  onLeave?: () => void

  connected: boolean

}) {

  const workspace = page === 'workspace'



  return (

    <header className={`brand-header ${workspace ? 'workspace-header' : ''}`}>

      <div className="brand-lockup">

        <div className="brand-mark">

          <Zap size={19} fill="currentColor" />

        </div>

        <div>

          <div className="brand-name">PROSPERITY</div>

          <div className="brand-subtitle">TERMINAL WORKSPACE</div>

        </div>

      </div>



      <div className="header-actions">

        {workspace && (

          <>

            <div className="connection">

              <span

                className="status-dot"

                style={{ opacity: connected ? 1 : 0.4 }}

              />

              <span>

                {connected ? 'Connected to' : 'Connecting to'}{' '}
                <strong> {connected ? 'workspace' : 'server...'}</strong>

              </span>

            </div>

            <button
              className="button button-ghost leave-button leave-terminal-button"
              onClick={onLeave}
              aria-label="Leave terminal"
              title="Leave terminal"
            >
              <LogOut size={15} aria-hidden="true" /> Leave Terminal
            </button>

          </>

        )}

        <ThemeToggle dark={dark} onToggle={onToggle} />

      </div>

    </header>

  )

}



function ToastView({

  toast,

  onClose,

}: {

  toast: Toast

  onClose: () => void

}) {

  return (

    <div className={`toast toast-${toast.type}`} role="status">

      <div className="toast-icon">

        {toast.type === 'success' ? (

          <Check size={16} />

        ) : (

          <AlertCircle size={16} />

        )}

      </div>

      <div>

        <strong>{toast.title}</strong>

        <p>{toast.message}</p>

      </div>

      <button

        className="toast-close"

        onClick={onClose}

        aria-label="Dismiss notification"

      >

        <X size={15} />

      </button>

    </div>

  )

}



function Home({ navigate }: { navigate: (page: Page) => void }) {

  return (

    <main className="home-page page-enter">

      <div className="home-intro">

        <div className="announcement">

          <Sparkles size={14} /> A calmer way to collaborate

        </div>

        <h1>

          Welcome to the <span>Workspace</span>

        </h1>

        <p>Choose how you want to continue.</p>

      </div>



      <div className="choice-grid">

        <button className="choice-card" onClick={() => navigate('join')}>

          <div className="choice-icon">

            <Link2 size={23} />

          </div>

          <div className="choice-copy">

            <div className="micro-label">ACCESS A ROOM</div>

            <h2>Join Existing Terminal</h2>

            <p>

              Connect to a friend's workspace with the credentials they shared

              with you.

            </p>

            <div className="choice-action">

              Enter credentials <ArrowRight size={16} />

            </div>

          </div>

        </button>



        <button className="choice-card" onClick={() => navigate('create')}>

          <div className="choice-icon choice-icon-blue">

            <Plus size={23} />

          </div>

          <div className="choice-copy">

            <div className="micro-label">START A ROOM</div>

            <h2>Create New Terminal</h2>

            <p>

              Open a private workspace and invite your study group to join you.

            </p>

            <div className="choice-action">

              Set it up <ArrowRight size={16} />

            </div>

          </div>

        </button>

      </div>



      <div className="home-footer">

        <span /> Create a room <b>{'->'}</b> Share access <b>{'->'}</b>{' '}

        Collaborate <b>{'->'}</b> Upload <b>{'->'}</b> Chat <b>{'->'}</b>{' '}

        Finish <span />

      </div>

    </main>

  )

}



function FormField({

  label,

  value,

  onChange,

  type = 'text',

  placeholder,

  autoComplete,

}: {

  label: string

  value: string

  onChange: (value: string) => void

  type?: string

  placeholder: string

  autoComplete?: string

}) {

  return (

    <label className="form-field">

      <span>{label}</span>

      <input

        type={type}

        value={value}

        onChange={(event) => onChange(event.target.value)}

        placeholder={placeholder}

        autoComplete={autoComplete}

      />

    </label>

  )

}



function FormPage({

  mode,

  navigate,

  notify,

  onAuthenticated,

}: {

  mode: 'create' | 'join'

  navigate: (page: Page) => void

  notify: (toast: Toast) => void

  onAuthenticated: (session: TerminalSession) => void

}) {

  const create = mode === 'create'

  const [roomCode, setRoomCode] = useState('')

  const [password, setPassword] = useState('')

  const [confirm, setConfirm] = useState('')

  const [displayName, setDisplayName] = useState('')

  const [loading, setLoading] = useState(false)

  const [error, setError] = useState('')



  const validPassword = password.length >= 8

  const normalizedRoomCode = roomCode.trim().toUpperCase()



  const roomCodeError =

    roomCode.length > 0 &&

    (normalizedRoomCode.length < 1 || normalizedRoomCode.length > 64)

      ? 'Room code must be between 1 and 64 characters.'

      : ''



  const passwordError =

    password.length > 0 && !validPassword

      ? 'Password must be at least 8 characters.'

      : ''



  const confirmError =

    create && confirm.length > 0 && password !== confirm

      ? 'Passwords do not match.'

      : ''



  const valid = create

    ? Boolean(

        normalizedRoomCode &&

          !roomCodeError &&

          validPassword &&

          password === confirm,

      )

    : Boolean(normalizedRoomCode && password.trim())



  const submit = async (event: FormEvent<HTMLFormElement>) => {

    event.preventDefault()

    if (!valid || loading) return



    setLoading(true)

    setError('')



    try {

      let session: TerminalSession



      if (create) {

        const response = await createRoom(normalizedRoomCode, password)



        if (!response.token) {

          throw new Error(

            'Terminal created, but owner authentication is unavailable.',

          )

        }



        session = {

          token: response.token,

          room: response.room,

          member: response.member,

        }



        notify({

          type: 'success',

          title: 'Terminal created',

          message: 'Your private room is ready to share.',

        })

      } else {

        const response = await joinRoom(

          normalizedRoomCode,

          password,

          displayName.trim() || undefined,

        )



        session = {

          token: response.token,

          room: response.room,

          member: response.member,

        }



        notify({

          type: 'success',

          title: 'Connected successfully',

          message: `Welcome${response.member.username ? `, ${response.member.username}` : ''}.`,

        })

      }



      storeTerminalSession(session)

      onAuthenticated(session)

      navigate('workspace')

    } catch (submissionError) {

      setError(

        submissionError instanceof Error

          ? submissionError.message

          : 'The request could not be completed.',

      )

    } finally {

      setLoading(false)

    }

  }



  return (

    <main className="form-page page-enter">

      <button className="back-link" onClick={() => navigate('home')}>

        <ArrowLeft size={16} /> Back to home

      </button>



      <GlassCard className="form-card">

        <div className={`form-icon ${create ? 'choice-icon-blue' : ''}`}>

          {create ? <Plus size={25} /> : <Link2 size={25} />}

        </div>



        <div className="form-heading">

          <div className="micro-label">

            {create ? 'NEW PRIVATE ROOM' : 'INVITED ACCESS'}

          </div>

          <h1>{create ? 'Create New Terminal' : 'Join Existing Terminal'}</h1>

          <p>

            {create

              ? 'Choose a room code and password for your study group.'

              : 'Enter the credentials shared by the owner of the terminal.'}

          </p>

        </div>



        <form onSubmit={submit}>

          <div className="form-grid">

            <FormField

              label="Room code"

              value={roomCode}

              onChange={setRoomCode}

              placeholder="e.g. MY-ROOM-2026"

              autoComplete="off"

            />



            <FormField

              label="Terminal password"

              value={password}

              onChange={setPassword}

              type="password"

              placeholder="Enter password"

              autoComplete={create ? 'new-password' : 'current-password'}

            />



            {create ? (

              <FormField

                label="Confirm password"

                value={confirm}

                onChange={setConfirm}

                type="password"

                placeholder="Repeat password"

                autoComplete="new-password"

              />

            ) : (

              <FormField

                label="Your display name (optional)"

                value={displayName}

                onChange={setDisplayName}

                placeholder="How should others see you?"

              />

            )}

          </div>



          {roomCodeError && (

            <div className="field-error">

              <AlertCircle size={15} /> {roomCodeError}

            </div>

          )}



          {create && passwordError && (

            <div className="field-error">

              <AlertCircle size={15} /> {passwordError}

            </div>

          )}



          {create && confirmError && (

            <div className="field-error">

              <AlertCircle size={15} /> {confirmError}

            </div>

          )}



          {error && (

            <div className="field-error" role="alert">

              <AlertCircle size={15} /> {error}

            </div>

          )}



          {!create && (

            <div className="form-hint">

              <CircleHelp size={15} /> Enter the room code shared by the owner.

              It is normalized to uppercase.

            </div>

          )}



          <button

            className="button button-primary submit-button"

            disabled={!valid || loading}

          >

            {loading ? (

              <>

                <span className="spinner" />{' '}

                {create ? 'Creating terminal...' : 'Verifying credentials...'}

              </>

            ) : (

              <>

                {create ? 'Create terminal' : 'Connect to terminal'}{' '}

                <ArrowRight size={17} />

              </>

            )}

          </button>

        </form>



        {create && (

          <div className="form-note">

            Your room stays private. Share the room code and terminal password

            only with people you trust.

          </div>

        )}



        {!create && (

          <button

            className="alternate-action"

            onClick={() => navigate('create')}

          >

            Need your own room? <strong>Create a new terminal</strong>

          </button>

        )}

      </GlassCard>

    </main>

  )

}



function MessageBubble({
  message,
  onDownload,
  onDelete,
  deleting,
}: {
  message: Message
  onDownload: (attachment: ChatMessage['attachments'][number]) => void
  onDelete: (messageId: string) => void
  deleting: boolean
}) {

  if (message.system) {

    return (

      <div className="system-message">

        <span />

        {message.text}

        <span />

      </div>

    )

  }



  return (

    <div className={`message-row ${message.own ? 'own' : ''}`}>

      <div className="message-bubble">

        <div className="message-meta">

          <strong>{message.author}</strong>

          <span>{message.time}</span>

        </div>

        <p>{message.text}</p>

        {message.attachments.length > 0 && (
          <div className="message-attachments">
            {message.attachments.map((attachment) => (
              <button
                className="attachment-link"
                key={attachment.id}
                onClick={() => onDownload(attachment)}
                type="button"
              >
                <Download size={13} /> {attachment.originalName}
              </button>
            ))}
          </div>
        )}

        {message.own && <CheckCheck size={14} className="read-mark" />}

        {message.own && (
          <button
            className="message-delete-button"
            onClick={() => onDelete(message.id)}
            disabled={deleting}
            aria-label={deleting ? 'Deleting message' : 'Delete message'}
            title={deleting ? 'Deleting message' : 'Delete message'}
            type="button"
          >
            {deleting ? <span className="mini-spinner" /> : <X size={13} />}
          </button>
        )}

      </div>

    </div>

  )

}



type ServerAck =

  | { success: true; message: ChatMessage }

  | { success: false; message?: string }



type OnlineMember = {

  memberId: string

  username: string

  role: string

}



function Workspace({
  navigate,
  notify,
  session,
  onLeave,
}: {
  navigate: (page: Page) => void
  notify: (toast: Toast) => void
  session: TerminalSession
  onLeave: () => void
}) {

  const [messages, setMessages] = useState<Message[]>([])
    const [sharedFiles, setSharedFiles] = useState<Attachment[]>([])

  const [draft, setDraft] = useState('')

  const [sending, setSending] = useState(false)
  const [deletingMessageId, setDeletingMessageId] = useState<string | null>(null)

  const [selectedFiles, setSelectedFiles] = useState<File[]>([])

  const [connected, setConnected] = useState(false)

  const [historyLoading, setHistoryLoading] = useState(true)

  const [historyError, setHistoryError] = useState('')

  const [onlineMembers, setOnlineMembers] = useState<OnlineMember[]>([])

  const socketRef = useRef<Socket | null>(null)

  const messagesEndRef = useRef<HTMLDivElement | null>(null)

  const fileInputRef = useRef<HTMLInputElement | null>(null)



  useEffect(() => {

    let active = true



    const socket = io(API_URL, {

      auth: { token: session.token },

      transports: ['websocket', 'polling'],

      reconnection: true,

      reconnectionAttempts: 5,

      timeout: 10000,

    })



    socketRef.current = socket



    socket.on('connect', () => {

      if (!active) return

      setConnected(true)

      setHistoryError('')


      // Load history after connecting so live events can be received while

      // history is being fetched. Message IDs prevent duplicates.

      void getMessages(session.token)

        .then((history) => {

          if (!active) return

          const loaded = history.map((item) =>

            toMessage(item, session.member.id),

          )

          setMessages((current) => {

            const byId = new Map<string, Message>()

            for (const message of loaded) byId.set(message.id, message)

            for (const message of current) byId.set(message.id, message)

            return [...byId.values()]

          })

          setSharedFiles((current) =>
            mergeAttachments(current, loaded.flatMap((message) => message.attachments)),
          )

          setHistoryLoading(false)

        })

        .catch((error: unknown) => {

          if (!active) return

          setHistoryLoading(false)

          setHistoryError(

            error instanceof Error

              ? error.message

              : 'Could not load message history.',

          )

        })

    })

    void getAttachments(session.token)
      .then((attachments) => {
        if (active) setSharedFiles(attachments)
      })
      .catch((error: unknown) => {
        if (active) {
          notify({
            type: 'error',
            title: 'Shared files unavailable',
            message: error instanceof Error ? error.message : 'Unable to load shared files.',
          })
        }
      })

    socket.on('presence:list', (payload: { members?: OnlineMember[] }) => {

      if (!active || !Array.isArray(payload?.members)) return

      setOnlineMembers(payload.members)

    })



    socket.on(

      'presence:changed',

      (change: OnlineMember & { status: 'online' | 'offline' }) => {

        if (!active || !change?.memberId) return



        setOnlineMembers((current) => {

          if (change.status === 'online') {

            const existing = current.some(

              (member) => member.memberId === change.memberId,

            )

            if (existing) return current

            return [

              ...current,

              {

                memberId: change.memberId,

                username: change.username,

                role: change.role,

              },

            ]

          }

          return current.filter((member) => member.memberId !== change.memberId)

        })

      },

    )



    socket.on('disconnect', () => {

      if (active) {

        setConnected(false)

        setOnlineMembers([])

      }

    })



    socket.on('connect_error', (error) => {

      if (!active) return

      setConnected(false)

      setOnlineMembers([])

      setHistoryLoading(false)

      setHistoryError(error.message || 'Unable to connect to the chat server.')

    })



    socket.on('message:new', (message: ChatMessage) => {

      if (!active || !message?.id || !message.sender) return



      const incoming = toMessage(message, session.member.id)

      setMessages((current) => {

        if (current.some((item) => item.id === incoming.id)) return current

        return [...current, incoming]

      })

      setSharedFiles((current) => mergeAttachments(current, incoming.attachments))

    })

    socket.on(
      'message:deleted',
      (payload: { messageId?: string; attachmentIds?: string[] }) => {
        if (!active || !payload?.messageId) return
        setMessages((current) => current.filter((item) => item.id !== payload.messageId))
        const attachmentIds = new Set(payload.attachmentIds ?? [])
        setSharedFiles((current) => current.filter((file) => !attachmentIds.has(file.id)))
      },
    )



    return () => {

      active = false

      socket.removeAllListeners()

      socket.disconnect()

      socketRef.current = null

    }

  }, [session.token, session.member.id])



  useEffect(() => {

    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })

  }, [messages])



  const send = async () => {

    const content = draft.trim()

    const socket = socketRef.current



    if ((!content && selectedFiles.length === 0) || sending) return

    if (selectedFiles.length > 0) {

      if (!connected) {

        notify({

          type: 'error',

          title: 'Not connected',

          message: 'Wait for the chat connection to return, then try again.',

        })

        return

      }



      setSending(true)

      try {

        const saved = toMessage(

          await uploadMessage(session.token, content, selectedFiles),

          session.member.id,

        )

        setMessages((current) =>

          current.some((item) => item.id === saved.id)

            ? current

            : [...current, saved],

        )

        setDraft('')

        setSelectedFiles([])

        setSharedFiles((current) => mergeAttachments(current, saved.attachments))

        notify({

          type: 'success',

          title: 'Attachment sent',

          message: 'Your file was shared with the terminal.',

        })

      } catch (error) {

        notify({

          type: 'error',

          title: 'Upload failed',

          message: error instanceof Error ? error.message : 'Unable to upload files.',

        })

      } finally {

        setSending(false)

      }

      return

    }



    if (!socket?.connected) {

      notify({

        type: 'error',

        title: 'Not connected',

        message: 'Wait for the chat connection to return, then try again.',

      })

      return

    }



    setSending(true)



    socket.timeout(10000).emit(

      'message:send',

      { content },

      (timeoutError: Error | null, ack?: ServerAck) => {

        setSending(false)



        if (timeoutError) {

          notify({

            type: 'error',

            title: 'Message timed out',

            message: 'The server did not confirm your message. Check history before retrying.',

          })

          return

        }



        if (!ack?.success) {

          notify({

            type: 'error',

            title: 'Message not sent',

            message:

              (ack && 'message' in ack && ack.message) ||

              'The server rejected the message.',

          })

          return

        }



        const saved = toMessage(ack.message, session.member.id)



        setMessages((current) => {

          if (current.some((item) => item.id === saved.id)) return current

          return [...current, saved]

        })

        setDraft('')

      },

    )

  }



  const chooseFiles = (event: ChangeEvent<HTMLInputElement>) => {

    const files = Array.from(event.target.files ?? [])

    if (files.length === 0) return

    setSelectedFiles(files.slice(0, 5))

    event.target.value = ''

  }

  const downloadFile = async (
    attachment: ChatMessage['attachments'][number],
  ) => {
    try {
      const blob = await downloadAttachment(session.token, attachment.id)
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = attachment.originalName
      link.click()
      URL.revokeObjectURL(url)
    } catch (error) {
      notify({
        type: 'error',
        title: 'Download failed',
        message: error instanceof Error ? error.message : 'Unable to download the attachment.',
      })
    }
  }

  const deleteOwnMessage = async (messageId: string) => {
    if (deletingMessageId) return
    if (!window.confirm('Delete this message for everyone in the room?')) return

    setDeletingMessageId(messageId)
    try {
      const deleted = await deleteMessage(session.token, messageId)
      setMessages((current) => current.filter((item) => item.id !== deleted.messageId))
      const attachmentIds = new Set(deleted.attachmentIds ?? [])
      setSharedFiles((current) => current.filter((file) => !attachmentIds.has(file.id)))
      notify({ type: 'success', title: 'Message deleted', message: 'The message was removed from the room.' })
    } catch (error) {
      notify({
        type: 'error',
        title: 'Could not delete message',
        message: error instanceof Error ? error.message : 'Please try again.',
      })
    } finally {
      setDeletingMessageId(null)
    }
  }



  const keyDown = (event: KeyboardEvent<HTMLInputElement>) => {

    if (event.key === 'Enter' && !event.shiftKey) {

      event.preventDefault()

      send()

    }

  }



  return (

    <main className="workspace-page page-enter">

      <div className="workspace-welcome">

        <div>

          <div className="micro-label">PRIVATE COLLABORATION ROOM</div>

          <h1>{session.room.roomCode}</h1>

        </div>

        <div className="workspace-caption">

          A shared place to think clearly.

        </div>

      </div>



      <button className="workspace-leave" onClick={onLeave} type="button">
        <LogOut size={15} /> Leave Focus Room
      </button>

      <div className="workspace-grid">

        <GlassCard className="chat-panel">

          <div className="panel-heading">

            <div>

              <div className="micro-label">SHARED CHAT</div>

              <h2>Room conversation</h2>

            </div>

            <span className="message-count">{messages.length} messages</span>

          </div>



          <div className="messages">

            {historyLoading && messages.length === 0 && (

              <div className="system-message">

                <span />

                Loading message history...

                <span />

              </div>

            )}



            {historyError && (

              <div className="field-error" role="alert">

                <AlertCircle size={15} /> {historyError}

              </div>

            )}



            {!historyLoading && !historyError && messages.length === 0 && (

              <div className="system-message">

                <span />

                You're connected. Send the first message.

                <span />

              </div>

            )}



            {messages.map((message) => (

              <MessageBubble
                message={message}
                key={message.id}
                onDownload={downloadFile}
                onDelete={deleteOwnMessage}
                deleting={deletingMessageId === message.id}
              />

            ))}



            <div ref={messagesEndRef} />

          </div>



          <div className="composer">

            <button

              className={`icon-button composer-action ${selectedFiles.length > 0 ? 'active' : ''}`}

              onClick={() => fileInputRef.current?.click()}

              aria-label="Attach a file"

              title="Attach files"

            >

              <Paperclip size={18} />

            </button>

            <input
              ref={fileInputRef}
              type="file"
              className="visually-hidden"
              accept=".jpg,.jpeg,.png,.gif,.webp,.svg,.pdf,.txt,.csv,.md,.json,.xml,.yaml,.yml,.log,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.zip,.tar,.gz,.rar,.c,.h,.cpp,.cc,.cxx,.hpp,.hh,.hxx,.java,.py,.pyw,.js,.jsx,.ts,.tsx,.mjs,.cjs,.html,.htm,.css,.scss,.sh,.bash,.ps1,.bat,.cmd,.sql,.r,.go,.rs,.php,.rb,.swift,.kt,.kts,.dart,.vue,.svelte,.graphql,.proto,.toml,.ini,.conf,.env.example,.gitignore,Dockerfile,Makefile"
              multiple
              onChange={chooseFiles}
              aria-label="Choose files to attach"
            />



            <input

              value={draft}

              onChange={(event) => setDraft(event.target.value)}

              onKeyDown={keyDown}

              placeholder="Share a message, note or practical data..."

              aria-label="Message"

              maxLength={5000}

              disabled={!connected}

            />



            <button

              className="send-button"

              onClick={send}

              disabled={(!draft.trim() && selectedFiles.length === 0) || sending || !connected}

              aria-label="Send message"

              title="Send message"

            >

              {sending ? (

                <span className="spinner spinner-dark" />

              ) : (

                <Send size={17} />

              )}

            </button>

          </div>



          {selectedFiles.length > 0 && (

            <div className="attachment-chip">

              <FileText size={14} />

              {selectedFiles.map((file) => file.name).join(', ')}

              <button

                onClick={() => setSelectedFiles([])}

                aria-label="Remove attachment"

              >

                <X size={13} />

              </button>

            </div>

          )}

        </GlassCard>



        <aside className="sidebar">

          <GlassCard className="side-panel">

            <div className="panel-heading compact">

              <div className="side-title">

                <Users size={17} />

                <div className="micro-label">CONNECTED USERS</div>

              </div>

              <span className="online-count">

                {connected

                  ? `${onlineMembers.length} online`

                  : 'Offline'}

              </span>

            </div>



            <div className="member-list">

              {onlineMembers.map((member) => (

                <div className="member" key={member.memberId}>

                  <div className="avatar">

                    {member.username.slice(0, 2).toUpperCase()}

                  </div>

                  <div className="member-name">

                    <strong>{member.username}</strong>

                    {member.role === 'OWNER' && (

                      <span className="owner-badge">OWNER</span>

                    )}

                  </div>

                  <span className="member-status online">Online</span>

                </div>

              ))}

              {connected && onlineMembers.length === 0 && (

                <p className="form-hint">Waiting for workspace members...</p>

              )}

            </div>

          </GlassCard>



          <GlassCard className="side-panel files-panel">

            <div className="panel-heading compact">

              <div className="side-title">

                <FileText size={17} />

                <div className="micro-label">SHARED FILES</div>

              </div>

              <button

                className="mini-icon"

                aria-label="Upload a file"

                title="Attach files"

                onClick={() => fileInputRef.current?.click()}

              >

                <UploadCloud size={15} />

              </button>

            </div>



            <div className="shared-file-list">
              {sharedFiles.length === 0 ? (
                <div className="file-row">
                  <div className="file-icon"><FileText size={17} /></div>
                  <div className="file-info">
                    <strong>No files yet</strong>
                    <span>Attach a file to share it here</span>
                  </div>
                </div>
              ) : (
                sharedFiles.map((file) => (
                  <div className="file-row" key={file.id}>
                    <div className="file-icon"><AttachmentIcon mimeType={file.mimeType} /></div>
                    <div className="file-info">
                      <strong title={file.originalName}>{file.originalName}</strong>
                      <span>{formatFileSize(file.sizeBytes)}</span>
                    </div>
                    <button
                      className="mini-icon"
                      onClick={() => void downloadFile(file)}
                      aria-label={`Download ${file.originalName}`}
                      title={`Download ${file.originalName}`}
                    >
                      <Download size={15} />
                    </button>
                  </div>
                ))
              )}
            </div>

          </GlassCard>



          <GlassCard className="side-panel credential-panel">

            <div className="credential-mark">

              <ShieldAlert size={16} />

            </div>

            <div>

              <div className="micro-label">INVITE SOMEONE</div>

              <p>

                Share the room code and terminal password with people you

                trust. Anyone with access can see this room.

              </p>

              <p>

                Room code: <strong>{session.room.roomCode}</strong>

              </p>

            </div>

          </GlassCard>

        </aside>

      </div>



    </main>

  )

}



export default function App() {

  const [page, setPage] = useState<Page>('home')

  const [dark, setDark] = useState(false)

  const [toast, setToast] = useState<Toast | null>(null)

  const [session, setSession] = useState<TerminalSession | null>(null)

  const [connected, setConnected] = useState(false)
  const [leaving, setLeaving] = useState(false)

  const navigate = (next: Page) => setPage(next)

  const leave = async () => {
    if (leaving) return
    if (!window.confirm('Leave this Focus Room?')) return

    if (!session) {
      clearTerminalSession()
      setConnected(false)
      navigate('home')
      return
    }

    setLeaving(true)

    try {
      await leaveTerminal(session.token)
      clearTerminalSession()
      setSession(null)
      setConnected(false)
      navigate('home')
      setToast({
        type: 'success',
        title: 'Left terminal',
        message: 'Your display name is now available to use again.',
      })
    } catch (error) {
      setToast({
        type: 'error',
        title: 'Could not leave terminal',
        message:
          error instanceof Error ? error.message : 'Please try again.',
      })
    } finally {
      setLeaving(false)
    }
  }



  const notify = (next: Toast) => setToast(next)



  useEffect(() => {

    const stored = getTerminalSession()

    if (stored) {

      setSession(stored)

      setPage('workspace')

    }

  }, [])



  return (

    <div className={dark ? 'app dark' : 'app'}>

      <div className="ambient ambient-one" />

      <div className="ambient ambient-two" />



      <div className="app-shell">

        <BrandHeader

          page={page}

          dark={dark}

          onToggle={() => setDark(!dark)}

          onLeave={leave}

          connected={connected}

        />



        {page === 'home' && <Home navigate={navigate} />}



        {(page === 'create' || page === 'join') && (

          <FormPage

            mode={page}

            navigate={navigate}

            notify={notify}

            onAuthenticated={setSession}

          />

        )}



        {page === 'workspace' && session && (
  <Workspace
    navigate={navigate}
    notify={notify}
    session={session}
    onLeave={leave}
  />
)}

      </div>



      {toast && <ToastView toast={toast} onClose={() => setToast(null)} />}

    </div>

  )

}
