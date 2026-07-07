import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { routeCustomer, pickMessageVersion, type Funnel, type CustomerSnapshot } from "../_shared/crmtg-routing.ts";
import { CUTOFF_DATE, parseBRDate } from "../_shared/crmtg-cutoff.ts";

const TZ = "America/Sao_Paulo";
function todayBRT(): string {
  const d = new Date();
  const fmt = new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" });
  return fmt.format(d);
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
  const runDate = todayBRT();

  try {
    // 1) Settings
    const { data: settings } = await supa.from("crmtg_settings").select("*").eq("id", true).maybeSingle();
    if (!settings) throw new Error("settings ausente");
    if (settings.sistema_pausado) {
      await supa.from("crmtg_daily_run_log").upsert({ run_date: runDate, status: "skipped", alertas: [{ tipo: "sistema_pausado" }], finalizado_em: new Date().toISOString() });
      return new Response(JSON.stringify({ skipped: true, reason: "paused" }), { headers });
    }

    // 2) Frescor Tiny: último pedido fetched_at < 24h
    const { data: lastFetch } = await supa.from("tiny_orders_cache").select("fetched_at").order("fetched_at", { ascending: false }).limit(1).maybeSingle();
    const stale = !lastFetch?.fetched_at || (Date.now() - new Date(lastFetch.fetched_at).getTime()) > 24 * 3600 * 1000;
    if (stale) {
      await supa.from("crmtg_settings").update({ ultimo_alerta_tiny: new Date().toISOString() }).eq("id", true);
      await supa.from("crmtg_daily_run_log").upsert({ run_date: runDate, status: "skipped", alertas: [{ tipo: "tiny_desatualizado", last_fetch: lastFetch?.fetched_at }], finalizado_em: new Date().toISOString() });
      return new Response(JSON.stringify({ skipped: true, reason: "tiny_stale" }), { headers });
    }

    await supa.from("crmtg_daily_run_log").upsert({ run_date: runDate, status: "running", iniciado_em: new Date().toISOString(), alertas: [], elegiveis: 0, fila_criada: 0 });

    // 3) Funis + toques
    const { data: funnelsRaw } = await supa.from("crmtg_funnels").select("*").eq("ativo", true);
    const { data: touchesRaw } = await supa.from("crmtg_funnel_touches").select("*");
    const funnels: Funnel[] = (funnelsRaw || []).map(f => ({
      id: f.id, nome: f.nome, categoria: f.categoria, prioridade: f.prioridade, ativo: f.ativo,
      produtos_gatilho: f.produtos_gatilho || [],
      touches: (touchesRaw || []).filter(t => t.funnel_id === f.id).sort((a,b) => a.dia_offset - b.dia_offset)
        .map(t => ({ id: t.id, ordem: t.ordem, dia_offset: t.dia_offset, botconversa_flow_id: t.botconversa_flow_id, flow_id_v1: t.flow_id_v1, flow_id_v2: t.flow_id_v2, flow_id_v3: t.flow_id_v3, mensagem_v1: t.mensagem_v1, mensagem_v2: t.mensagem_v2, mensagem_v3: t.mensagem_v3 })),
    }));

    // 4) Snapshot de clientes: agregação de pedidos (paginado, supera limite 1000)
    const validOrders: any[] = [];
    const PAGE = 1000;
    for (let off = 0; ; off += PAGE) {
      const { data: chunk, error: oerr } = await supa
        .from("tiny_orders_cache")
        .select("nome, data_pedido, situacao, tiny_order_id")
        .range(off, off + PAGE - 1);
      if (oerr) throw oerr;
      if (!chunk || chunk.length === 0) break;
      for (const o of chunk) if (o.nome && !/consumidor\s*final/i.test(o.nome)) validOrders.push(o);
      if (chunk.length < PAGE) break;
    }

    // último pedido por cliente (apenas pedidos a partir do CUTOFF)
    const lastByCust = new Map<string, { date: string; tiny_order_id: number }>();
    for (const o of validOrders) {
      const d = parseBRDate(o.data_pedido);
      if (!d) continue;
      if (d < CUTOFF_DATE) continue;
      const cur = lastByCust.get(o.nome);
      if (!cur || d > cur.date) lastByCust.set(o.nome, { date: d, tiny_order_id: o.tiny_order_id });
    }

    // detalhes (items) do último pedido para extrair SKUs
    const orderIds = Array.from(lastByCust.values()).map(v => v.tiny_order_id);
    const skusByOrder = new Map<number, string[]>();
    for (let i = 0; i < orderIds.length; i += 200) {
      const slice = orderIds.slice(i, i + 200);
      const { data: dets } = await supa.from("tiny_order_details_cache").select("tiny_order_id, items").in("tiny_order_id", slice);
      for (const d of dets || []) {
        const skus: string[] = [];
        for (const it of (d.items || [])) {
          const sku = it?.sku || it?.codigo;
          if (sku) skus.push(String(sku));
        }
        skusByOrder.set(Number(d.tiny_order_id), skus);
      }
    }

    // telefones
    const nomes = Array.from(lastByCust.keys());
    const phoneByName = new Map<string, string | null>();
    for (let i = 0; i < nomes.length; i += 500) {
      const slice = nomes.slice(i, i + 500);
      const { data: phs } = await supa.from("tiny_customers_cache").select("nome, telefone_normalizado").in("nome", slice);
      for (const p of phs || []) phoneByName.set(p.nome, p.telefone_normalizado);
    }

    const snapshots: CustomerSnapshot[] = [];
    for (const [nome, info] of lastByCust.entries()) {
      snapshots.push({
        customer_id: nome,
        customer_name: nome,
        telefone_normalizado: phoneByName.get(nome) || null,
        last_order_date: info.date,
        last_order_skus: skusByOrder.get(info.tiny_order_id) || [],
        days_since_last: diffDays(info.date),
      });
    }

    // 5) Roteamento + fila
    // Lê estado atual para preservar entrada_funnel_em (hoje = dia 0 na 1ª vez)
    const { data: statesRaw } = await supa.from("crmtg_customer_state").select("customer_id, funnel_atual_id, entrada_funnel_em");
    const stateMap = new Map<string, { funnel_atual_id: string | null; entrada_funnel_em: string | null }>();
    for (const s of statesRaw || []) stateMap.set(s.customer_id, { funnel_atual_id: s.funnel_atual_id, entrada_funnel_em: s.entrada_funnel_em });

    const queueRows: any[] = [];
    const alertas: any[] = [];
    let elegiveis = 0;

    const [hStartH, hStartM] = (settings.horario_inicio as string).split(":").map(Number);
    const [hEndH, hEndM] = (settings.horario_fim as string).split(":").map(Number);
    const startMin = hStartH * 60 + hStartM;
    const endMin = hEndH * 60 + hEndM;
    const totalWindow = endMin - startMin;

    const stateRows: any[] = [];
    let idx = 0;
    for (const snap of snapshots) {
      const r = routeCustomer(snap, funnels);
      if (!r.funnel) continue;

      // entrada_em = hoje na 1ª vez nesse funil; preserva data anterior se já estava
      const prevState = stateMap.get(snap.customer_id);
      const sameFunnel = prevState?.funnel_atual_id === r.funnel.id;
      const entradaDate = sameFunnel && prevState?.entrada_funnel_em ? prevState.entrada_funnel_em : runDate;

      const offsetHoje = diffDays(entradaDate);
      const touchesHoje = r.funnel.touches.filter(t => t.dia_offset === offsetHoje);

      // acumula state row para upsert em lote
      stateRows.push({
        customer_id: snap.customer_id,
        fase: r.funnel.categoria,
        funnel_atual_id: r.funnel.id,
        entrada_funnel_em: entradaDate,
        ultimo_pedido_em: snap.last_order_date,
        ultima_avaliacao_em: new Date().toISOString(),
      });

      if (touchesHoje.length === 0) continue;
      elegiveis++;

      for (const t of touchesHoje) {
        const pick = pickMessageVersion(idx, t);
        const min = startMin + Math.floor((totalWindow * (idx % 50)) / 50);
        const h = Math.floor(min / 60);
        const m = min % 60;
        const horario = `${runDate}T${String(h).padStart(2,"0")}:${String(m).padStart(2,"0")}:00-03:00`;
        queueRows.push({
          run_date: runDate,
          customer_id: snap.customer_id,
          customer_name: snap.customer_name,
          telefone_normalizado: snap.telefone_normalizado,
          funnel_id: r.funnel.id,
          funnel_nome: r.funnel.nome,
          funnel_categoria: r.funnel.categoria,
          touch_id: t.id,
          touch_ordem: t.ordem,
          horario_previsto: horario,
          flow_id: pick.flow_id,
          mensagem_versao: pick.versao,
          texto_render: pick.texto,
          status: snap.telefone_normalizado ? "pending" : "blocked_no_phone",
          motivo_cancelamento: snap.telefone_normalizado ? null : "aguardando enriquecimento de telefone",
        });
        idx++;
      }
    }

    // Upsert state em lotes de 500 (evita milhares de round-trips sequenciais)
    for (let i = 0; i < stateRows.length; i += 500) {
      const chunk = stateRows.slice(i, i + 500);
      const { error } = await supa.from("crmtg_customer_state").upsert(chunk, { onConflict: "customer_id" });
      if (error) console.error("state upsert error:", error.message);
    }

    // Limpeza de órfãos: remove estados sem funil ou de funis inativos/apagados
    const activeFunnelIds = funnels.map(f => f.id);
    await supa.from("crmtg_customer_state").delete().is("funnel_atual_id", null);
    if (activeFunnelIds.length > 0) {
      await supa.from("crmtg_customer_state").delete().not("funnel_atual_id", "in", `(${activeFunnelIds.map(id => `"${id}"`).join(",")})`);
    } else {
      await supa.from("crmtg_customer_state").delete().not("funnel_atual_id", "is", null);
    }




    // limpa fila pending antiga deste dia
    await supa.from("crmtg_daily_queue").delete().eq("run_date", runDate).in("status", ["pending", "blocked_no_phone"]);
    let inserted = 0;
    for (let i = 0; i < queueRows.length; i += 500) {
      const chunk = queueRows.slice(i, i + 500);
      const { error } = await supa.from("crmtg_daily_queue").insert(chunk);
      if (!error) inserted += chunk.length;
    }

    await supa.from("crmtg_settings").update({ ultima_execucao_diaria: new Date().toISOString() }).eq("id", true);
    await supa.from("crmtg_daily_run_log").upsert({ run_date: runDate, status: "done", elegiveis, fila_criada: inserted, finalizado_em: new Date().toISOString(), alertas });

    return new Response(JSON.stringify({ run_date: runDate, elegiveis, fila_criada: inserted }), { headers });
  } catch (e) {
    return new Response(JSON.stringify({ error: String((e as Error).message) }), { headers, status: 500 });
  }
});
