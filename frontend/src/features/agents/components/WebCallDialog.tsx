import { Alert, Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, IconButton, Stack, Typography } from '@mui/material'
import { StudioIcon } from '../../../components/StudioIcon'

const bars = [12, 22, 38, 26, 52, 34, 60, 40, 26, 44, 18, 10]

export function WebCallDialog({ agentName, open, onClose }: { agentName: string; open: boolean; onClose: () => void }) {
  return <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs" aria-labelledby="web-call-title">
    <DialogTitle id="web-call-title" sx={{ pr: 6 }}>Web Call</DialogTitle>
    <IconButton aria-label="Close web call" onClick={onClose} sx={{ position: 'absolute', right: 12, top: 12 }}><StudioIcon name="close" /></IconButton>
    <DialogContent>
      <Stack alignItems="center" sx={{ py: 3 }}>
        <Box sx={{ width: 76, height: 76, bgcolor: '#f4eee8', color: 'primary.main', borderRadius: '50%', display: 'grid', placeItems: 'center', mb: 2.5 }}><StudioIcon name="mic" sx={{ fontSize: 30 }} /></Box>
        <Typography variant="h6" fontWeight={600} sx={{ overflowWrap: 'anywhere', textAlign: 'center' }}>{agentName}</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>Browser voice conversation</Typography>
        <Stack aria-hidden="true" direction="row" spacing={0.75} alignItems="center" sx={{ height: 76, mt: 3, opacity: 0.55 }}>{bars.map((height, index) => <Box key={index} sx={{ width: 5, height, borderRadius: 4, bgcolor: '#c8cbbf' }} />)}</Stack>
      </Stack>
      <Alert severity="info" sx={{ '& .MuiAlert-message': { lineHeight: 1.7 } }}>Voice calling isn’t connected yet. Your agent’s saved name and prompt will be used when browser calling is added.</Alert>
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 2, textAlign: 'center' }}>Your microphone is off. No call has started.</Typography>
    </DialogContent>
    <DialogActions sx={{ p: 3, pt: 1 }}><Button onClick={onClose} variant="outlined" color="inherit" fullWidth>Done</Button></DialogActions>
  </Dialog>
}
