import { useCallback, useEffect, useRef, useState } from 'react'

export type MicrophoneDevice = { deviceId: string; label: string }

export function useMicrophones() {
  const [devices, setDevices] = useState<MicrophoneDevice[]>([])
  const [deviceListError, setError] = useState<string | null>(null)
  const [loadingDevices, setLoading] = useState(false)
  const lifecycle = useRef({ mounted: false, generation: 0 })

  const refreshMicrophones = useCallback(async (requestPermission = false) => {
    const state = lifecycle.current
    const current = ++state.generation
    if (!state.mounted || current !== state.generation) return
    setLoading(true)
    setError(null)
    let stream: MediaStream | undefined
    try {
      if (!navigator.mediaDevices?.enumerateDevices) throw new Error('unsupported')
      if (requestPermission) stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false })
      const all = await navigator.mediaDevices.enumerateDevices()
      if (!state.mounted || current !== state.generation) return
      const microphones = all.filter((device) => device.kind === 'audioinput' && device.deviceId && device.deviceId !== 'default')
      setDevices([...new Map(microphones.map((device, index) => [device.deviceId, { deviceId: device.deviceId, label: device.label || `Microphone ${index + 1}` }])).values()])
    } catch {
      if (state.mounted && current === state.generation) setError('Could not list microphones. Check browser permissions and connect your audio device, then refresh.')
    } finally {
      // Permission previews are never left recording, including after unmount.
      stream?.getTracks().forEach((track) => track.stop())
      if (state.mounted && current === state.generation) setLoading(false)
    }
  }, [])

  useEffect(() => {
    const state = lifecycle.current
    state.mounted = true
    const initialLoad = new AbortController()
    queueMicrotask(() => { if (!initialLoad.signal.aborted) void refreshMicrophones() })
    const changed = () => { void refreshMicrophones() }
    navigator.mediaDevices?.addEventListener('devicechange', changed)
    return () => {
      initialLoad.abort()
      state.mounted = false
      state.generation++
      navigator.mediaDevices?.removeEventListener('devicechange', changed)
    }
  }, [refreshMicrophones])

  return { devices, deviceListError, loadingDevices, refreshMicrophones }
}
