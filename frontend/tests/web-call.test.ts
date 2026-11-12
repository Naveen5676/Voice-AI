import assert from 'node:assert/strict'
import { test } from 'node:test'
import { WebCallController, type CallDependencies, type CallState, type CallTicket, type RoomSignal } from '../src/features/agents/data/web-call-controller.js'
import type { TranscriptMessage } from '../src/features/agents/data/call-transcript.js'

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((done) => { resolve = done })
  return { promise, resolve }
}
const ticket: CallTicket = { callId: 'call', serverUrl: 'wss://example.test', participantToken: 'private-token', expiresAt: new Date(Date.now() + 60_000).toISOString() }
const tick = () => new Promise((resolve) => setTimeout(resolve, 0))
function fixture(overrides: Partial<CallDependencies> = {}) {
  const actions: string[] = []
  const states: CallState[] = []
  let signal!: (event: RoomSignal) => void
  let transcript!: (message: TranscriptMessage) => void
  const deps: CallDependencies = {
    checkMicrophone: async () => { actions.push('permission') },
    start: async () => { actions.push('start'); return ticket },
    status: async () => ({ status: 'active' }),
    end: async () => { actions.push('end') },
    room: (callback, received) => {
      signal = callback
      transcript = received
      return {
        connect: async () => { actions.push('connect') },
        microphone: async (enabled) => { actions.push(`microphone:${enabled}`) },
        disconnect: async () => { actions.push('disconnect') },
        playAudio: async () => {},
        selectMicrophone: async () => {},
      }
    },
    ...overrides,
  }
  const controller = new WebCallController(deps, (state) => states.push(state))
  return { controller, actions, states, signal: (event: RoomSignal) => signal(event), transcript: (message: TranscriptMessage) => transcript(message) }
}

test('closing during permission request never starts a remote call', async () => {
  const permission = deferred<void>()
  const f = fixture({ checkMicrophone: () => permission.promise })
  const start = f.controller.start('agent')
  f.controller.stop()
  permission.resolve()
  await start
  assert.deepEqual(f.actions, [])
})

test('a late start response after closing is ended without connecting', async () => {
  const response = deferred<CallTicket>()
  const f = fixture({ start: () => response.promise })
  const start = f.controller.start('agent')
  await tick()
  f.controller.stop()
  response.resolve(ticket)
  await start
  assert.deepEqual(f.actions, ['permission', 'end'])
})

test('closing while connecting prevents later microphone activation', async () => {
  const connection = deferred<void>()
  let microphone = 0
  let disconnected = 0
  const f = fixture({ room: () => ({ connect: () => connection.promise, microphone: async () => { microphone++ }, disconnect: async () => { disconnected++ }, playAudio: async () => {} }) })
  const start = f.controller.start('agent')
  await tick()
  f.controller.stop()
  connection.resolve()
  await start
  assert.equal(microphone, 0)
  assert.ok(disconnected >= 1)
  assert.ok(f.actions.includes('end'))
})

test('permission rejection gives a useful error and never starts a call', async () => {
  const f = fixture({ checkMicrophone: async () => { throw new DOMException('denied', 'NotAllowedError') } })
  await f.controller.start('agent')
  assert.equal(f.states.at(-1)?.phase, 'failed')
  assert.match(f.states.at(-1)!.error!, /permission was denied/)
  assert.deepEqual(f.actions, [])
})

test('a microphone operation completing after close is disposed again', async () => {
  const microphone = deferred<void>()
  let disconnects = 0
  const f = fixture({ room: () => ({ connect: async () => {}, microphone: () => microphone.promise, disconnect: async () => { disconnects++ }, playAudio: async () => {} }) })
  const start = f.controller.start('agent')
  await tick()
  f.controller.stop()
  microphone.resolve()
  await start
  assert.ok(disconnects >= 2)
  assert.equal(f.states.at(-1)?.phase, 'ended')
  assert.ok(f.actions.includes('end'))
})

