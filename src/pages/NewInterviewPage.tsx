import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useInterviewStore } from '@/store/interviewStore'
import styles from './NewInterviewPage.module.scss'

export default function NewInterviewPage() {
  const [role, setRole] = useState('')
  const [level, setLevel] = useState('junior')
  const [style, setStyle] = useState('standard')
  const [maxRounds, setMaxRounds] = useState(5)
  const { startInterview, loading, error } = useInterviewStore()
  const navigate = useNavigate()

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    const iv = await startInterview({ role, level, style, max_rounds: maxRounds })
    navigate(`/interviews/${iv.id}`)
  }

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <h1 className={styles.title}>新面试</h1>
        <p className={styles.subtitle}>配置你的 AI 面试场景</p>

        <form onSubmit={handleSubmit} className={styles.form}>
          <div className={styles.field}>
            <label>岗位 / 职业</label>
            <input
              type="text"
              placeholder="例如：产品经理、前端工程师、护士..."
              value={role}
              onChange={(e) => setRole(e.target.value)}
              required
            />
          </div>

          <div className={styles.row}>
            <div className={styles.field}>
              <label>难度级别</label>
              <select value={level} onChange={(e) => setLevel(e.target.value)}>
                <option value="junior">初级</option>
                <option value="mid">中级</option>
                <option value="senior">高级</option>
              </select>
            </div>

            <div className={styles.field}>
              <label>面试风格</label>
              <select value={style} onChange={(e) => setStyle(e.target.value)}>
                <option value="standard">标准</option>
                <option value="behavioral">行为面试</option>
                <option value="technical">技术面试</option>
                <option value="case">案例分析</option>
              </select>
            </div>

            <div className={styles.field}>
              <label>轮数</label>
              <input
                type="number"
                min={1}
                max={10}
                value={maxRounds}
                onChange={(e) => setMaxRounds(Number(e.target.value))}
              />
            </div>
          </div>

          {error && <p className="error-msg">{error}</p>}

          <div className={styles.actions}>
            <button type="button" className={styles.cancelBtn} onClick={() => navigate('/')}>
              取消
            </button>
            <button type="submit" className={styles.submitBtn} disabled={loading}>
              {loading ? '准备中...' : '开始面试 →'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
