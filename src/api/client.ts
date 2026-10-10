
export type Room = {
  id: string
  roomCode: string
  createdAt?: string
}

export type Member = {
  id: string
  username: string
  role: string
}

export type CreateRoomResponse = {
  success: true
  message: string
  token?: string
  room: Room
  member: Member
}

export type JoinRoomResponse = {
  success: true
  message: string
  token: string
  room: Room
  member: Member
}

export type TerminalSession = {
  token: string
  room: Room
  member: Member
}

export type ChatMessage = {
  id: string
  workspaceId: string
  senderId: string
  content: string
  createdAt: string
  sender: {
    id: string
    username: string
    role: string
  }
  attachments: Attachment[]
}

export type Attachment = {
  id: string
  originalName: string
  mimeType: string
  sizeBytes: number
  createdAt?: string
}

export type UploadMessageResponse = {
  success: true
  message: ChatMessage
}

type ApiErrorPayload = {
  message?: string
  errors?: Record<string, string[] | undefined>
}

const API_URL = (
  import.meta.env.VITE_API_URL || 'http://localhost:4545'
).replace(/\/$/, '')

async function request<T>(
  path: string,
  body: Record<string, string>,
): Promise<T> {
  let response: Response

  try {
    response = await fetch(`${API_URL}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
  } catch {
    throw new Error(
      'Unable to reach the server. Check your connection and try again.',
    )
  }

  let payload: ApiErrorPayload & Partial<T> = {}

  try {
    payload = await response.json()
  } catch {
    if (!response.ok) {
      throw new Error('The server returned an unexpected response.')
    }
  }

  if (!response.ok) {
    const fieldMessage = payload.errors
      ? Object.values(payload.errors).flat().find(Boolean)
      : undefined

    throw new Error(
      fieldMessage ||
        payload.message ||
        'The request could not be completed.',
    )
  }

  return payload as T
}

export function createRoom(roomCode: string, password: string) {
  return request<CreateRoomResponse>('/api/rooms', {
    roomCode,
    password,
  })
}

export function joinRoom(
  roomCode: string,
  password: string,
  displayName?: string,
) {
  const body: Record<string, string> = { roomCode, password }

  if (displayName) {
    body.displayName = displayName
  }

  return request<JoinRoomResponse>('/api/rooms/join', body)
}

export async function getMessages(
  token: string,
): Promise<ChatMessage[]> {
  let response: Response

  try {
    response = await fetch(`${API_URL}/api/messages`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })
  } catch {
    throw new Error(
      'Unable to load messages. Check your connection and try again.',
    )
  }

  let payload: {
    success?: boolean
    message?: string
    messages?: ChatMessage[]
  }

  try {
    payload = await response.json()
  } catch {
    throw new Error('The server returned an unexpected response.')
  }

  if (!response.ok || !payload.success) {
    throw new Error(
      payload.message || 'Unable to load message history.',
    )
  }

  return payload.messages ?? []
}

export async function deleteMessage(token: string, messageId: string) {
  let response: Response
  try {
    response = await fetch(`${API_URL}/api/messages/${encodeURIComponent(messageId)}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    })
  } catch {
    throw new Error('Unable to delete the message. Check your connection and try again.')
  }

  const payload = (await response.json().catch(() => ({}))) as {
    success?: boolean
    message?: string
    messageId?: string
    attachmentIds?: string[]
  }
  if (!response.ok || !payload.success || !payload.messageId) {
    throw new Error(payload.message || 'Unable to delete the message.')
  }
  return payload
}

export async function getAttachments(token: string): Promise<Attachment[]> {
  let response: Response
  try {
    response = await fetch(`${API_URL}/api/messages/attachments`, {
      headers: { Authorization: `Bearer ${token}` },
    })
  } catch {
    throw new Error('Unable to load shared files.')
  }

  const payload = (await response.json().catch(() => ({}))) as {
    success?: boolean
    message?: string
    attachments?: Attachment[]
  }
  if (!response.ok || !payload.success) {
    throw new Error(payload.message || 'Unable to load shared files.')
  }
  return payload.attachments ?? []
}

export async function uploadMessage(
  token: string,
  content: string,
  files: File[],
): Promise<ChatMessage> {
  const formData = new FormData()
  formData.append('content', content)
  files.forEach((file) => formData.append('files', file))

  let response: Response
  try {
    response = await fetch(`${API_URL}/api/messages/upload`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: formData,
    })
  } catch {
    throw new Error('Unable to upload files. Check your connection and try again.')
  }

  let payload: UploadMessageResponse | { success?: boolean; message?: string } = {}
  try {
    payload = await response.json()
  } catch {
    throw new Error('The server returned an unexpected response.')
  }

  if (!response.ok || !('message' in payload) || typeof payload.message !== 'object' || !('success' in payload)) {
    const errorMessage = 'message' in payload && typeof payload.message === 'string'
      ? payload.message
      : 'Unable to upload files.'
    throw new Error(errorMessage)
  }

  return payload.message
}

export async function downloadAttachment(token: string, attachmentId: string) {
  let response: Response
  try {
    response = await fetch(getAttachmentDownloadUrl(attachmentId), {
      headers: { Authorization: `Bearer ${token}` },
    })
  } catch {
    throw new Error('Unable to download the attachment.')
  }

  if (!response.ok) {
    let message = 'Unable to download the attachment.'
    try {
      const payload = (await response.json()) as { message?: string }
      message = payload.message || message
    } catch {
      // Keep the generic message for non-JSON download errors.
    }
    throw new Error(message)
  }

  return response.blob()
}

export function getAttachmentDownloadUrl(attachmentId: string) {
  return `${API_URL}/api/messages/attachments/${encodeURIComponent(attachmentId)}/download`
}

export function storeTerminalSession(session: TerminalSession) {
  sessionStorage.setItem('terminalSession', JSON.stringify(session))
}

export function getTerminalSession(): TerminalSession | null {
  try {
    const stored = sessionStorage.getItem('terminalSession')

    if (!stored) return null

    const parsed = JSON.parse(stored) as TerminalSession

    if (
      !parsed.token ||
      !parsed.room?.id ||
      !parsed.member?.id ||
      !parsed.member?.username
    ) {
      sessionStorage.removeItem('terminalSession')
      return null
    }

    return parsed
  } catch {
    sessionStorage.removeItem('terminalSession')
    return null
  }
}

export function clearTerminalSession() {
  sessionStorage.removeItem('terminalSession')
}


export async function leaveTerminal(token: string): Promise<void> {
  let response: Response

  try {
    response = await fetch(`${API_URL}/api/rooms/leave`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })
  } catch {
    throw new Error(
      'Unable to reach the server. Your terminal session has not been cleared.',
    )
  }

  let payload: {
    success?: boolean
    message?: string
  }

  try {
    payload = await response.json()
  } catch {
    throw new Error('The server returned an unexpected response.')
  }

  if (!response.ok || !payload.success) {
    throw new Error(payload.message || 'Unable to leave the terminal.')
  }
}
