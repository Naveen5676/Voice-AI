import { useEffect, useState } from 'react'
import { WebCallController, initialCallState, type CallState, type CallTicket } from '../data/web-call-controller'
import { createVoiceRoom } from '../data/livekit-room'
import { useMicrophones } from './useMicrophones'

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { credentials: 'same-origin', ...init })
  if (!response.ok) {
    const body = await response.json().catch(() => ({}))
    throw new Error(body.message || 'Could not reach the voice service. Please try again.')
  }
  return response.json()
}


export function useWebCall() {
  const microphones = useMicrophones()
  const [state, setState] = useState<CallState>(initialCallState)
  const [controller] = useState(() => new WebCallController({
    async checkMicrophone(deviceId) {
      if (!navigator.mediaDevices?.getUserMedia) throw new Error('Microphone access requires HTTPS or localhost and a supported browser.')
      const stream = await navigator.mediaDevices.getUserMedia({ audio: deviceId === 'default' ? true : { deviceId: { exact: deviceId } }, video: false })
      for (const track of stream.getTracks()) track.stop()
      await microphones.refreshMicrophones()
    },
    start: (agentId, idempotencyKey, signal) => request<CallTicket>(`/api/agents/${encodeURIComponent(agentId)}/web-calls`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ idempotencyKey }), signal }),
    status: (id, signal) => request<{ status: string }>(`/api/web-calls/${id}`, { signal }),
    async end(id) { await request(`/api/web-calls/${id}/end`, { method: 'POST', keepalive: true }) },
    room: createVoiceRoom,
  }, setState))
  useEffect(() => {
    const stop = () => controller.stop()
    window.addEventListener('pagehide', stop)
    return () => { window.removeEventListener('pagehide', stop); controller.stop() }
  }, [controller])
  return { ...state, ...microphones, start: (agentId: string) => controller.start(agentId), stop: () => controller.stop(), mute: () => controller.mute(), playAudio: () => controller.playAudio(), selectMicrophone: (deviceId: string) => controller.selectMicrophone(deviceId) }
}
