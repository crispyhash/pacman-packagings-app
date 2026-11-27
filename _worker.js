/**
 * Cloudflare Pages advanced-mode worker for Pacman Packagings.
 *
 * Auth: protects all routes. Configure Pages secrets:
 *   APP_USERNAME, APP_PASSWORD, AUTH_SECRET
 *
 * Routes:
 *   GET/POST /login     -> login page / authenticate
 *   POST     /api/logout -> clear session
 *   GET      /api/state -> returns saved JSON state (or null)
 *   PUT/POST /api/state -> saves JSON state
 *   *                   -> serves static assets (authenticated)
 */
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;

    if (path === '/login') return handleLogin(request, env, url);
    if (path === '/api/login' && request.method === 'POST') return handleLoginPost(request, env);
    if (path === '/api/logout' && request.method === 'POST') return logout();

    const authed = await isAuthed(request, env);
    if (!authed) {
      if (path.startsWith('/api/')) return json({ error: 'Unauthorized' }, 401);
      const loginUrl = new URL('/login', url.origin);
      loginUrl.searchParams.set('next', path + url.search);
      return Response.redirect(loginUrl.toString(), 302);
    }

    if (path === '/api/state') return handleState(request, env);
    return env.ASSETS.fetch(request);
  }
};

async function handleState(request, env) {
  if (!env.DB) return json({ error: 'Database not configured' }, 503);

  if (request.method === 'GET') {
    const row = await env.DB.prepare('SELECT data FROM workspace WHERE id = ?').bind('main').first();
    return json(row ? JSON.parse(row.data) : null);
  }

  if (request.method === 'PUT' || request.method === 'POST') {
    const body = await request.text();
    try { JSON.parse(body); } catch { return json({ error: 'Invalid JSON' }, 400); }
    await env.DB.prepare(
      "INSERT INTO workspace (id, data, updated_at) VALUES (?, ?, datetime('now')) " +
      'ON CONFLICT(id) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at'
    ).bind('main', body).run();
    return json({ ok: true });
  }

  return json({ error: 'Method not allowed' }, 405);
}

async function handleLogin(request, env, url) {
  if (await isAuthed(request, env)) return Response.redirect(new URL('/', url.origin).toString(), 302);
  const next = sanitizeNext(url.searchParams.get('next'));
  const err = url.searchParams.get('err') ? 'Invalid username or password.' : '';
  return new Response(loginHtml(next, err), {
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' }
  });
}

async function handleLoginPost(request, env) {
  const form = await request.formData().catch(() => null);
  const username = String(form?.get('username') || '');
  const password = String(form?.get('password') || '');
  const next = sanitizeNext(String(form?.get('next') || '/'));
  const expectedUser = String(env.APP_USERNAME || '');
  const expectedPass = String(env.APP_PASSWORD || '');
  if (!expectedUser || !expectedPass) {
    return new Response(loginHtml(next, 'Login is not configured. Set APP_USERNAME and APP_PASSWORD secrets.'), {
      status: 503, headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' }
    });
  }
  if (!safeEqual(username, expectedUser) || !safeEqual(password, expectedPass)) {
    const u = new URL('/login', request.url);
    u.searchParams.set('err', '1');
    u.searchParams.set('next', next);
    return Response.redirect(u.toString(), 302);
  }
  const token = await makeToken(env);
  return new Response(null, {
    status: 302,
    headers: {
      'Location': new URL(next, request.url).toString(),
      'Set-Cookie': `pp_session=${token}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=${60 * 60 * 24 * 30}`,
      'Cache-Control': 'no-store'
    }
  });
}

function logout() {
  return new Response(null, {
    status: 302,
    headers: {
      'Location': '/login',
      'Set-Cookie': 'pp_session=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0',
      'Cache-Control': 'no-store'
    }
  });
}

async function isAuthed(request, env) {
  const secret = String(env.AUTH_SECRET || '');
  if (!secret) return false;
  const cookie = request.headers.get('Cookie') || '';
  const m = cookie.match(/(?:^|;\s*)pp_session=([^;]+)/);
  if (!m) return false;
  return verifyToken(m[1], secret);
}

