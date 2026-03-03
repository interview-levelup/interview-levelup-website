import { create } from 'zustand'
import type { Interview, InterviewRound, StartInterviewPayload } from '@/types'
import * as api from '@/api/interviews'

interface InterviewState {
  list: Interview[]
  current: Interview | null
  rounds: InterviewRound[]
  loading: boolean
  error: string | null
  /** Incrementally built question text during SSE streaming */
  streamingQuestion: string | null
  /** True while an SSE answer stream is in progress */
  isStreaming: boolean

  fetchList: () => Promise<void>
  startInterview: (payload: StartInterviewPayload) => Promise<Interview>
  startInterviewStream: (
    payload: StartInterviewPayload,
    onCreated: (id: string) => void,
  ) => Promise<void>
  fetchInterview: (id: string) => Promise<void>
  submitAnswer: (id: string, answer: string) => Promise<{ finished: boolean }>
  submitAnswerStream: (
    id: string,
    answer: string,
    onToken?: (token: string) => void,
  ) => Promise<{ finished: boolean }>
  reset: () => void
}

export const useInterviewStore = create<InterviewState>()((set) => ({
  list: [],
  current: null,
  rounds: [],
  loading: false,
  error: null,
  streamingQuestion: null,
  isStreaming: false,

  fetchList: async () => {
    set({ loading: true, error: null })
    try {
      const { data } = await api.listInterviews()
      set({ list: data.interviews ?? [] })
    } catch (e: unknown) {
      set({ error: (e as Error).message })
    } finally {
      set({ loading: false })
    }
  },

  startInterview: async (payload) => {
    set({ current: null, rounds: [], error: null, streamingQuestion: null, isStreaming: false })
    set({ loading: true, error: null })
    try {
      const { data } = await api.startInterview(payload)
      const firstRound: InterviewRound | null = data.current_question ?? null
      set({ current: data.interview, rounds: firstRound ? [firstRound] : [] })
      return data.interview
    } catch (e: unknown) {
      set({ error: (e as Error).message })
      throw e
    } finally {
      set({ loading: false })
    }
  },

  startInterviewStream: async (payload, onCreated) => {
    // Clear any stale state from a previous interview before starting.
    set({ current: null, rounds: [], error: null, streamingQuestion: null, isStreaming: false })
    set({ isStreaming: true, streamingQuestion: '', error: null })
    try {
      await api.startInterviewStream(
        payload,
        (evt) => {
          set({ current: evt.interview, rounds: [] })
          onCreated(evt.interview.id)
        },
        (token) => {
          set((state) => ({ streamingQuestion: (state.streamingQuestion ?? '') + token }))
        },
        (evt) => {
          set({ rounds: [evt.round], isStreaming: false, streamingQuestion: null })
        },
        (msg) => {
          set({ error: msg, isStreaming: false, streamingQuestion: null })
        },
      )
    } catch (e: unknown) {
      set({ error: (e as Error).message, isStreaming: false, streamingQuestion: null })
      throw e
    }
  },

  fetchInterview: async (id) => {
    set({ loading: true, error: null })
    try {
      const { data } = await api.getInterview(id)
      set({ current: data.interview, rounds: data.rounds ?? [] })
    } catch (e: unknown) {
      set({ error: (e as Error).message })
    } finally {
      set({ loading: false })
    }
  },

  submitAnswer: async (id, answer) => {
    set({ loading: true, error: null })
    try {
      const { data } = await api.submitAnswer(id, answer)
      set((state) => {
        const updatedRounds = state.rounds.map((r) =>
          r.id === data.answered_round?.id ? { ...r, ...data.answered_round } : r
        )
        return {
          current: data.interview,
          rounds: data.finished
            ? updatedRounds
            : data.next_question
              ? [...updatedRounds, data.next_question]
              : updatedRounds,
        }
      })
      return { finished: data.finished }
    } catch (e: unknown) {
      set({ error: (e as Error).message })
      throw e
    } finally {
      set({ loading: false })
    }
  },

  submitAnswerStream: async (id, answer, onToken) => {
    set({ isStreaming: true, streamingQuestion: '', error: null })
    let finished = false
    try {
      await api.submitAnswerStream(
        id,
        answer,
        (token) => {
          // Append token to streaming preview
          set((state) => ({ streamingQuestion: (state.streamingQuestion ?? '') + token }))
          onToken?.(token)
        },
        (saved) => {
          finished = saved.finished
          set((state) => {
            const updatedRounds = state.rounds.map((r) =>
              r.id === saved.answered_round?.id ? { ...r, ...saved.answered_round } : r
            )
            return {
              current: saved.interview,
              streamingQuestion: null,
              isStreaming: false,
              rounds: saved.finished
                ? updatedRounds
                : saved.next_question
                  ? [...updatedRounds, saved.next_question]
                  : updatedRounds,
            }
          })
        },
        (msg) => {
          set({ error: msg, isStreaming: false, streamingQuestion: null })
        },
      )
    } catch (e: unknown) {
      set({ error: (e as Error).message, isStreaming: false, streamingQuestion: null })
      throw e
    }
    return { finished }
  },

  reset: () =>
    set({ current: null, rounds: [], error: null, streamingQuestion: null, isStreaming: false }),
}))
