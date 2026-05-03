// Automation Engine - generic event-rules dispatcher
// Modes: process order, dispatch single rule, test webhook
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

interface Rule {
  id: string;
  name: string;
  is_active: boolean;
  webhook_url: string;
  http_method: string;
  headers: Record<string, string>;
  flow_id: string | null;
  match_mode: "any" | "all";
  product_priority: boolean;
  product_skus: string[];
  categories: string[];
  exclude_consumidor_final: boolean;
  require_phone: boolean;
  require_full_customer: boolean;
  allow_resend_after_days: number | null;
}

const norm = (s: unknown) => String(s ?? "").trim().toLowerCase();

function isConsumidorFinal(name: string) {
  return norm(name).includes("consumidor final");
}

function extractItems(detail: any): Array<{ sku: string; nome: string; categoria: string; quantidade: number; valor: number }> {
  const items = Array.isArray(detail?.items) ? detail.items : [];
  return items.map((it: any) => {
    const item = it?.item ?? it;
    return {
      sku: String(item?.codigo ?? item?.sku ?? ""),
      nome: String(item?.descricao ?? item?.nome ?? ""),
      categoria: String(item?.categoria ?? ""),
      quantidade: Number(item?.quantidade ?? 1),
      valor: Number(item?.valor_unitario ?? item?.valor ?? 0),
    };
  });
}

function matchRule(rule: Rule, items: ReturnType<typeof extractItems>, productCategoryMap: Map<string, string>) {
  const ruleSkus = rule.product_skus.map(norm).filter(Boolean);
  const ruleCats = rule.categories.map(norm).filter(Boolean);

  const hits: Array<{ produto: string; categoria: string; sku: string; quantidade: number; valor: number; via: "produto" | "categoria" }> = [];
  for (const it of items) {
    const itSku = norm(it.sku);
    const itCat = norm(it.categoria || productCategoryMap.get(itSku) || "");
    const matchProd = ruleSkus.length > 0 && ruleSkus.includes(itSku);
    const matchCat = ruleCats.length > 0 && ruleCats.includes(itCat);
    if (matchProd) hits.push({ produto: it.nome, categoria: it.categoria, sku: it.sku, quantidade: it.quantidade, valor: it.valor, via: "produto" });
    else if (matchCat && !rule.product_priority) hits.push({ produto: it.nome, categoria: it.categoria, sku: it.sku, quantidade: it.quantidade, valor: it.valor, via: "categoria" });
  }
  if (hits.length === 0) return null;

  if (rule.match_mode === "all") {
    const itemSkus = new Set(items.map((i) => norm(i.sku)));
    const itemCats = new Set(items.map((i) => norm(i.categoria || productCategoryMap.get(norm(i.sku)) || "")));
    const allSkus = ruleSkus.every((s) => itemSkus.has(s));
    const allCats = ruleCats.every((c) => itemCats.has(c));
    if (ruleSkus.length && !allSkus) return null;
    if (ruleCats.length && !allCats && !rule.product_priority) return null;
  }
  return hits[0];
}

