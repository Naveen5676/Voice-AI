import { mergeTranscript, type TranscriptMessage } from './call-transcript'

export type CallPhase = 'idle' | 'microphone' | 'connecting' | 'waiting' | 'active' | 'reconnecting' | 'ended' | 'failed'
export type CallState = { phase: CallPhase; muted: boolean; audioBlocked: boolean; error: string | null; messages: TranscriptMessage[]; microphoneId: string; microphoneChanging: boolean; deviceError: string | null }
export type RoomSignal = 'reconnecting' | 'connected' | 'disconnected' | 'audio-blocked'
export interface VoiceRoom {
  connect(url: string, token: string): Promise<void>
  disconnect(): Promise<void>
  microphone(enabled: boolean, deviceId?: string): Promise<void>
  selectMicrophone(deviceId: string): Promise<void>
  playAudio(): Promise<void>
}
export type CallTicket = { callId: string; serverUrl: string; participantToken: string; expiresAt: string }
export interface CallDependencies {
  checkMicrophone(deviceId: string): Promise<void>
  start(agentId: string, key: string, signal: AbortSignal): Promise<CallTicket>
  status(callId: string, signal: AbortSignal): Promise<{ status: string; failureCode?: string | null }>
  end(callId: string): Promise<void>
  room(signal: (event: RoomSignal) => void, transcript: (message: TranscriptMessage) => void): VoiceRoom
}
type Attempt = { cancelled: boolean; abort: AbortController; room?: VoiceRoom; callId?: string; timer?: ReturnType<typeof setTimeout>; deadline?: ReturnType<typeof setTimeout>; reconnecting: boolean }
export const initialCallState: CallState = { phase: 'idle', muted: false, audioBlocked: false, error: null, messages: [], microphoneId: 'default', microphoneChanging: false, deviceError: null }

// Independent of React so close/unmount races can be tested with deferred promises.
export class WebCallController {
  private attempt?: Attempt
  private state: CallState = initialCallState
  private readonly deps: CallDependencies
  private readonly changed: (state: CallState) => void
  constructor(deps: CallDependencies, changed: (state: CallState) => void) {
    this.deps = deps
    this.changed = changed
  }

