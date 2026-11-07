import { Box, Card, CardActionArea, Dialog, DialogContent, DialogTitle, IconButton, Stack, Typography } from '@mui/material'
import { Link } from 'react-router'
import { StudioIcon } from '../../../components/StudioIcon'
import { customAgentTemplate, promptTemplates } from '../data/prompt-templates'
import { TemplateMark } from './TemplateMark'

const choices = [
  customAgentTemplate,
  ...promptTemplates,
]

export function CreateAgentDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  return <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm" aria-labelledby="create-agent-title" aria-describedby="create-agent-description">
    <DialogTitle id="create-agent-title" sx={{ pt: 3.5, px: 3.5, pr: 7, pb: 1 }}>Create an agent</DialogTitle>
    <IconButton aria-label="Close agent options" onClick={onClose} sx={{ position: 'absolute', right: 16, top: 18 }}><StudioIcon name="close" /></IconButton>
    <DialogContent sx={{ px: 3.5, pb: 3.5 }}>
      <Typography id="create-agent-description" variant="body2" color="text.secondary" sx={{ mb: 3 }}>Start from scratch or choose a template. You can edit every detail.</Typography>
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))' }, gap: 2 }}>
        {choices.map((choice) => <Card key={choice.id} variant="outlined" sx={{ borderRadius: 2.5 }}>
          <CardActionArea component={Link} to={choice.id === 'custom' ? '/agents/new' : `/agents/new?template=${choice.id}`} onClick={onClose} sx={{ p: 2.5, height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'flex-start', '&:hover': { bgcolor: '#f7f8f2' } }}>
            <TemplateMark templateId={choice.id} />
            <Typography component="h2" fontSize={16} fontWeight={600} sx={{ mt: 2 }}>{choice.title}</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1, lineHeight: 1.7, flex: 1 }}>{choice.description}</Typography>
            <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 2.5, color: 'primary.main' }}><Typography variant="body2" fontWeight={600}>{choice.id === 'custom' ? 'Start from scratch' : 'Use template'}</Typography><StudioIcon name="arrow" sx={{ fontSize: 16 }} /></Stack>
          </CardActionArea>
        </Card>)}
      </Box>
    </DialogContent>
  </Dialog>
}
