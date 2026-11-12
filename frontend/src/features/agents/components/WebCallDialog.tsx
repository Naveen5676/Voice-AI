import { Alert, Box, Button, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle, MenuItem, Stack, TextField, Typography } from '@mui/material'
import { useWebCall } from '../hooks/useWebCall'
import { ConversationTranscript } from './ConversationTranscript'

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
    active: call.muted ? 'Connected - Microphone muted' : 'Connected - Microphone on',
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
        {call.error && <Alert severity="error">{call.error}</Alert>}
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
