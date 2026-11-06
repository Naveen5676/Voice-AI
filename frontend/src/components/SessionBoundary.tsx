import { Alert, Box, Button, CircularProgress, Stack } from '@mui/material'
import { Navigate, Outlet } from 'react-router'
import { useGetSessionQuery } from '../features/auth/api/auth-api'

export function SessionBoundary({ authenticated }: { authenticated: boolean }) {
  const { data: user, isLoading, isError, refetch } = useGetSessionQuery(undefined, {
    pollingInterval: 60_000,
    refetchOnFocus: true,
    refetchOnReconnect: true,
    refetchOnMountOrArgChange: true,
  })
  if (isLoading) return <Box role="status" aria-label="Checking your session" sx={{ minHeight: '100svh', display: 'grid', placeItems: 'center' }}><CircularProgress size={28} /></Box>
  if (isError) return (
    <Stack sx={{ maxWidth: 440, mx: 'auto', p: 3, pt: 10 }} spacing={2}>
      <Alert severity="error">We couldn’t check your session. Please try again.</Alert>
      <Button variant="outlined" onClick={() => void refetch()}>Try again</Button>
    </Stack>
  )
  if (authenticated && !user) return <Navigate to="/login" replace />
  if (!authenticated && user) return <Navigate to="/dashboard" replace />
  return <Outlet />
}
