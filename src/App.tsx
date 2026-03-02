import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Navbar from '@/components/Navbar'
import ProtectedRoute from '@/components/ProtectedRoute'
import LoginPage from '@/pages/LoginPage'
import RegisterPage from '@/pages/RegisterPage'
import DashboardPage from '@/pages/DashboardPage'
import NewInterviewPage from '@/pages/NewInterviewPage'
import InterviewPage from '@/pages/InterviewPage'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public */}
        <Route path="/login"    element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />

        {/* Protected */}
        <Route element={<><Navbar /><ProtectedRoute /></>}>
          <Route path="/"                   element={<DashboardPage />} />
          <Route path="/interviews/new"     element={<NewInterviewPage />} />
          <Route path="/interviews/:id"     element={<InterviewPage />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
