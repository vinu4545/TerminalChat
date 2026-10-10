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

type ApiErrorPayload = {
  message?: string
  errors?: Record<string, string[] | undefined>
}

const API_URL = (import.meta.env.VITE_API_URL || 'http://localhost:4545').replace(/\/$/, '')

async function request<T>(path: string, body: Record<string, string>): Promise<T> {
  let response: Response

  try {
    response = await fetch(`${API_URL}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
  } catch {
    throw new Error('Unable to reach the server. Check your connection and try again.')
  }

  let payload: ApiErrorPayload & Partial<T> = {}
  try {
    payload = await response.json()
  } catch {
    if (!response.ok) throw new Error('The server returned an unexpected response.')
  }

  if (!response.ok) {
    const fieldMessage = payload.errors
      ? Object.values(payload.errors).flat().find(Boolean)
      : undefined
    throw new Error(fieldMessage || payload.message || 'The request could not be completed.')
  }

  return payload as T
}

export function createRoom(roomCode: string, password: string) {
  return request<CreateRoomResponse>('/api/rooms', { roomCode, password })
}

export function joinRoom(roomCode: string, password: string, displayName?: string) {
  const body: Record<string, string> = { roomCode, password }
  if (displayName) body.displayName = displayName
  return request<JoinRoomResponse>('/api/rooms/join', body)
}

export function storeTerminalSession(session: TerminalSession) {
  sessionStorage.setItem('terminalSession', JSON.stringify(session))
}

export function clearTerminalSession() {
  sessionStorage.removeItem('terminalSession')
}