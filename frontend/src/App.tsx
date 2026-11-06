import { Navigate, Route, Routes } from 'react-router'
import { SessionBoundary } from './components/SessionBoundary'
import { AuthPage } from './features/auth/pages/AuthPage'
import { DashboardPage } from './features/dashboard/pages/DashboardPage'

export default function App() {
  return <Routes>
    <Route element={<SessionBoundary authenticated={false} />}>
      <Route path="/login" element={<AuthPage key="login" mode="login" />} />
      <Route path="/signup" element={<AuthPage key="signup" mode="signup" />} />
    </Route>
    <Route element={<SessionBoundary authenticated />}>
      <Route path="/dashboard" element={<DashboardPage />} />
    </Route>
    <Route path="*" element={<Navigate to="/dashboard" replace />} />
  </Routes>
}
