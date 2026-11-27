/**
 * Cloudflare Pages advanced-mode worker for Pacman Packagings.
 *
 * Routes:
 *   GET  /api/state  -> returns the saved JSON state (or null)
 *   PUT  /api/state  -> saves the JSON state
 *   *               -> serves static assets
 *
 * Requires a D1 binding named DB and this schema:
 *   CREATE TABLE IF NOT EXISTS workspace (
 *     id TEXT PRIMARY KEY,
 *     data TEXT NOT NULL,
 *     updated_at TEXT NOT NULL DEFAULT (datetime('now'))
 *   );
 */
export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === '/api/state') {
      if (!env.DB) {
        return json({ error: 'Database not configured' }, 503);
      }

      if (request.method === 'GET') {
        const row = await env.DB.prepare(
          'SELECT data FROM workspace WHERE id = ?'
        ).bind('main').first();
        return json(row ? JSON.parse(row.data) : null);
      }

      if (request.method === 'PUT' || request.method === 'POST') {
        const body = await request.text();
        try {
          JSON.parse(body);
        } catch {
          return json({ error: 'Invalid JSON' }, 400);
        }
        await env.DB.prepare(
          "INSERT INTO workspace (id, data, updated_at) VALUES (?, ?, datetime('now')) " +
          'ON CONFLICT(id) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at'
        ).bind('main', body).run();
        return json({ ok: true });
      }

      return json({ error: 'Method not allowed' }, 405);
    }

    return env.ASSETS.fetch(request);
  }
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store'
    }
  });
}