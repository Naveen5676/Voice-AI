import assert from 'node:assert/strict'
import { after, test } from 'node:test'
import { JSDOM } from 'jsdom'

const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost:5173', pretendToBeVisual: true })
globalThis.requestAnimationFrame = dom.window.requestAnimationFrame.bind(dom.window)
globalThis.cancelAnimationFrame = dom.window.cancelAnimationFrame.bind(dom.window)
for (const [key, value] of Object.entries({ window: dom.window, document: dom.window.document, navigator: dom.window.navigator, HTMLElement: dom.window.HTMLElement, Element: dom.window.Element, MutationObserver: dom.window.MutationObserver, getComputedStyle: dom.window.getComputedStyle })) {
  Object.defineProperty(globalThis, key, { configurable: true, value })
}
const NativeRequest = globalThis.Request
globalThis.Request = class extends NativeRequest {
  constructor(input: string | URL | Request, init?: RequestInit) {
    super(typeof input === 'string' && input.startsWith('/') ? `http://localhost:5173${input}` : input, init)
  }
}
const React = await import('react')
const { act, render, fireEvent, waitFor, cleanup } = await import('@testing-library/react')
const { Provider } = await import('react-redux')
const { RouterProvider, createMemoryRouter } = await import('react-router')
const { store } = await import('../src/app/store.js')
const { authApi } = await import('../src/features/auth/api/auth-api.js')
const { agentsApi } = await import('../src/features/agents/api/agents-api.js')
const { AgentEditorPage } = await import('../src/features/agents/pages/AgentEditorPage.js')
const { customAgentTemplate, promptTemplates } = await import('../src/features/agents/data/prompt-templates.js')
const originalFetch = globalThis.fetch
after(() => { cleanup(); globalThis.fetch = originalFetch; globalThis.Request = NativeRequest; dom.window.close() })

test('editor awaits save, keeps edits on failure, and navigates using the server ID', async () => {
  const calls: string[] = []
  let resolveSave!: (value: Response) => void
  let agent = { id: 'f9c69930-a49b-429a-8595-536e96053738', name: 'Willow', prompt: 'Help callers.', templateId: 'custom', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }
  globalThis.fetch = async (input, init) => {
    const request = input instanceof Request ? input : new Request(input, init)
    const path = new URL(request.url).pathname
    calls.push(`${request.method} ${path}`)
    if (path === '/api/agent-templates') return Response.json({ templates: [customAgentTemplate, ...promptTemplates] })
    if (request.method === 'POST' || request.method === 'PATCH') return new Promise<Response>((resolve) => { resolveSave = resolve })
    if (path === '/api/agents') return Response.json({ agents: [] })
    if (path === `/api/agents/${agent.id}`) return Response.json({ agent })
    throw new Error(`Unexpected request ${path}`)
  }
  await store.dispatch(authApi.util.upsertQueryData('getSession', undefined, { id: 'first-owner', name: 'Owner', email: 'owner@example.com' }))
  const router = createMemoryRouter([{ path: '/agents/new', element: React.createElement(AgentEditorPage) }, { path: '/agents/:agentId', element: React.createElement(AgentEditorPage) }], { initialEntries: ['/agents/new'] })
  const view = render(React.createElement(Provider, { store }, React.createElement(RouterProvider, { router })))
  const name = await view.findByLabelText('Agent name')
  const prompt = view.getByLabelText('Agent prompt')
  fireEvent.change(name, { target: { value: 'Willow' } })
  fireEvent.change(prompt, { target: { value: 'Help callers.' } })
  fireEvent.click(view.getByRole('button', { name: 'Save agent' }))
  await waitFor(() => assert.ok(resolveSave))
  assert.equal(router.state.location.pathname, '/agents/new')
  assert.ok((view.getByRole('button', { name: /Save agent/ }) as HTMLButtonElement).disabled)
  resolveSave(Response.json({ message: 'Database temporarily unavailable.' }, { status: 503 }))
  await view.findByText('Database temporarily unavailable.')
  assert.equal((name as HTMLInputElement).value, 'Willow')
  assert.equal((prompt as HTMLTextAreaElement).value, 'Help callers.')
  resolveSave = undefined!
  fireEvent.click(view.getByRole('button', { name: 'Save agent' }))
  await waitFor(() => assert.ok(resolveSave))
  resolveSave(Response.json({ agent }, { status: 201 }))
  await waitFor(() => assert.equal(router.state.location.pathname, `/agents/${agent.id}`))
  const savedPrompt = await view.findByLabelText('Agent prompt')
  fireEvent.change(savedPrompt, { target: { value: 'Unsaved local edit.' } })
  agent = { ...agent, prompt: 'Another tab saved this.' }
  const detailReads = calls.filter((value) => value === `GET /api/agents/${agent.id}`).length
  store.dispatch(agentsApi.util.invalidateTags(['Agent']))
  await waitFor(() => assert.ok(calls.filter((value) => value === `GET /api/agents/${agent.id}`).length > detailReads))
  assert.equal((savedPrompt as HTMLTextAreaElement).value, 'Unsaved local edit.')
  const refresh = new dom.window.Event('beforeunload', { cancelable: true })
  dom.window.dispatchEvent(refresh)
  assert.equal(refresh.defaultPrevented, false)
  await act(async () => { await router.navigate('/agents/new') })
  assert.equal((await view.findByLabelText('Agent name') as HTMLInputElement).value, '')
  await act(async () => { await router.navigate(`/agents/${agent.id}`) })
  assert.equal((await view.findByLabelText('Agent prompt') as HTMLTextAreaElement).value, 'Another tab saved this.')
  assert.equal(view.queryByText('Leave your changes behind?'), null)
  cleanup()
  router.dispose()
  store.dispatch(agentsApi.util.resetApiState())
  store.dispatch(authApi.util.resetApiState())
})

test('late account-A requests cannot populate account-B data', async () => {
  let resolveOld!: (value: Response) => void
  globalThis.fetch = async () => new Promise<Response>((resolve) => { resolveOld = resolve })
  await store.dispatch(authApi.util.upsertQueryData('getSession', undefined, { id: 'account-a', name: 'A', email: 'a@example.com' }))
  const query = store.dispatch(agentsApi.endpoints.listAgents.initiate('account-a'))
  await waitFor(() => assert.ok(resolveOld))
  await store.dispatch(authApi.util.upsertQueryData('getSession', undefined, { id: 'account-b', name: 'B', email: 'b@example.com' }))
  resolveOld(Response.json({ agents: [{ id: 'private-a', name: 'A private agent' }] }))
  await query
  assert.equal(agentsApi.endpoints.listAgents.select('account-b')(store.getState()).data, undefined)
  assert.equal(agentsApi.endpoints.listAgents.select('account-a')(store.getState()).data, undefined)
  query.unsubscribe()
  store.dispatch(agentsApi.util.resetApiState())
  store.dispatch(authApi.util.resetApiState())
})
