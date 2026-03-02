import { useEffect, useState, useRef, useCallback, type FormEvent } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import ReactMarkdown from 'react-markdown'
import { useInterviewStore } from '@/store/interviewStore'
import ReportModal from '@/components/ReportModal'
import styles from './InterviewPage.module.scss'

// Parse evaluation_detail which may be a plain string or JSON {score, details}
function parseEval(raw: string | undefined): { score: number | null; detail: string } {
  if (!raw) return { score: null, detail: '' }
  try {
    const obj = JSON.parse(raw)
    if (typeof obj === 'object' && obj !== null) {
      return {
        score: typeof obj.score === 'number' ? obj.score : null,
        detail: typeof obj.details === 'string' ? obj.details : (typeof obj.detail === 'string' ? obj.detail : ''),
      }
    }
  } catch { /* not JSON, use as-is */ }
  return { score: null, detail: raw }
}

// Renders score pill
function ScoreBlock({ score }: { score: number | undefined | null }) {
  if (score === undefined || score === null) return null
  const color = score >= 80 ? '#22c55e' : score >= 60 ? '#f59e0b' : '#ef4444'
  return (
    <div className={styles.evalScoreRow}>
      <span className={styles.evalLabel}>得分</span>
      <span className={styles.evalPill} style={{ background: color }}>
        {score}<span className={styles.evalMax}>/100</span>
      </span>
    </div>
  )
}

// Renders detail markdown block
function EvalBlock({ score, detail }: { score: number | undefined | null; detail: string | undefined }) {
  const parsed = parseEval(detail)
  const finalScore = (parsed.score !== null ? parsed.score : score) ?? null
  const finalDetail = parsed.detail

  if (!finalDetail && finalScore === null) return null

  return (
    <div className={styles.evalBlock}>
      <ScoreBlock score={finalScore} />
      {finalDetail && (
        <div className={styles.evalMd}>
          <ReactMarkdown>{finalDetail}</ReactMarkdown>
        </div>
      )}
    </div>
  )
}

export default function InterviewPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { current, rounds, loading, fetchInterview, submitAnswer, endInterview, reset } =
    useInterviewStore()
  const [answer, setAnswer] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [ending, setEnding] = useState(false)
  const [showEndConfirm, setShowEndConfirm] = useState(false)
  const [showReport, setShowReport] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const sidebarRef = useRef<HTMLDivElement>(null)
  const [canScrollDown, setCanScrollDown] = useState(false)

  const checkSidebarScroll = useCallback(() => {
    const el = sidebarRef.current
    if (!el) return
    setCanScrollDown(el.scrollHeight - el.scrollTop - el.clientHeight > 4)
  }, [])

  useEffect(() => {
    const el = sidebarRef.current
    if (!el) return
    checkSidebarScroll()
    el.addEventListener('scroll', checkSidebarScroll, { passive: true })
    const ro = new ResizeObserver(checkSidebarScroll)
    ro.observe(el)
    return () => { el.removeEventListener('scroll', checkSidebarScroll); ro.disconnect() }
  }, [checkSidebarScroll, rounds])

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

  const handleEnd = async () => {
    if (!id) return
    setEnding(true)
    setShowEndConfirm(false)
    try {
      await endInterview(id)
      await fetchInterview(id)
    } finally {
      setEnding(false)
    }
  }

  if (loading && !current) return <div className="spinner" />

  if (!current) return null

  const isFinished = current.status !== 'ongoing'

  const statusLabelMap: Record<string, { text: string; cls: string }> = {
    ongoing:  { text: '进行中', cls: styles.ongoing },
    finished: { text: '已完成', cls: styles.done },
    aborted:  { text: '已中止', cls: styles.aborted },
    ended:    { text: '已结束', cls: styles.ended },
  }
  const statusLabel = statusLabelMap[current.status] ?? { text: '进行中', cls: styles.ongoing }

  const bannerMessageMap: Record<string, string> = {
    finished: '面试已完成，点击左侧「查看报告」查看完整评估',
    aborted:  '面试因参与度不足被系统终止，点击左侧「查看报告」查看评估',
    ended:    '面试已手动结束',
  }
  const bannerMessage = bannerMessageMap[current.status] ?? '面试已结束'

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
      {showEndConfirm && (
        <div className={styles.confirmOverlay}>
          <div className={styles.confirmBox}>
            <p className={styles.confirmTitle}>结束面试</p>
            <p className={styles.confirmDesc}>确定要提前结束本次面试吗？结束后将生成评估报告。</p>
            <div className={styles.confirmActions}>
              <button className={styles.confirmCancel} onClick={() => setShowEndConfirm(false)}>否，继续</button>
              <button className={styles.confirmOk} onClick={handleEnd} disabled={ending}>
                {ending ? '结束中...' : '确定结束'}
              </button>
            </div>
          </div>
        </div>
      )}
      {showReport && current.final_report && (
        <ReportModal
          report={current.final_report}
          role={current.role}
          onClose={() => setShowReport(false)}
        />
      )}
      <div className={styles.sidebarWrap}>
      <div className={styles.sidebar} ref={sidebarRef}>
        <button className={styles.backBtn} onClick={() => navigate('/')}>返回</button>
        <div className={styles.meta}>
          <div className={styles.metaItem}>
            <span className={styles.metaLabel}>岗位</span>
            <span className={styles.metaValue}>{current.role}</span>
          </div>
          <div className={styles.metaItem}>
            <span className={styles.metaLabel}>级别</span>
            <span className={styles.metaValue}>{current.level}</span>
          </div>
          <div className={styles.metaItem}>
            <span className={styles.metaLabel}>风格</span>
            <span className={styles.metaValue}>{current.style}</span>
          </div>
          <div className={styles.metaItem}>
            <span className={styles.metaLabel}>轮次</span>
            <span className={styles.metaValue}>
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
            <span className={statusLabel.cls}>{statusLabel.text}</span>
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
                {isFinished && r.score !== undefined && r.score !== null && (
                  <span className={styles.score}>{r.score}</span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
      {canScrollDown && <div className={styles.sidebarFade} />}
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
                  {isFinished && <EvalBlock score={r.score} detail={r.evaluation_detail} />}
                </div>
              )}
            </div>
          ))}

          {isFinished && (
            <div className={styles.finishedBanner}>
              {bannerMessage}
            </div>
          )}

          <div ref={bottomRef} />
        </div>

        {!isFinished && (
          <>
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
                <button
                  type="button"
                  className={styles.endBtn}
                  onClick={() => setShowEndConfirm(true)}
                  disabled={ending}
                >
                  {ending ? '结束中...' : '结束面试'}
                </button>
                <div className={styles.inputRight}>
                  <span className={styles.hint}>Cmd+Enter 提交</span>
                  <button type="submit" disabled={submitting || !answer.trim()}>
                    {submitting ? '提交中...' : '提交回答'}
                  </button>
                </div>
              </div>
            </form>
          </>
        )}
      </div>
    </div>
  )
}
