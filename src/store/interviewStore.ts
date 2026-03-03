import { create } from 'zustand'
import type { Interview, InterviewRound, StartInterviewPayload } from '@/types'
import * as api from '@/api/interviews'

interface InterviewState {
  list: Interview[]
  current: Interview | null
  rounds: InterviewRound[]
  loading: boolean
  error: string | null

  fetchList: () => Promise<void>
  startInterview: (payload: StartInterviewPayload) => Promise<Interview>
  fetchInterview: (id: string) => Promise<void>
  submitAnswer: (id: string, answer: string) => Promise<{ finished: boolean }>
  reset: () => void
}

export const useInterviewStore = create<InterviewState>()((set) => ({
  list: [],
  current: null,
  rounds: [],
  loading: false,
  error: null,

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
        // Patch the last round with the answer + eval returned by the backend
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

  reset: () =>
    set({ current: null, rounds: [], error: null }),
}))
