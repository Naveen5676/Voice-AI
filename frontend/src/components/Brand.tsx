import { Box, Stack, Typography } from '@mui/material'

export function Brand() {
  return (
    <Stack direction="row" spacing={1.25} alignItems="center">
      <Box aria-hidden="true" sx={{ bgcolor: 'text.primary', width: 32, height: 32, borderRadius: '9px', display: 'flex', gap: '3px', alignItems: 'center', justifyContent: 'center' }}>
        {[9, 17, 12].map((height, index) => <Box key={index} sx={{ width: 3, height, bgcolor: '#fff', borderRadius: 2 }} />)}
      </Box>
      <Typography fontWeight={650} fontSize={18} letterSpacing="-0.5px">Voice Studio</Typography>
    </Stack>
  )
}
