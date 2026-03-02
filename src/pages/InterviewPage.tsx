import { useEffect, useState, useRef, type FormEvent } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import ReactMarkdown from 'react-markdown'
import { useInterviewStore } from '@/store/interviewStore'
import ReportModal from '@/components/ReportModal'
import styles from './InterviewPage.module.scss'

// EvalBlock renders the per-answer evaluation panel.
// The backend guarantees score and detail are always separate clean fields.
function EvalBlock({ score, detail }: { score: number | undefined | null; detail: string | undefined }) {
  if (!detail && (score === undefined || score === null)) return null

  return (
    <div className={styles.evalBlock}>
      {detail && (
        <div className={styles.evalMd}>
          <ReactMarkdown>{detail}</ReactMarkdown>
        </div>
      )}
    </div>
  )
}

export default function InterviewPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { current, rounds, loading, fetchInterview, submitAnswer, reset } =
    useInterviewStore()
  const [answer, setAnswer] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [showReport, setShowReport] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (id) fetchInterview(id)
    return () => { reset() }
  }, [id, fetchInterview, reset])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [rounds])

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!id || !answer.trim()) return
    setSubmitting(true)
    try {
      const { finished } = await submitAnswer(id, answer.trim())
      setAnswer('')
      if (finished) {
        await fetchInterview(id)
      }
    } finally {
      setSubmitting(false)
    }
  }

  if (loading && !current) return <div className="spinner" />

  if (!current) return null

  const isFinished = current.status === 'finished'

  // Build display labels: main questions get Q1, Q2…; followups get Q1 追问, Q1 追问2…
  let mainCount = 0
  let followupCount = 0
  const roundLabels = rounds.map(r => {
    if (!r.is_followup) {
      mainCount++
      followupCount = 0
      return `Q${mainCount}`
    } else {
      followupCount++
      return `Q${mainCount} 追问${followupCount > 1 ? followupCount : ''}`
    }
  })

  return (
    <div className={styles.page}>
      {showReport && current.final_report && (
        <ReportModal
          report={current.final_report}
          role={current.role}
          onClose={() => setShowReport(false)}
        />
      )}
      <div className={styles.sidebar}>
        <button className={styles.backBtn} onClick={() => navigate('/')}>← 返回</button>
        <div className={styles.meta}>
          <div className={styles.metaItem}>
            <span className={styles.metaLabel}>岗位</span>
            <span>{current.role}</span>
          </div>
          <div className={styles.metaItem}>
            <span className={styles.metaLabel}>级别</span>
            <span>{current.level}</span>
          </div>
          <div className={styles.metaItem}>
            <span className={styles.metaLabel}>风格</span>
            <span>{current.style}</span>
          </div>
          <div className={styles.metaItem}>
            <span className={styles.metaLabel}>轮次</span>
            <span>
              {rounds.filter(r => !r.is_followup && r.answer).length}
              {' '}/ {current.max_rounds}
              {rounds.some(r => r.is_followup) && (
                <span className={styles.followupBadge}>
                  +{rounds.filter(r => r.is_followup).length}追问
                </span>
              )}
            </span>
          </div>
          <div className={styles.metaItem}>
            <span className={styles.metaLabel}>状态</span>
            <span className={isFinished ? styles.done : styles.ongoing}>
              {isFinished ? '已完成' : '进行中'}
            </span>
          </div>
          {isFinished && current.final_report && (
            <button className={styles.reportBtn} onClick={() => setShowReport(true)}>
              📋 查看报告
            </button>
          )}
        </div>

        {rounds.length > 0 && (
          <div className={styles.roundList}>
            <p className={styles.roundListTitle}>历史问题</p>
            {rounds.map((r, i) => (
              <div key={r.id} className={styles.roundItem + (r.is_followup ? ' ' + styles.roundItemFollowup : '')}>
                <span className={styles.roundNum}>{roundLabels[i]}</span>
                {r.score !== undefined && r.score !== null && (
                  <span className={styles.score}>{r.score}</span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className={styles.main}>
        <div className={styles.chatArea}>
          {rounds.map((r, i) => (
            <div key={r.id} className={styles.roundWrapper}>
              <div className={styles.bubble + ' ' + (r.is_followup ? styles.aiFollowup : styles.ai)}>
                <span className={styles.bubbleLabel}>面试官 {roundLabels[i]}</span>
                <div className={styles.md}><ReactMarkdown>{r.question}</ReactMarkdown></div>
              </div>
              {r.answer && (
                <div className={styles.bubble + ' ' + styles.user}>
                  <span className={styles.bubbleLabel}>你</span>
                  <div className={styles.md}><ReactMarkdown>{r.answer}</ReactMarkdown></div>
                  <EvalBlock score={r.score} detail={r.evaluation_detail} />
                </div>
              )}
            </div>
          ))}

          {isFinished && (
            <div className={styles.finishedBanner}>
              面试已结束，点击左侧「查看报告」查看完整评估
            </div>
          )}

          <div ref={bottomRef} />
        </div>

        {!isFinished && (
          <form className={styles.inputArea} onSubmit={handleSubmit}>
            <textarea
              className={styles.textarea}
              placeholder="输入你的回答..."
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              rows={4}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleSubmit(e as unknown as FormEvent)
              }}
            />
            <div className={styles.inputActions}>
              <span className={styles.hint}>Cmd+Enter 提交</span>
              <button type="submit" disabled={submitting || !answer.trim()}>
                {submitting ? '提交中...' : '提交回答 →'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
