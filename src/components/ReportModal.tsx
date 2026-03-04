import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import styles from './ReportModal.module.scss'
import IconReport from '@/assets/icon-report.svg?react'

interface Props {
  report: string
  role: string
  onClose: () => void
}

export default function ReportModal({ report, role, onClose }: Props) {
  const handleDownload = () => {
    const blob = new Blob([report], { type: 'text/markdown;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `interview-report-${role.replace(/\s+/g, '-')}-${new Date().toISOString().slice(0, 10)}.md`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className={styles.overlay} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className={styles.modal}>
        <div className={styles.header}>
          <h2><IconReport style={{ width: '1.3em', height: '1.3em', marginRight: '0.4em', flexShrink: 0 }} /> 面试报告</h2>
          <div className={styles.actions}>
            <button className={styles.downloadBtn} onClick={handleDownload}>
              ⬇ 下载 .md
            </button>
            <button className={styles.closeBtn} onClick={onClose}>✕ 关闭</button>
          </div>
        </div>
        <div className={styles.body}>
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{report}</ReactMarkdown>
        </div>
      </div>
    </div>
  )
}
