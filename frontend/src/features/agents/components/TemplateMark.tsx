import { Box } from '@mui/material'
import type { AgentFormValues } from 'backend/validator/agent'
import { StudioIcon } from '../../../components/StudioIcon'
import { findTemplate } from '../data/prompt-templates'

export function TemplateMark({ templateId, size = 42 }: { templateId: AgentFormValues['templateId']; size?: number }) {
  const template = findTemplate(templateId)
  const icon = templateId === 'custom' ? 'edit' : templateId === 'support' ? 'support' : templateId === 'receptionist' ? 'greeting' : 'spark'
  return <Box sx={{ width: size, height: size, display: 'grid', placeItems: 'center', flexShrink: 0, borderRadius: 2, bgcolor: template?.background ?? '#f0f0e9', color: template?.color ?? '#6e746b' }}><StudioIcon name={icon} sx={{ fontSize: size * 0.5 }} /></Box>
}
