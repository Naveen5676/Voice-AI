import { useEffect, useRef } from 'react'
import { Box, Stack, Typography } from '@mui/material'
import type { TranscriptMessage } from '../data/call-transcript'

export function ConversationTranscript({ messages, agentName, live }: { messages: TranscriptMessage[]; agentName: string; live: boolean }) {
  const container = useRef<HTMLDivElement>(null)
  const following = useRef(true)
  useEffect(() => {
    if (following.current && container.current) container.current.scrollTop = container.current.scrollHeight
  }, [messages])

  return <Box ref={container} role="log" aria-label="Live conversation" aria-live="polite" aria-relevant="additions text" tabIndex={0}
    onScroll={(event) => {
      const element = event.currentTarget
      following.current = element.scrollHeight - element.clientHeight - element.scrollTop < 64
    }}
    sx={{ minHeight: { xs: 210, sm: 270 }, maxHeight: '42vh', overflowY: 'auto', bgcolor: 'background.default', border: 1, borderColor: 'divider', borderRadius: 2, p: 2 }}>
    {messages.length === 0 ? <Stack alignItems="center" justifyContent="center" sx={{ minHeight: { xs: 175, sm: 235 }, px: 2 }}>
      <Typography variant="body2" color="text.secondary" textAlign="center">Your conversation will appear here as you speak.</Typography>
    </Stack> : <Stack spacing={1.5}>{messages.map((message) => {
      const own = message.role === 'user'
      return <Box key={message.id} data-speaker={message.role} sx={{ alignSelf: own ? 'flex-end' : 'flex-start', maxWidth: '88%' }}>
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5, px: 0.5, textAlign: own ? 'right' : 'left', overflowWrap: 'anywhere' }}>{own ? 'You' : agentName}</Typography>
        <Box sx={{ px: 1.75, py: 1.25, bgcolor: own ? 'primary.main' : 'grey.100', color: own ? 'primary.contrastText' : 'text.primary', borderRadius: 2, borderBottomRightRadius: own ? 4 : undefined, borderBottomLeftRadius: own ? undefined : 4 }}>
          <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', lineHeight: 1.65 }}>{message.text}</Typography>
          {live && !message.final && <Typography component="span" variant="caption" sx={{ opacity: 0.75 }} aria-label="Transcript updating">...</Typography>}
        </Box>
      </Box>
    })}</Stack>}
  </Box>
}
