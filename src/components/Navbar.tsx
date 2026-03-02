import { useRef, useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/store/authStore'
import ChangePasswordModal from './ChangePasswordModal'
import styles from './Navbar.module.scss'
import logo from '@/assets/Logo.png'

export default function Navbar() {
  const { user, logout } = useAuthStore()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [showChangePwd, setShowChangePwd] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const handleLogout = () => {
    setOpen(false)
    logout()
    navigate('/login')
  }

  return (
    <>
      <nav className={styles.nav}>
        <Link to="/" className={styles.brand}>
          <img src={logo} alt="Interview LevelUp" className={styles.logo} />
        </Link>
        {user && (
          <div className={styles.userMenu} ref={menuRef}>
            <button
              className={styles.emailBtn}
              onClick={() => setOpen((v) => !v)}
            >
              {user.email}
              <span className={`${styles.caret} ${open ? styles.caretOpen : ''}`}>▾</span>
            </button>
            {open && (
              <div className={styles.dropdown}>
                <button
                  className={styles.dropdownItem}
                  onClick={() => { setOpen(false); setShowChangePwd(true) }}
                >
                  修改密码
                </button>
                <button className={styles.dropdownItem} onClick={handleLogout}>
                  退出登录
                </button>
              </div>
            )}
          </div>
        )}
      </nav>
      {showChangePwd && (
        <ChangePasswordModal onClose={() => setShowChangePwd(false)} />
      )}
    </>
  )
}
