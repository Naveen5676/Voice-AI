import assert from 'node:assert/strict'
import { randomBytes } from 'node:crypto'
import { once } from 'node:events'
import test from 'node:test'
import { getMigrations } from 'better-auth/db/migration'
import { createApp } from '../src/app.js'
import { readEnvironment } from '../src/config/env.js'
import { createPool } from '../src/db/pool.js'
import { authOptions, createAuth } from '../src/lib/auth.js'

test('environment validation does not expose secrets', () => {
  assert.throws(() => readEnvironment({ DATABASE_URL: 'private-value', BETTER_AUTH_SECRET: 'secret' }), (error: unknown) => {
    assert.ok(error instanceof Error)
    assert.ok(!error.message.includes('private-value'))
    assert.ok(!error.message.includes(': secret'))
    return true
  })
  assert.throws(() => readEnvironment({ NODE_ENV: 'production', DATABASE_URL: 'postgresql://localhost/test', BETTER_AUTH_SECRET: randomBytes(32).toString('hex'), BETTER_AUTH_URL: 'http://example.com' }), /HTTPS/)
})

// Creates and drops a separate database; never runs migrations against app data.
test('email/password authentication over HTTP with PostgreSQL', { skip: !process.env.TEST_DATABASE_URL }, async (t) => {
  const databaseName = `voice_auth_test_${randomBytes(8).toString('hex')}`
  const admin = createPool(process.env.TEST_DATABASE_URL!)
  await admin.query(`CREATE DATABASE "${databaseName}"`)
  const url = new URL(process.env.TEST_DATABASE_URL!)
  url.pathname = `/${databaseName}`
  const pool = createPool(url.toString())
  const env = readEnvironment({
    NODE_ENV: 'test', DATABASE_URL: url.toString(),
    BETTER_AUTH_SECRET: randomBytes(32).toString('hex'),
    BETTER_AUTH_URL: 'http://localhost:5173',
  })
  let server: ReturnType<ReturnType<typeof createApp>['listen']> | undefined
  try {
    await (await getMigrations(authOptions(pool, env))).runMigrations()
    // Re-running migration is safe and should not recreate existing tables.
    await (await getMigrations(authOptions(pool, env))).runMigrations()
    const auth = createAuth(pool, env)
    server = createApp(auth, env).listen(0, '127.0.0.1')
    await once(server, 'listening')
    const address = server.address()
    assert.ok(address && typeof address === 'object')
    const base = `http://127.0.0.1:${address.port}`
    const user = { name: 'Test User', email: 'auth-test@example.com', password: 'correct-test-password' }
    let cookie = ''
    const call = (endpoint: string, body?: object, options?: { cookie?: string; origin?: string; spoofedIp?: string }) => fetch(`${base}${endpoint}`, {
      method: body ? 'POST' : 'GET',
      headers: {
        ...(body ? { 'Content-Type': 'application/json', Origin: options?.origin ?? env.BETTER_AUTH_URL } : {}),
        ...(options?.cookie ? { Cookie: options.cookie } : {}),
        ...(options?.spoofedIp ? { 'x-voice-client-ip': options.spoofedIp, 'x-forwarded-for': options.spoofedIp } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    })

    await t.test('protected API rejects visitors and unknown APIs return JSON', async () => {
      assert.equal((await call('/api/me')).status, 401)
      const unknown = await call('/api/unknown')
      assert.equal(unknown.status, 404)
      assert.match(unknown.headers.get('content-type')!, /json/)
    })
    await t.test('server rejects short passwords and untrusted origins', async () => {
      assert.equal((await call('/api/auth/sign-up/email', { ...user, password: 'short' })).status, 400)
      assert.equal((await call('/api/auth/sign-up/email', user, { origin: 'https://untrusted.example' })).status, 403)
    })
    await t.test('signup creates a cookie session without email verification', async () => {
      const response = await call('/api/auth/sign-up/email', user)
      assert.equal(response.status, 200)
      const cookies = response.headers.getSetCookie()
      const sessionCookie = cookies.find((value) => value.startsWith('better-auth.session_token='))
      assert.ok(sessionCookie)
      assert.match(sessionCookie, /HttpOnly/i)
      assert.match(sessionCookie, /SameSite=Lax/i)
      cookie = cookies.map((value) => value.split(';')[0]).join('; ')
      assert.equal((await response.json()).user.emailVerified, false)
      const me = await call('/api/me', undefined, { cookie })
      assert.equal(me.status, 200)
      assert.deepEqual(Object.keys((await me.json()).user).sort(), ['email', 'id', 'name'])
      const account = await pool.query('SELECT password FROM account WHERE "providerId" = $1', ['credential'])
      assert.notEqual(account.rows[0].password, user.password)
      assert.ok(account.rows[0].password.length > 30)
    })
    await t.test('session is restored on a subsequent request', async () => {
      const response = await call('/api/auth/get-session', undefined, { cookie })
      assert.equal(response.status, 200)
      assert.equal((await response.json()).user.email, user.email)
    })
    await t.test('duplicate signup and invalid login are rejected', async () => {
      assert.equal((await call('/api/auth/sign-up/email', user)).status, 422)
      assert.equal((await call('/api/auth/sign-in/email', { email: user.email, password: 'wrong-password' })).status, 401)
    })
    await t.test('repeated signup requests are rate limited', async () => {
      assert.equal((await call('/api/auth/sign-up/email', user)).status, 422)
      assert.equal((await call('/api/auth/sign-up/email', user, { spoofedIp: '203.0.113.99' })).status, 429)
    })
    await t.test('logout invalidates the old session on the backend', async () => {
      assert.equal((await call('/api/auth/sign-out', {}, { cookie })).status, 200)
      assert.equal((await call('/api/me', undefined, { cookie })).status, 401)
    })
    await t.test('login establishes a new session; expired sessions are rejected', async () => {
      const response = await call('/api/auth/sign-in/email', { email: user.email, password: user.password })
      assert.equal(response.status, 200)
      cookie = response.headers.getSetCookie().map((value) => value.split(';')[0]).join('; ')
      assert.equal((await call('/api/me', undefined, { cookie })).status, 200)
      await pool.query('UPDATE session SET "expiresAt" = $1', [new Date(Date.now() - 60_000)])
      assert.equal((await call('/api/me', undefined, { cookie })).status, 401)
    })
    await t.test('production serves SPA routes and uses Secure session cookies', async () => {
      const production = { ...env, NODE_ENV: 'production' as const, BETTER_AUTH_URL: 'https://voice.example' }
      await pool.query('DELETE FROM "rateLimit"')
      const productionServer = createApp(createAuth(pool, production), production).listen(0, '127.0.0.1')
      await once(productionServer, 'listening')
      const productionAddress = productionServer.address()
      assert.ok(productionAddress && typeof productionAddress === 'object')
      const productionBase = `http://127.0.0.1:${productionAddress.port}`
      try {
        for (const path of ['/login', '/signup', '/dashboard']) {
          const response = await fetch(`${productionBase}${path}`)
          assert.equal(response.status, 200)
          assert.match(await response.text(), /Voice Studio/)
          assert.ok(response.headers.get('content-security-policy'))
        }
        assert.equal((await fetch(`${productionBase}/api/unknown`)).status, 404)
        const response = await fetch(`${productionBase}/api/auth/sign-in/email`, {
          method: 'POST', headers: { 'Content-Type': 'application/json', Origin: production.BETTER_AUTH_URL },
          body: JSON.stringify({ email: user.email, password: user.password }),
        })
        assert.equal(response.status, 200)
        const sessionCookie = response.headers.getSetCookie().find((value) => value.includes('session_token='))
        assert.ok(sessionCookie)
        assert.match(sessionCookie, /; Secure/i)
        assert.match(sessionCookie, /; HttpOnly/i)
      } finally {
        await new Promise<void>((resolve) => productionServer.close(() => resolve()))
      }
    })
    await t.test('backend validators reject blank and overlong names', async () => {
      await pool.query('DELETE FROM "rateLimit"')
      for (const name of ['   ', 'a'.repeat(101)]) {
        const response = await call('/api/auth/sign-up/email', { ...user, name, email: 'invalid-name@example.com' })
        assert.equal(response.status, 400)
      }
      assert.equal((await pool.query('SELECT 1 FROM "user" WHERE email = $1', ['invalid-name@example.com'])).rowCount, 0)
    })
  } finally {
    if (server) await new Promise<void>((resolve) => server!.close(() => resolve()))
    await pool.end()
    await admin.query(`DROP DATABASE "${databaseName}" WITH (FORCE)`)
    await admin.end()
  }
})
