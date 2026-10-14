const E = process.env;
export const sbOn = () => !!(E.SUPABASE_URL && E.SUPABASE_SERVICE_KEY);
export async function sb(method, path, body, h = {}) {
  if (!sbOn()) return null;
  try {
    const r = await fetch(`${E.SUPABASE_URL}/rest/v1/${path}`, { method, body: body && JSON.stringify(body),
      headers: { apikey: E.SUPABASE_SERVICE_KEY, Authorization: 'Bearer ' + E.SUPABASE_SERVICE_KEY, 'Content-Type': 'application/json', ...h } });
    if (!r.ok) { console.warn(`[Supabase ${method} ${path}] HTTP ${r.status}`); return null; }
    return method === 'GET' ? r.json() : true;
  } catch (e) { console.warn(`[Supabase] ${e.message}`); return null; }
}
export const saveSnapshot = data => sb('POST', 'snapshots', { id: 'catalog', data, updated_at: new Date().toISOString() }, { Prefer: 'resolution=merge-duplicates' });
export const loadSnapshot = async () => (await sb('GET', 'snapshots?id=eq.catalog&select=data'))?.[0]?.data || null;