test('active call mutes and ends; late disconnect does not reconnect', async () => {
  const f = fixture()
  await f.controller.start('agent')
  await tick()
  assert.equal(f.states.at(-1)?.phase, 'active')
  await f.controller.mute()
  assert.equal(f.states.at(-1)?.muted, true)
  f.controller.stop()
  f.signal('disconnected')
  await tick()
  assert.equal(f.states.at(-1)?.phase, 'ended')
  assert.equal(f.actions.filter((action) => action === 'start').length, 1)
  assert.ok(f.actions.includes('microphone:false'))
  assert.ok(f.actions.includes('disconnect'))
  assert.ok(f.actions.includes('end'))
  assert.ok(f.states.every((state) => !JSON.stringify(state).includes('private-token')))
})

test('double start only creates one call and microphone failure disposes it', async () => {
  const f = fixture({ room: () => ({ connect: async () => {}, microphone: async () => { throw new Error('device failed') }, disconnect: async () => {}, playAudio: async () => {} }) })
  await Promise.all([f.controller.start('agent'), f.controller.start('agent')])
  await tick()
  assert.equal(f.actions.filter((action) => action === 'start').length, 1)
  assert.equal(f.states.at(-1)?.phase, 'failed')
  assert.ok(f.actions.includes('end'))
})

test('live bubbles replace interim text, stay after ending, and clear for the next call', async () => {
  const f = fixture()
  await f.controller.start('agent')
  await tick()
  const message: TranscriptMessage = { id: 'user-segment', role: 'user', text: 'Hello', timestamp: 1, revision: 1, final: false }
  f.transcript(message)
  f.transcript({ ...message, text: 'Hello there', final: true, revision: 2 })
  assert.equal(f.states.at(-1)?.messages.length, 1)
  assert.equal(f.states.at(-1)?.messages[0].text, 'Hello there')
  f.controller.stop()
  f.transcript({ ...message, text: 'Late text' })
  assert.equal(f.states.at(-1)?.messages[0].text, 'Hello there')
  const starting = f.controller.start('agent')
  assert.deepEqual(f.states.at(-1)?.messages, [])
  await starting
  f.controller.stop()
})

test('chosen microphone is used at start; live switches preserve mute and failures preserve selection', async () => {
  const requested: string[] = []
  const micActions: boolean[] = []
  let failSwitch = false
  const f = fixture({
    checkMicrophone: async (id) => { requested.push(id) },
    room: () => ({
      connect: async () => {}, disconnect: async () => {}, playAudio: async () => {},
      microphone: async (enabled, id) => { micActions.push(enabled); if (enabled) requested.push(id!) },
      selectMicrophone: async () => { if (failSwitch) throw new Error('device unplugged') },
    }),
  })
  await f.controller.selectMicrophone('built-in')
  await f.controller.start('agent')
  await tick()
  assert.deepEqual(requested, ['built-in', 'built-in'])
  await f.controller.mute()
  await f.controller.selectMicrophone('headset')
  assert.equal(f.states.at(-1)?.microphoneId, 'headset')
  assert.equal(f.states.at(-1)?.muted, true)
  assert.deepEqual(micActions, [true, false, false])
  failSwitch = true
  await f.controller.selectMicrophone('unplugged')
  assert.equal(f.states.at(-1)?.microphoneId, 'headset')
  assert.equal(f.states.at(-1)?.phase, 'active')
  assert.match(f.states.at(-1)!.deviceError!, /Could not switch/)
  f.controller.stop()
})

test('a microphone switch completing after close cannot revive the call', async () => {
  const switching = deferred<void>()
  let disconnects = 0
  const f = fixture({ room: () => ({ connect: async () => {}, disconnect: async () => { disconnects++ }, playAudio: async () => {}, microphone: async () => {}, selectMicrophone: () => switching.promise }) })
  await f.controller.start('agent')
  await tick()
  const pending = f.controller.selectMicrophone('headset')
  f.controller.stop()
  switching.resolve()
  await pending
  assert.ok(disconnects >= 2)
  assert.equal(f.states.at(-1)?.phase, 'ended')
  assert.equal(f.states.at(-1)?.microphoneId, 'default')
})
