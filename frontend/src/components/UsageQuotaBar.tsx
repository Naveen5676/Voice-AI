import { useState } from 'react'
import {
  Box,
  Button,
  Chip,
  Divider,
  Popover,
  Stack,
  Typography,
} from '@mui/material'
import { useGetUsageQuery } from '../features/agents/api/agents-api'
import { StudioIcon } from './StudioIcon'

export function UsageQuotaBar() {
  const { data: usage, isLoading } = useGetUsageQuery()
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null)

  const open = Boolean(anchorEl)
  const project = usage?.project
  const user = usage?.user

  const totalCalls = project?.totalCalls ?? 0
  const limitCalls = project?.limitCalls ?? 100
  const remainingCalls = project?.remainingCalls ?? (limitCalls - totalCalls)
  const percentage = project?.percentage ?? Math.min(100, Math.round((totalCalls / limitCalls) * 100))
  const emptySpacePercentage = Math.max(0, 100 - percentage)
  const maxDuration = project?.maxCallDurationMinutes ?? 5

  const handleOpen = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget)
  }

  const handleClose = () => {
    setAnchorEl(null)
  }

  return (
    <>
      {/* Navbar Clickable Bar / Pill */}
      <Button
        variant="outlined"
        size="small"
        onClick={handleOpen}
        disabled={isLoading}
        aria-label="View project usage and call limits"
        sx={{
          borderRadius: 20,
          textTransform: 'none',
          px: 1.75,
          py: 0.5,
          minHeight: 34,
          borderColor: '#dce1d1',
          bgcolor: '#fafbf7',
          color: 'text.primary',
          display: 'flex',
          alignItems: 'center',
          gap: 1.25,
          boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
          transition: 'all 0.15s ease',
          '&:hover': {
            bgcolor: '#f2f4ec',
            borderColor: '#c6ceb9',
          },
        }}
      >
        <Stack direction="row" alignItems="center" spacing={1}>
          <Box
            sx={{
              width: 7.5,
              height: 7.5,
              borderRadius: '50%',
              bgcolor: percentage > 85 ? '#e53e3e' : percentage > 50 ? '#dd6b20' : '#38a169',
            }}
          />
          <Typography variant="caption" fontWeight={600} sx={{ fontSize: 11.5 }}>
            Limit: {totalCalls}/{limitCalls} calls
          </Typography>
        </Stack>

        {/* Mini progress bar on pill */}
        <Box sx={{ width: 48, height: 6, borderRadius: 3, bgcolor: '#e2e8f0', overflow: 'hidden' }}>
          <Box
            sx={{
              width: `${percentage}%`,
              height: '100%',
              bgcolor: percentage > 85 ? '#e53e3e' : '#4f46e5',
              transition: 'width 0.3s ease',
            }}
          />
        </Box>
      </Button>

      {/* Dropdown Popover */}
      <Popover
        open={open}
        anchorEl={anchorEl}
        onClose={handleClose}
        anchorOrigin={{
          vertical: 'bottom',
          horizontal: 'right',
        }}
        transformOrigin={{
          vertical: 'top',
          horizontal: 'right',
        }}
        slotProps={{
          paper: {
            sx: {
              mt: 1.25,
              p: 2.5,
              width: 330,
              borderRadius: 3,
              boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1), 0 8px 10px -6px rgba(0,0,0,0.05)',
              border: 1,
              borderColor: 'divider',
            },
          },
        }}
      >
        {/* Header */}
        <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
          <Stack direction="row" alignItems="center" spacing={1}>
            <Box sx={{ width: 26, height: 26, borderRadius: '50%', bgcolor: '#eef2ff', display: 'grid', placeItems: 'center' }}>
              <StudioIcon name="phone" sx={{ fontSize: 14, color: '#4f46e5' }} />
            </Box>
            <Typography variant="subtitle2" fontWeight={700} fontSize={14}>
              Project Voice Quota
            </Typography>
          </Stack>
          <Chip
            label="Free Tier"
            size="small"
            sx={{ height: 20, fontSize: 10, fontWeight: 600, bgcolor: '#e8f5e9', color: '#2e7d32' }}
          />
        </Stack>

        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 2, lineHeight: 1.5 }}>
          Usage limit across all users in this project. Real-time consumption vs remaining empty space.
        </Typography>

        {/* Visual Progress Bar */}
        <Box sx={{ mb: 1.5 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.75 }}>
            <Typography variant="caption" fontWeight={600} color="text.primary">
              Consumed: {percentage}%
            </Typography>
            <Typography variant="caption" fontWeight={500} color="text.secondary">
              Available: {emptySpacePercentage}%
            </Typography>
          </Box>

          <Box
            sx={{
              position: 'relative',
              height: 12,
              borderRadius: 6,
              bgcolor: '#e2e8f0', // Empty space
              overflow: 'hidden',
            }}
          >
            <Box
              sx={{
                width: `${percentage}%`,
                height: '100%',
                borderRadius: 6,
                background: percentage > 85 ? 'linear-gradient(90deg, #f87171, #ef4444)' : 'linear-gradient(90deg, #6366f1, #4f46e5)',
                transition: 'width 0.4s ease',
              }}
            />
          </Box>
        </Box>

        {/* Metrics Grid */}
        <Stack spacing={1.25} sx={{ mt: 2, p: 1.5, bgcolor: '#f8fafc', borderRadius: 2, border: 1, borderColor: '#f1f5f9' }}>
          <Stack direction="row" justifyContent="space-between" alignItems="center">
            <Typography variant="caption" color="text.secondary">Total Calls Made:</Typography>
            <Typography variant="caption" fontWeight={600}>
              {totalCalls} / {limitCalls} calls
            </Typography>
          </Stack>
          <Stack direction="row" justifyContent="space-between" alignItems="center">
            <Typography variant="caption" color="text.secondary">Remaining Quota:</Typography>
            <Typography variant="caption" fontWeight={600} sx={{ color: remainingCalls <= 5 ? '#dc2626' : '#16a34a' }}>
              {remainingCalls} calls left
            </Typography>
          </Stack>
          <Stack direction="row" justifyContent="space-between" alignItems="center">
            <Typography variant="caption" color="text.secondary">Your Total Talk Time:</Typography>
            <Typography variant="caption" fontWeight={600}>
              {user?.usedMinutes ?? 0} minutes
            </Typography>
          </Stack>
          <Stack direction="row" justifyContent="space-between" alignItems="center">
            <Typography variant="caption" color="text.secondary">Max Session Duration:</Typography>
            <Typography variant="caption" fontWeight={600} sx={{ color: '#4f46e5' }}>
              {maxDuration} minutes per call
            </Typography>
          </Stack>
        </Stack>

        <Divider sx={{ my: 1.75 }} />

        {/* Footer Note */}
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', fontSize: 11, lineHeight: 1.5 }}>
          💡 Each voice call automatically disconnects after <strong>{maxDuration} minutes</strong> to safeguard project resources.
        </Typography>
      </Popover>
    </>
  )
}
