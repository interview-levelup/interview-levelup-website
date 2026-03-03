import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useInterviewStore } from '@/store/interviewStore'
import styles from './NewInterviewPage.module.scss'

const ROLE_PRESETS = [
  '前端工程师', '后端工程师', '全栈工程师', '产品经理',
  'AI / 算法工程师', '数据分析师', 'UI / 设计师', '运营',
  '销售', '市场营销', '项目经理', '英语口语',
]

const LEVELS = [
  { value: 'junior',    label: '初级',    desc: '0-2 年' },
  { value: 'mid',       label: '中级',    desc: '3-5 年' },
  { value: 'senior',   label: '高级',    desc: '5+ 年' },
]

const STYLES = [
  { value: 'standard',   label: '标准综合' },
  { value: 'behavioral', label: '行为面试' },
  { value: 'technical',  label: '技术面试' },
  { value: 'case',       label: '案例分析' },
  { value: 'stress',     label: '压力面试' },
]

export default function NewInterviewPage() {
  const [role, setRole] = useState('')
  const [level, setLevel] = useState('junior')
  const [style, setStyle] = useState('standard')
  const [maxRounds, setMaxRounds] = useState(5)
  const [starting, setStarting] = useState(false)
  const { startInterviewStream, error } = useInterviewStore()
  const navigate = useNavigate()

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setStarting(true)
    try {
      await startInterviewStream(
        { role, level, style, max_rounds: maxRounds },
        (id) => navigate(`/interviews/${id}`),
      )
    } finally {
      setStarting(false)
    }
  }

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <h1 className={styles.title}>新面试</h1>
        <p className={styles.subtitle}>配置你的 AI 面试场景</p>

        <form onSubmit={handleSubmit} className={styles.form}>

          {/* Role */}
          <div className={styles.section}>
            <label className={styles.sectionLabel}>岗位</label>
            <div className={styles.tagGrid}>
              {ROLE_PRESETS.map(r => (
                <button
                  key={r}
                  type="button"
                  className={styles.tag + (role === r ? ' ' + styles.tagActive : '')}
                  onClick={() => setRole(role === r ? '' : r)}
                >{r}</button>
              ))}
            </div>
            <input
              className={styles.roleInput}
              type="text"
              placeholder="或输入自定义岗位…"
              value={role}
              onChange={(e) => setRole(e.target.value)}
              required
            />
          </div>

          {/* Level */}
          <div className={styles.section}>
            <label className={styles.sectionLabel}>难度级别</label>
            <div className={styles.tagRow}>
              {LEVELS.map(l => (
                <button
                  key={l.value}
                  type="button"
                  className={styles.levelTag + (level === l.value ? ' ' + styles.tagActive : '')}
                  onClick={() => setLevel(l.value)}
                >
                  <span className={styles.levelLabel}>{l.label}</span>
                  <span className={styles.levelDesc}>{l.desc}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Style */}
          <div className={styles.section}>
            <label className={styles.sectionLabel}>面试风格</label>
            <div className={styles.tagRow + ' ' + styles.tagRowWrap}>
              {STYLES.map(s => (
                <button
                  key={s.value}
                  type="button"
                  className={styles.tag + (style === s.value ? ' ' + styles.tagActive : '')}
                  onClick={() => setStyle(s.value)}
                >{s.label}</button>
              ))}
            </div>
          </div>

          {/* Rounds */}
          <div className={styles.section}>
            <label className={styles.sectionLabel}>面试轮数</label>
            <div className={styles.stepper}>
              <button
                type="button"
                className={styles.stepBtn}
                onClick={() => setMaxRounds(v => Math.max(1, v - 1))}
                disabled={maxRounds <= 1}
              >−</button>
              <span className={styles.stepVal}>{maxRounds}</span>
              <button
                type="button"
                className={styles.stepBtn}
                onClick={() => setMaxRounds(v => Math.min(10, v + 1))}
                disabled={maxRounds >= 10}
              >+</button>
              <span className={styles.stepHint}>轮（最多 10 轮）</span>
            </div>
          </div>

          {error && <p className="error-msg">{error}</p>}

          <div className={styles.actions}>
            <button type="button" className={styles.cancelBtn} onClick={() => navigate('/')}>
              取消
            </button>
            <button type="submit" className={styles.submitBtn} disabled={starting || !role.trim()}>
              {starting ? '准备中...' : '开始面试'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
