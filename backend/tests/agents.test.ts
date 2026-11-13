import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { once } from 'node:events'
import test from 'node:test'
import { createApp } from '../src/app.js'
import { createAuth } from '../src/lib/auth.js'
import { createTestDatabase, deployTestMigrations } from './helpers/database.js'

test('agent management APIs with real sessions and PostgreSQL', { skip: !process.env.TEST_DATABASE_URL }, async (t) => {
  const { pool, prisma, env, cleanup } = await createTestDatabase('agents')
  const server = createApp(createAuth(prisma, env), env, prisma).listen(0, '127.0.0.1')
  try {
    await once(server, 'listening')
    const address = server.address()
    assert.ok(address && typeof address === 'object')
    const base = `http://127.0.0.1:${address.port}`
    const call = (method: string, path: string, cookie = '', body?: unknown, origin: string | null = env.BETTER_AUTH_URL) => fetch(`${base}${path}`, {
      method,
      headers: {
        ...(cookie ? { Cookie: cookie } : {}),
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(origin ? { Origin: origin } : {}),
      },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    })
    async function register(email: string) {
      const response = await call('POST', '/api/auth/sign-up/email', '', { name: 'Agent owner', email, password: 'agent-owner-test-password' })
      assert.equal(response.status, 200)
      return { cookie: response.headers.getSetCookie().map((value) => value.split(';')[0]).join('; '), userId: (await response.json()).user.id as string }
    }
    const first = await register('first-owner@example.com')
    const second = await register('second-owner@example.com')
    const input = { name: '  First agent  ', prompt: '  Answer questions clearly.  ', templateId: 'custom' }
    let agentId = ''
    let otherId = ''

    await t.test('all endpoints require authentication', async () => {
      for (const [method, path, body] of [
        ['GET', '/api/agent-templates', undefined], ['GET', '/api/agents', undefined],
        ['POST', '/api/agents', input], ['GET', `/api/agents/${randomUUID()}`, undefined],
        ['PATCH', `/api/agents/${randomUUID()}`, { name: 'Changed' }],
        ['DELETE', `/api/agents/${randomUUID()}`, undefined],
      ] as const) assert.equal((await call(method, path, '', body)).status, 401)
    })
    await t.test('templates include Custom and three editable presets', async () => {
      const response = await call('GET', '/api/agent-templates', first.cookie)
      assert.equal(response.status, 200)
      assert.equal(response.headers.get('cache-control'), 'no-store')
      const { templates } = await response.json()
      assert.deepEqual(templates.map((template: { id: string }) => template.id), ['custom', 'assistant', 'support', 'receptionist'])
      assert.equal(templates[0].prompt, '')
      assert.ok(templates.slice(1).every((template: { prompt: string }) => template.prompt.length > 0))
    })
    await t.test('create persists normalized fields and returns a resource location', async () => {
      const response = await call('POST', '/api/agents', first.cookie, input)
      assert.equal(response.status, 201)
      const { agent } = await response.json()
      agentId = agent.id
      assert.equal(response.headers.get('location'), `/api/agents/${agent.id}`)
      assert.equal(agent.name, 'First agent')
      assert.equal(agent.prompt, 'Answer questions clearly.')
      assert.equal(agent.templateId, 'custom')
      assert.ok(!Number.isNaN(Date.parse(agent.createdAt)))
      assert.ok(Math.abs(Date.parse(agent.createdAt) - Date.now()) < 30_000, 'Stored timestamps must round-trip correctly on a non-UTC PostgreSQL host')
      const row = (await pool.query('SELECT owner_id, name FROM agents WHERE id = $1', [agentId])).rows[0]
      assert.equal(row.owner_id, first.userId)
      assert.equal(row.name, agent.name)
      const other = await call('POST', '/api/agents', second.cookie, { name: 'Other agent', prompt: 'Another prompt.' })
      assert.equal(other.status, 201)
      const otherAgent = (await other.json()).agent
      assert.equal(otherAgent.templateId, 'custom')
      otherId = otherAgent.id
    })
    await t.test('listing is scoped to the session owner even with an owner query parameter', async () => {
      const response = await call('GET', `/api/agents?ownerId=${second.userId}`, first.cookie)
      assert.equal(response.status, 200)
      assert.deepEqual((await response.json()).agents.map((agent: { id: string }) => agent.id), [agentId])
      assert.deepEqual((await (await call('GET', '/api/agents', second.cookie)).json()).agents.map((agent: { id: string }) => agent.id), [otherId])
    })
    await t.test('get, patch and delete hide other users’ agents and missing agents', async () => {
      for (const id of [otherId, randomUUID()]) {
        for (const method of ['GET', 'PATCH', 'DELETE']) {
          const response = await call(method, `/api/agents/${id}`, first.cookie, method === 'PATCH' ? { name: 'Not allowed' } : undefined)
          assert.equal(response.status, 404)
          assert.deepEqual(await response.json(), { message: 'Agent not found.' })
        }
      }
      const response = await call('GET', `/api/agents/${agentId}`, first.cookie)
      assert.equal(response.status, 200)
      assert.equal((await response.json()).agent.id, agentId)
    })
    await t.test('partial updates preserve other fields and accept literal SQL-like text', async () => {
      const response = await call('PATCH', `/api/agents/${agentId}`, first.cookie, { name: "O'Reilly -- support" })
      assert.equal(response.status, 200)
      const { agent } = await response.json()
      assert.equal(agent.name, "O'Reilly -- support")
      assert.equal(agent.prompt, 'Answer questions clearly.')
      assert.equal(agent.templateId, 'custom')
      const update = await call('PATCH', `/api/agents/${agentId}`, first.cookie, { prompt: 'Updated prompt.', templateId: 'support' })
      assert.equal(update.status, 200)
      const updated = (await update.json()).agent
      assert.equal(updated.prompt, 'Updated prompt.')
      assert.equal(updated.templateId, 'support')
      assert.equal(updated.name, agent.name)
    })
    await t.test('invalid fields, empty patches, and ownership injection are rejected', async () => {
      for (const changes of [{ name: '  ' }, { name: 'x'.repeat(101) }, { prompt: '' }, { prompt: 'x'.repeat(12001) }, { templateId: 'unknown' }, { ownerId: second.userId }]) {
        const response = await call('POST', '/api/agents', first.cookie, { ...input, ...changes })
        assert.equal(response.status, 400)
        assert.ok((await response.json()).message)
      }
      for (const body of [{}, null, { prompt: null }, { id: otherId }, { ownerId: second.userId }, { createdAt: new Date().toISOString() }]) {
        assert.equal((await call('PATCH', `/api/agents/${agentId}`, first.cookie, body)).status, 400)
      }
      assert.equal((await call('GET', '/api/agents/invalid-id', first.cookie)).status, 400)
    })
    await t.test('create and patch reject missing and untrusted origins', async () => {
      for (const origin of [null, 'https://untrusted.example']) {
        assert.equal((await call('POST', '/api/agents', first.cookie, input, origin)).status, 403)
        assert.equal((await call('PATCH', `/api/agents/${agentId}`, first.cookie, { name: 'Forbidden' }, origin)).status, 403)
      }
      assert.equal((await (await call('GET', `/api/agents/${agentId}`, first.cookie)).json()).agent.name, "O'Reilly -- support")
    })
    await t.test('valid Unicode prompts fit the JSON body limit and updates sort first', async () => {
      const prompt = '界'.repeat(12000)
      const response = await call('POST', '/api/agents', first.cookie, { name: 'Unicode agent', prompt, templateId: 'assistant' })
      assert.equal(response.status, 201)
      const { agent } = await response.json()
      assert.equal(agent.prompt, prompt)
      let list = (await (await call('GET', '/api/agents', first.cookie)).json()).agents
      assert.equal(list[0].id, agent.id)
      assert.equal((await call('PATCH', `/api/agents/${agentId}`, first.cookie, { name: 'Most recent' })).status, 200)
      list = (await (await call('GET', '/api/agents', first.cookie)).json()).agents
      assert.equal(list[0].id, agentId)
    })
    await t.test('delete removes owned agent and prevents future access', async () => {
      const created = await call('POST', '/api/agents', first.cookie, { name: 'To be deleted', prompt: 'Delete me.' })
      assert.equal(created.status, 201)
      const toDeleteId = (await created.json()).agent.id
      const delResponse = await call('DELETE', `/api/agents/${toDeleteId}`, first.cookie)
      assert.equal(delResponse.status, 200)
      assert.deepEqual(await delResponse.json(), { id: toDeleteId })
      const getResponse = await call('GET', `/api/agents/${toDeleteId}`, first.cookie)
      assert.equal(getResponse.status, 404)
    })
    await t.test('malformed and oversized JSON return useful client errors', async () => {
      for (const [body, expected] of [['{broken', 400], [JSON.stringify({ prompt: 'x'.repeat(100_000) }), 413]] as const) {
        const response = await fetch(`${base}/api/agents`, { method: 'POST', headers: { Cookie: first.cookie, Origin: env.BETTER_AUTH_URL, 'Content-Type': 'application/json' }, body })
        assert.equal(response.status, expected)
        assert.ok((await response.json()).message)
      }
    })
    await t.test('Prisma migrations can be redeployed without changing saved agents', async () => {
      await deployTestMigrations(env.DATABASE_URL)
      assert.equal((await pool.query('SELECT 1 FROM _prisma_migrations WHERE migration_name = $1 AND finished_at IS NOT NULL', ['0001_initial'])).rowCount, 1)
      assert.equal((await call('GET', `/api/agents/${agentId}`, first.cookie)).status, 200)
      assert.equal((await pool.query('SELECT owner_id FROM agents WHERE id = $1', [agentId])).rows[0].owner_id, first.userId)
    })
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()))
    await cleanup()
  }
})
