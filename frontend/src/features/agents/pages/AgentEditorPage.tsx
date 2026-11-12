import { lazy, Suspense, useState } from 'react'
import { Alert, Box, Button, Card, CardActionArea, Chip, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle, Paper, Snackbar, Stack, TextField, Typography } from '@mui/material'
import { Controller, useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router'
import { agentFormSchema } from 'backend/validator/agent'
import type { AgentFormValues } from 'backend/validator/agent'
import { StudioIcon } from '../../../components/StudioIcon'
import { TemplateMark } from '../components/TemplateMark'
import { WorkspaceStatus } from '../components/WorkspaceStatus'
import type { PromptTemplate } from '../data/prompt-templates'
import { useAgentWorkspace } from '../hooks/useAgentWorkspace'
import type { SavedAgent } from '../types'

const WebCallDialog = lazy(() => import('../components/WebCallDialog').then((module) => ({ default: module.WebCallDialog })))

export function AgentEditorPage() {
  const { agentId } = useParams()
  const [searchParams] = useSearchParams()
  const workspace = useAgentWorkspace(agentId)
  if (workspace.notFound) return <Box sx={{ py: 8, textAlign: 'center' }}><Typography variant="h5">Agent not found</Typography><Typography color="text.secondary">This agent is unavailable in your account.</Typography><Button component={Link} to="/dashboard">Back to agents</Button></Box>
  if (!workspace.ready) return <WorkspaceStatus error={workspace.error} retry={workspace.retry} />
  const existing = workspace.agent
  const initialTemplate = workspace.templates.find((item) => item.id === searchParams.get('template'))
  return <AgentEditor key={`${workspace.ownerId}-${agentId ?? `new-${initialTemplate?.id}`}`} existing={existing} initialTemplate={initialTemplate} templates={workspace.templates} onSave={workspace.saveAgent} />
}

type EditorProps = {
  existing?: SavedAgent
  templates: PromptTemplate[]
  initialTemplate?: PromptTemplate
  onSave: (values: AgentFormValues, id?: string) => Promise<SavedAgent>
}

function AgentEditor({ existing, initialTemplate, templates, onSave }: EditorProps) {
  const navigate = useNavigate()
  const [error, setError] = useState<string | null>(null)
  const [savedNotice, setSavedNotice] = useState(false)
  const [callOpen, setCallOpen] = useState(false)
  const [pendingTemplate, setPendingTemplate] = useState<PromptTemplate | 'custom' | null>(null)
  const { control, handleSubmit, reset, setValue, getValues, formState: { isDirty, isSubmitting } } = useForm<AgentFormValues>({
    resolver: zodResolver(agentFormSchema),
    defaultValues: existing ? { name: existing.name, prompt: existing.prompt, templateId: existing.templateId }
      : { name: initialTemplate?.title ?? '', prompt: initialTemplate?.prompt ?? '', templateId: initialTemplate?.id ?? 'custom' },
  })
  const [name, prompt, templateId] = useWatch({ control, name: ['name', 'prompt', 'templateId'] })

  function applyTemplate(template: PromptTemplate | 'custom') {
    const custom = template === 'custom'
    setValue('prompt', custom ? '' : template.prompt, { shouldDirty: true, shouldValidate: true })
    setValue('templateId', custom ? 'custom' : template.id, { shouldDirty: true })
    if (!getValues('name').trim() && !custom) setValue('name', template.title, { shouldDirty: true })
    setPendingTemplate(null)
  }

  function chooseTemplate(template: PromptTemplate | 'custom') {
    if (getValues('prompt').trim()) setPendingTemplate(template)
    else applyTemplate(template)
  }

  async function save(values: AgentFormValues) {
    setError(null)
    try {
      const agent = await onSave(values, existing?.id)
      reset({ name: agent.name, prompt: agent.prompt, templateId: agent.templateId })
      if (!existing) {
        navigate(`/agents/${agent.id}`, { replace: true })
      } else setSavedNotice(true)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Your changes could not be saved. Please try again.')
    }
  }

  return <>
    <Button component={Link} to="/dashboard" color="inherit" size="small" startIcon={<StudioIcon name="back" sx={{ fontSize: 17 }} />} sx={{ px: 0, minHeight: 30, mb: 2.5, color: 'text.secondary' }}>All agents</Button>
    <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ xs: 'flex-start', sm: 'center' }} spacing={2.5} sx={{ mb: 3.5 }}>
      <Box sx={{ minWidth: 0 }}>
        <Stack direction="row" alignItems="center" spacing={1.5} flexWrap="wrap" useFlexGap>
          <Typography component="h1" variant="h4" sx={{ fontSize: 30, overflowWrap: 'anywhere' }}>{existing ? name || 'Untitled agent' : 'Create an agent'}</Typography>
          <Chip size="small" variant="outlined" label={isDirty ? 'Unsaved changes' : existing ? 'Saved to your account' : 'New agent'} sx={{ height: 23, fontSize: 10, bgcolor: isDirty ? '#fcf4e5' : '#f0f2e9', borderColor: isDirty ? '#e9d5ad' : '#dce1d1', color: isDirty ? '#896424' : '#5a694a' }} />
        </Stack>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>Give it a purpose. Make it sound like you.</Typography>
      </Box>
      <Button form="agent-form" type="submit" variant="contained" loading={isSubmitting} disabled={!!existing && !isDirty} startIcon={<StudioIcon name="check" />}>{existing ? 'Save changes' : 'Save agent'}</Button>
    </Stack>
    {error && <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>}

    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: 'minmax(0, 1fr) 290px' }, gap: 3, alignItems: 'start' }}>
      <Box component="form" id="agent-form" noValidate onSubmit={(event) => { void handleSubmit(save)(event) }}>
        <Paper variant="outlined" sx={{ borderRadius: 3, p: { xs: 2.5, sm: 3.5 }, mb: 3 }}>
          <Typography component="h2" fontSize={16} fontWeight={600}>Agent identity</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, mb: 3 }}>A name you’ll recognize in your workspace.</Typography>
          <Controller name="name" control={control} render={({ field: { ref, ...field }, fieldState: { error: fieldError } }) => <TextField {...field} inputRef={ref} label="Agent name" placeholder="e.g. Willow, your support assistant" error={!!fieldError} helperText={fieldError?.message} slotProps={{ htmlInput: { maxLength: 100 } }} />} />
        </Paper>
        <Paper variant="outlined" sx={{ borderRadius: 3, overflow: 'hidden' }}>
          <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ px: { xs: 2.5, sm: 3.5 }, py: 2.5, borderBottom: 1, borderColor: 'divider' }} spacing={1}>
            <Box><Typography component="h2" fontSize={16} fontWeight={600}>Instructions</Typography><Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>The prompt that shapes every conversation.</Typography></Box>
            <StudioIcon name="edit" sx={{ color: '#a3aa97', fontSize: 19 }} />
          </Stack>
          <Box sx={{ p: { xs: 2.5, sm: 3.5 } }}>
            <Controller name="prompt" control={control} render={({ field: { ref, ...field }, fieldState: { error: fieldError } }) => <TextField {...field} inputRef={ref} label="Agent prompt" multiline minRows={14} maxRows={30} placeholder={'You are a friendly voice assistant…\n\nDescribe your agent’s role, how it should speak, and what it should help with.'} error={!!fieldError} helperText={fieldError?.message} slotProps={{ htmlInput: { maxLength: 12000 }, input: { sx: { alignItems: 'flex-start', bgcolor: '#fdfdfb', fontFamily: 'ui-monospace, SFMono-Regular, Consolas, monospace', fontSize: 13, lineHeight: 1.9 } } }} />} />
            <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={2} sx={{ mt: 1.5 }}><Typography variant="caption" color="text.secondary">Plain text · Fully editable</Typography><Typography variant="caption" color="text.secondary">{prompt.length.toLocaleString()} / 12,000</Typography></Stack>
          </Box>
          <Box sx={{ px: { xs: 2.5, sm: 3.5 }, py: 2, bgcolor: '#f6f7f1', borderTop: 1, borderColor: 'divider' }}><Typography variant="caption" color="text.secondary">A good prompt defines a role, a tone, and clear boundaries.</Typography></Box>
        </Paper>
      </Box>

      <Stack spacing={3}>
        <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 3 }}>
          <Typography component="h2" fontSize={15} fontWeight={600}>Starting points</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.75, mb: 2.5, lineHeight: 1.7 }}>A little structure to get you going. Every word is yours to change.</Typography>
          <Stack spacing={1.25}>{templates.filter((item) => item.id !== 'custom').map((template) => <Card key={template.id} variant="outlined" sx={{ borderColor: templateId === template.id ? '#c5cfb5' : 'divider', bgcolor: templateId === template.id ? '#f3f6ed' : 'white', borderRadius: 2 }}>
            <CardActionArea onClick={() => chooseTemplate(template)} sx={{ p: 1.5 }} aria-label={`Use ${template.title} template`}>
              <Stack direction="row" alignItems="center" spacing={1.25}><TemplateMark templateId={template.id} size={32} /><Typography variant="body2" fontWeight={500} sx={{ flex: 1 }}>{template.title}</Typography>{templateId === template.id && <StudioIcon name="check" sx={{ fontSize: 16, color: '#66794f' }} />}</Stack>
            </CardActionArea>
          </Card>)}</Stack>
          <Button size="small" color="inherit" onClick={() => chooseTemplate('custom')} sx={{ mt: 1.5, color: 'text.secondary', minHeight: 32 }}>Start from scratch</Button>
        </Paper>
        <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 3, bgcolor: '#eeeee5' }}>
          <Box sx={{ width: 38, height: 38, bgcolor: '#e0e3d4', borderRadius: '50%', display: 'grid', placeItems: 'center', mb: 2 }}><StudioIcon name="mic" sx={{ fontSize: 19, color: '#566344' }} /></Box>
          <Typography component="h2" fontSize={16} fontWeight={600}>Hear it in action.</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.75, mt: 1, mb: 2.5 }}>Try a browser conversation with your agent’s saved instructions.</Typography>
          <Button variant="outlined" color="inherit" startIcon={<StudioIcon name="mic" />} disabled={!existing || isDirty} fullWidth onClick={() => setCallOpen(true)} sx={{ bgcolor: 'white', borderColor: '#c9cfbd' }}>Web Call</Button>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', lineHeight: 1.6, mt: 1.5 }}>{!existing || isDirty ? 'Save your agent before opening Web Call.' : 'Start a conversation using your saved instructions.'}</Typography>
        </Paper>
        <Box sx={{ px: 0.5 }}><Typography variant="caption" color="text.secondary" sx={{ lineHeight: 1.8 }}>Agents sync to your account. Each call uses the instructions saved when it starts.</Typography></Box>
      </Stack>
    </Box>

    {callOpen && <Suspense fallback={<Typography role="status">Loading voice controls?</Typography>}><WebCallDialog agentId={existing?.id ?? ''} agentName={existing?.name ?? name} open onClose={() => setCallOpen(false)} /></Suspense>}
    <Dialog open={!!pendingTemplate} onClose={() => setPendingTemplate(null)} maxWidth="xs" fullWidth aria-labelledby="replace-prompt-title">
      <DialogTitle id="replace-prompt-title">Replace this prompt?</DialogTitle>
      <DialogContent><DialogContentText>The selected starting point will replace the text in your prompt editor. Your saved version stays unchanged until you save.</DialogContentText></DialogContent>
      <DialogActions sx={{ p: 2.5 }}><Button color="inherit" onClick={() => setPendingTemplate(null)}>Keep my prompt</Button><Button variant="contained" onClick={() => pendingTemplate && applyTemplate(pendingTemplate)}>Replace prompt</Button></DialogActions>
    </Dialog>
    <Snackbar open={savedNotice} autoHideDuration={3500} onClose={() => setSavedNotice(false)}><Alert severity="success" variant="filled" onClose={() => setSavedNotice(false)}>Agent saved to your account.</Alert></Snackbar>
  </>
}
