import { useState, type FormEvent } from 'react'
import { useAuthStore } from '@/store/authStore'
import styles from './ChangePasswordModal.module.scss'

interface Props {
  onClose: () => void
}

export default function ChangePasswordModal({ onClose }: Props) {
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [loading, setLoading] = useState(false)
  const { changePassword } = useAuthStore()

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    if (newPassword !== confirmPassword) {
      setError('两次输入的新密码不一致')
      return
    }
    if (newPassword.length < 6) {
      setError('新密码至少 6 位')
      return
    }
    setLoading(true)
    try {
      await changePassword(currentPassword, newPassword)
      setSuccess(true)
      setTimeout(onClose, 1500)
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error
      setError(msg ?? '修改失败，请重试')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      className={styles.overlay}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className={styles.modal}>
        <div className={styles.header}>
          <h2>修改密码</h2>
          <button className={styles.closeBtn} onClick={onClose}>✕</button>
        </div>

        <div className={styles.body}>
          {success ? (
            <p className={styles.successMsg}>密码已更新 ✓</p>
          ) : (
            <form onSubmit={handleSubmit} className={styles.form}>
              <div className={styles.field}>
                <label>当前密码</label>
                <input
                  type="password"
                  placeholder="••••••••"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  required
                  autoFocus
                />
              </div>
              <div className={styles.field}>
                <label>新密码</label>
                <input
                  type="password"
                  placeholder="••••••••"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                />
              </div>
              <div className={styles.field}>
                <label>确认新密码</label>
                <input
                  type="password"
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                />
              </div>
              {error && <p className={styles.errorMsg}>{error}</p>}
              <button type="submit" className={styles.submitBtn} disabled={loading}>
                {loading ? '更新中...' : '确认修改'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
