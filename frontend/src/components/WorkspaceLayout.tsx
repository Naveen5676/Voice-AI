import { useState } from 'react'
import { Alert, Avatar, Box, Button, Chip, Divider, Stack, Typography } from '@mui/material'
import { Link, Outlet, useLocation, useNavigate } from 'react-router'
import { useAppDispatch } from '../app/store'
import { authApi, authErrorMessage, signOut, useGetSessionQuery } from '../features/auth/api/auth-api'
import { agentsApi } from '../features/agents/api/agents-api'
import { Brand } from './Brand'
import { StudioIcon } from './StudioIcon'
import { UsageQuotaBar } from './UsageQuotaBar'

export function WorkspaceLayout() {
  const { data: user } = useGetSessionQuery()
  const dispatch = useAppDispatch()
  const navigate = useNavigate()
  const location = useLocation()
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isAgents = !location.pathname.startsWith('/knowledge-bases')
  const isKb = location.pathname.startsWith('/knowledge-bases')

  async function logout() {
    setError(null)
    setIsLoading(true)
    try {
      await signOut()
      dispatch(agentsApi.util.resetApiState())
      dispatch(authApi.util.resetApiState())
      navigate('/login', { replace: true })
    } catch (cause) {
      setError(authErrorMessage(cause))
    } finally { setIsLoading(false) }
  }

  const logoutButton = <Button color="inherit" startIcon={<StudioIcon name="logout" />} onClick={() => void logout()} loading={isLoading} sx={{ justifyContent: 'flex-start', color: 'text.secondary', px: 1.5 }}>Log out</Button>

  return <Box sx={{ display: 'flex', minHeight: '100svh' }}>
    <Stack component="aside" sx={{ display: { xs: 'none', md: 'flex' }, width: 232, flexShrink: 0, position: 'fixed', inset: '0 auto 0 0', bgcolor: '#f0f0e9', borderRight: 1, borderColor: 'divider', px: 2.5, py: 3.5 }}>
      <Box sx={{ px: 0.5 }}><Brand /></Box>
      <Typography variant="overline" color="text.secondary" sx={{ fontSize: 10, letterSpacing: '.14em', mt: 6, mb: 1, px: 1.5 }}>WORKSPACE</Typography>
      <Stack spacing={0.75} sx={{ mb: 2 }}>
        <Button component={Link} to="/dashboard" startIcon={<StudioIcon name="grid" />} color="inherit" sx={{ bgcolor: isAgents ? '#e2e4d9' : 'transparent', fontWeight: isAgents ? 600 : 400, justifyContent: 'flex-start', px: 1.5, '&:hover': { bgcolor: '#daddd0' } }}>Agents</Button>
        <Button component={Link} to="/knowledge-bases" startIcon={<StudioIcon name="book" />} color="inherit" sx={{ bgcolor: isKb ? '#e2e4d9' : 'transparent', fontWeight: isKb ? 600 : 400, justifyContent: 'flex-start', px: 1.5, '&:hover': { bgcolor: '#daddd0' } }}>Knowledge Base</Button>
      </Stack>
      <Box sx={{ mt: 'auto' }}>
        <Box sx={{ p: 1.5, mb: 2, border: 1, borderColor: '#dcded2', borderRadius: 2 }}>
          <Typography variant="body2" fontWeight={600}>One prompt. Your voice.</Typography>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5, lineHeight: 1.6 }}>Shape how your agent speaks, listens, and helps.</Typography>
        </Box>
        <Divider sx={{ mb: 2.5 }} />
        <Stack direction="row" spacing={1.25} alignItems="center" sx={{ px: 1, mb: 1 }}>
          <Avatar sx={{ width: 32, height: 32, fontSize: 13, bgcolor: '#dedfd3', color: 'text.primary' }}>{user?.name.slice(0, 1).toUpperCase()}</Avatar>
          <Box sx={{ minWidth: 0 }}><Typography variant="body2" fontWeight={600} noWrap>{user?.name}</Typography><Typography variant="caption" color="text.secondary">Personal workspace</Typography></Box>
        </Stack>
        {logoutButton}
      </Box>
    </Stack>
    <Box sx={{ ml: { md: '232px' }, width: { xs: '100%', md: 'calc(100% - 232px)' }, minWidth: 0 }}>
      <Stack component="header" direction="row" alignItems="center" justifyContent="space-between" sx={{ minHeight: 76, borderBottom: 1, borderColor: 'divider', px: { xs: 2.5, lg: 5 }, bgcolor: 'background.paper' }}>
        <Box sx={{ display: { xs: 'block', md: 'none' } }}><Brand /></Box>
        <Typography variant="body2" color="text.secondary" sx={{ display: { xs: 'none', md: 'block' } }}>Your workspace <Box component="span" sx={{ color: '#b7bbae', mx: 1.5 }}>/</Box><Box component="span" sx={{ color: 'text.primary', fontWeight: 500 }}>{isKb ? 'Knowledge Base' : 'Agents'}</Box></Typography>
        <Stack direction="row" alignItems="center" spacing={2}>
          <UsageQuotaBar />
          <Chip label="Personal workspace" variant="outlined" size="small" sx={{ display: { xs: 'none', sm: 'inline-flex' }, fontSize: 11, borderColor: 'divider', bgcolor: '#fafaf7' }} />
          <Box sx={{ display: { md: 'none' } }}>{logoutButton}</Box>
        </Stack>
      </Stack>
      <Box component="main" sx={{ maxWidth: 1440, mx: 'auto', px: { xs: 2.5, sm: 4, lg: 5 }, py: { xs: 3.5, lg: 5 } }}>
        {error && <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>}
        <Outlet />
      </Box>
    </Box>
  </Box>
}
