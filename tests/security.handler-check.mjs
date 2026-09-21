import { test } from 'node:test'
import assert from 'node:assert/strict'
import { makeCreateUserHandler } from '../supabase/functions/create-user/handler.mjs'

const actor = '00000000-0000-0000-0000-000000000001'
const target = '00000000-0000-0000-0000-000000000002'
const password = 'fixture-password-only'
const create = { email: 'staff@example.invalid', name: 'Staff', password, role: 'admin' }
const json = (body, status = 200) => new Response(JSON.stringify(body), { status })
function fixture(overrides = {}) {
  const calls = [], envReads = []
  let checks = 0
  const env = name => {
    envReads.push(name)
    return { SUPABASE_URL: 'https://fixture.invalid', SUPABASE_ANON_KEY: 'public-fixture', SUPABASE_SERVICE_ROLE_KEY: 'service-fixture' }[name]
  }
  const handler = makeCreateUserHandler(env, async (url, options) => {
    const path = new URL(url).pathname + new URL(url).search
    const item = { path, method: options.method || 'GET', authorization: options.headers.authorization, body: options.body ? JSON.parse(options.body) : undefined }
    calls.push(item)
    assert.equal(options.redirect, 'error')
    if (overrides.respond) {
      const result = await overrides.respond(item)
      if (result) return result
    }
    if (path === '/auth/v1/user') return json({ id: actor }, overrides.identityStatus || 200)
    if (path === '/rest/v1/rpc/get_user_role') {
      checks++
      return json(overrides.roles ? overrides.roles[Math.min(checks - 1, overrides.roles.length - 1)] : 'admin')
    }
    if (path === '/auth/v1/admin/users') return json({ id: target, email: create.email })
    if (path.startsWith('/auth/v1/admin/users?page=')) return json({ users: [{ id: target, email: create.email }] })
    if (path === '/rest/v1/profiles') return json({})
    if (path.startsWith('/rest/v1/profiles?')) return json(overrides.noProfile ? [] : [{ id: target }])
    if (path === '/rest/v1/rpc/admin_update_profile') return json(null)
    if (path === '/rest/v1/security_events') return json({})
    if (path === '/auth/v1/admin/users/' + target) return json({ id: target })
    if (path === '/auth/v1/admin/generate_link') return json({ id: target, action_link: 'https://fixture.invalid/recovery?token=fixture', email_otp: 'never-return', hashed_token: 'never-return' })
    throw new Error('Unexpected request ' + path)
  })
  return {
    calls, envReads,
    async request(body, options = {}) {
      const response = await handler(new Request('https://fixture.invalid/functions/v1/create-user', {
        method: options.method || 'POST',
        headers: { authorization: 'Bearer caller-fixture', 'Content-Type': 'application/json', ...options.headers },
        ...(['GET', 'OPTIONS'].includes(options.method) ? {} : { body: typeof body === 'string' ? body : JSON.stringify(body) }),
      }))
      return { status: response.status, headers: response.headers, body: response.status === 204 ? null : await response.json() }
    },
  }
}

test('HTTP boundary denies foreign origins, non-POST and missing authentication without service access', async () => {
  for (const [options, status] of [
    [{ method: 'GET' }, 405],
    [{ headers: { origin: 'https://evil.invalid' } }, 403],
    [{ headers: { authorization: '' } }, 401],
  ]) {
    const f = fixture()
    assert.equal((await f.request(create, options)).status, status)
    assert.equal(f.calls.length, 0)
    assert.ok(!f.envReads.includes('SUPABASE_SERVICE_ROLE_KEY'))
  }
  const preflight = await fixture().request({}, { method: 'OPTIONS', headers: { origin: 'https://prodflow.acgllc.co' } })
  assert.equal(preflight.status, 204)
  assert.equal(preflight.headers.get('access-control-allow-origin'), 'https://prodflow.acgllc.co')
})

