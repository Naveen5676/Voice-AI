import assert from 'node:assert/strict'
import { after, afterEach, test } from 'node:test'
import { JSDOM } from 'jsdom'
import type { Room, TextStreamReader } from 'livekit-client'

const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost:5173', pretendToBeVisual: true })
for (const key of ['DocumentFragment', 'Node', 'ShadowRoot'] as const) Object.defineProperty(globalThis, key, { configurable: true, value: dom.window[key] })
globalThis.requestAnimationFrame = dom.window.requestAnimationFrame.bind(dom.window)
globalThis.cancelAnimationFrame = dom.window.cancelAnimationFrame.bind(dom.window)
for (const [key, value] of Object.entries({ window: dom.window, document: dom.window.document, navigator: dom.window.navigator, HTMLElement: dom.window.HTMLElement, Element: dom.window.Element, MutationObserver: dom.window.MutationObserver, getComputedStyle: dom.window.getComputedStyle })) {
  Object.defineProperty(globalThis, key, { configurable: true, value })
}
const React = await import('react')
const { act, render, fireEvent, waitFor, cleanup } = await import('@testing-library/react')
const { ThemeProvider } = await import('@mui/material/styles')
const { theme } = await import('../src/app/theme.js')
const { WebCallDialog } = await import('../src/features/agents/components/WebCallDialog.js')
const { ConversationTranscript } = await import('../src/features/agents/components/ConversationTranscript.js')
const { createVoiceRoom } = await import('../src/features/agents/data/livekit-room.js')
afterEach(cleanup)
after(() => dom.window.close())

function renderDialog() {
  function Wrapper() {
    const [open, setOpen] = React.useState(true)
    return React.createElement(ThemeProvider, { theme }, React.createElement(WebCallDialog, { agentId: 'agent', agentName: 'Cedar', open, onClose: () => setOpen(false) }))
  }
  return render(React.createElement(Wrapper))
}

test('microphone menu lists built-in and headset devices without requesting permission on open', async () => {
  let permissionRequests = 0
  let stopped = 0
  const listeners = new Set<() => void>()
  Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: {
    enumerateDevices: async () => [{ deviceId: 'builtin', kind: 'audioinput', label: 'Built-in microphone' }, { deviceId: 'headset', kind: 'audioinput', label: 'USB headset' }, { deviceId: 'speaker', kind: 'audiooutput', label: 'Speakers' }],
    getUserMedia: async () => { permissionRequests++; return { getTracks: () => [{ stop: () => { stopped++ } }] } },
    addEventListener: (_name: string, listener: () => void) => listeners.add(listener),
    removeEventListener: (_name: string, listener: () => void) => listeners.delete(listener),
  } })
  const view = renderDialog()
  await waitFor(() => assert.ok(!(view.getByRole('button', { name: 'Refresh devices' }) as HTMLButtonElement).disabled))
  const menu = view.getByRole('combobox', { name: 'Microphone' })
  fireEvent.mouseDown(menu)
  const builtIn = await view.findByRole('option', { name: 'Built-in microphone' })
  assert.ok(view.getByRole('option', { name: 'USB headset' }))
  assert.equal(view.queryByRole('option', { name: 'Speakers' }), null)
  fireEvent.click(builtIn)
  assert.match(menu.textContent!, /Built-in microphone/)
  assert.equal(permissionRequests, 0)
  fireEvent.click(view.getByRole('button', { name: 'Refresh devices' }))
  await waitFor(() => assert.equal(stopped, 1))
  assert.equal(permissionRequests, 1)
  fireEvent.click(view.getByRole('button', { name: 'Close' }))
  await waitFor(() => assert.equal(listeners.size, 0))
})

test('closing during a device permission refresh releases the late preview stream', async () => {
  let resolvePermission!: (value: unknown) => void
  let stopped = 0
  Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: {
    enumerateDevices: async () => [],
    getUserMedia: () => new Promise((resolve) => { resolvePermission = resolve }),
    addEventListener: () => {}, removeEventListener: () => {},
  } })
  const view = renderDialog()
  await waitFor(() => assert.ok(!(view.getByRole('button', { name: 'Refresh devices' }) as HTMLButtonElement).disabled))
  fireEvent.click(view.getByRole('button', { name: 'Refresh devices' }))
  await waitFor(() => assert.ok(resolvePermission))
  fireEvent.click(view.getByRole('button', { name: 'Close' }))
  await act(async () => { resolvePermission({ getTracks: () => [{ stop: () => { stopped++ } }] }) })
  assert.equal(stopped, 1)
})

test('conversation shows two speaker labels and different backgrounds, rendering text safely', () => {
  const messages = [
    { id: 'agent', role: 'assistant' as const, text: 'Welcome to Cedar.', timestamp: 1, final: true, revision: 1 },
    { id: 'user', role: 'user' as const, text: '<img src=x onerror=alert(1)>', timestamp: 2, final: true, revision: 2 },
  ]
  const view = render(React.createElement(ThemeProvider, { theme }, React.createElement(ConversationTranscript, { messages, agentName: 'Cedar', live: true })))
  assert.ok(view.getByRole('log', { name: 'Live conversation' }))
  assert.ok(view.getByText('You'))
  assert.ok(view.getByText('Cedar'))
  const assistantBubble = view.getByText('Welcome to Cedar.').parentElement!
  const userBubble = view.getByText(messages[1].text).parentElement!
  assert.notEqual(getComputedStyle(assistantBubble).backgroundColor, getComputedStyle(userBubble).backgroundColor)
  assert.equal(view.container.querySelector('img'), null)
})

test('LiveKit adapter receives transcription streams and selects the actual audio input device', async () => {
  let handler!: (reader: TextStreamReader, participant: { identity: string }) => void
  let removed = false
  let stopped = 0
  const selections: unknown[] = []
  const captures: unknown[] = []
  const messages: unknown[] = []
  const fake = {
    localParticipant: {
      identity: 'browser', audioTrackPublications: new Map([['mic', { track: { stop: () => { stopped++ } } }]]),
      setMicrophoneEnabled: async (enabled: boolean, options: unknown) => { captures.push({ enabled, options }) },
    },
    registerTextStreamHandler: (_topic: string, callback: typeof handler) => { handler = callback },
    unregisterTextStreamHandler: () => { removed = true },
    on: () => {}, disconnect: async () => {},
    switchActiveDevice: async (...args: unknown[]) => { selections.push(args); return true },
  }
  const room = createVoiceRoom(() => {}, (message) => messages.push(message), fake as unknown as Room)
  const stream = { info: { id: 'text', timestamp: 1, attributes: { 'lk.segment_id': 'segment', 'lk.transcription_final': 'true' } }, withAbortSignal() { return this }, async *[Symbol.asyncIterator]() { yield 'Hello' } }
  handler(stream as unknown as TextStreamReader, { identity: 'browser' })
  await waitFor(() => assert.ok(messages.length))
  await room.microphone(true, 'builtin')
  await room.selectMicrophone('headset')
  assert.deepEqual(selections, [['audioinput', 'headset']])
  assert.deepEqual(captures, [{ enabled: true, options: { deviceId: { exact: 'builtin' } } }])
  await room.disconnect()
  assert.equal(removed, true)
  assert.ok(stopped >= 1)
})
