import { createBrowserRouter, createRoutesFromElements, Navigate, Route, RouterProvider } from 'react-router'
import { SessionBoundary } from './components/SessionBoundary'
import { AuthPage } from './features/auth/pages/AuthPage'
import { DashboardPage } from './features/dashboard/pages/DashboardPage'
import { WorkspaceLayout } from './components/WorkspaceLayout'
import { AgentEditorPage } from './features/agents/pages/AgentEditorPage'
import { KnowledgeBasePage } from './features/knowledge-base/pages/KnowledgeBasePage'

const router = createBrowserRouter(createRoutesFromElements(<>
    <Route element={<SessionBoundary authenticated={false} />}>
      <Route path="/login" element={<AuthPage key="login" mode="login" />} />
      <Route path="/signup" element={<AuthPage key="signup" mode="signup" />} />
    </Route>
    <Route element={<SessionBoundary authenticated />}>
      <Route element={<WorkspaceLayout />}>
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/agents/new" element={<AgentEditorPage />} />
        <Route path="/agents/:agentId" element={<AgentEditorPage />} />
        <Route path="/knowledge-bases" element={<KnowledgeBasePage />} />
      </Route>
    </Route>
    <Route path="*" element={<Navigate to="/dashboard" replace />} />
  </>))

export default function App() { return <RouterProvider router={router} /> }
