import { lazy, Suspense, useState } from 'react'
import { Box, Button, Card, CardActionArea, CardActions, Chip, InputAdornment, Stack, TextField, Typography } from '@mui/material'
import { Link } from 'react-router'
import { StudioIcon } from '../../../components/StudioIcon'
import { TemplateMark } from '../../agents/components/TemplateMark'
import { WorkspaceStatus } from '../../agents/components/WorkspaceStatus'
import { CreateAgentDialog } from '../../agents/components/CreateAgentDialog'
import { useAgentWorkspace } from '../../agents/hooks/useAgentWorkspace'
import type { SavedAgent } from '../../agents/types'

const WebCallDialog = lazy(() => import('../../agents/components/WebCallDialog').then((module) => ({ default: module.WebCallDialog })))

export function DashboardPage() {
  const { agents, templates, ready, error, retry } = useAgentWorkspace()
  const [search, setSearch] = useState('')
  const [calling, setCalling] = useState<SavedAgent | null>(null)
  const [createOpen, setCreateOpen] = useState(false)
  const filtered = agents.filter((agent) => agent.name.toLowerCase().includes(search.trim().toLowerCase()))

  if (!ready) return <WorkspaceStatus error={error} retry={retry} />

  return <>
    {agents.length > 0 && <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ xs: 'flex-start', sm: 'center' }} spacing={2.5} sx={{ mb: 4 }}>
      <Box><Typography component="h1" variant="h4" sx={{ fontSize: { xs: 30, md: 34 } }}>Your agents</Typography><Typography color="text.secondary" sx={{ mt: 1 }}>A little direction. A voice of your own.</Typography></Box>
      <Button onClick={() => setCreateOpen(true)} variant="contained" startIcon={<StudioIcon name="plus" />}>Create agent</Button>
    </Stack>}
    {agents.length > 0 && <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2.5 }} spacing={2}>
      <Stack direction="row" alignItems="center" spacing={1}><Typography variant="body2" fontWeight={600}>All agents</Typography><Chip label={agents.length} size="small" sx={{ height: 22, minWidth: 26, bgcolor: '#e9eade', fontSize: 11 }} /></Stack>
      {agents.length > 0 && <TextField size="small" placeholder="Search agents" value={search} onChange={(event) => setSearch(event.target.value)} sx={{ maxWidth: 255 }} slotProps={{ htmlInput: { 'aria-label': 'Search agents' }, input: { startAdornment: <InputAdornment position="start"><StudioIcon name="search" sx={{ fontSize: 19 }} /></InputAdornment> } }} />}
    </Stack>}
    {agents.length === 0 ? <Box sx={{ minHeight: '65svh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', px: 3, py: 6, textAlign: 'center' }}>
      <Box sx={{ width: 58, height: 58, borderRadius: 3, bgcolor: '#e9ecdf', display: 'grid', placeItems: 'center', mx: 'auto', mb: 2.5 }}><StudioIcon name="spark" sx={{ fontSize: 26, color: '#687457' }} /></Box>
      <Button onClick={() => setCreateOpen(true)} variant="contained" startIcon={<StudioIcon name="plus" />}>Create your first agent</Button>
    </Box> : filtered.length === 0 ? <Box sx={{ py: 7, textAlign: 'center', border: 1, borderColor: 'divider', borderRadius: 3 }}><Typography fontWeight={600}>No matching agents</Typography><Button onClick={() => setSearch('')} sx={{ mt: 1 }}>Clear search</Button></Box> : <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))', xl: 'repeat(3, minmax(0, 1fr))' }, gap: 2.5 }}>
      {filtered.map((agent) => <Card key={agent.id} variant="outlined" sx={{ borderRadius: 3, boxShadow: '0 2px 5px #22272003', display: 'flex', flexDirection: 'column' }}>
        <CardActionArea component={Link} to={`/agents/${agent.id}`} sx={{ p: 3, flexGrow: 1, alignItems: 'flex-start' }}>
          <Stack direction="row" justifyContent="space-between" alignItems="center"><TemplateMark templateId={agent.templateId} /><StudioIcon name="arrow" sx={{ fontSize: 18, color: 'text.secondary' }} /></Stack>
          <Typography component="h2" fontSize={18} fontWeight={600} sx={{ mt: 2.5, overflowWrap: 'anywhere' }}>{agent.name}</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>{templates.find((item) => item.id === agent.templateId)?.title ?? 'Custom prompt'}</Typography>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 2 }}>Edited {new Date(agent.updatedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} · Saved to your account</Typography>
        </CardActionArea>
        <CardActions sx={{ borderTop: 1, borderColor: 'divider', p: 1.5, px: 2.5 }}><Button size="small" color="inherit" startIcon={<StudioIcon name="mic" sx={{ fontSize: 17 }} />} onClick={() => setCalling(agent)}>Web Call</Button></CardActions>
      </Card>)}
    </Box>}

    {agents.length > 0 && <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 3 }}>Agents sync to your account. Web Call uses each agent's saved instructions.</Typography>}
    <CreateAgentDialog open={createOpen} onClose={() => setCreateOpen(false)} />
    {calling && <Suspense fallback={<Typography role="status">Loading voice controls?</Typography>}><WebCallDialog agentId={calling.id} open agentName={calling.name} onClose={() => setCalling(null)} /></Suspense>}
  </>
}
