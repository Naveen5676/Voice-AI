import { useState } from 'react'
import { Alert, Box, Button, Link, Stack, Typography } from '@mui/material'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Link as RouterLink, useNavigate } from 'react-router'
import { useAppDispatch } from '../../../app/store'
import { authApi, authErrorMessage, submitAuth } from '../api/auth-api'
import { loginSchema, signupSchema } from 'backend/validator/auth'
import type { AuthFormValues } from 'backend/validator/auth'
import { AuthLayout } from '../components/AuthLayout'
import { AuthField } from '../components/AuthField'

export function AuthPage({ mode }: { mode: 'login' | 'signup' }) {
  const signup = mode === 'signup'
  const navigate = useNavigate()
  const dispatch = useAppDispatch()
  const [error, setError] = useState<string | null>(null)
  const { control, handleSubmit, formState: { isSubmitting } } = useForm<AuthFormValues>({
    resolver: zodResolver(signup ? signupSchema : loginSchema),
    defaultValues: { name: '', email: '', password: '' },
  })

  async function submit(values: AuthFormValues) {
    setError(null)
    try {
      await submitAuth(mode, values)
      const session = dispatch(authApi.endpoints.getSession.initiate(undefined, { forceRefetch: true }))
      try {
        await session.unwrap()
      } finally {
        session.unsubscribe()
      }
      navigate('/dashboard', { replace: true })
    } catch (cause) {
      setError(authErrorMessage(cause))
    }
  }

  return <AuthLayout>
    <Typography variant="overline" color="text.secondary" letterSpacing="0.14em">YOUR WORKSPACE</Typography>
    <Typography component="h1" variant="h4" sx={{ mt: 1, fontSize: 34 }}>{signup ? 'Create your account' : 'Welcome back'}</Typography>
    <Typography color="text.secondary" sx={{ mt: 1, mb: 4 }}>{signup ? 'A fresh start for your next conversation.' : 'Sign in to your Voice Studio account.'}</Typography>
    <Box component="form" noValidate onSubmit={handleSubmit(submit)}>
      <Stack spacing={2.5}>
        {error && <Alert severity="error">{error}</Alert>}
        {signup && <AuthField control={control} name="name" label="Name" autoComplete="name" autoFocus disabled={isSubmitting} />}
        <AuthField control={control} name="email" label="Email address" type="email" autoComplete="email" autoFocus={!signup} disabled={isSubmitting} />
        <AuthField control={control} name="password" label="Password" autoComplete={signup ? 'new-password' : 'current-password'} helperText={signup ? 'At least 8 characters.' : undefined} disabled={isSubmitting} />
        <Button type="submit" variant="contained" size="large" loading={isSubmitting} fullWidth sx={{ mt: 0.5 }}>{signup ? 'Create account' : 'Sign in'}</Button>
      </Stack>
    </Box>
    <Typography variant="body2" color="text.secondary" sx={{ mt: 3.5, textAlign: 'center' }}>
      {signup ? 'Already have an account? ' : 'New to Voice Studio? '}
      <Link component={RouterLink} to={signup ? '/login' : '/signup'} fontWeight={600}>{signup ? 'Sign in' : 'Create an account'}</Link>
    </Typography>
  </AuthLayout>
}
