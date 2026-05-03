import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const db = () => createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const norm = (value: unknown) => String(value ?? "").trim().toLowerCase();

const json = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const formatDate = (d: Date) => {
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  return `${day}/${month}/${d.getFullYear()}`;
};

const isRateLimitError = (msg: string) => msg.includes("Bloqueada") || msg.includes("Excedido");
const isBillableOrder = (situacao: unknown) => norm(situacao).includes("faturado");

async function tinyPost(endpoint: string, params: Record<string, string>) {
  const form = new URLSearchParams(params);
  const res = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: form.toString(),
  });
  if (!res.ok) throw new Error(`Tiny API ${res.status}: ${await res.text()}`);
  return res.json();
}

function buildDetailRow(orderId: number, pedido: any) {
  const items = (pedido.itens || []).map((it: any) => {
    const item = it.item || it;
    const qty = Number.parseFloat(item.quantidade) || 1;
    const unit = Number.parseFloat(item.valor_unitario) || 0;
    return {
      sku: item.codigo || "",
      product_name: item.descricao || item.nome || item.codigo || "",
      categoria: item.categoria || item.tipo_categoria || "",
      qty,
      unit_price: unit,
      total: unit * qty,
    };
  });

  return {
    tiny_order_id: orderId,
    hora: pedido.hora || null,
    forma_pagamento: pedido.forma_pagamento || "Não informado",
    items,
    frete: Number.parseFloat(pedido.valor_frete) || 0,
    desconto: Number.parseFloat(pedido.valor_desconto) || 0,
    total_produtos: Number.parseFloat(pedido.total_produtos) || 0,
    numero_ecommerce: pedido.numero_ecommerce || null,
    obs: pedido.obs || null,
    endereco_entrega: pedido.endereco_entrega ? {
      cidade: pedido.endereco_entrega.cidade || "",
      uf: pedido.endereco_entrega.uf || "",
      cep: pedido.endereco_entrega.cep || "",
    } : null,
    raw_json: pedido,
    fetched_at: new Date().toISOString(),
  };
}