async function dispatchWebhook(rule: Rule, payload: any) {
  const headers: Record<string, string> = { "Content-Type": "application/json", ...rule.headers };
  let attempts = 0;
  let lastErr: string | null = null;
  let lastStatus: number | null = null;
  let lastBody = "";
  const delays = [0, 1000, 4000];
  for (let i = 0; i < delays.length; i++) {
    if (delays[i]) await new Promise((r) => setTimeout(r, delays[i]));
    attempts++;
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 10_000);
      const res = await fetch(rule.webhook_url, {
        method: rule.http_method || "POST",
        headers,
        body: JSON.stringify(payload),
        signal: ctrl.signal,
      });
      clearTimeout(t);
      lastStatus = res.status;
      lastBody = (await res.text()).slice(0, 4000);
      if (res.ok) return { success: true, status: res.status, body: lastBody, attempts, error: null };
      lastErr = `HTTP ${res.status}`;
    } catch (e) {
      lastErr = e instanceof Error ? e.message : String(e);
    }
  }
  return { success: false, status: lastStatus, body: lastBody, attempts, error: lastErr };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  try {
    const body = await req.json().catch(() => ({}));
    const { orderId, ruleId, testPayload, ignoreDedup } = body as {
      orderId?: number;
      ruleId?: string;
      testPayload?: Record<string, unknown>;
      ignoreDedup?: boolean;
    };

    // ---- Test mode (manual webhook test from UI) ----
    if (testPayload && ruleId) {
      const { data: rule } = await supabase.from("automation_rules").select("*").eq("id", ruleId).maybeSingle();
      if (!rule) return new Response(JSON.stringify({ error: "Rule not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      const r = await dispatchWebhook(rule as Rule, testPayload);
      await supabase.from("automation_dispatches").insert({
        rule_id: ruleId,
        tiny_order_id: null,
        customer_name: String((testPayload as any).cliente_nome ?? "TESTE"),
        customer_phone: String((testPayload as any).cliente_telefone ?? ""),
        matched_product: String((testPayload as any).produto_comprado ?? ""),
        matched_category: String((testPayload as any).categoria_produto ?? ""),
        payload: testPayload,
        response_status: r.status,
        response_body: r.body,
        success: r.success,
        error_message: r.error,
        attempts: r.attempts,
        is_test: true,
      });
      return new Response(JSON.stringify(r), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (!orderId) {
      return new Response(JSON.stringify({ error: "orderId required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Load order + detail
    const { data: order } = await supabase.from("tiny_orders_cache").select("*").eq("tiny_order_id", orderId).maybeSingle();
    if (!order) return new Response(JSON.stringify({ error: "Order not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    const { data: detail } = await supabase.from("tiny_order_details_cache").select("*").eq("tiny_order_id", orderId).maybeSingle();

    // Customer info from raw_json
    const raw = (order as any).raw_json ?? {};
    const cliente = raw?.cliente ?? {};
    const customerName = String(order.nome ?? cliente?.nome ?? "");
    const customerPhone = String(cliente?.fone ?? cliente?.celular ?? (detail as any)?.endereco_entrega?.fone ?? "");

    const items = extractItems(detail);

    // Build product->category fallback map
    const skus = items.map((i) => i.sku).filter(Boolean);
    const productCategoryMap = new Map<string, string>();
    if (skus.length > 0) {
      const { data: prods } = await supabase.from("tiny_products_cache").select("sku, categoria").in("sku", skus);
      (prods ?? []).forEach((p: any) => productCategoryMap.set(norm(p.sku), norm(p.categoria)));
    }

    // Load rules
    let q = supabase.from("automation_rules").select("*").order("priority", { ascending: false });
    if (ruleId) q = q.eq("id", ruleId);
    else q = q.eq("is_active", true);
    const { data: rules } = await q;

    const results: any[] = [];
    for (const rule of (rules ?? []) as Rule[]) {
      const hit = matchRule(rule, items, productCategoryMap);
      if (!hit) { results.push({ rule_id: rule.id, skipped: "no_match" }); continue; }

      // Eligibility
      if (rule.exclude_consumidor_final && isConsumidorFinal(customerName)) { results.push({ rule_id: rule.id, skipped: "consumidor_final" }); continue; }
      if (rule.require_phone && !customerPhone) { results.push({ rule_id: rule.id, skipped: "no_phone" }); continue; }
      if (rule.require_full_customer && (!customerName || !customerPhone)) { results.push({ rule_id: rule.id, skipped: "incomplete_customer" }); continue; }

      // Dedup
      if (!ignoreDedup) {
        const { data: prev } = await supabase
          .from("automation_dispatches")
          .select("dispatched_at")
          .eq("rule_id", rule.id)
          .eq("tiny_order_id", orderId)
          .eq("success", true)
          .order("dispatched_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (prev) {
          if (rule.allow_resend_after_days == null) { results.push({ rule_id: rule.id, skipped: "dedup" }); continue; }
          const ageMs = Date.now() - new Date(prev.dispatched_at).getTime();
          if (ageMs < rule.allow_resend_after_days * 86400_000) { results.push({ rule_id: rule.id, skipped: "dedup_window" }); continue; }
        }
      }

      const payload = {
        cliente_nome: customerName,
        cliente_telefone: customerPhone,
        produto_comprado: hit.produto,
        categoria_produto: hit.categoria || productCategoryMap.get(norm(hit.sku)) || "",
        data_compra: order.data_pedido ?? null,
        pedido_id: orderId,
        valor_total: Number(order.valor ?? 0),
        quantidade: hit.quantidade,
        regra_disparada: rule.name,
        flow_id: rule.flow_id ?? undefined,
      };
      const r = await dispatchWebhook(rule, payload);
      await supabase.from("automation_dispatches").insert({
        rule_id: rule.id,
        tiny_order_id: orderId,
        customer_name: customerName,
        customer_phone: customerPhone,
        matched_product: hit.produto,
        matched_category: payload.categoria_produto,
        payload,
        response_status: r.status,
        response_body: r.body,
        success: r.success,
        error_message: r.error,
        attempts: r.attempts,
      });
      results.push({ rule_id: rule.id, success: r.success, status: r.status });
    }

    return new Response(JSON.stringify({ orderId, results }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
