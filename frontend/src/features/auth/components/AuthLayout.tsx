import type { ReactNode } from 'react'
import { Box, Stack, Typography } from '@mui/material'
import { Brand } from '../../../components/Brand'

const bars = [12, 20, 36, 25, 48, 64, 42, 80, 58, 98, 76, 52, 88, 66, 42, 60, 34, 46, 26, 16, 10]

export function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <Box sx={{ minHeight: '100svh', display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'minmax(320px, 0.95fr) 1.05fr' } }}>
      <Stack component="aside" sx={{ display: { xs: 'none', md: 'flex' }, p: { md: 5, lg: 8 }, borderRight: 1, borderColor: 'divider', justifyContent: 'space-between', position: 'relative', overflow: 'hidden' }}>
        <Brand />
        <Box sx={{ maxWidth: 470, py: 8 }}>
          <Typography variant="overline" sx={{ color: 'primary.main', letterSpacing: '0.16em', fontWeight: 600 }}>A little less typing.</Typography>
          <Typography variant="h1" sx={{ fontSize: { md: 56, lg: 76 }, lineHeight: 1.05, mt: 2 }}>Make room<br />for conversation.</Typography>
          <Typography color="text.secondary" sx={{ maxWidth: 320, lineHeight: 1.8, mt: 3, fontSize: 17 }}>Your voice workspace starts here.</Typography>
          <Stack aria-hidden="true" direction="row" alignItems="center" spacing={0.75} sx={{ mt: 7, height: 100 }}>
            {bars.map((height, index) => <Box key={index} sx={{ height, width: { md: 6, lg: 8 }, borderRadius: 4, bgcolor: index > 6 && index < 14 ? 'primary.main' : '#d6d8cb', opacity: index > 6 && index < 14 ? 0.9 : 0.8 }} />)}
          </Stack>
        </Box>
        <Typography variant="caption" color="text.secondary">A place to begin. A space to build.</Typography>
      </Stack>
      <Stack component="main" sx={{ bgcolor: 'background.paper', px: { xs: 3, sm: 6 }, py: { xs: 4, md: 6 }, alignItems: 'center', justifyContent: 'center', minWidth: 0 }}>
        <Box sx={{ display: { md: 'none' }, alignSelf: 'flex-start', mb: 7 }}><Brand /></Box>
        <Box sx={{ width: '100%', maxWidth: 390, my: 'auto', py: 4 }}>{children}</Box>
      </Stack>
    </Box>
  )
}
