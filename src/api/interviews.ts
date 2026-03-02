import client from './client'
import type { Interview, InterviewRound, StartInterviewPayload } from '@/types'

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

export const endInterview = (id: string) =>
  client.post<{ interview: Interview }>(`/api/v1/interviews/${id}/end`)
