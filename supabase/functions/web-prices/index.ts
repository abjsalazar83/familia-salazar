// Preços de referência da internet: Open Prices (Open Food Facts), dados abertos ODbL, API pública feita para isto.
// Lojas (Continente, Pingo Doce, Auchan…) bloqueiam a pesquisa no robots.txt → não usamos.
// Atualiza a cache public.web_prices no máximo 1×/dia. Sem segredos próprios (só os da própria Supabase).
const API = 'https://prices.openfoodfacts.org/api/v1/prices';
const UA = 'FamiliaSalazar/1.0 (https://github.com/abjsalazar83/familia-salazar)';
const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type', 'Content-Type': 'application/json' };
const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();

const CC: Record<string, string> = { portugal: 'PT', espana: 'ES', spain: 'ES' };
const cc = (loc: any) => (loc.osm_address_country_code || CC[norm(loc.osm_address_country || '')] || null);
/** Cadeia normalizada (só as que a família compara). */
export const chainOf = (s: string) => { const n = norm(s); return /\bmercadona\b/.test(n) ? 'mercadona' : /\blidl\b/.test(n) ? 'lidl' : null; };

function row(p: any) {
  const pr = p.product ?? {}, loc = p.location ?? {};
  const name = (pr.product_name || (p.category_tag ?? '').replace(/^[a-z]{2}:/, '').replace(/-/g, ' ') || '').trim();
  if (!name || typeof p.price !== 'number' || p.currency !== 'EUR') return null;
  const cents = Math.round(p.price * 100);
  let base: string | null = null, unit: number | null = null;
  if (p.price_per === 'KILOGRAM') { base = 'kg'; unit = cents; }
  else if (p.price_per === 'LITER' || p.price_per === 'LITRE') { base = 'L'; unit = cents; }
  else if (p.price_per === 'UNIT') { base = 'un'; unit = cents; }
  else if (pr.product_quantity > 0) {
    const q = Number(pr.product_quantity), u = String(pr.product_quantity_unit || 'g').toLowerCase();
    const k = u === 'g' ? q / 1000 : u === 'kg' ? q : u === 'ml' ? q / 1000 : u === 'l' ? q : u === 'cl' ? q / 100 : null;
    if (k) { base = u.includes('l') ? 'L' : 'kg'; unit = Math.round(cents / k); }
  }
  const cats = (pr.categories_tags ?? []).concat(p.category_tag ? [p.category_tag] : []).map((t: string) => t.replace(/^[a-z]{2}:/, '').replace(/-/g, ' '));
  return { id: 'off:' + p.id, source: 'open_prices', name: name.slice(0, 200), terms: norm([name, pr.brands ?? '', ...cats].join(' ')).slice(0, 2000),
    store: loc.osm_brand || loc.osm_name || null, city: loc.osm_address_city || null, price_cents: cents, base, unit_price_cents: unit,
    country: cc(loc), chain: chainOf(loc.osm_brand || loc.osm_name || ''),
    seen_on: p.date ?? null, url: `https://prices.openfoodfacts.org/prices/${p.id}`, fetched_at: new Date().toISOString() };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  const url = Deno.env.get('SUPABASE_URL')!, key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const h = { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' };
  const last = await (await fetch(`${url}/rest/v1/web_prices?select=fetched_at&country=not.is.null&order=fetched_at.desc&limit=1`, { headers: h })).json();
  const age = last?.[0] ? Date.now() - Date.parse(last[0].fetched_at) : Infinity;
  if (age < 20 * 3600e3) return new Response(JSON.stringify({ fresh: true, fetched_at: last[0].fetched_at }), { headers: cors });
  const byId = new Map<string, any>();
  // Portugal continental: raio de 350 km à volta do centro (a API não filtra por país nos preços).
  for (let page = 1; page <= 10; page++) {
    const r = await fetch(`${API}?lat=39.6&lon=-8.0&radius_km=350&currency=EUR&order_by=-date&size=100&page=${page}`, { headers: { 'User-Agent': UA } });
    if (!r.ok) break;
    const d = await r.json();
    for (const p of d.items ?? []) { const x = row(p); if (x && x.country === 'PT') byId.set(x.id, x); } // só Portugal
    if (page >= (d.pages ?? 1)) break;
  }
  const rows = [...byId.values()];
  if (rows.length) {
    const up = await fetch(`${url}/rest/v1/web_prices?on_conflict=id`, { method: 'POST', headers: { ...h, Prefer: 'resolution=merge-duplicates,return=minimal' }, body: JSON.stringify(rows) });
    if (!up.ok) return new Response(JSON.stringify({ error: await up.text() }), { status: 500, headers: cors });
  }
  const by = (c: string) => rows.filter((r) => r.chain === c).length;
  return new Response(JSON.stringify({ fresh: false, n: rows.length, mercadona: by('mercadona'), lidl: by('lidl') }), { headers: cors });
});
