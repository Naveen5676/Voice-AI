import { useState } from 'react'
import { Alert, Box, Button, Container, Stack, Typography } from '@mui/material'
import { useNavigate } from 'react-router'
import { useAppDispatch } from '../../../app/store'
import { authApi, authErrorMessage, signOut } from '../../auth/api/auth-api'
import { Brand } from '../../../components/Brand'

export function DashboardPage() {
  const dispatch = useAppDispatch()
  const navigate = useNavigate()
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function logout() {
    setError(null)
    setIsLoading(true)
    try {
      await signOut()
      dispatch(authApi.util.resetApiState())
      navigate('/login', { replace: true })
    } catch (cause) {
      setError(authErrorMessage(cause))
    } finally {
      setIsLoading(false)
    }
  }

  return <Box sx={{ minHeight: '100svh' }}>
    <Box component="header" sx={{ bgcolor: 'background.paper', borderBottom: 1, borderColor: 'divider' }}>
      <Container maxWidth="lg"><Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ py: 2.5 }}>
        <Brand />
        <Button variant="outlined" color="inherit" onClick={() => void logout()} loading={isLoading}>Log out</Button>
      </Stack></Container>
    </Box>
    <Container component="main" maxWidth="lg" sx={{ py: 5 }}>
      {error && <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>}
      <Typography component="h1" variant="h4">Dashboard</Typography>
    </Container>
  </Box>
}
