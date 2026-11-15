import { useState } from 'react'
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Divider,
  Drawer,
  IconButton,
  Paper,
  Stack,
  TextField,
  Typography,
} from '@mui/material'
import { StudioIcon } from '../../../components/StudioIcon'
import { useGetSessionQuery } from '../../auth/api/auth-api'
import {
  useAddKbNoteMutation,
  useCreateKnowledgeBaseMutation,
  useDeleteKbNoteMutation,
  useDeleteKnowledgeBaseMutation,
  useListKbNotesQuery,
  useListKnowledgeBasesQuery,
} from '../../agents/api/agents-api'
import type { KbItem, KnowledgeBase } from '../../agents/types'

export function KnowledgeBasePage() {
  const { data: user } = useGetSessionQuery()
  const ownerId = user?.id ?? ''

  const { data: kbs = [], isLoading, refetch } = useListKnowledgeBasesQuery(ownerId, { skip: !ownerId })
  const [createKb, { isLoading: isCreating }] = useCreateKnowledgeBaseMutation()
  const [deleteKb, { isLoading: isDeletingKb }] = useDeleteKnowledgeBaseMutation()

  const [createOpen, setCreateOpen] = useState(false)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [error, setError] = useState<string | null>(null)

  const [selectedKb, setSelectedKb] = useState<KnowledgeBase | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<KnowledgeBase | null>(null)

  async function handleCreate() {
    if (!name.trim()) return
    setError(null)
    try {
      await createKb({
        ownerId,
        name: name.trim(),
        description: description.trim() || undefined,
      }).unwrap()
      setName('')
      setDescription('')
      setCreateOpen(false)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not create knowledge base.')
    }
  }

  async function handleDeleteKb() {
    if (!deleteTarget) return
    setError(null)
    try {
      await deleteKb({ ownerId, kbId: deleteTarget.id }).unwrap()
      if (selectedKb?.id === deleteTarget.id) setSelectedKb(null)
      setDeleteTarget(null)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not delete knowledge base.')
    }
  }

  return (
    <>
      <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ xs: 'flex-start', sm: 'center' }} spacing={2} sx={{ mb: 4 }}>
        <Box>
          <Typography component="h1" variant="h4" sx={{ fontSize: 30 }}>Knowledge Bases</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            Centralized reference documentation. Create a knowledge base and attach it to any agent.
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<StudioIcon name="plus" />}
          onClick={() => setCreateOpen(true)}
          sx={{ height: 42, px: 2.5 }}
        >
          New Knowledge Base
        </Button>
      </Stack>

      {error && <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>{error}</Alert>}

      {isLoading ? (
        <Box sx={{ py: 8, textAlign: 'center' }}>
          <CircularProgress size={30} sx={{ color: 'text.secondary' }} />
        </Box>
      ) : kbs.length === 0 ? (
        <Paper
          variant="outlined"
          sx={{
            py: 8,
            px: 3,
            textAlign: 'center',
            borderRadius: 3,
            borderStyle: 'dashed',
            borderColor: '#dce1d1',
            bgcolor: '#fafbf7',
          }}
        >
          <Box sx={{ width: 44, height: 44, bgcolor: '#eef2e6', borderRadius: '50%', display: 'grid', placeItems: 'center', mx: 'auto', mb: 2 }}>
            <StudioIcon name="book" sx={{ fontSize: 22, color: '#566344' }} />
          </Box>
          <Typography variant="h6" fontWeight={600}>No knowledge bases yet</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1, mb: 3, maxWidth: 440, mx: 'auto' }}>
            Group your company policies, FAQs, and product guides into knowledge bases, then attach them to your agents.
          </Typography>
          <Button variant="contained" startIcon={<StudioIcon name="plus" />} onClick={() => setCreateOpen(true)}>
            Create Knowledge Base
          </Button>
        </Paper>
      ) : (
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(2, minmax(0, 1fr))', lg: 'repeat(3, minmax(0, 1fr))' }, gap: 3 }}>
          {kbs.map((kb) => (
            <Card
              key={kb.id}
              variant="outlined"
              sx={{
                borderRadius: 3,
                borderColor: selectedKb?.id === kb.id ? '#66794f' : 'divider',
                display: 'flex',
                flexDirection: 'column',
                transition: 'all 0.15s ease-in-out',
                '&:hover': { borderColor: '#b0bba0' },
              }}
            >
              <CardContent sx={{ p: 3, flex: 1 }}>
                <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={1}>
                  <Typography variant="h6" fontSize={18} fontWeight={600} noWrap>
                    {kb.name}
                  </Typography>
                  <IconButton
                    size="small"
                    color="error"
                    aria-label={`Delete ${kb.name}`}
                    onClick={() => setDeleteTarget(kb)}
                    sx={{ mt: -0.5, mr: -0.5 }}
                  >
                    <StudioIcon name="trash" sx={{ fontSize: 17 }} />
                  </IconButton>
                </Stack>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 1, minHeight: 38, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                  {kb.description || 'No description provided.'}
                </Typography>

                <Stack direction="row" spacing={1} sx={{ mt: 2.5 }} flexWrap="wrap" useFlexGap>
                  <Chip
                    size="small"
                    label={`${kb.itemCount} ${kb.itemCount === 1 ? 'note' : 'notes'}`}
                    sx={{ height: 22, fontSize: 11, bgcolor: '#f0f4e8', color: '#446633', fontWeight: 500 }}
                  />
                  <Chip
                    size="small"
                    label={`Attached to ${kb.agentCount} ${kb.agentCount === 1 ? 'agent' : 'agents'}`}
                    variant="outlined"
                    sx={{ height: 22, fontSize: 11 }}
                  />
                </Stack>
              </CardContent>

              <Divider />
              <Box sx={{ p: 1.5, bgcolor: '#fafbf7', textAlign: 'right' }}>
                <Button
                  size="small"
                  variant="outlined"
                  onClick={() => setSelectedKb(kb)}
                  startIcon={<StudioIcon name="edit" sx={{ fontSize: 15 }} />}
                >
                  Manage Notes
                </Button>
              </Box>
            </Card>
          ))}
        </Box>
      )}

      {/* Create Knowledge Base Modal */}
      <Dialog open={createOpen} onClose={() => !isCreating && setCreateOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>New Knowledge Base</DialogTitle>
        <DialogContent sx={{ pt: 1 }}>
          <DialogContentText sx={{ mb: 2 }}>
            Organize reference notes under a shared name. You can attach this knowledge base to one or multiple agents.
          </DialogContentText>
          <Stack spacing={2.5}>
            <TextField
              label="Knowledge Base Name"
              placeholder="e.g. Customer Support FAQs"
              value={name}
              onChange={(e) => setName(e.target.value)}
              fullWidth
              slotProps={{ htmlInput: { maxLength: 100 } }}
              required
            />
            <TextField
              label="Description (optional)"
              placeholder="e.g. Return windows, pricing tiers, and business hours."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              multiline
              minRows={2}
              maxRows={4}
              fullWidth
              slotProps={{ htmlInput: { maxLength: 500 } }}
            />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ p: 2.5 }}>
          <Button color="inherit" disabled={isCreating} onClick={() => setCreateOpen(false)}>Cancel</Button>
          <Button variant="contained" disabled={!name.trim() || isCreating} onClick={() => { void handleCreate() }}>
            {isCreating ? 'Creating...' : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Knowledge Base Confirmation */}
      <Dialog open={!!deleteTarget} onClose={() => !isDeletingKb && setDeleteTarget(null)} maxWidth="xs" fullWidth>
        <DialogTitle>Delete Knowledge Base?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Are you sure you want to delete <strong>{deleteTarget?.name}</strong>? All notes and vectors will be permanently removed, and any attached agents will detach.
          </DialogContentText>
        </DialogContent>
        <DialogActions sx={{ p: 2.5 }}>
          <Button color="inherit" disabled={isDeletingKb} onClick={() => setDeleteTarget(null)}>Cancel</Button>
          <Button variant="contained" color="error" disabled={isDeletingKb} onClick={() => { void handleDeleteKb() }}>
            {isDeletingKb ? 'Deleting...' : 'Delete'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Manage Notes Drawer / Panel */}
      {selectedKb && (
        <KnowledgeBaseNotesDrawer
          kb={selectedKb}
          ownerId={ownerId}
          open={!!selectedKb}
          onClose={() => setSelectedKb(null)}
          onNoteChanged={() => { void refetch() }}
        />
      )}
    </>
  )
}

