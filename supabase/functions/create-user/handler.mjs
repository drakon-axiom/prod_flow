// Shared with the Node tests. Secrets are read only in the deployed Edge runtime.
export function makeCreateUserHandler(env, fetcher = fetch) {
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  const validEmail = value => typeof value === 'string' && value.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
  const validPassword = value => typeof value === 'string' && value.length >= 8 && value.length <= 128
  const validName = value => typeof value === 'string' && value.trim().length > 0 && value.trim().length <= 255
  return async request => {
    const headers = { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', Vary: 'Origin' }
    const reply = (status, body) => new Response(JSON.stringify(body), { status, headers })
    const origin = request.headers.get('origin')
    const allowed = (env('ALLOWED_ORIGINS') || 'https://prodflow.acgllc.co').split(',').map(value => value.trim())
    if (origin && !allowed.includes(origin)) return reply(403, { error: 'Origin not allowed' })
    if (origin) Object.assign(headers, {
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
    })
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers })
    if (request.method !== 'POST') return reply(405, { error: 'Use POST' })
    const authorization = request.headers.get('authorization') || ''
    if (!/^Bearer \S+$/.test(authorization)) return reply(401, { error: 'Sign in required' })
    const base = env('SUPABASE_URL'), publicKey = env('SUPABASE_ANON_KEY')
    if (!base || !publicKey) return reply(503, { error: 'User management is not configured' })
    const call = (path, options = {}) => fetcher(base + path, { ...options, redirect: 'error', signal: AbortSignal.timeout(10000) })
    const callerHeaders = { apikey: publicKey, authorization, 'Content-Type': 'application/json' }
    const rpc = (name, body) => call('/rest/v1/rpc/' + name, { method: 'POST', headers: callerHeaders, body: JSON.stringify(body) })
    const eligible = async () => {
      const result = await rpc('get_user_role', {})
      if (!result.ok) throw new Error('Access check unavailable')
      return await result.json() === 'admin'
    }
    try {
      const identity = await call('/auth/v1/user', { headers: callerHeaders })
      if (!identity.ok) return reply(401, { error: 'Sign in required' })
      const actor = await identity.json()
      if (!uuid.test(actor?.id || '')) return reply(401, { error: 'Sign in required' })
      // This is the caller-scoped, live Auth-aware helper from migration 016.
      // Never authorize through a service-role profile read or request metadata.
      if (!await eligible()) return reply(403, { error: 'Active administrator access is required' })
      if (Number(request.headers.get('content-length') || 0) > 8192) return reply(413, { error: 'Request too large' })
      const reader = request.body?.getReader()
      let raw = '', bytes = 0
      if (reader) {
        const decoder = new TextDecoder()
        for (;;) {
          const chunk = await reader.read()
          if (chunk.done) break
          bytes += chunk.value.byteLength
          if (bytes > 8192) { await reader.cancel(); return reply(413, { error: 'Request too large' }) }
          raw += decoder.decode(chunk.value, { stream: true })
        }
        raw += decoder.decode()
      }
      let body
      try { body = JSON.parse(raw) } catch { return reply(400, { error: 'Invalid request' }) }
      if (!body || typeof body !== 'object' || Array.isArray(body)) return reply(400, { error: 'Invalid request' })
      const action = body.action ?? 'create'
      if (action === 'delete') return reply(409, { error: 'User records must be preserved. Use Deactivate to remove access.' })
      if (!['create', 'update', 'set_password', 'send_reset_email'].includes(action)) return reply(400, { error: 'Unsupported action' })
      const fields = {
        create: ['action', 'email', 'password', 'name', 'role'],
        update: ['action', 'user_id', 'name', 'role', 'is_active'],
        set_password: ['action', 'user_id', 'password'],
        send_reset_email: ['action', 'email'],
      }[action]
      if (!fields || Object.keys(body).some(key => !fields.includes(key))) return reply(400, { error: 'Unsupported action or fields. Email changes are not supported here.' })
      if (['update', 'set_password'].includes(action) && !uuid.test(body.user_id || '')) return reply(400, { error: 'Valid user identifier required' })
      if (['create', 'send_reset_email'].includes(action) && !validEmail(body.email)) return reply(400, { error: 'Valid email required' })
      if (['create', 'set_password'].includes(action) && !validPassword(body.password)) return reply(400, { error: 'Use a password between 8 and 128 characters' })
      if (action === 'create' && !validName(body.name)) return reply(400, { error: 'Enter a name between 1 and 255 characters' })
      if (body.role !== undefined && !['admin', 'operator'].includes(body.role)) return reply(400, { error: 'Choose Admin or Operator' })
      if (action === 'update') {
        if ((body.name !== undefined && !validName(body.name)) || (body.is_active !== undefined && typeof body.is_active !== 'boolean')) return reply(400, { error: 'Invalid profile fields' })
        if (body.name === undefined && body.role === undefined && body.is_active === undefined) return reply(400, { error: 'Choose a profile change' })
        const updated = await rpc('admin_update_profile', { p_user_id: body.user_id, p_name: body.name, p_role: body.role, p_is_active: body.is_active })
        if (!updated.ok) return reply(409, { error: 'Access change was not permitted. Keep an active administrator and ask another administrator to change your own access.' })
        return reply(200, { success: true })
      }
      // Construct service credentials only after successful caller authorization.
      const secret = env('SUPABASE_SERVICE_ROLE_KEY')
      if (!secret) return reply(503, { error: 'User management is not configured' })
      const serviceHeaders = { apikey: secret, authorization: `Bearer ${secret}`, 'Content-Type': 'application/json' }
      const service = (path, method, body) => call(path, { method, headers: serviceHeaders, ...(body === undefined ? {} : { body: JSON.stringify(body) }) })
      const audit = async (target, event, details = {}) => {
        const result = await service('/rest/v1/security_events', 'POST', { actor_id: actor.id, target_id: target, action: event, details })
        return result.ok
      }
      const staffExists = async id => {
        const result = await call('/rest/v1/profiles?id=eq.' + id + '&select=id', { headers: callerHeaders })
        return result.ok && (await result.json()).some(row => row.id === id)
      }
      const requestId = crypto.randomUUID()
      if (action === 'create') {
        const role = body.role || 'operator', name = body.name.trim(), email = body.email.trim()
        if (!await eligible()) return reply(403, { error: 'Active administrator access is required' })
        if (!await audit(requestId, 'user.create_requested', { requested_role: role })) return reply(503, { error: 'Could not record the account request' })
        const created = await service('/auth/v1/admin/users', 'POST', { email, password: body.password, email_confirm: true, user_metadata: { name } })
        if (!created.ok) return reply(400, { error: 'Could not create user. Check the email and password policy.' })
        const user = await created.json()
        if (!uuid.test(user?.id || '')) return reply(502, { error: 'Unexpected account response. Check Users before retrying.' })
        // Repository migrations have no Auth profile trigger. Never provision a
        // privileged profile from Auth metadata or silently upsert an existing one.
        const profile = await service('/rest/v1/profiles', 'POST', { id: user.id, name, role: 'operator', is_active: false })
        if (!profile.ok) return reply(409, { error: 'Account created, but staff profile setup failed. An administrator must inspect the account before retrying.' })
        if (!await audit(user.id, 'user.created_inactive', { request_id: requestId })) return reply(409, { error: 'Account created but remains inactive. Audit setup needs administrator review.' })
        // The caller's audited transaction handles elevation/activation and
        // rechecks authority under the same lock as other access changes.
        const activated = await rpc('admin_update_profile', { p_user_id: user.id, p_name: name, p_role: role, p_is_active: true })
        if (!activated.ok) return reply(409, { error: 'Account created but remains inactive. An administrator must finish enabling it in Users.' })
        return reply(201, { user: { id: user.id, email, name, role } })
      }
      let target = body.user_id
      if (action === 'send_reset_email') {
        // The legacy contract accepts email. Resolve it to a staff account before
        // generating a recovery credential; never act on a nonstaff Auth account.
        for (let page = 1; page <= 20; page++) {
          const listed = await service(`/auth/v1/admin/users?page=${page}&per_page=100`, 'GET')
          if (!listed.ok) return reply(503, { error: 'Could not find the staff account' })
          const users = (await listed.json()).users
          if (!Array.isArray(users)) return reply(503, { error: 'Could not find the staff account' })
          target = users.find(user => typeof user.email === 'string' && user.email.toLowerCase() === body.email.toLowerCase())?.id
          if (target || users.length < 100) break
        }
      }
      if (!uuid.test(target || '') || !await staffExists(target)) return reply(404, { error: 'Staff account not found. Use the user list to choose an account.' })
      if (!await eligible()) return reply(403, { error: 'Active administrator access is required' })
      const event = action === 'set_password' ? 'user.password_change' : 'user.recovery_link'
      if (!await audit(target, event + '_requested', { request_id: requestId })) return reply(503, { error: 'Could not record the password request' })
      const changed = action === 'set_password'
        ? await service('/auth/v1/admin/users/' + target, 'PUT', { password: body.password })
        : await service('/auth/v1/admin/generate_link', 'POST', { type: 'recovery', email: body.email })
      if (!changed.ok) return reply(400, { error: 'Could not complete the password request. Check the account and password policy.' })
      let link
      if (action === 'send_reset_email') {
        const data = await changed.json()
        // GoTrue returns action_link on the top level; Supabase JS wraps it in properties.
        if (data.id !== target || typeof data.action_link !== 'string') return reply(502, { error: 'Could not confirm the recovery link. No link was returned.' })
        link = data.action_link
      }
      const recorded = await audit(target, event + '_completed', { request_id: requestId })
      return reply(200, { success: true, ...(link ? { link } : {}), ...(!recorded ? { warning: 'Password operation completed; completion audit needs administrator review.' } : {}) })
    } catch {
      return reply(503, { error: 'User management could not confirm completion. Check Users before retrying.' })
    }
  }
}
