// Mock mínimo de Supabase (Auth + PostgREST) SOLO para ver la app renderizada. Datos de ejemplo del encargo.
const http = require('http');
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
const jwt = (sub) => `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ sub, role: 'authenticated', exp: Math.floor(Date.now() / 1000) + 3600 })}.sig`;
const USERS = { 'mama@t': { id: 'u-mama', role: 'admin', name: 'Mamá', is_helper: false }, 'john@t': { id: 'u-john', role: 'user', name: 'John', is_helper: false } };
const byId = (id) => Object.values(USERS).find((u) => u.id === id);
const mv = (id, kind, origin, amt, date, concept, machine) => ({ id, kind, origin, origin_detail: null, signed_amount: amt, movement_date: date, concept, updated_at: '2026-10-03T10:00:00Z', created_at: '2026-10-03T10:00:00Z', machine: machine ? { name: machine } : null, account_id: 'acc-john', deleted_at: null, income_id: null, machine_id: null });
const MOVS = [mv('m1', 'credit', 'work', 200000, '2026-10-03', 'Trabajo'), mv('m2', 'machine_income', 'machine', 180000, '2026-10-03', 'Ingreso M1', 'Máquina 1'), mv('m3', 'transfer', 'transfer', -50000, '2026-10-03', 'Transferencia personal')];
const DASH = { total_machine_income: 180000, unassigned_income: 0, total_transferred: 50000, managed_balance: 430000,
  accounts: [{ account_id: 'acc-john', owner_key: 'john', display_name: 'John', balance: 330000, assigned: 380000, transferred: 50000 }, { account_id: 'acc-mauricio', owner_key: 'mauricio', display_name: 'Mauricio', balance: 100000, assigned: 100000, transferred: 0 }],
  machines: [{ id: 'w', name: 'Wild', description: null, active: true, total: 0 }, { id: 'mj', name: 'Máquina Multijuegos', description: null, active: true, total: 0 }, { id: 'm1', name: 'Máquina 1', description: null, active: true, total: 180000 }] };
const SUMMARY = { balance: 330000, opening_balance: 0, total_income: 380000, total_received: 50000, by_origin: [{ origin: 'machine', total: 180000 }, { origin: 'work', total: 200000 }, { origin: 'transfer', total: -50000 }], last_movement: { id: 'm3', kind: 'transfer', signed_amount: -50000, movement_date: '2026-10-03' } };
const send = (res, code, body, extra = {}) => { res.writeHead(code, { 'content-type': 'application/json', 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-expose-headers': '*', ...extra }); res.end(body === undefined ? '' : JSON.stringify(body)); };
http.createServer((req, res) => {
  if (req.method === 'OPTIONS') return send(res, 200, {});
  const url = new URL(req.url, 'http://x'); let body = '';
  req.on('data', (c) => (body += c));
  req.on('end', () => {
    const auth = (req.headers.authorization || '').replace('Bearer ', '');
    let sub = null; try { sub = JSON.parse(Buffer.from(auth.split('.')[1], 'base64url').toString()).sub; } catch {}
    const me = byId(sub); const single = (req.headers.accept || '').includes('pgrst.object');
    const out = (rows) => send(res, 200, single ? rows[0] : rows, { 'content-range': `0-${Math.max(rows.length - 1, 0)}/${rows.length}` });
    console.log(req.method, url.pathname + url.search.slice(0, 90));
    if (url.pathname === '/auth/v1/token') {
      const { email, password } = JSON.parse(body || '{}'); const u = USERS[email];
      if (!u || password !== 'clave12345') return send(res, 400, { error: 'invalid_grant', error_description: 'Invalid login credentials' });
      const t = jwt(u.id);
      return send(res, 200, { access_token: t, token_type: 'bearer', expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, refresh_token: 'r', user: { id: u.id, aud: 'authenticated', email, app_metadata: {}, user_metadata: {}, created_at: '2026-01-01T00:00:00Z' } });
    }
    if (url.pathname === '/auth/v1/user') return me ? send(res, 200, { id: me.id, email: me.id, aud: 'authenticated' }) : send(res, 401, {});
    if (url.pathname === '/auth/v1/logout') return send(res, 204);
    if (!me) return send(res, 401, { message: 'JWT' });
    const p = url.pathname.replace('/rest/v1/', '');
    if (p === 'profiles') return out([{ id: me.id, role: me.role, display_name: me.name, is_helper: me.is_helper }]);
    if (p === 'rpc/admin_dashboard') return me.role === 'admin' ? send(res, 200, DASH) : send(res, 403, { code: '42501', message: 'No autorizado' });
    if (p === 'rpc/account_summary') return send(res, 200, SUMMARY);
    if (p === 'rpc/family_status') return send(res, 200, [{ owner_key: 'john', display_name: 'John', is_helper: false, active: true, is_me: false, user_id: 'u-john' }, { owner_key: 'mauricio', display_name: 'Mauricio', is_helper: false, active: true, is_me: false, user_id: 'u-m' }]);
    if (p === 'account_balances') return out([{ account_id: 'acc-john', balance: 330000 }]);
    if (p === 'account_movements') return out(MOVS);
    if (p === 'notifications') return out([{ id: 'n1', title: 'Tu saldo fue actualizado', body: 'Mamá registró una transferencia de $50.000 a tu cuenta.', created_at: '2026-10-03T10:00:00Z', read_at: null }]);
    if (p === 'machines') return out(DASH.machines.map((m) => ({ id: m.id, name: m.name, active: true })));
    if (p === 'incomes') return out([{ id: 'i1', income_date: '2026-10-03', amount: 180000, description: 'Ingreso M1', machine: { name: 'Máquina 1' }, allocations: [{ account_id: 'acc-john', signed_amount: 180000, deleted_at: null }] }]);
    if (p === 'receipts') return out([]);
    if (p === 'accounts') return out([{ id: 'acc-john', profile: { display_name: 'John' } }, { id: 'acc-mauricio', profile: { display_name: 'Mauricio' } }]);
    send(res, 200, []);
  });
}).listen(54321, () => console.log('mock listo en 54321'));
