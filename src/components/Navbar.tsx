import { Link, useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/store/authStore'
import styles from './Navbar.module.scss'
import logo from '@/assets/Logo.png'

export default function Navbar() {
  const { user, logout } = useAuthStore()
  const navigate = useNavigate()

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  return (
    <nav className={styles.nav}>
      <Link to="/" className={styles.brand}>
        <img src={logo} alt="Interview LevelUp" className={styles.logo} />
      </Link>
      {user && (
        <div className={styles.right}>
          <span className={styles.email}>{user.email}</span>
          <button className={styles.logoutBtn} onClick={handleLogout}>
            退出
          </button>
        </div>
      )}
    </nav>
  )
}
