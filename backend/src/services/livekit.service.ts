import { AccessToken, AgentDispatchClient, RoomServiceClient, TrackSource } from 'livekit-server-sdk'
import type { Environment } from '../config/env.js'

export type CallRoom = { id: string; roomName: string; participantIdentity: string; expiresAt: Date }
export interface VoiceTransport {
  dispatch(call: CallRoom): Promise<string>
  token(call: CallRoom): Promise<string>
  cleanup(roomName: string): Promise<void>
}

export function createLivekitService(env: Environment): VoiceTransport | undefined {
  if (!env.LIVEKIT_URL || !env.LIVEKIT_API_KEY || !env.LIVEKIT_API_SECRET || !env.AGENT_SERVICE_SECRET) return undefined
  const host = env.LIVEKIT_URL.replace(/^ws/, 'http')
  const dispatches = new AgentDispatchClient(host, env.LIVEKIT_API_KEY, env.LIVEKIT_API_SECRET, { requestTimeout: 10 })
  const rooms = new RoomServiceClient(host, env.LIVEKIT_API_KEY, env.LIVEKIT_API_SECRET, { requestTimeout: 10 })
  return {
    async dispatch(call) {
      const metadata = JSON.stringify({ version: 1, callId: call.id, roomName: call.roomName })
      const deployment = env.LIVEKIT_AGENT_DEPLOYMENT ?? (env.NODE_ENV === 'production' ? undefined : 'voice-studio-local')
      console.log(`[LiveKit] Dispatching to room "${call.roomName}", agent: "${env.LIVEKIT_AGENT_NAME}"${deployment ? `, deployment: "${deployment}"` : ''}`)
      try {
        const dispatch = await dispatches.createDispatch(call.roomName, env.LIVEKIT_AGENT_NAME, {
          metadata,
          ...(deployment ? { deployment } : {}),
        })
        console.log(`[LiveKit] Dispatch created successfully (id: ${dispatch.id})`)
        return dispatch.id
      } catch (error) {
        console.error('[LiveKit] createDispatch failed:', error)
        // A timed-out response can still have created the job. Never blindly retry.
        const existing = await dispatches.listDispatch(call.roomName)
        const match = existing.find((entry) => entry.agentName === env.LIVEKIT_AGENT_NAME && entry.metadata === metadata)
        if (match) return match.id
        throw error
      }
    },
    async token(call) {
      const token = new AccessToken(env.LIVEKIT_API_KEY, env.LIVEKIT_API_SECRET, {
        identity: call.participantIdentity,
        ttl: Math.max(1, Math.min(300, Math.floor((call.expiresAt.getTime() - Date.now()) / 1000))),
      })
      token.addGrant({ roomJoin: true, room: call.roomName, canPublish: true, canPublishSources: [TrackSource.MICROPHONE], canSubscribe: true, canPublishData: false, canUpdateOwnMetadata: false })
      return token.toJwt()
    },
    async cleanup(roomName) {
      // Remove dispatches before the room. Room deletion alone may race a starting job.
      try {
        for (const dispatch of await dispatches.listDispatch(roomName)) await dispatches.deleteDispatch(dispatch.id, roomName)
      } catch (error) { if (!isMissing(error)) throw error }
      try { await rooms.deleteRoom(roomName) } catch (error) { if (!isMissing(error)) throw error }
    },
  }
}

function isMissing(error: unknown) {
  return !!error && typeof error === 'object' && 'code' in error && error.code === 'not_found'
}
