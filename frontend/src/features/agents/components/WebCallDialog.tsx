import { Alert, Box, Button, Chip, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle, MenuItem, Stack, TextField, Typography } from '@mui/material'
import { useWebCall } from '../hooks/useWebCall'
import { ConversationTranscript } from './ConversationTranscript'
import { StudioIcon } from '../../../components/StudioIcon'

export function WebCallDialog({ agentId, agentName, open, onClose }: { agentId: string; agentName: string; open: boolean; onClose: () => void }) {
  return <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm" aria-labelledby="web-call-title">
    {open && <CallContent key={agentId} agentId={agentId} agentName={agentName} onClose={onClose} />}
  </Dialog>
}

function CallContent({ agentId, agentName, onClose }: { agentId: string; agentName: string; onClose: () => void }) {
  const call = useWebCall()
  const busy = ['microphone', 'connecting', 'waiting', 'reconnecting'].includes(call.phase)
  const running = busy || call.phase === 'active'
  const labels = {
    idle: 'Your microphone is off. Start when you are ready.',
    microphone: 'Requesting microphone access...',
    connecting: 'Connecting to the voice room...',
    waiting: 'Waiting for your agent...',
    active: call.muted ? 'Connected · Microphone muted (5 min max)' : 'Connected · Microphone active (5 min max)',
    reconnecting: 'Reconnecting to your call...',
    ended: 'Call ended. Your microphone is off.',
    failed: 'Call could not continue. Your microphone is off.',
  }
  const canSelectMicrophone = !call.microphoneChanging && (!running || call.phase === 'active' || call.phase === 'waiting')
  const selectedMissing = call.microphoneId !== 'default' && !call.devices.some((device) => device.deviceId === call.microphoneId)
  function close() { call.stop(); onClose() }
  return <>
    <DialogTitle id="web-call-title">Web Call</DialogTitle>
    <DialogContent>
      <Stack spacing={1} alignItems="center" sx={{ pt: 1, pb: 2 }}>
        <Typography variant="h6" sx={{ overflowWrap: 'anywhere', textAlign: 'center' }}>{agentName}</Typography>
        <Typography variant="body2" color="text.secondary">Uses your saved instructions</Typography>
        {busy && <CircularProgress size={28} />}
        <Typography role="status" variant="body2" sx={{ textAlign: 'center' }}>{labels[call.phase]}</Typography>
        {call.error && (
          <Stack spacing={1} alignItems="center" sx={{ width: '100%' }}>
            <Alert severity="error" sx={{ width: '100%' }}>{call.error}</Alert>
            <Button
              variant="outlined"
              color="warning"
              size="small"
              onClick={async () => {
                await call.cancelPrevious()
                void call.start(agentId)
              }}
            >
              Reset active call & Retry
            </Button>
          </Stack>
        )}
        {call.audioBlocked && <Button variant="outlined" onClick={() => void call.playAudio()}>Enable speaker audio</Button>}
      </Stack>
      <ConversationTranscript messages={call.messages} agentName={agentName} live={running} />
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems={{ sm: 'flex-start' }} sx={{ mt: 2.5 }}>
        <TextField select size="small" label="Microphone" value={call.microphoneId} onChange={(event) => void call.selectMicrophone(event.target.value)} disabled={!canSelectMicrophone} fullWidth
          helperText={call.microphoneChanging ? 'Switching microphone...' : 'Choose your built-in, headset, or USB microphone.'}>
          <MenuItem value="default">System default microphone</MenuItem>
          {call.devices.map((device) => <MenuItem key={device.deviceId} value={device.deviceId}>{device.label}</MenuItem>)}
          {selectedMissing && <MenuItem value={call.microphoneId} disabled>Selected microphone unavailable</MenuItem>}
        </TextField>
        <Button size="small" onClick={() => void call.refreshMicrophones(!running)} loading={call.loadingDevices} disabled={running && !canSelectMicrophone} sx={{ flexShrink: 0, minHeight: 40 }}>Refresh devices</Button>
      </Stack>
      {selectedMissing && <Alert severity="warning" sx={{ mt: 1 }}>The selected microphone is no longer available. Choose another input.</Alert>}
      {(call.deviceError || call.deviceListError) && <Alert severity="warning" sx={{ mt: 1 }}>{call.deviceError || call.deviceListError}</Alert>}
      {call.phase === 'ended' && (
        <Box sx={{ mt: 2.5, p: 2, borderRadius: 2.5, bgcolor: '#fbfcf8', border: 1, borderColor: '#dce1d1' }}>
          <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 0.75 }}>
            <StudioIcon name="check" sx={{ fontSize: 17, color: '#4d6938' }} />
            <Typography variant="subtitle2" fontWeight={600} fontSize={13.5}>
              Call Session Ended
            </Typography>
            <Chip label="Completed" size="small" sx={{ height: 19, fontSize: 10, bgcolor: '#eef6ea', color: '#446633', ml: 'auto' }} />
          </Stack>
          <Typography variant="body2" color="text.secondary" sx={{ fontSize: 12, lineHeight: 1.6 }}>
            Your microphone connection was securely closed. Any knowledge base lookups performed during the conversation are reflected in the transcript above.
          </Typography>
          <Box sx={{ mt: 1.25, pt: 1, borderTop: 1, borderColor: '#eeefe6', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="caption" color="text.secondary">
              Session limit: <strong>5 minutes maximum</strong>
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Microphone is off
            </Typography>
          </Box>
        </Box>
      )}
      <Box sx={{ mt: 1.5 }}><Typography variant="caption" color="text.secondary">Live transcript only. Closing this dialog clears the conversation.</Typography></Box>
    </DialogContent>
    <DialogActions sx={{ p: 3, pt: 0, flexWrap: 'wrap', gap: 1 }}>
      {running ? <>
        <Button disabled={call.phase !== 'active' || call.microphoneChanging} onClick={() => void call.mute()}>{call.muted ? 'Unmute' : 'Mute'}</Button>
        <Button variant="contained" color="error" onClick={call.stop}>End call</Button>
      </> : <Button variant="contained" disabled={!agentId || call.loadingDevices} onClick={() => void call.start(agentId)}>{call.phase === 'idle' ? 'Start call' : 'Start new call'}</Button>}
      <Button color="inherit" onClick={close}>Close</Button>
    </DialogActions>
  </>
}