function KnowledgeBaseNotesDrawer({
  kb,
  ownerId,
  open,
  onClose,
  onNoteChanged,
}: {
  kb: KnowledgeBase
  ownerId: string
  open: boolean
  onClose: () => void
  onNoteChanged: () => void
}) {
  const { data: notes = [], isLoading } = useListKbNotesQuery({ ownerId, kbId: kb.id })
  const [addNote, { isLoading: isAdding }] = useAddKbNoteMutation()
  const [deleteNote, { isLoading: isDeleting }] = useDeleteKbNoteMutation()

  const [addOpen, setAddOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<KbItem | null>(null)

  async function handleAddNote() {
    if (!title.trim() || !content.trim()) return
    setError(null)
    try {
      await addNote({
        ownerId,
        kbId: kb.id,
        title: title.trim(),
        content: content.trim(),
      }).unwrap()
      setTitle('')
      setContent('')
      setAddOpen(false)
      onNoteChanged()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not add note.')
    }
  }

  async function handleDeleteNote() {
    if (!deleteTarget) return
    setError(null)
    try {
      await deleteNote({
        ownerId,
        kbId: kb.id,
        itemId: deleteTarget.id,
      }).unwrap()
      setDeleteTarget(null)
      onNoteChanged()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not delete note.')
    }
  }

  return (
    <Drawer anchor="right" open={open} onClose={onClose} PaperProps={{ sx: { width: { xs: '100%', sm: 500 }, p: 3.5 } }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
        <Box sx={{ minWidth: 0, pr: 2 }}>
          <Typography variant="h6" fontWeight={600} noWrap>{kb.name}</Typography>
          <Typography variant="caption" color="text.secondary">Knowledge Base Notes</Typography>
        </Box>
        <IconButton onClick={onClose} aria-label="Close panel"><StudioIcon name="close" /></IconButton>
      </Stack>

      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Notes added here are vectorized in ChromaDB. Any agent attached to <strong>{kb.name}</strong> will dynamically consult these notes.
      </Typography>

      <Button
        variant="contained"
        startIcon={<StudioIcon name="plus" />}
        fullWidth
        onClick={() => setAddOpen(true)}
        sx={{ mb: 3 }}
      >
        Add Note to {kb.name}
      </Button>

      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>{error}</Alert>}

      <Divider sx={{ mb: 2.5 }} />

      {isLoading ? (
        <Box sx={{ py: 6, textAlign: 'center' }}>
          <CircularProgress size={24} sx={{ color: 'text.secondary' }} />
        </Box>
      ) : notes.length === 0 ? (
        <Box sx={{ p: 3, textAlign: 'center', border: '1px dashed #dce1d1', borderRadius: 2, bgcolor: '#fafbf7' }}>
          <Typography variant="body2" color="text.secondary">No notes in this knowledge base yet.</Typography>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
            Click "Add Note" to add policies, guides, or details.
          </Typography>
        </Box>
      ) : (
        <Stack spacing={1.5} sx={{ overflowY: 'auto' }}>
          {notes.map((note) => (
            <Paper
              key={note.id}
              variant="outlined"
              sx={{ p: 2, borderRadius: 2, bgcolor: '#fafbf7', borderColor: '#e2e7d8' }}
            >
              <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={1}>
                <Box sx={{ minWidth: 0, flex: 1 }}>
                  <Typography variant="body2" fontWeight={600}>{note.title}</Typography>
                  <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 0.5 }}>
                    <Chip
                      size="small"
                      label="Vectorized"
                      sx={{ height: 18, fontSize: 10, bgcolor: '#e8f5e9', color: '#2e7d32', fontWeight: 600 }}
                    />
                    <Typography variant="caption" color="text.secondary">
                      {note.charCount.toLocaleString()} chars
                    </Typography>
                  </Stack>
                </Box>
                <IconButton size="small" color="error" onClick={() => setDeleteTarget(note)}>
                  <StudioIcon name="trash" sx={{ fontSize: 16 }} />
                </IconButton>
              </Stack>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1, whiteSpace: 'pre-wrap', maxHeight: 80, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {note.content}
              </Typography>
            </Paper>
          ))}
        </Stack>
      )}

      {/* Add Note Modal */}
      <Dialog open={addOpen} onClose={() => !isAdding && setAddOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Add Note to {kb.name}</DialogTitle>
        <DialogContent sx={{ pt: 1 }}>
          <Stack spacing={2.5} sx={{ mt: 1 }}>
            <TextField
              label="Note Title"
              placeholder="e.g. Return and Refund Policy"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              fullWidth
              slotProps={{ htmlInput: { maxLength: 200 } }}
              required
            />
            <Box>
              <TextField
                label="Note Content"
                placeholder="Write the policy, details, or facts..."
                value={content}
                onChange={(e) => setContent(e.target.value)}
                multiline
                minRows={6}
                maxRows={15}
                fullWidth
                slotProps={{ htmlInput: { maxLength: 20000 } }}
                required
              />
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5, textAlign: 'right' }}>
                {content.length.toLocaleString()} / 20,000 characters
              </Typography>
            </Box>
          </Stack>
        </DialogContent>
        <DialogActions sx={{ p: 2.5 }}>
          <Button color="inherit" disabled={isAdding} onClick={() => setAddOpen(false)}>Cancel</Button>
          <Button variant="contained" disabled={!title.trim() || !content.trim() || isAdding} onClick={() => { void handleAddNote() }}>
            {isAdding ? 'Vectorizing...' : 'Save & Index'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Note Confirmation */}
      <Dialog open={!!deleteTarget} onClose={() => !isDeleting && setDeleteTarget(null)} maxWidth="xs" fullWidth>
        <DialogTitle>Delete Note?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Are you sure you want to delete <strong>{deleteTarget?.title}</strong>? Its vectors will be purged from ChromaDB.
          </DialogContentText>
        </DialogContent>
        <DialogActions sx={{ p: 2.5 }}>
          <Button color="inherit" disabled={isDeleting} onClick={() => setDeleteTarget(null)}>Cancel</Button>
          <Button variant="contained" color="error" disabled={isDeleting} onClick={() => { void handleDeleteNote() }}>
            {isDeleting ? 'Deleting...' : 'Delete'}
          </Button>
        </DialogActions>
      </Dialog>
    </Drawer>
  )
}
