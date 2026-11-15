import { lazy, Suspense, useState } from 'react'
import {
  Alert,
  Box,
  Button,
  Card,
  CardActionArea,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Divider,
  FormControl,
  MenuItem,
  Paper,
  Select,
  Snackbar,
  Stack,
  Tab,
  Tabs,
  TextField,
  Typography,
} from '@mui/material'
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
import { useListKbNotesQuery, useListKnowledgeBasesQuery } from '../api/agents-api'

const WebCallDialog = lazy(() => import('../components/WebCallDialog').then((module) => ({ default: module.WebCallDialog })))

export const FREE_MODELS = [
  { id: 'google/gemma-4-31b-it', name: 'Google Gemma 4 31B', tag: 'High reasoning · Free tier' },
  { id: 'google/gemma-2-9b-it', name: 'Google Gemma 2 9B', tag: 'Fast & lightweight · Free tier' },
  { id: 'meta/llama-3.1-8b-instruct', name: 'Meta Llama 3.1 8B', tag: 'Low latency · Open weights' },
] as const

export const FREE_VOICES = [
  { id: 'fa4c9eb3dccc4806b382b40d61c6b10a', name: 'Natural Assistant (Fish Audio)', tag: 'Warm & balanced · Free tier' },
  { id: 'generic-female-1', name: 'Expressive Female (Fish Audio)', tag: 'Conversational · Free tier' },
  { id: 'generic-male-1', name: 'Warm Male (Fish Audio)', tag: 'Clear & professional · Free tier' },
] as const

type TabKey = 'prompt' | 'voice-engine' | 'knowledge-base' | 'test-call'

export function AgentEditorPage() {
  const { agentId } = useParams()
  const [searchParams] = useSearchParams()
  const workspace = useAgentWorkspace(agentId)
  if (workspace.notFound) return <Box sx={{ py: 8, textAlign: 'center' }}><Typography variant="h5">Agent not found</Typography><Typography color="text.secondary">This agent is unavailable in your account.</Typography><Button component={Link} to="/dashboard">Back to agents</Button></Box>
  if (!workspace.ready) return <WorkspaceStatus error={workspace.error} retry={workspace.retry} />
  const existing = workspace.agent
  const initialTemplate = workspace.templates.find((item) => item.id === searchParams.get('template'))
  return <AgentEditor key={`${workspace.ownerId}-${agentId ?? `new-${initialTemplate?.id}`}`} ownerId={workspace.ownerId} existing={existing} initialTemplate={initialTemplate} templates={workspace.templates} onSave={workspace.saveAgent} onDelete={workspace.deleteAgent} />
}

type EditorProps = {
  ownerId?: string
  existing?: SavedAgent
  templates: PromptTemplate[]
  initialTemplate?: PromptTemplate
  onSave: (values: AgentFormValues, id?: string) => Promise<SavedAgent>
  onDelete?: (id: string) => Promise<unknown>
}

