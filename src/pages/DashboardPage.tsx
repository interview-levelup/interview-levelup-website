import { useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useInterviewStore } from '@/store/interviewStore'
import styles from './DashboardPage.module.scss'

const levelLabel: Record<string, string> = {
  junior: '初级',
  mid: '中级',
  senior: '高级',
}

const statusLabel: Record<string, string> = {
  ongoing:    '进行中',
  finished:   '已完成',
  aborted:    '已中止',
  user_ended: '主动结束',
  ended:      '已结束', // legacy rows
}

export default function DashboardPage() {
  const { list, loading, fetchList } = useInterviewStore()
  const navigate = useNavigate()

  useEffect(() => { fetchList() }, [fetchList])

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1>我的面试</h1>
          <p className={styles.subtitle}>共 {list.length} 场</p>
        </div>
        <button className={styles.newBtn} onClick={() => navigate('/interviews/new')}>
          + 新面试
        </button>
      </div>

      {loading && <div className="spinner" />}

      {!loading && list.length === 0 && (
        <div className={styles.empty}>
          <p>还没有面试记录</p>
          <button className={styles.newBtn} onClick={() => navigate('/interviews/new')}>
            开始第一场面试
          </button>
        </div>
      )}

      <div className={styles.grid}>
        {list.map((iv) => (
          <Link to={`/interviews/${iv.id}`} key={iv.id} className={styles.card}>
            <div className={styles.cardTop}>
              <span className={styles.role}>{iv.role}</span>
              <span className={`${styles.badge} ${styles[iv.status] ?? ''}`}>
                {statusLabel[iv.status] ?? iv.status}
              </span>
            </div>
            <div className={styles.cardMeta}>
              <span>{levelLabel[iv.level] ?? iv.level}</span>
              <span>·</span>
              <span>{iv.style}</span>
              <span>·</span>
              <span>{iv.answered_rounds} / {iv.max_rounds} 轮</span>
            </div>
            <div className={styles.cardDate}>
              {new Date(iv.created_at).toLocaleString('zh-CN')}
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
