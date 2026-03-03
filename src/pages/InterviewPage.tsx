import { useEffect, useState, useRef, useCallback, type FormEvent } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import ReactMarkdown from 'react-markdown'
import { useInterviewStore } from '@/store/interviewStore'
import ReportModal from '@/components/ReportModal'
import { useTTS } from '@/hooks/useTTS'
import { useSTT, type SttMode } from '@/hooks/useSTT'
import styles from './InterviewPage.module.scss'

// Formats a timestamp for chat bubbles:
// - same day  → "14:05"
// - yesterday / earlier this year → "3月2日 14:05"
// - last year or earlier → "2025年3月2日 14:05"
function formatBubbleTime(iso: string): string {
  const d = new Date(iso)
  const now = new Date()
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const yesterdayStart = new Date(todayStart.getTime() - 86400_000)
  const thisYearStart = new Date(now.getFullYear(), 0, 1)

  const hm = d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false })
  if (d >= todayStart) return hm
  if (d >= yesterdayStart) {
    return `${d.getMonth() + 1}月${d.getDate()}日 ${hm}`
  }
  if (d >= thisYearStart) {
    return `${d.getMonth() + 1}月${d.getDate()}日 ${hm}`
  }
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日 ${hm}`
}

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
  const { current, rounds, loading, fetchInterview, submitAnswer, submitAnswerStream, reset, streamingQuestion, isStreaming } =
    useInterviewStore()
  const [answer, setAnswer] = useState('')
  const [pendingAnswer, setPendingAnswer] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [ending, setEnding] = useState(false)
  const [showEndConfirm, setShowEndConfirm] = useState(false)
  const [showReport, setShowReport] = useState(false)
  const [sttMode, setSttMode] = useState<SttMode>('webspeech')
  const [autoTTS, setAutoTTS] = useState(true)
  const bottomRef = useRef<HTMLDivElement>(null)
  const sidebarRef = useRef<HTMLDivElement>(null)
  const [canScrollDown, setCanScrollDown] = useState(false)
  const ttsBufferRef = useRef('')
  // Tracks how many chars of streamingQuestion have already been fed to TTS
  // (used for initial first-question stream; submit stream uses its own token cb)
  const ttsStartProcessedRef = useRef(0)

  const { speak, enqueue, stop: stopTTS, speaking, voicesReady } = useTTS()
  const { listening, startListening, stopListening } = useSTT(
    sttMode,
    (text) => setAnswer((prev) => prev + text),
    (msg) => console.warn('[STT]', msg),
  )

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
    // Only fetch if this interview isn't already in the store (e.g. direct URL / back-nav).
    // When arriving from the stream-start flow, the store already has current set.
    if (id && current?.id !== id) fetchInterview(id)
    // Do NOT reset on cleanup: React Strict Mode runs cleanup+effect twice on mount,
    // which would wipe the store mid-stream. Reset is handled explicitly (back button
    // or starting a new interview).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  // Stop TTS when leaving the page
  useEffect(() => {
    return () => stopTTS()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [rounds])

  // Also scroll when streaming text grows
  useEffect(() => {
    if (isStreaming) bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [streamingQuestion, isStreaming])

  // Auto-TTS for the initial first question (start-stream path).
  // handleSubmit covers subsequent rounds via its own token callback.
  useEffect(() => {
    if (!autoTTS || !isStreaming || rounds.length > 0) return
    const text = streamingQuestion ?? ''
    const delta = text.slice(ttsStartProcessedRef.current)
    if (!delta) return
    ttsBufferRef.current += delta
    ttsStartProcessedRef.current = text.length
    const match = ttsBufferRef.current.match(/^([\s\S]*?[。！？.!?])([\s\S]*)$/)
    if (match) {
      enqueue(match[1])
      ttsBufferRef.current = match[2] ?? ''
    }
  }, [streamingQuestion, isStreaming, rounds.length, autoTTS, enqueue])

  // When initial stream finishes (isStreaming flips false with still rounds.length === 1),
  // flush any remaining buffer.
  useEffect(() => {
    if (autoTTS && !isStreaming && rounds.length === 1 && ttsStartProcessedRef.current > 0) {
      if (ttsBufferRef.current.trim()) {
        enqueue(ttsBufferRef.current.trim())
        ttsBufferRef.current = ''
      }
      ttsStartProcessedRef.current = 0
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isStreaming])

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!id || !answer.trim() || isStreaming) return
    const trimmedAnswer = answer.trim()
    setSubmitting(true)
    setAnswer('')
    setPendingAnswer(trimmedAnswer)
    stopTTS()
    ttsBufferRef.current = ''
    try {
      const { finished } = await submitAnswerStream(id, trimmedAnswer, (token) => {
        if (!autoTTS) return
        // Accumulate tokens; enqueue complete sentences as they arrive (no cancel)
        ttsBufferRef.current += token
        const match = ttsBufferRef.current.match(/^([\s\S]*?[。！？.!?])([\s\S]*)$/)
        if (match) {
          enqueue(match[1])
          ttsBufferRef.current = match[2] ?? ''
        }
      })
      // Enqueue any remaining text once the stream ends
      if (autoTTS && ttsBufferRef.current.trim()) {
        enqueue(ttsBufferRef.current.trim())
        ttsBufferRef.current = ''
      }
      if (finished) {
        await fetchInterview(id)
      }
    } finally {
      setSubmitting(false)
      setPendingAnswer('')
    }
  }

  const handleEnd = async () => {
    if (!id) return
    setEnding(true)
    setShowEndConfirm(false)
    try {
      const { finished } = await submitAnswer(id, '我想结束面试')
      if (finished) {
        await fetchInterview(id)
      }
    } finally {
      setEnding(false)
    }
  }

  if (loading && !current) return <div className="spinner" />

  if (!current) return null

  const isFinished = current.status !== 'ongoing'

  const statusLabelMap: Record<string, { text: string; cls: string }> = {
    ongoing:    { text: '进行中', cls: styles.ongoing },
    finished:   { text: '已完成', cls: styles.done },
    aborted:    { text: '已中止', cls: styles.aborted },
    user_ended: { text: '主动结束', cls: styles.userEnded },
    ended:      { text: '已结束', cls: styles.done }, // legacy rows
  }
  const statusLabel = statusLabelMap[current.status] ?? { text: '进行中', cls: styles.ongoing }

  const bannerMessageMap: Record<string, string> = {
    finished:   '面试已完成，点击左侧「查看报告」查看完整评估',
    aborted:    '面试因不当行为被系统终止，点击左侧「查看报告」查看评估',
    user_ended: '你主动结束了本次面试，点击左侧「查看报告」查看评估',
    ended:      '面试已结束，点击左侧「查看报告」查看完整评估', // legacy rows
  }
  const bannerMessage = bannerMessageMap[current.status] ?? '面试已结束'

  // Build display labels: main questions get Q1, Q2…; sub rounds Q1 反问; followups Q1 追问…
  let mainCount = 0
  let followupCount = 0
  const roundLabels = rounds.map(r => {
    if (r.is_sub) {
      return `Q${mainCount} 反问`  // same mainCount, don't increment
    }
    if (!r.is_followup) {
      mainCount++
      followupCount = 0
      return `Q${mainCount}`
    } else {
      followupCount++
      return `Q${mainCount} 追问${followupCount > 1 ? followupCount : ''}`
    }
  })
  const labelMap = new Map(rounds.map((r, i) => [r.id, roundLabels[i]]))

  // Round nums that have a subsequent sub round — those answers were candidate sub-questions
  const subNums = new Set(rounds.filter(r => r.is_sub).map(r => r.round_num))

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
        <button className={styles.backBtn} onClick={() => { reset(); navigate('/') }}>返回</button>
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
              {rounds.filter(r => !r.is_followup && !r.is_sub && r.answer).length}
              {' '}/ {current.max_rounds}
              {rounds.some(r => r.is_followup) && (
                <span className={styles.followupBadge}>
                  +{rounds.filter(r => r.is_followup).length}追问
                </span>
              )}
              {rounds.some(r => r.is_sub) && (
                <span className={styles.subBadge}>
                  +{rounds.filter(r => r.is_sub).length}反问
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
            {rounds.filter(r => !r.is_sub).map((r) => (
              <div key={r.id} className={styles.roundItem + (r.is_followup ? ' ' + styles.roundItemFollowup : '')}>
                <span className={styles.roundNum}>{labelMap.get(r.id)}</span>
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
              <div className={styles.bubble + ' ' + (r.is_sub ? styles.aiSub : r.is_followup ? styles.aiFollowup : styles.ai)}>
                <div className={styles.bubbleHeader}>
                  <span className={styles.bubbleLabel}>面试官 {roundLabels[i]}</span>
                  <button
                    type="button"
                    className={styles.speakBtn}
                    onClick={() => speak(r.question)}
                    disabled={!voicesReady}
                    title={voicesReady ? '朗读问题' : '音声加载中...'}
                  >🔊</button>
                </div>
                <div className={styles.md}><ReactMarkdown>{r.question}</ReactMarkdown></div>
                <span className={styles.bubbleTime}>{formatBubbleTime(r.created_at)}</span>
              </div>
              {r.answer && (
                <div className={styles.bubble + ' ' + styles.user}>
                  <span className={styles.bubbleLabel}>
                    {!r.is_sub && !r.is_followup && subNums.has(r.round_num)
                      ? '你（反问）'
                      : '你'}
                  </span>
                  <div className={styles.md}><ReactMarkdown>{r.answer}</ReactMarkdown></div>
                  {isFinished && !(!r.is_sub && !r.is_followup && subNums.has(r.round_num)) && <EvalBlock score={r.score} detail={r.evaluation_detail} />}
                  {r.answered_at && <span className={styles.bubbleTime}>{formatBubbleTime(r.answered_at)}</span>}
                </div>
              )}
            </div>
          ))}

          {/* Optimistic user answer bubble — visible immediately after submit, before backend confirms */}
          {pendingAnswer && (
            <div className={styles.bubble + ' ' + styles.user}>
              <span className={styles.bubbleLabel}>你</span>
              <div className={styles.md}><ReactMarkdown>{pendingAnswer}</ReactMarkdown></div>
            </div>
          )}

          {isFinished && (
            <div className={styles.finishedBanner}>
              {bannerMessage}
            </div>
          )}

          {/* Streaming AI bubble — identical structure to real round bubbles to avoid flash on transition */}
          {!isFinished && isStreaming && (
            <div className={styles.roundWrapper}>
              <div className={styles.bubble + ' ' + styles.ai + ' ' + styles.streamingActive}>
                <div className={styles.bubbleHeader}>
                  <span className={styles.bubbleLabel}>
                    面试官{!streamingQuestion && ' (思考中...)'}
                  </span>
                </div>
                <div className={styles.md}>
                  <ReactMarkdown>{streamingQuestion ?? ''}</ReactMarkdown>
                  <span className={styles.cursor} aria-hidden />
                </div>
              </div>
            </div>
          )}

          <div ref={bottomRef} />
        </div>

        {!isFinished && (
          <>
            <form className={styles.inputArea} onSubmit={handleSubmit}>
              <textarea
                className={styles.textarea}
                placeholder={listening ? '正在聆听...' : isStreaming ? '等待面试官...' : '输入你的回答...'}
                value={answer}
                onChange={(e) => setAnswer(e.target.value)}
                rows={4}
                disabled={isStreaming}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleSubmit(e as unknown as FormEvent)
                }}
              />

              {/* Voice controls bar */}
              <div className={styles.voiceBar}>
                <div className={styles.voiceLeft}>
                  {/* TTS mute toggle */}
                  <button
                    type="button"
                    className={`${styles.voiceIconBtn} ${autoTTS ? styles.active : ''}`}
                    onClick={() => { setAutoTTS((v) => !v); if (speaking) stopTTS() }}
                    disabled={!voicesReady}
                    title={!voicesReady ? '音声加载中...' : autoTTS ? '关闭自动朗读' : '开启自动朗读'}
                  >
                    {autoTTS ? '🔊' : '🔇'}
                  </button>

                  {/* Mic button */}
                  <button
                    type="button"
                    className={`${styles.micBtn} ${listening ? styles.listening : ''}`}
                    onMouseDown={() => { if (sttMode === 'webspeech' && !listening) startListening() }}
                    onMouseUp={() => { if (sttMode === 'webspeech' && listening) stopListening() }}
                    onClick={() => { if (sttMode === 'whisper') { if (listening) stopListening(); else startListening() } }}
                    disabled={isStreaming}
                    title={sttMode === 'webspeech' ? '按住说话 (Web Speech)' : listening ? '点击停止录音' : '点击开始录音 (Whisper)'}
                  >
                    {listening ? '⏹' : '🎤'}
                  </button>

                  {/* STT mode picker */}
                  <select
                    className={styles.sttSelect}
                    value={sttMode}
                    onChange={(e) => setSttMode(e.target.value as SttMode)}
                    disabled={listening}
                  >
                    <option value="webspeech">Web Speech</option>
                    <option value="whisper">Whisper</option>
                  </select>
                </div>

                <div className={styles.voiceRight}>
                  <span className={styles.hint}>Cmd+Enter 提交</span>
                </div>
              </div>

              <div className={styles.inputActions}>
                <button
                  type="button"
                  className={styles.endBtn}
                  onClick={() => setShowEndConfirm(true)}
                  disabled={ending || isStreaming}
                >
                  {ending ? '结束中...' : '结束面试'}
                </button>
                <div className={styles.inputRight}>
                  <button type="submit" disabled={submitting || isStreaming || !answer.trim()}>
                    {submitting || isStreaming ? (isStreaming ? '等待回复...' : '提交中...') : '提交回答'}
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
