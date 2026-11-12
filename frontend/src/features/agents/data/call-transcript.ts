export type TranscriptMessage = {
  id: string
  role: 'user' | 'assistant'
  text: string
  timestamp: number
  final: boolean
  revision: number
}

// STT emits replacement interim streams and a final stream for the same segment.
// Keep one bubble, and never let an older stream overwrite newer/final text.
export function mergeTranscript(messages: TranscriptMessage[], incoming: TranscriptMessage): TranscriptMessage[] {
  if (!incoming.text.trim()) return messages
  const index = messages.findIndex((message) => message.id === incoming.id)
  if (index === -1) return [...messages, incoming].sort((a, b) => a.timestamp - b.timestamp)
  const previous = messages[index]
  if (previous.final && !incoming.final || incoming.revision < previous.revision && (!incoming.final || previous.final)) return messages
  const next = [...messages]
  next[index] = { ...incoming, timestamp: previous.timestamp }
  return next
}

export type TranscriptStream = AsyncIterable<string> & {
  info: { id: string; timestamp: number; attributes?: Record<string, string> }
}

export async function receiveTranscript(stream: TranscriptStream, sender: string, localIdentity: string, revision: number, received: (message: TranscriptMessage) => void, signal: AbortSignal) {
  const id = `${sender}:${stream.info.attributes?.['lk.segment_id'] ?? stream.info.id}`
  let text = ''
  const publish = (final: boolean) => received({ id, role: sender === localIdentity ? 'user' : 'assistant', text, timestamp: stream.info.timestamp, revision, final })
  try {
    for await (const chunk of stream) {
      if (signal.aborted) return
      text += chunk
      publish(false)
    }
    if (!signal.aborted) publish(stream.info.attributes?.['lk.transcription_final'] !== 'false')
  } catch {
    // Preserve the last received words if a stream is interrupted or cancelled.
    // A later final stream for this segment can still replace the partial text.
  }
}
