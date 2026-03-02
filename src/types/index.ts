export interface User {
  id: string
  email: string
  created_at: string
}

export interface Interview {
  id: string
  user_id: string
  role: string
  level: string
  style: string
  max_rounds: number
  status: 'ongoing' | 'finished' | 'aborted' | 'ended'
  final_report?: string
  created_at: string
  updated_at: string
}

export interface InterviewRound {
  id: string
  interview_id: string
  round_num: number
  question: string
  answer?: string
  score?: number
  evaluation_detail?: string
  is_followup: boolean
  created_at: string
}

export interface StartInterviewPayload {
  role: string
  level: string
  style: string
  max_rounds: number
}
