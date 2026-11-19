import { ConnectionState, ParticipantKind, Room, RoomEvent, Track } from 'livekit-client'
import { receiveTranscript, type TranscriptMessage } from './call-transcript'
import type { RoomSignal } from './web-call-controller'

export function createVoiceRoom(signal: (event: RoomSignal) => void, transcript: (message: TranscriptMessage) => void, room = new Room({
  audioCaptureDefaults: {
    echoCancellation: true,
    noiseSuppression: true,
    autoGainControl: true,
  },
})) {
  const audio = new Set<HTMLMediaElement>()
  let disposed = false
  let revision = 0
  const transcriptAbort = new AbortController()
  room.registerTextStreamHandler('lk.transcription', (reader, participant) => {
    if (disposed) return
    void receiveTranscript(reader.withAbortSignal(transcriptAbort.signal), participant.identity, room.localParticipant.identity, ++revision, transcript, transcriptAbort.signal)
  })
  const stopMicrophones = () => { for (const publication of room.localParticipant.audioTrackPublications.values()) publication.track?.stop() }
  const detach = () => { for (const element of audio) { element.pause(); element.srcObject = null; element.remove() } audio.clear() }
  room.on(RoomEvent.TrackSubscribed, (track) => {
    if (disposed || track.kind !== Track.Kind.Audio) return
    const element = track.attach()
    audio.add(element)
    element.hidden = true
    document.body.appendChild(element)
    void element.play().catch(() => { if (!disposed) signal('audio-blocked') })
  })
  room.on(RoomEvent.TrackUnsubscribed, (track) => { for (const element of track.detach()) { audio.delete(element); element.remove() } })
  room.on(RoomEvent.ConnectionStateChanged, (state) => {
    if (state === ConnectionState.Reconnecting || state === ConnectionState.SignalReconnecting) signal('reconnecting')
    else if (state === ConnectionState.Connected) signal('connected')
  })
  room.on(RoomEvent.Disconnected, () => { detach(); signal('disconnected') })
  room.on(RoomEvent.ParticipantDisconnected, (participant) => {
    if (!disposed && participant.kind === ParticipantKind.AGENT) signal('disconnected')
  })
  return {
    connect: (url: string, token: string) => room.connect(url, token, { peerConnectionTimeout: 15_000, websocketTimeout: 15_000 }),
    async disconnect() { disposed = true; transcriptAbort.abort(); room.unregisterTextStreamHandler('lk.transcription'); stopMicrophones(); detach(); await room.disconnect(true); stopMicrophones(); detach() },
    async microphone(enabled: boolean, deviceId = 'default') {
      await room.localParticipant.setMicrophoneEnabled(enabled, {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
        deviceId: deviceId === 'default' ? undefined : { exact: deviceId },
      })
      if (disposed) stopMicrophones()
    },
    async selectMicrophone(deviceId: string) {
      if (!await room.switchActiveDevice('audioinput', deviceId)) throw new Error('Microphone switch failed')
      if (disposed) stopMicrophones()
    },
    async playAudio() { await room.startAudio(); await Promise.all([...audio].map((element) => element.play())) },
  }
}

