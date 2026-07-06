import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { routeCustomer, type Funnel, type CustomerSnapshot } from "../_shared/crmtg-routing.ts";

const TZ = "America/Sao_Paulo";
const CUTOFF_DATE = "2026-07-05";
function todayBRT(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(new Date());
}
function parseBRDate(s: string | null): string | null {
  if (!s) return null;
  const m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : null;
}
function diffDays(iso: string): number {
  const d = new Date(iso + "T00:00:00-03:00").getTime();
  const today = new Date(todayBRT() + "T00:00:00-03:00").getTime();
  return Math.floor((today - d) / 86400000);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const headers = { ...corsHeaders, "Content-Type": "application/json" };
  const supa = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  try {
    const body = await req.json().catch(() => ({}));
    const funnelId: string | undefined = body.funnel_id;

    const { data: funnelsRaw } = await supa.from("crmtg_funnels").select("*").eq("ativo", true);
    const { data: touchesRaw } = await supa.from("crmtg_funnel_touches").select("*");
    const funnels: Funnel[] = (funnelsRaw || []).map(f => ({
      id: f.id, nome: f.nome, categoria: f.categoria, prioridade: f.prioridade, ativo: f.ativo,
      produtos_gatilho: f.produtos_gatilho || [],
      touches: (touchesRaw || []).filter(t => t.funnel_id === f.id),
    }));

    const { data: orders } = await supa.from("tiny_orders_cache").select("nome, data_pedido, tiny_order_id");
    const validOrders = (orders || []).filter(o => o.nome && !/consumidor\s*final/i.test(o.nome));
    const lastByCust = new Map<string, { date: string; tiny_order_id: number }>();
    for (const o of validOrders) {
      const d = parseBRDate(o.data_pedido);
      if (!d) continue;
      if (d < CUTOFF_DATE) continue;
      const cur = lastByCust.get(o.nome);
      if (!cur || d > cur.date) lastByCust.set(o.nome, { date: d, tiny_order_id: o.tiny_order_id });
    }

    const orderIds = Array.from(lastByCust.values()).map(v => v.tiny_order_id);
    const skusByOrder = new Map<number, string[]>();
    for (let i = 0; i < orderIds.length; i += 200) {
      const slice = orderIds.slice(i, i + 200);
      const { data: dets } = await supa.from("tiny_order_details_cache").select("tiny_order_id, items").in("tiny_order_id", slice);
      for (const d of dets || []) {
        const skus: string[] = [];
        for (const it of (d.items || [])) { const sku = it?.sku || it?.codigo; if (sku) skus.push(String(sku)); }
        skusByOrder.set(Number(d.tiny_order_id), skus);
      }
    }

    const nomes = Array.from(lastByCust.keys());
    const phoneByName = new Map<string, string | null>();
    for (let i = 0; i < nomes.length; i += 500) {
      const slice = nomes.slice(i, i + 500);
      const { data: phs } = await supa.from("tiny_customers_cache").select("nome, telefone_normalizado").in("nome", slice);
      for (const p of phs || []) phoneByName.set(p.nome, p.telefone_normalizado);
    }

    const matches: any[] = [];
    for (const [nome, info] of lastByCust.entries()) {
      const snap: CustomerSnapshot = {
        customer_id: nome, customer_name: nome,
        telefone_normalizado: phoneByName.get(nome) || null,
        last_order_date: info.date,
        last_order_skus: skusByOrder.get(info.tiny_order_id) || [],
        days_since_last: diffDays(info.date),
      };
      const r = routeCustomer(snap, funnels);
      if (!r.funnel) continue;
      if (funnelId && r.funnel.id !== funnelId) continue;
      matches.push({
        customer_id: nome,
        telefone: snap.telefone_normalizado,
        funnel_id: r.funnel.id,
        funnel_nome: r.funnel.nome,
        categoria: r.funnel.categoria,
        motivo: r.motivo,
        days_since_last: snap.days_since_last,
      });
    }

    return new Response(JSON.stringify({ total: matches.length, matches: matches.slice(0, 500) }), { headers });
  } catch (e) {
    return new Response(JSON.stringify({ error: String((e as Error).message) }), { headers, status: 500 });
  }
});
