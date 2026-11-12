import assert from 'node:assert/strict'
import { once } from 'node:events'
import { randomUUID } from 'node:crypto'
import test from 'node:test'
import { AgentDispatchClient } from 'livekit-server-sdk'
import { createApp } from '../src/app.js'
import { createAuth } from '../src/lib/auth.js'
import { readEnvironment } from '../src/config/env.js'
import { createLivekitService, type CallRoom, type VoiceTransport } from '../src/services/livekit.service.js'
import { createWebCallService } from '../src/services/web-call.service.js'
import { createTestDatabase } from './helpers/database.js'

test('voice configuration is optional but partial configuration is rejected', () => {
  const base = { DATABASE_URL: 'postgresql://localhost/test', BETTER_AUTH_SECRET: 'a'.repeat(32) }
  assert.equal(readEnvironment(base).LIVEKIT_URL, undefined)
  assert.throws(() => readEnvironment({ ...base, LIVEKIT_URL: 'wss://example.test' }), /Set all LiveKit/)
})

test('development dispatch targets the isolated worker deployment', async (t) => {
  const deployments: string[] = []
  t.mock.method(AgentDispatchClient.prototype, 'createDispatch', async (_room: string, _name: string, options: { deployment: string }) => {
    deployments.push(options.deployment)
    return { id: 'test-dispatch' }
  })
  const env = readEnvironment({ DATABASE_URL: 'postgresql://localhost/test', BETTER_AUTH_SECRET: 'a'.repeat(32), LIVEKIT_URL: 'wss://example.test', LIVEKIT_API_KEY: 'test', LIVEKIT_API_SECRET: 's'.repeat(32), AGENT_SERVICE_SECRET: 'w'.repeat(32) })
  const call = { id: randomUUID(), roomName: 'opaque-room', participantIdentity: 'opaque-user', expiresAt: new Date(Date.now() + 600_000) }
  await createLivekitService(env)!.dispatch(call)
  await createLivekitService({ ...env, LIVEKIT_AGENT_DEPLOYMENT: 'private-staging' })!.dispatch(call)
  assert.deepEqual(deployments, ['voice-studio-local', 'private-staging'])
})

test('browser voice tokens are room-scoped, microphone-only and short-lived', async () => {
  const env = readEnvironment({ DATABASE_URL: 'postgresql://localhost/test', BETTER_AUTH_SECRET: 'a'.repeat(32), LIVEKIT_URL: 'wss://example.test', LIVEKIT_API_KEY: 'test', LIVEKIT_API_SECRET: 's'.repeat(32), AGENT_SERVICE_SECRET: 'w'.repeat(32) })
  const token = await createLivekitService(env)!.token({ id: randomUUID(), roomName: 'opaque-room', participantIdentity: 'opaque-user', expiresAt: new Date(Date.now() + 600_000) })
  const body = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString())
  assert.equal(body.video.room, 'opaque-room')
  assert.deepEqual(body.video.canPublishSources, ['microphone'])
  assert.equal(body.video.canPublishData, false)
  assert.equal(body.video.canUpdateOwnMetadata, false)
  assert.ok(!body.video.roomAdmin)
  assert.ok(body.exp - body.nbf <= 300)
  assert.ok(!JSON.stringify(body).includes('prompt'))
})