test('every action uses caller-scoped live role check before reading service credentials', async () => {
  for (const role of [null, 'operator']) {
    for (const body of [create, { action: 'update', user_id: target, role: 'admin' }, { action: 'set_password', user_id: target, password }, { action: 'send_reset_email', email: create.email }, { action: 'delete', user_id: target }]) {
      const f = fixture({ roles: [role] })
      assert.equal((await f.request(body)).status, 403)
      assert.deepEqual(f.calls.map(call => call.path), ['/auth/v1/user', '/rest/v1/rpc/get_user_role'])
      assert.equal(f.calls[1].authorization, 'Bearer caller-fixture')
      assert.ok(!f.envReads.includes('SUPABASE_SERVICE_ROLE_KEY'))
    }
  }
  const failed = fixture({ respond: call => call.path.endsWith('get_user_role') ? json({}, 500) : null })
  assert.equal((await failed.request(create)).status, 503)
  assert.ok(!failed.envReads.includes('SUPABASE_SERVICE_ROLE_KEY'))
  const forged = fixture({ identityStatus: 401 })
  assert.equal((await forged.request(create)).status, 401)
  assert.equal(forged.calls.length, 1)
})

test('malformed, oversized, unknown and invalid fields fail before service operations', async () => {
  for (const body of ['{', [], { ...create, role: 'superadmin' }, { ...create, password: 'short' }, { ...create, actor_id: actor }, { action: 'update', user_id: target, email: 'changed@example.invalid' }, { action: 'update', user_id: target, is_active: 'true' }, { action: 'set_password', user_id: '../escape', password }, { action: 'constructor' }, { action: 'unknown' }, { action: 'update', user_id: target }]) {
    const f = fixture()
    assert.equal((await f.request(body)).status, 400)
    assert.ok(!f.envReads.includes('SUPABASE_SERVICE_ROLE_KEY'))
  }
  assert.equal((await fixture().request('x'.repeat(8193))).status, 413)
})

test('legacy delete is rejected and role/activation updates use audited caller RPC only', async () => {
  const deletion = fixture()
  const result = await deletion.request({ action: 'delete', user_id: target })
  assert.equal(result.status, 409)
  assert.match(result.body.error, /Deactivate/)
  assert.ok(!deletion.envReads.includes('SUPABASE_SERVICE_ROLE_KEY'))
  const update = fixture()
  assert.equal((await update.request({ action: 'update', user_id: target, name: 'Changed', role: 'operator', is_active: false })).status, 200)
  const last = update.calls.at(-1)
  assert.equal(last.path, '/rest/v1/rpc/admin_update_profile')
  assert.equal(last.authorization, 'Bearer caller-fixture')
  assert.deepEqual(last.body, { p_user_id: target, p_name: 'Changed', p_role: 'operator', p_is_active: false })
  assert.ok(!update.envReads.includes('SUPABASE_SERVICE_ROLE_KEY'))
  const denied = fixture({ respond: call => call.path.endsWith('admin_update_profile') ? json({}, 403) : null })
  assert.equal((await denied.request({ action: 'update', user_id: actor, is_active: false })).status, 409)
  assert.ok(!denied.calls.some(call => call.authorization === 'Bearer service-fixture'))
})

test('new users start as inactive operators and elevation occurs through caller RPC', async () => {
  const f = fixture()
  const result = await f.request(create)
  assert.equal(result.status, 201)
  assert.deepEqual(result.body, { user: { id: target, email: create.email, name: create.name, role: 'admin' } })
  const auth = f.calls.find(call => call.path === '/auth/v1/admin/users')
  assert.deepEqual(auth.body.user_metadata, { name: 'Staff' })
  assert.equal(auth.body.role, undefined)
  assert.deepEqual(f.calls.find(call => call.path === '/rest/v1/profiles').body, { id: target, name: 'Staff', role: 'operator', is_active: false })
  const activation = f.calls.at(-1)
  assert.equal(activation.path, '/rest/v1/rpc/admin_update_profile')
  assert.equal(activation.authorization, 'Bearer caller-fixture')
  assert.equal(activation.body.p_role, 'admin')
  assert.equal(activation.body.p_is_active, true)
  assert.ok(f.calls.findIndex(call => call.path === '/rest/v1/profiles') < f.calls.length - 1)
  assert.ok(f.calls.filter(call => call.path === '/rest/v1/security_events').every(call => !JSON.stringify(call.body).includes(password)))
})