function AgentEditor({ ownerId, existing, initialTemplate, templates, onSave, onDelete }: EditorProps) {
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState<TabKey>('prompt')
  const [error, setError] = useState<string | null>(null)
  const [savedNotice, setSavedNotice] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [callOpen, setCallOpen] = useState(false)
  const [pendingTemplate, setPendingTemplate] = useState<PromptTemplate | 'custom' | null>(null)
  const [selectedModel, setSelectedModel] = useState<string>('google/gemma-4-31b-it')
  const [selectedVoice, setSelectedVoice] = useState<string>('fa4c9eb3dccc4806b382b40d61c6b10a')

  const { data: kbs = [] } = useListKnowledgeBasesQuery(ownerId ?? '', { skip: !ownerId })
  const { control, handleSubmit, reset, setValue, getValues, formState: { isDirty, isSubmitting } } = useForm<AgentFormValues>({
    resolver: zodResolver(agentFormSchema),
    defaultValues: existing ? { name: existing.name, prompt: existing.prompt, templateId: existing.templateId, knowledgeBaseId: existing.knowledgeBaseId ?? null }
      : { name: initialTemplate?.title ?? '', prompt: initialTemplate?.prompt ?? '', templateId: initialTemplate?.id ?? 'custom', knowledgeBaseId: null },
  })
  const [name, prompt, templateId, knowledgeBaseId] = useWatch({ control, name: ['name', 'prompt', 'templateId', 'knowledgeBaseId'] })

  // Query notes for currently attached KB if any
  const selectedKb = kbs.find((k) => k.id === knowledgeBaseId)
  const { data: attachedNotes = [] } = useListKbNotesQuery(
    { ownerId: ownerId ?? '', kbId: knowledgeBaseId ?? '' },
    { skip: !ownerId || !knowledgeBaseId }
  )

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
      reset({ name: agent.name, prompt: agent.prompt, templateId: agent.templateId, knowledgeBaseId: agent.knowledgeBaseId ?? null })
      if (!existing) {
        navigate(`/agents/${agent.id}`, { replace: true })
      } else setSavedNotice(true)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Your changes could not be saved. Please try again.')
    }
  }

  return <>
    {/* Breadcrumbs & Header */}
    <Button
      component={Link}
      to="/dashboard"
      color="inherit"
      size="small"
      startIcon={<StudioIcon name="back" sx={{ fontSize: 17 }} />}
      sx={{ px: 0, minHeight: 30, mb: 2, color: 'text.secondary' }}
    >
      All agents
    </Button>

    <Stack
      direction={{ xs: 'column', sm: 'row' }}
      justifyContent="space-between"
      alignItems={{ xs: 'flex-start', sm: 'center' }}
      spacing={2.5}
      sx={{ mb: 2.5 }}
    >
      <Box sx={{ minWidth: 0 }}>
        <Stack direction="row" alignItems="center" spacing={1.5} flexWrap="wrap" useFlexGap>
          <Typography component="h1" variant="h4" sx={{ fontSize: 28, fontWeight: 700, overflowWrap: 'anywhere' }}>
            {existing ? name || 'Untitled agent' : 'Create an agent'}
          </Typography>
          <Chip
            size="small"
            variant="outlined"
            label={isDirty ? 'Unsaved changes' : existing ? 'Saved to account' : 'New agent'}
            sx={{
              height: 23,
              fontSize: 10,
              fontWeight: 600,
              bgcolor: isDirty ? '#fcf4e5' : '#f0f2e9',
              borderColor: isDirty ? '#e9d5ad' : '#dce1d1',
              color: isDirty ? '#896424' : '#5a694a',
            }}
          />
        </Stack>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
          Configure prompt instructions, AI model, voice, and connected knowledge bases.
        </Typography>
      </Box>

      <Stack direction="row" spacing={1.5} alignItems="center">
        {existing && (
          <Button
            type="button"
            variant="outlined"
            color="error"
            disabled={isSubmitting || isDeleting}
            startIcon={<StudioIcon name="trash" />}
            onClick={() => setDeleteOpen(true)}
            sx={{ fontSize: 13 }}
          >
            Delete
          </Button>
        )}
        <Button
          type="button"
          variant="outlined"
          color="inherit"
          disabled={!existing || isDirty}
          startIcon={<StudioIcon name="mic" />}
          onClick={() => setCallOpen(true)}
          sx={{ fontSize: 13, bgcolor: '#ffffff' }}
        >
          Web Call
        </Button>
        <Button
          form="agent-form"
          type="submit"
          variant="contained"
          loading={isSubmitting}
          disabled={(!!existing && !isDirty) || isDeleting}
          startIcon={<StudioIcon name="check" />}
          sx={{ fontSize: 13, fontWeight: 600 }}
        >
          {existing ? 'Save changes' : 'Save agent'}
        </Button>
      </Stack>
    </Stack>

    {error && <Alert severity="error" sx={{ mb: 2.5 }}>{error}</Alert>}

    {/* Reference OpenMic Navigation Tabs */}
    <Paper
      variant="outlined"
      sx={{
        borderRadius: 2.5,
        bgcolor: '#ffffff',
        mb: 3,
        px: 1,
        py: 0.5,
        display: 'flex',
        alignItems: 'center',
        borderColor: 'divider',
        boxShadow: '0 1px 2px rgba(0,0,0,0.02)',
      }}
    >
      <Tabs
        value={activeTab}
        onChange={(_, val) => setActiveTab(val)}
        variant="scrollable"
        scrollButtons="auto"
        sx={{
          minHeight: 42,
          '& .MuiTab-root': {
            minHeight: 40,
            textTransform: 'none',
            fontWeight: 500,
            fontSize: 13,
            gap: 1.2,
            px: 2.2,
            py: 1,
            color: '#64748b',
            borderRadius: 2,
            transition: 'all 0.15s ease',
            '&:hover': {
              bgcolor: '#f8fafc',
              color: '#0f172a',
            },
            '&.Mui-selected': {
              color: '#0f172a',
              fontWeight: 600,
              bgcolor: '#f1f5f9',
            },
          },
          '& .MuiTabs-indicator': {
            display: 'none',
          },
        }}
      >
        <Tab
          icon={<StudioIcon name="edit" sx={{ fontSize: 16 }} />}
          iconPosition="start"
          label="Prompt"
          value="prompt"
        />
        <Tab
          icon={<StudioIcon name="mic" sx={{ fontSize: 16 }} />}
          iconPosition="start"
          label="Voice & AI Model"
          value="voice-engine"
        />
        <Tab
          icon={<StudioIcon name="book" sx={{ fontSize: 16 }} />}
          iconPosition="start"
          label={
            <Stack direction="row" alignItems="center" spacing={1}>
              <span>Knowledge Base</span>
              {knowledgeBaseId && (
                <Chip
                  label="Connected"
                  size="small"
                  sx={{ height: 18, fontSize: 9.5, bgcolor: '#e0f2fe', color: '#0369a1', fontWeight: 600 }}
                />
              )}
            </Stack>
          }
          value="knowledge-base"
        />
        <Tab
          icon={<StudioIcon name="phone" sx={{ fontSize: 16 }} />}
          iconPosition="start"
          label="Test Call"
          value="test-call"
        />
      </Tabs>
    </Paper>

    {/* Form wrapper for all tab contents */}
    <Box component="form" id="agent-form" noValidate onSubmit={(event) => { void handleSubmit(save)(event) }}>

      {/* TAB 1: PROMPT */}
      {activeTab === 'prompt' && (
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: existing ? '1fr' : 'minmax(0, 1fr) 290px' }, gap: 3, alignItems: 'start' }}>
          <Stack spacing={3}>
            <Paper variant="outlined" sx={{ borderRadius: 3, p: { xs: 2.5, sm: 3.5 } }}>
              <Typography component="h2" fontSize={16} fontWeight={600}>Agent identity</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, mb: 3 }}>A friendly name you’ll recognize in your workspace.</Typography>
              <Controller
                name="name"
                control={control}
                render={({ field: { ref, ...field }, fieldState: { error: fieldError } }) => (
                  <TextField
                    {...field}
                    inputRef={ref}
                    label="Agent name"
                    placeholder="e.g. Willow, your support assistant"
                    error={!!fieldError}
                    helperText={fieldError?.message}
                    slotProps={{ htmlInput: { maxLength: 100 } }}
                  />
                )}
              />
            </Paper>

            <Paper variant="outlined" sx={{ borderRadius: 3, overflow: 'hidden' }}>
              <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ px: { xs: 2.5, sm: 3.5 }, py: 2.5, borderBottom: 1, borderColor: 'divider' }} spacing={1}>
                <Box>
                  <Typography component="h2" fontSize={16} fontWeight={600}>Instructions</Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>The core prompt and persona that guides every voice conversation.</Typography>
                </Box>
                <StudioIcon name="edit" sx={{ color: '#a3aa97', fontSize: 19 }} />
              </Stack>
              <Box sx={{ p: { xs: 2.5, sm: 3.5 } }}>
                <Controller
                  name="prompt"
                  control={control}
                  render={({ field: { ref, ...field }, fieldState: { error: fieldError } }) => (
                    <TextField
                      {...field}
                      inputRef={ref}
                      label="Agent prompt"
                      multiline
                      minRows={14}
                      maxRows={30}
                      placeholder={'You are a friendly voice assistant…\n\nDescribe your agent’s role, how it should speak, and what it should help with.'}
                      error={!!fieldError}
                      helperText={fieldError?.message}
                      slotProps={{
                        htmlInput: { maxLength: 12000 },
                        input: {
                          sx: {
                            alignItems: 'flex-start',
                            bgcolor: '#fdfdfb',
                            fontFamily: 'ui-monospace, SFMono-Regular, Consolas, monospace',
                            fontSize: 13,
                            lineHeight: 1.9,
                          },
                        },
                      }}
                    />
                  )}
                />
                <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={2} sx={{ mt: 1.5 }}>
                  <Typography variant="caption" color="text.secondary">Plain text · Fully editable</Typography>
                  <Typography variant="caption" color="text.secondary">{prompt.length.toLocaleString()} / 12,000</Typography>
                </Stack>
              </Box>
              <Box sx={{ px: { xs: 2.5, sm: 3.5 }, py: 2, bgcolor: '#f6f7f1', borderTop: 1, borderColor: 'divider' }}>
                <Typography variant="caption" color="text.secondary">A good prompt defines a role, a tone, and clear boundaries.</Typography>
              </Box>
            </Paper>
          </Stack>

          {!existing && (
            <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 3 }}>
              <Typography component="h2" fontSize={15} fontWeight={600}>Starting points</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.75, mb: 2.5, lineHeight: 1.7 }}>
                A little structure to get you going. Every word is yours to change.
              </Typography>
              <Stack spacing={1.25}>
                {templates.filter((item) => item.id !== 'custom').map((template) => (
                  <Card
                    key={template.id}
                    variant="outlined"
                    sx={{
                      borderColor: templateId === template.id ? '#c5cfb5' : 'divider',
                      bgcolor: templateId === template.id ? '#f3f6ed' : 'white',
                      borderRadius: 2,
                    }}
                  >
                    <CardActionArea onClick={() => chooseTemplate(template)} sx={{ p: 1.5 }} aria-label={`Use ${template.title} template`}>
                      <Stack direction="row" alignItems="center" spacing={1.25}>
                        <TemplateMark templateId={template.id} size={32} />
                        <Typography variant="body2" fontWeight={500} sx={{ flex: 1 }}>{template.title}</Typography>
                        {templateId === template.id && <StudioIcon name="check" sx={{ fontSize: 16, color: '#66794f' }} />}
                      </Stack>
                    </CardActionArea>
                  </Card>
                ))}
              </Stack>
              <Button size="small" color="inherit" onClick={() => chooseTemplate('custom')} sx={{ mt: 1.5, color: 'text.secondary', minHeight: 32 }}>
                Start from scratch
              </Button>
            </Paper>
          )}
        </Box>
      )}

      {/* TAB 2: VOICE & AI MODEL */}
      {activeTab === 'voice-engine' && (
        <Stack spacing={3} sx={{ maxWidth: 840 }}>
          <Paper variant="outlined" sx={{ p: { xs: 2.5, sm: 3.5 }, borderRadius: 3, bgcolor: '#ffffff' }}>
            <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
              <Typography component="h2" fontSize={16} fontWeight={600}>Voice & AI Model</Typography>
              <Chip label="100% Free / Open Weights" size="small" sx={{ height: 22, fontSize: 10, bgcolor: '#e8f5e9', color: '#2e7d32', fontWeight: 600 }} />
            </Stack>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              Select the active language model and synthetic voice. All models in this studio are open-weight or free-tier.
            </Typography>

            <Stack spacing={3}>
              <Box>
                <Typography variant="caption" sx={{ fontWeight: 600, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', mb: 1 }}>
                  Large Language Model (LLM)
                </Typography>
                <FormControl fullWidth size="small">
                  <Select
                    value={selectedModel}
                    onChange={(e) => setSelectedModel(e.target.value)}
                    sx={{ fontSize: 13.5, bgcolor: '#fafbf7' }}
                  >
                    {FREE_MODELS.map((model) => (
                      <MenuItem key={model.id} value={model.id}>
                        <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ width: '100%', py: 0.5 }}>
                          <Box sx={{ minWidth: 0, pr: 2 }}>
                            <Typography variant="body2" sx={{ fontSize: 13.5, fontWeight: 500 }}>{model.name}</Typography>
                            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', fontSize: 11 }}>{model.tag}</Typography>
                          </Box>
                          <Chip label="Free" size="small" sx={{ height: 20, fontSize: 10, bgcolor: '#eef6ea', color: '#446633' }} />
                        </Stack>
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.75 }}>
                  Powering conversational intelligence and dynamic tool calling (e.g. searching the Knowledge Base).
                </Typography>
              </Box>

              <Divider />

              <Box>
                <Typography variant="caption" sx={{ fontWeight: 600, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', mb: 1 }}>
                  Speech Synthesis Voice (TTS)
                </Typography>
                <FormControl fullWidth size="small">
                  <Select
                    value={selectedVoice}
                    onChange={(e) => setSelectedVoice(e.target.value)}
                    sx={{ fontSize: 13.5, bgcolor: '#fafbf7' }}
                  >
                    {FREE_VOICES.map((voice) => (
                      <MenuItem key={voice.id} value={voice.id}>
                        <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ width: '100%', py: 0.5 }}>
                          <Box sx={{ minWidth: 0, pr: 2 }}>
                            <Typography variant="body2" sx={{ fontSize: 13.5, fontWeight: 500 }}>{voice.name}</Typography>
                            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', fontSize: 11 }}>{voice.tag}</Typography>
                          </Box>
                          <Chip label="Free" size="small" sx={{ height: 20, fontSize: 10, bgcolor: '#eef6ea', color: '#446633' }} />
                        </Stack>
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.75 }}>
                  Powered by Fish Audio free tier for low latency, natural human inflection.
                </Typography>
              </Box>
            </Stack>
          </Paper>

          <Paper variant="outlined" sx={{ p: 3, borderRadius: 3, bgcolor: '#fbfcf8' }}>
            <Typography component="h3" fontSize={14} fontWeight={600} sx={{ mb: 1.5 }}>
              Audio Pipeline & Specifications
            </Typography>
            <Stack spacing={1.2}>
              <Stack direction="row" justifyContent="space-between">
                <Typography variant="body2" color="text.secondary">Speech-to-Text (STT):</Typography>
                <Typography variant="body2" fontWeight={500}>AssemblyAI Universal-Streaming (Free)</Typography>
              </Stack>
              <Stack direction="row" justifyContent="space-between">
                <Typography variant="body2" color="text.secondary">Turn Detection:</Typography>
                <Typography variant="body2" fontWeight={500}>Adaptive Turn Detector (Low latency)</Typography>
              </Stack>
              <Stack direction="row" justifyContent="space-between">
                <Typography variant="body2" color="text.secondary">Transport & RTC:</Typography>
                <Typography variant="body2" fontWeight={500}>LiveKit Cloud WebRTC</Typography>
              </Stack>
              <Stack direction="row" justifyContent="space-between">
                <Typography variant="body2" color="text.secondary">Vector Embeddings:</Typography>
                <Typography variant="body2" fontWeight={500}>Local ONNX all-MiniLM-L6-v2 (Zero cost)</Typography>
              </Stack>
            </Stack>
          </Paper>
        </Stack>
      )}

      {/* TAB 3: KNOWLEDGE BASE */}
      {activeTab === 'knowledge-base' && (
        <Stack spacing={3} sx={{ maxWidth: 840 }}>
          <Paper variant="outlined" sx={{ p: { xs: 2.5, sm: 3.5 }, borderRadius: 3, bgcolor: '#ffffff' }}>
            <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
              <Box>
                <Typography component="h2" fontSize={16} fontWeight={600}>Connected Knowledge Base</Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                  The selected knowledge base is queried dynamically during voice calls via tool calling.
                </Typography>
              </Box>
              <Chip
                label="Dynamic Tool"
                size="small"
                sx={{ height: 22, fontSize: 10, bgcolor: '#e8f0fe', color: '#1a73e8', fontWeight: 600 }}
              />
            </Stack>

            <Box sx={{ mt: 3, mb: 2 }}>
              <Typography variant="caption" sx={{ fontWeight: 600, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', mb: 1 }}>
                Select Knowledge Base
              </Typography>
              <Controller
                name="knowledgeBaseId"
                control={control}
                render={({ field }) => (
                  <FormControl fullWidth size="small">
                    <Select
                      value={field.value ?? ''}
                      onChange={(e) => field.onChange(e.target.value ? e.target.value : null)}
                      displayEmpty
                      sx={{ fontSize: 13.5, bgcolor: '#fafbf7' }}
                    >
                      <MenuItem value="">
                        <em>None (No knowledge base connected)</em>
                      </MenuItem>
                      {kbs.map((kb) => (
                        <MenuItem key={kb.id} value={kb.id}>
                          <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ width: '100%', py: 0.25 }}>
                            <Stack direction="row" alignItems="center" spacing={1.2}>
                              <StudioIcon name="book" sx={{ fontSize: 16, color: '#475569' }} />
                              <span style={{ fontWeight: 500 }}>{kb.name}</span>
                            </Stack>
                            <Chip
                              label={`${kb.itemCount} ${kb.itemCount === 1 ? 'note' : 'notes'}`}
                              size="small"
                              sx={{ height: 20, fontSize: 10.5, bgcolor: '#f1f5f9' }}
                            />
                          </Stack>
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                )}
              />
            </Box>

            <Stack direction="row" spacing={1.5} sx={{ mt: 2 }}>
              <Button
                component={Link}
                to="/knowledge-bases"
                variant="outlined"
                size="small"
                startIcon={<StudioIcon name="plus" sx={{ fontSize: 15 }} />}
                sx={{ fontSize: 12.5 }}
              >
                Create new Knowledge Base
              </Button>
              <Button
                component={Link}
                to="/knowledge-bases"
                color="inherit"
                size="small"
                endIcon={<StudioIcon name="arrow" sx={{ fontSize: 14 }} />}
                sx={{ fontSize: 12.5, color: 'text.secondary' }}
              >
                Manage all Knowledge Bases
              </Button>
            </Stack>
          </Paper>

          {/* Connected KB Preview or Empty State */}
          {selectedKb ? (
            <Paper variant="outlined" sx={{ p: 3, borderRadius: 3, bgcolor: '#f8fafc', borderColor: '#cbd5e1' }}>
              <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2 }}>
                <Stack direction="row" alignItems="center" spacing={1.5}>
                  <Box sx={{ width: 36, height: 36, borderRadius: '50%', bgcolor: '#e0f2fe', display: 'grid', placeItems: 'center' }}>
                    <StudioIcon name="book" sx={{ fontSize: 18, color: '#0369a1' }} />
                  </Box>
                  <Box>
                    <Typography variant="subtitle2" fontWeight={600} fontSize={14.5}>{selectedKb.name}</Typography>
                    <Typography variant="caption" color="text.secondary">{selectedKb.description || 'No description provided'}</Typography>
                  </Box>
                </Stack>
                <Chip
                  label="Active & Ready"
                  size="small"
                  sx={{ height: 22, fontSize: 10, bgcolor: '#dcfce7', color: '#15803d', fontWeight: 600 }}
                />
              </Stack>

              <Typography variant="caption" sx={{ fontWeight: 600, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', mb: 1.5 }}>
                Indexed Notes Preview ({attachedNotes.length})
              </Typography>

              {attachedNotes.length === 0 ? (
                <Box sx={{ p: 2.5, bgcolor: '#ffffff', borderRadius: 2, textAlign: 'center', border: '1px dashed #cbd5e1' }}>
                  <Typography variant="body2" color="text.secondary">This knowledge base has no notes yet.</Typography>
                  <Button component={Link} to="/knowledge-bases" size="small" sx={{ mt: 1 }}>+ Add Notes in Knowledge Base Manager</Button>
                </Box>
              ) : (
                <Stack spacing={1.5}>
                  {attachedNotes.map((note) => (
                    <Box key={note.id} sx={{ p: 2, bgcolor: '#ffffff', borderRadius: 2, border: 1, borderColor: '#e2e8f0' }}>
                      <Typography variant="body2" fontWeight={600} fontSize={13}>{note.title}</Typography>
                      <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, lineHeight: 1.6, overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                        {note.content}
                      </Typography>
                    </Box>
                  ))}
                </Stack>
              )}

              <Box sx={{ mt: 2.5, p: 2, bgcolor: '#f1f5f9', borderRadius: 2 }}>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', lineHeight: 1.6 }}>
                  💡 <strong>How Tool Calling Works:</strong> During voice calls, when a caller asks a question that isn't answered in your prompt, the agent autonomously executes <code>query_knowledge_base</code> to fetch the most relevant snippets from these notes.
                </Typography>
              </Box>
            </Paper>
          ) : (
            <Paper variant="outlined" sx={{ p: 3.5, borderRadius: 3, textAlign: 'center', bgcolor: '#fafafa' }}>
              <Box sx={{ width: 44, height: 44, borderRadius: '50%', bgcolor: '#f1f5f9', display: 'grid', placeItems: 'center', mx: 'auto', mb: 1.5 }}>
                <StudioIcon name="book" sx={{ fontSize: 22, color: '#94a3b8' }} />
              </Box>
              <Typography variant="subtitle2" fontWeight={600} fontSize={15}>No Knowledge Base Connected</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, mb: 2, maxWidth: 460, mx: 'auto' }}>
                Connect a knowledge base from the dropdown above to provide your agent with domain knowledge, product facts, or company documentation.
              </Typography>
            </Paper>
          )}
        </Stack>
      )}

      {/* TAB 4: TEST CALL */}
      {activeTab === 'test-call' && (
        <Stack spacing={3} sx={{ maxWidth: 840 }}>
          <Paper variant="outlined" sx={{ p: { xs: 3, sm: 4 }, borderRadius: 3, bgcolor: '#eeeee5' }}>
            <Box sx={{ width: 44, height: 44, bgcolor: '#e0e3d4', borderRadius: '50%', display: 'grid', placeItems: 'center', mb: 2 }}>
              <StudioIcon name="mic" sx={{ fontSize: 22, color: '#566344' }} />
            </Box>
            <Typography component="h2" fontSize={18} fontWeight={700}>Hear it in action.</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.75, mt: 1, mb: 3, maxWidth: 600 }}>
              Try a real-time browser conversation with your agent. Test voice latency, persona adherence, and dynamic knowledge base tool retrieval.
            </Typography>

            <Button
              variant="contained"
              size="large"
              startIcon={<StudioIcon name="mic" />}
              disabled={!existing || isDirty}
              onClick={() => setCallOpen(true)}
              sx={{ px: 4, py: 1.25, fontSize: 14, fontWeight: 600 }}
            >
              Start Web Call
            </Button>

            {(!existing || isDirty) && (
              <Alert severity="info" sx={{ mt: 2.5, maxWidth: 540 }}>
                Please save your agent changes using the <strong>Save changes</strong> button in the top bar before launching Web Call.
              </Alert>
            )}
          </Paper>

          <Paper variant="outlined" sx={{ p: 3, borderRadius: 3, bgcolor: '#ffffff' }}>
            <Typography component="h3" fontSize={14} fontWeight={600} sx={{ mb: 2 }}>
              Current Agent Configuration Summary
            </Typography>
            <Stack spacing={1.5}>
              <Stack direction="row" justifyContent="space-between">
                <Typography variant="body2" color="text.secondary">Agent Name:</Typography>
                <Typography variant="body2" fontWeight={500}>{name || 'Untitled'}</Typography>
              </Stack>
              <Stack direction="row" justifyContent="space-between">
                <Typography variant="body2" color="text.secondary">Prompt Length:</Typography>
                <Typography variant="body2" fontWeight={500}>{prompt.length} characters</Typography>
              </Stack>
              <Stack direction="row" justifyContent="space-between">
                <Typography variant="body2" color="text.secondary">AI Model:</Typography>
                <Typography variant="body2" fontWeight={500}>{FREE_MODELS.find((m) => m.id === selectedModel)?.name}</Typography>
              </Stack>
              <Stack direction="row" justifyContent="space-between">
                <Typography variant="body2" color="text.secondary">TTS Voice:</Typography>
                <Typography variant="body2" fontWeight={500}>{FREE_VOICES.find((v) => v.id === selectedVoice)?.name}</Typography>
              </Stack>
              <Stack direction="row" justifyContent="space-between">
                <Typography variant="body2" color="text.secondary">Attached Knowledge Base:</Typography>
                <Typography variant="body2" fontWeight={500}>
                  {selectedKb ? `${selectedKb.name} (${selectedKb.itemCount} notes)` : 'None'}
                </Typography>
              </Stack>
            </Stack>
          </Paper>
        </Stack>
      )}

    </Box>

    {/* Dialogs */}
    {callOpen && (
      <Suspense fallback={<Typography role="status">Loading voice controls?</Typography>}>
        <WebCallDialog agentId={existing?.id ?? ''} agentName={existing?.name ?? name} open onClose={() => setCallOpen(false)} />
      </Suspense>
    )}

    <Dialog open={deleteOpen} onClose={() => !isDeleting && setDeleteOpen(false)} maxWidth="xs" fullWidth aria-labelledby="delete-agent-title">
      <DialogTitle id="delete-agent-title">Delete agent?</DialogTitle>
      <DialogContent>
        <DialogContentText>
          Are you sure you want to delete <strong>{existing?.name || name || 'this agent'}</strong>? This action cannot be undone.
        </DialogContentText>
      </DialogContent>
      <DialogActions sx={{ p: 2.5 }}>
        <Button color="inherit" disabled={isDeleting} onClick={() => setDeleteOpen(false)}>Cancel</Button>
        <Button
          variant="contained"
          color="error"
          loading={isDeleting}
          onClick={async () => {
            if (!existing || !onDelete) return
            setIsDeleting(true)
            setError(null)
            try {
              await onDelete(existing.id)
              navigate('/dashboard', { replace: true })
            } catch (cause) {
              setError(cause instanceof Error ? cause.message : 'Could not delete agent. Please try again.')
              setDeleteOpen(false)
              setIsDeleting(false)
            }
          }}
        >
          Delete
        </Button>
      </DialogActions>
    </Dialog>

    <Dialog open={!!pendingTemplate} onClose={() => setPendingTemplate(null)} maxWidth="xs" fullWidth aria-labelledby="replace-prompt-title">
      <DialogTitle id="replace-prompt-title">Replace this prompt?</DialogTitle>
      <DialogContent>
        <DialogContentText>
          The selected starting point will replace the text in your prompt editor. Your saved version stays unchanged until you save.
        </DialogContentText>
      </DialogContent>
      <DialogActions sx={{ p: 2.5 }}>
        <Button color="inherit" onClick={() => setPendingTemplate(null)}>Keep my prompt</Button>
        <Button variant="contained" onClick={() => pendingTemplate && applyTemplate(pendingTemplate)}>Replace prompt</Button>
      </DialogActions>
    </Dialog>

    <Snackbar open={savedNotice} autoHideDuration={3500} onClose={() => setSavedNotice(false)}>
      <Alert severity="success" variant="filled" onClose={() => setSavedNotice(false)}>Agent saved to your account.</Alert>
    </Snackbar>
  </>
}