async function fetchOrderDetail(token: string, orderId: number) {
  const data = await tinyPost("https://api.tiny.com.br/api2/pedido.obter.php", {
    token,
    formato: "JSON",
    id: String(orderId),
  });
  if (data.retorno?.status === "OK" && data.retorno?.pedido) return data.retorno.pedido;
  const erros = data.retorno?.erros?.map((e: { erro: string }) => e.erro).join(", ") || "Detalhe não retornado";
  if (isRateLimitError(erros)) throw new Error(`RATE_LIMIT: ${erros}`);
  throw new Error(erros);
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const token = Deno.env.get("TINY_API_TOKEN");
    if (!token) throw new Error("TINY_API_TOKEN não configurado");

    const body = await req.json().catch(() => ({}));
    const force = Boolean(body.force);
    const ignoreDedup = Boolean(body.ignoreDedup);
    const maxPages = Math.min(Number(body.maxPages ?? 2) || 2, 4);
    const maxOrders = Math.min(Number(body.maxOrders ?? 80) || 80, 150);
    const lookbackHours = Math.max(Number(body.lookbackHours ?? 1) || 1, 1);
    const database = db();

    const { data: activeRules, error: rulesError } = await database
      .from("automation_rules")
      .select("id")
      .eq("is_active", true);
    if (rulesError) throw new Error(rulesError.message);
    const activeRuleIds = (activeRules ?? []).map((r: any) => r.id);
    if (activeRuleIds.length === 0) return json({ success: true, source: body.source ?? "manual", active_rules: 0, processed: 0 });

    const now = new Date();
    const start = new Date(now.getTime() - lookbackHours * 3600_000);
    const dataInicial = formatDate(start);
    const dataFinal = formatDate(now);

    const fetchedOrders: any[] = [];
    let rateLimited = false;
    let totalPages = 1;
    for (let page = 1; page <= Math.min(totalPages, maxPages); page++) {
      const listing = await tinyPost("https://api.tiny.com.br/api2/pedidos.pesquisa.php", {
        token,
        formato: "JSON",
        pagina: String(page),
        dataInicial,
        dataFinal,
      });
      if (listing.retorno?.status === "Erro") {
        const erros = listing.retorno?.erros?.map((e: { erro: string }) => e.erro).join(", ") || "Erro Tiny";
        if (isRateLimitError(erros)) { rateLimited = true; break; }
        throw new Error(erros);
      }
      fetchedOrders.push(...(listing.retorno?.pedidos ?? []));
      totalPages = Number.parseInt(listing.retorno?.numero_paginas) || 1;
      if (page < Math.min(totalPages, maxPages)) await delay(350);
    }

    const recentBillable = fetchedOrders
      .filter((o: any) => isBillableOrder(o?.pedido?.situacao))
      .sort((a: any, b: any) => Number(b.pedido.id) - Number(a.pedido.id))
      .slice(0, maxOrders);

    const rows = recentBillable.map((o: any) => ({
      tiny_order_id: Number(o.pedido.id),
      numero: o.pedido.numero || null,
      numero_ecommerce: o.pedido.numero_ecommerce || null,
      data_pedido: o.pedido.data_pedido || null,
      nome: o.pedido.nome || null,
      valor: o.pedido.valor || 0,
      situacao: o.pedido.situacao || null,
      codigo_rastreamento: o.pedido.codigo_rastreamento || null,
      raw_json: o,
      fetched_at: new Date().toISOString(),
    }));
    if (rows.length > 0) {
      const { error } = await database.from("tiny_orders_cache").upsert(rows, { onConflict: "tiny_order_id" });
      if (error) throw new Error(error.message);
    }

    const orderIds = rows.map((r) => Number(r.tiny_order_id));
    let candidateIds = orderIds;
    if (!force && orderIds.length > 0) {
      const { data: alreadyDispatched } = await database
        .from("automation_dispatches")
        .select("tiny_order_id")
        .in("tiny_order_id", orderIds)
        .in("rule_id", activeRuleIds)
        .eq("success", true);
      const done = new Set((alreadyDispatched ?? []).map((r: any) => Number(r.tiny_order_id)));
      candidateIds = orderIds.filter((id) => !done.has(id));
    }

    const { data: cachedDetails } = candidateIds.length > 0
      ? await database.from("tiny_order_details_cache").select("tiny_order_id").in("tiny_order_id", candidateIds)
      : { data: [] as any[] };
    const cachedDetailIds = new Set((cachedDetails ?? []).map((r: any) => Number(r.tiny_order_id)));
    const detailsToFetch = force ? candidateIds : candidateIds.filter((id) => !cachedDetailIds.has(id));

    const detailRows: any[] = [];
    for (const orderId of detailsToFetch) {
      try {
        await delay(750);
        const detail = await fetchOrderDetail(token, orderId);
        detailRows.push(buildDetailRow(orderId, detail));
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        console.error(`automation-sync detail failed for ${orderId}: ${msg}`);
        if (msg.startsWith("RATE_LIMIT:")) { rateLimited = true; break; }
      }
    }
    if (detailRows.length > 0) {
      const { error } = await database.from("tiny_order_details_cache").upsert(detailRows, { onConflict: "tiny_order_id" });
      if (error) throw new Error(error.message);
    }

    const engineUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/automation-engine`;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const triggerableIds = candidateIds.filter((id) => cachedDetailIds.has(id) || detailRows.some((r) => Number(r.tiny_order_id) === id));
    const engineResults: any[] = [];
    for (const orderId of triggerableIds) {
      const res = await fetch(engineUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${serviceKey}` },
        body: JSON.stringify({ orderId, ignoreDedup }),
      });
      const text = await res.text();
      engineResults.push({ orderId, status: res.status, body: text.slice(0, 1000) });
      await delay(150);
    }

    return json({
      success: true,
      source: body.source ?? "manual",
      interval: { dataInicial, dataFinal, lookbackHours },
      active_rules: activeRuleIds.length,
      fetched_from_tiny: fetchedOrders.length,
      billable_orders: rows.length,
      candidates: candidateIds.length,
      details_fetched: detailRows.length,
      processed: engineResults.length,
      rate_limited: rateLimited,
      engine_results: engineResults,
      timestamp: new Date().toISOString(),
    });
  } catch (e) {
    return json({ success: false, error: e instanceof Error ? e.message : String(e) }, 500);
  }
});