test('revoked authority or partial provisioning never triggers privileged fallback or destructive cleanup', async () => {
  const revoked = fixture({ roles: ['admin', null] })
  assert.equal((await revoked.request(create)).status, 403)
  assert.ok(!revoked.calls.some(call => call.authorization === 'Bearer service-fixture'))
  for (const failedPath of ['/rest/v1/profiles', '/rest/v1/rpc/admin_update_profile']) {
    const f = fixture({ respond: call => call.path === failedPath ? json({}, 409) : null })
    const result = await f.request(create)
    assert.equal(result.status, 409)
    assert.match(result.body.error, /Account created/)
    assert.ok(!f.calls.some(call => call.method === 'DELETE' || call.method === 'PATCH'))
    assert.equal(f.calls.filter(call => call.path === '/auth/v1/admin/users').length, 1)
  }
  const noAudit = fixture({ respond: call => call.path === '/rest/v1/security_events' ? json({}, 500) : null })
  assert.equal((await noAudit.request(create)).status, 503)
  assert.ok(!noAudit.calls.some(call => call.path === '/auth/v1/admin/users'))
})

test('password change verifies staff and fresh caller authority; audit contains no password', async () => {
  const f = fixture()
  assert.equal((await f.request({ action: 'set_password', user_id: target, password })).status, 200)
  const audit = f.calls.filter(call => call.path === '/rest/v1/security_events')
  assert.deepEqual(audit.map(call => call.body.action), ['user.password_change_requested', 'user.password_change_completed'])
  assert.ok(audit.every(call => call.body.actor_id === actor && call.body.target_id === target && !JSON.stringify(call.body).includes(password)))
  const changed = f.calls.find(call => call.method === 'PUT')
  assert.deepEqual(changed.body, { password })
  for (const options of [{ noProfile: true }, { roles: ['admin', null] }]) {
    const denied = fixture(options)
    assert.ok([403, 404].includes((await denied.request({ action: 'set_password', user_id: target, password })).status))
    assert.ok(!denied.calls.some(call => call.method === 'PUT'))
  }
  const noAudit = fixture({ respond: call => call.path === '/rest/v1/security_events' ? json({}, 500) : null })
  assert.equal((await noAudit.request({ action: 'set_password', user_id: target, password })).status, 503)
  assert.ok(!noAudit.calls.some(call => call.method === 'PUT'))
})

test('legacy recovery response returns only validated staff link, without emailing or logging credentials', async () => {
  const f = fixture()
  const result = await f.request({ action: 'send_reset_email', email: create.email })
  assert.equal(result.status, 200)
  assert.deepEqual(result.body, { success: true, link: 'https://fixture.invalid/recovery?token=fixture' })
  assert.ok(!f.calls.some(call => call.path === '/auth/v1/recover'))
  const audit = f.calls.filter(call => call.path === '/rest/v1/security_events')
  assert.ok(audit.every(call => !JSON.stringify(call.body).includes('token=') && !JSON.stringify(call.body).includes('never-return')))
  const noStaff = fixture({ noProfile: true })
  assert.equal((await noStaff.request({ action: 'send_reset_email', email: create.email })).status, 404)
  assert.ok(!noStaff.calls.some(call => call.path.endsWith('generate_link')))
  const mismatch = fixture({ respond: call => call.path.endsWith('generate_link') ? json({ id: actor, action_link: 'must-not-expose' }) : null })
  const denied = await mismatch.request({ action: 'send_reset_email', email: create.email })
  assert.equal(denied.status, 502)
  assert.ok(!JSON.stringify(denied.body).includes('must-not-expose'))
})

test('uncertain remote failure has safe response; completed password operation reports audit warning', async () => {
  const failure = fixture({ respond: call => { if (call.method === 'PUT') throw new Error('provider-secret'); return null } })
  const result = await failure.request({ action: 'set_password', user_id: target, password })
  assert.equal(result.status, 503)
  assert.ok(!JSON.stringify(result.body).includes('provider-secret'))
  const warning = fixture({ respond: call => call.body?.action === 'user.password_change_completed' ? json({}, 500) : null })
  const completed = await warning.request({ action: 'set_password', user_id: target, password })
  assert.equal(completed.status, 200)
  assert.equal(completed.body.success, true)
  assert.match(completed.body.warning, /audit/)
  assert.equal(completed.headers.get('cache-control'), 'no-store')
})