async function makeToken(env) {
  const secret = String(env.AUTH_SECRET || '');
  const exp = Date.now() + 1000 * 60 * 60 * 24 * 30;
  const payload = btoa(JSON.stringify({ exp }));
  const sig = await sign(payload, secret);
  return `${payload}.${sig}`;
}

async function verifyToken(token, secret) {
  const [payload, sig] = String(token).split('.');
  if (!payload || !sig) return false;
  const expected = await sign(payload, secret);
  if (!safeEqual(sig, expected)) return false;
  try {
    const data = JSON.parse(atob(payload));
    return typeof data.exp === 'number' && data.exp > Date.now();
  } catch { return false; }
}

async function sign(data, secret) {
  const key = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );
  const buf = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(data));
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
}

function safeEqual(a, b) {
  const aa = String(a), bb = String(b);
  if (aa.length !== bb.length) return false;
  let out = 0;
  for (let i = 0; i < aa.length; i++) out |= aa.charCodeAt(i) ^ bb.charCodeAt(i);
  return out === 0;
}

function sanitizeNext(next) {
  const n = String(next || '/');
  if (!n.startsWith('/') || n.startsWith('//') || n.includes('://')) return '/';
  return n;
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }
  });
}

function esc(s) {
  return String(s).replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
}

function loginHtml(next, err) {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Login — Pacman Packagings</title>
  <style>
    :root { --bg:#f5f5f2; --card:#fff; --text:#1f2420; --muted:#6b756f; --line:#e6e8e4; --accent:#1f6a45; --danger:#b3261e; }
    * { box-sizing: border-box; }
    body { margin:0; min-height:100vh; display:grid; place-items:center; background:linear-gradient(180deg,#fbfbf9,#f0f2ee); font-family:Inter,system-ui,-apple-system,Segoe UI,sans-serif; color:var(--text); padding:24px; }
    .card { width:min(100%,420px); background:var(--card); border:1px solid var(--line); border-radius:20px; padding:28px; box-shadow:0 8px 30px rgba(0,0,0,.04); }
    .brand { display:flex; align-items:center; gap:12px; margin-bottom:20px; }
    .mark { width:42px; height:42px; border-radius:12px; background:#f4c400; display:grid; place-items:center; font-weight:800; color:#1b1b18; }
    h1 { font-size:1.35rem; margin:0; letter-spacing:-.02em; }
    p.sub { margin:4px 0 0; color:var(--muted); font-size:.92rem; }
    label { display:block; font-size:.85rem; font-weight:600; margin:14px 0 6px; }
    input { width:100%; padding:12px 13px; border:1px solid var(--line); border-radius:12px; font:inherit; background:#fff; }
    input:focus { outline:2px solid #dceade; border-color:#9bc0ad; }
    button { width:100%; margin-top:18px; padding:12px 14px; border:0; border-radius:12px; background:var(--accent); color:#fff; font:inherit; font-weight:650; cursor:pointer; }
    button:hover { filter:brightness(.96); }
    .err { margin-top:14px; padding:10px 12px; border-radius:10px; background:#fff3f2; color:var(--danger); font-size:.9rem; }
    .foot { margin-top:18px; color:var(--muted); font-size:.78rem; text-align:center; }
  </style>
</head>
<body>
  <form class="card" method="post" action="/api/login">
    <div class="brand">
      <div class="mark">P</div>
      <div>
        <h1>Pacman Packagings</h1>
        <p class="sub">Sign in to access bookkeeping</p>
      </div>
    </div>
    <input type="hidden" name="next" value="${esc(next)}">
    <label for="username">Username</label>
    <input id="username" name="username" autocomplete="username" required>
    <label for="password">Password</label>
    <input id="password" name="password" type="password" autocomplete="current-password" required>
    <button type="submit">Sign in</button>
    ${err ? `<div class="err">${esc(err)}</div>` : ''}
    <div class="foot">An undertaking of Neena Greentailers</div>
  </form>
</body>
</html>`;
}