  private update(patch: Partial<CallState>) {
    this.state = { ...this.state, ...patch }
    this.changed(this.state)
  }
  private async dispose(attempt: Attempt) {
    attempt.cancelled = true
    attempt.abort.abort()
    clearTimeout(attempt.timer)
    clearTimeout(attempt.deadline)
    // Run independently: a pending SDK connection must not delay remote cleanup.
    await Promise.allSettled([
      attempt.room?.disconnect(),
      attempt.callId ? this.deps.end(attempt.callId) : undefined,
    ])
  }
  private fail(attempt: Attempt, error: unknown) {
    if (attempt.cancelled) return
    this.update({ phase: 'failed', error: callError(error) })
    void this.dispose(attempt)
  }
  async start(agentId: string) {
    if (this.attempt && !this.attempt.cancelled) return
    const attempt: Attempt = { cancelled: false, abort: new AbortController(), reconnecting: false }
    this.attempt = attempt
    this.state = { ...initialCallState, microphoneId: this.state.microphoneId }
    this.update({ phase: 'microphone' })
    try {
      await this.deps.checkMicrophone(this.state.microphoneId)
      if (attempt.cancelled) return
      this.update({ phase: 'connecting' })
      const ticket = await this.deps.start(agentId, crypto.randomUUID(), attempt.abort.signal)
      attempt.callId = ticket.callId
      if (attempt.cancelled) { await this.deps.end(ticket.callId); return }
      attempt.deadline = setTimeout(() => {
        if (attempt.cancelled) return
        this.update({ phase: 'ended', error: 'This call reached its time limit.' })
        void this.dispose(attempt)
      }, Math.max(0, new Date(ticket.expiresAt).getTime() - Date.now()))
      const room = this.deps.room((event) => {
        if (attempt.cancelled) return
        if (event === 'audio-blocked') this.update({ audioBlocked: true })
        else if (event === 'reconnecting') { attempt.reconnecting = true; this.update({ phase: 'reconnecting' }) }
        else if (event === 'connected') { attempt.reconnecting = false }
        else if (event === 'disconnected') this.fail(attempt, new Error('The call disconnected. You can start a new call.'))
      }, (message) => {
        if (!attempt.cancelled) this.update({ messages: mergeTranscript(this.state.messages, message) })
      })
      attempt.room = room
      await room.connect(ticket.serverUrl, ticket.participantToken)
      if (attempt.cancelled) { await room.disconnect(); return }
      await room.microphone(true, this.state.microphoneId)
      if (attempt.cancelled) { await room.disconnect(); return }
      this.update({ phase: 'waiting' })
      void this.poll(attempt)
    } catch (error) { this.fail(attempt, error) }
  }
  private async poll(attempt: Attempt) {
    try {
      const result = await this.deps.status(attempt.callId!, attempt.abort.signal)
      if (attempt.cancelled) return
      if (['ended', 'expired', 'failed'].includes(result.status)) {
        this.update({ phase: result.status === 'failed' ? 'failed' : 'ended', error: result.status === 'failed' ? 'The agent could not continue. Please try again.' : result.status === 'expired' ? 'The call timed out. Check that the worker is running and try again.' : null })
        await this.dispose(attempt)
        return
      }
      if (!attempt.reconnecting) this.update({ phase: result.status === 'active' ? 'active' : 'waiting' })
      attempt.timer = setTimeout(() => { void this.poll(attempt) }, 1000)
    } catch (error) { this.fail(attempt, error) }
  }
  stop() {
    const attempt = this.attempt
    if (attempt) void this.dispose(attempt)
    this.update({ phase: 'ended', muted: false, microphoneChanging: false })
  }
  async mute() {
    const attempt = this.attempt
    if (!attempt || attempt.cancelled || !attempt.room || this.state.microphoneChanging) return
    try {
      const muted = !this.state.muted
      await attempt.room.microphone(!muted, this.state.microphoneId)
      if (attempt.cancelled) { await attempt.room.disconnect(); return }
      this.update({ muted })
    } catch (error) { this.fail(attempt, error) }
  }
  async selectMicrophone(deviceId: string) {
    if (this.state.microphoneChanging || deviceId === this.state.microphoneId) return
    const attempt = this.attempt
    if (!attempt || attempt.cancelled) {
      this.update({ microphoneId: deviceId, deviceError: null })
      return
    }
    if (!attempt.room || !['active', 'waiting'].includes(this.state.phase)) return
    this.update({ microphoneChanging: true, deviceError: null })
    try {
      await attempt.room.selectMicrophone(deviceId)
      if (attempt.cancelled) { await attempt.room.disconnect(); return }
      // Switching inputs must not turn a deliberately muted microphone back on.
      if (this.state.muted) await attempt.room.microphone(false)
      if (attempt.cancelled) { await attempt.room.disconnect(); return }
      this.update({ microphoneId: deviceId })
    } catch {
      if (!attempt.cancelled) this.update({ deviceError: 'Could not switch microphones. Your selection has not changed. Check the device and try again.' })
    } finally {
      if (!attempt.cancelled) this.update({ microphoneChanging: false })
    }
  }
  async playAudio() {
    const attempt = this.attempt
    if (!attempt || attempt.cancelled) return
    try {
      await attempt.room?.playAudio()
      if (!attempt.cancelled) this.update({ audioBlocked: false })
    } catch { if (!attempt.cancelled) this.update({ audioBlocked: true }) }
  }
}

function callError(error: unknown) {
  if (error && typeof error === 'object' && 'name' in error) {
    if (error.name === 'NotAllowedError') return 'Microphone permission was denied. Allow microphone access in your browser and try again.'
    if (error.name === 'NotFoundError') return 'No microphone was found. Connect one and try again.'
    if (error.name === 'NotReadableError') return 'Your microphone is unavailable or in use by another application.'
    if (error.name === 'OverconstrainedError') return 'The selected microphone is unavailable. Choose another microphone or System default and try again.'
  }
  return error instanceof Error ? error.message : 'The call could not connect. Please try again.'
}