test('call HTTP APIs, snapshots, ownership and lifecycle with PostgreSQL', { skip: !process.env.TEST_DATABASE_URL }, async (t) => {
  const { prisma, env: base, cleanup } = await createTestDatabase('agents')
  const env = { ...base, LIVEKIT_URL: 'wss://example.test', AGENT_SERVICE_SECRET: 'w'.repeat(32) }
  let dispatched = 0
  let cleanupFails = false
  const rooms: string[] = []
  let dispatchHook: ((call: CallRoom) => Promise<void>) | undefined
  const transport: VoiceTransport = {
    async dispatch(call) { dispatched++; await dispatchHook?.(call); return `dispatch-${call.id}` },
    async token() { return 'test-participant-token' },
    async cleanup(room) { if (cleanupFails) throw new Error('offline'); rooms.push(room) },
  }
  const service = createWebCallService(prisma, env, transport)
  const server = createApp(createAuth(prisma, env), env, prisma, transport).listen(0, '127.0.0.1')
  try {
    await once(server, 'listening')
    const address = server.address()
    assert.ok(address && typeof address === 'object')
    const baseUrl = `http://127.0.0.1:${address.port}`
    const call = (path: string, method = 'GET', cookie = '', body?: object, headers?: Record<string, string>) => fetch(`${baseUrl}/api${path}`, {
      method, headers: { Cookie: cookie, Origin: env.BETTER_AUTH_URL, ...(body ? { 'Content-Type': 'application/json' } : {}), ...headers }, ...(body ? { body: JSON.stringify(body) } : {}),
    })
    async function register(label: string) {
      const response = await call('/auth/sign-up/email', 'POST', '', { name: label, email: `${label}@example.com`, password: 'strong-call-test-password' })
      assert.equal(response.status, 200)
      const cookie = response.headers.getSetCookie().map((value) => value.split(';')[0]).join('; ')
      return { cookie, id: (await response.json()).user.id as string }
    }
    const first = await register('caller-one')
    const second = await register('caller-two')
    const agent = await prisma.agent.create({ data: { ownerId: first.id, name: 'Reception', prompt: 'You work for Cedar Library.' } })
    const path = `/agents/${agent.id}/web-calls`
    let callId = ''
    let key = randomUUID()
    await t.test('start requires session, origin and ownership; rejects arbitrary prompt', async () => {
      assert.equal((await call(path, 'POST', '', { idempotencyKey: key })).status, 401)
      assert.equal((await call(path, 'POST', first.cookie, { idempotencyKey: key }, { Origin: 'https://evil.test' })).status, 403)
      assert.equal((await call(path, 'POST', second.cookie, { idempotencyKey: key })).status, 404)
      assert.equal((await call(path, 'POST', first.cookie, { idempotencyKey: key, prompt: 'untrusted' })).status, 400)
    })
    await t.test('start snapshots server prompt and reuses idempotent requests', async () => {
      const response = await call(path, 'POST', first.cookie, { idempotencyKey: key })
      assert.equal(response.status, 201)
      assert.equal(response.headers.get('cache-control'), 'no-store')
      const body = await response.json()
      callId = body.callId
      assert.ok(!('prompt' in body))
      await prisma.agent.update({ where: { id: agent.id }, data: { prompt: 'New saved instructions.' } })
      const saved = await prisma.voiceCall.findUniqueOrThrow({ where: { id: callId } })
      assert.equal(saved.prompt, 'You work for Cedar Library.')
      assert.equal((await call(path, 'POST', first.cookie, { idempotencyKey: key })).status, 201)
      assert.equal(dispatched, 1)
      assert.equal((await call(path, 'POST', first.cookie, { idempotencyKey: randomUUID() })).status, 409)
      assert.equal((await call(`/web-calls/${callId}`, 'GET', second.cookie)).status, 404)
    })
    await t.test('context requires worker authentication and matching room', async () => {
      const record = await prisma.voiceCall.findUniqueOrThrow({ where: { id: callId } })
      const url = `/internal/web-calls/${callId}/context?roomName=${record.roomName}`
      assert.equal((await call(url)).status, 401)
      assert.equal((await call(url, 'GET', '', undefined, { Authorization: 'Bearer wrong' })).status, 401)
      const headers = { Authorization: `Bearer ${env.AGENT_SERVICE_SECRET}` }
      const result = await call(url, 'GET', '', undefined, headers)
      assert.equal(result.status, 200)
      assert.equal((await result.json()).prompt, 'You work for Cedar Library.')
      assert.equal((await call(`/internal/web-calls/${callId}/context?roomName=wrong`, 'GET', '', undefined, headers)).status, 404)
      const eventId = randomUUID()
      for (let i = 0; i < 2; i++) assert.equal((await call(`/internal/web-calls/${callId}/events`, 'POST', '', { eventId, roomName: record.roomName, type: 'active' }, headers)).status, 204)
      assert.equal(await prisma.voiceCallEvent.count({ where: { callId } }), 1)
      assert.equal((await service.status(first.id, callId)).status, 'active')
    })
    await t.test('end is owner-scoped, repeatable and cannot be undone by late events', async () => {
      const record = await prisma.voiceCall.findUniqueOrThrow({ where: { id: callId } })
      assert.equal((await call(`/web-calls/${callId}/end`, 'POST', second.cookie)).status, 404)
      for (let i = 0; i < 2; i++) assert.equal((await call(`/web-calls/${callId}/end`, 'POST', first.cookie)).status, 200)
      await service.event(callId, record.roomName, randomUUID(), 'active')
      assert.equal((await service.status(first.id, callId)).status, 'ended')
      assert.equal((await call(path, 'POST', first.cookie, { idempotencyKey: key })).status, 409)
      assert.ok(rooms.includes(record.roomName))
    })
    await t.test('concurrent starts admit only one call', async () => {
      const results = await Promise.allSettled([service.start(first.id, agent.id, randomUUID()), service.start(first.id, agent.id, randomUUID())])
      assert.equal(results.filter((result) => result.status === 'fulfilled').length, 1)
      const success = results.find((result) => result.status === 'fulfilled')!
      if (success.status === 'fulfilled') await service.end(first.id, success.value.callId)
    })
    await t.test('expiry and failed cleanup are retried by reconciliation', async () => {
      key = randomUUID()
      const started = await service.start(first.id, agent.id, key)
      await prisma.voiceCall.update({ where: { id: started.callId }, data: { readyDeadline: new Date(0) } })
      cleanupFails = true
      await service.reconcile()
      assert.equal((await service.status(first.id, started.callId)).status, 'expired')
      assert.equal((await service.status(first.id, started.callId)).cleanupPending, true)
      cleanupFails = false
      await service.reconcile()
      assert.equal((await service.status(first.id, started.callId)).cleanupPending, false)
    })
    await t.test('cancellation during dispatch cleans up a late-created room', async () => {
      dispatchHook = async (record) => { await service.end(first.id, record.id) }
      await assert.rejects(service.start(first.id, agent.id, randomUUID()), /could not start/)
      dispatchHook = undefined
      assert.equal(await prisma.voiceCall.count({ where: { status: { in: ['pending', 'connecting', 'active'] } } }), 0)
    })
    await t.test('disabled voice service leaves agent management available', async () => {
      const disabled = createWebCallService(prisma, base)
      await assert.rejects(disabled.start(first.id, agent.id, randomUUID()), /not configured/)
    })
  } finally {
    await new Promise<void>((resolve) => { server.close(() => resolve()) })
    await cleanup()
  }
})
