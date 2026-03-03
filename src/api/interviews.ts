import client from './client'
import type { Interview, InterviewRound, StartInterviewPayload } from '@/types'

const apiBase = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8080'

export const startInterview = (payload: StartInterviewPayload) =>
  client.post<{ interview: Interview; current_question: InterviewRound }>(
    '/api/v1/interviews',
    payload,
  )

export const listInterviews = () =>
  client.get<{ interviews: Interview[] }>('/api/v1/interviews')

export const getInterview = (id: string) =>
  client.get<{ interview: Interview; rounds: InterviewRound[] }>(
    `/api/v1/interviews/${id}`,
  )

export const submitAnswer = (id: string, answer: string) =>
  client.post<{
    interview: Interview
    finished: boolean
    answered_round: InterviewRound
    next_question?: InterviewRound
    final_report?: string
  }>(`/api/v1/interviews/${id}/answer`, { answer })

// ── Stream-start types ────────────────────────────────────────────────────────

export interface StartCreatedEvent {
  type: 'created'
  interview: Interview
}

export interface StartDoneEvent {
  type: 'done'
  round: InterviewRound
}

/**
 * Starts an interview via SSE. Emits a 'created' event as soon as the DB row
 * is saved (client can navigate then), streams LLM tokens, then emits 'done'
 * with the first round once it's persisted.
 */
export async function startInterviewStream(
  payload: StartInterviewPayload,
  onCreated: (data: StartCreatedEvent) => void,
  onToken: (token: string) => void,
  onDone: (data: StartDoneEvent) => void,
  onError: (msg: string) => void,
): Promise<void> {
  const token = localStorage.getItem('token')
  const resp = await fetch(`${apiBase}/api/v1/interviews/stream`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(payload),
  })

  if (!resp.ok) {
    const data = await resp.json().catch(() => ({}))
    onError((data as { error?: string }).error ?? `HTTP ${resp.status}`)
    return
  }

  const reader = resp.body!.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() ?? ''

    for (const line of lines) {
      if (!line.startsWith('data: ')) continue
      try {
        const data = JSON.parse(line.slice(6))
        if (data.type === 'created') onCreated(data as StartCreatedEvent)
        else if (data.type === 'token') onToken(data.content ?? '')
        else if (data.type === 'done') onDone(data as StartDoneEvent)
        else if (data.type === 'error') onError(data.message ?? 'unknown error')
      } catch { /* skip malformed events */ }
    }
  }
}

// ── Submit-answer types ───────────────────────────────────────────────────────

export interface SavedEvent {
  type: 'saved'
  interview: Interview
  finished: boolean
  answered_round: InterviewRound
  next_question?: InterviewRound
  final_report?: string
}

/**
 * Submits an answer using the streaming SSE endpoint.
 * Calls onToken for each streamed LLM token, onSaved when DB write is done.
 */
export async function submitAnswerStream(
  id: string,
  answer: string,
  onToken: (token: string) => void,
  onSaved: (data: SavedEvent) => void,
  onError: (msg: string) => void,
): Promise<void> {
  const token = localStorage.getItem('token')
  const resp = await fetch(`${apiBase}/api/v1/interviews/${id}/answer/stream`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ answer }),
  })

  if (!resp.ok) {
    const data = await resp.json().catch(() => ({}))
    onError((data as { error?: string }).error ?? `HTTP ${resp.status}`)
    return
  }

  const reader = resp.body!.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() ?? ''

    for (const line of lines) {
      if (!line.startsWith('data: ')) continue
      try {
        const data = JSON.parse(line.slice(6)) as { type: string; content?: string; message?: string }
        if (data.type === 'token') onToken(data.content ?? '')
        else if (data.type === 'saved') onSaved(data as unknown as SavedEvent)
        else if (data.type === 'error') onError(data.message ?? 'unknown error')
      } catch { /* skip malformed events */ }
    }
  }
}
