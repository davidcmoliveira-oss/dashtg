import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const getSupabaseAdmin = () =>
  createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

const tinyPost = async (endpoint: string, params: Record<string, string>) => {
  const formData = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => formData.append(k, v));
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: formData.toString(),
  });
  if (!res.ok) throw new Error(`Tiny API ${res.status}: ${await res.text()}`);
  return res.json();
};

const isRateLimitError = (msg: string) =>
  msg.includes('Bloqueada') || msg.includes('Excedido');

const formatDate = (d: Date) => {
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  return `${day}/${month}/${d.getFullYear()}`;
};

const delay = (ms: number) => new Promise(r => setTimeout(r, ms));

const buildDetailRow = (orderId: number, pedido: any) => {
  const items = (pedido.itens || []).map((item: any) => {
    const i = item.item || item;
    return {
      sku: i.codigo || '',
      product_name: i.descricao || i.codigo || '',
      categoria: i.categoria || i.tipo_categoria || '',
      qty: parseFloat(i.quantidade) || 1,
      unit_price: parseFloat(i.valor_unitario) || 0,
      total: parseFloat(i.valor_unitario) * (parseFloat(i.quantidade) || 1),
    };
  });
  return {
    tiny_order_id: orderId,
    hora: pedido.hora || null,
    forma_pagamento: pedido.forma_pagamento || 'Não informado',
    items,
    frete: parseFloat(pedido.valor_frete) || 0,
    desconto: parseFloat(pedido.valor_desconto) || 0,
    total_produtos: parseFloat(pedido.total_produtos) || 0,
    numero_ecommerce: pedido.numero_ecommerce || null,
    obs: pedido.obs || null,
    endereco_entrega: pedido.endereco_entrega ? {
      cidade: pedido.endereco_entrega.cidade || '',
      uf: pedido.endereco_entrega.uf || '',
      cep: pedido.endereco_entrega.cep || '',
    } : null,
    raw_json: pedido,
    fetched_at: new Date().toISOString(),
  };
};

// Fetch order details with concurrency control + retry-on-rate-limit.
// Each id gets up to MAX_RETRIES attempts with exponential backoff.
// A global time budget prevents runaway loops (Edge function timeout ~150s).
const MAX_RETRIES_PER_ID = 5;
const RETRY_BACKOFF_MS = [3000, 8000, 20000, 45000, 60000]; // per attempt
const GLOBAL_RATE_LIMIT_BUDGET_MS = 120_000; // total time we allow burning on backoff waits

const fetchOrderDetails = async (
  token: string,
  ids: number[],
  concurrency = 2,
): Promise<{ results: Record<number, any>; failedIds: number[]; rateLimited: boolean }> => {
  const results: Record<number, any> = {};
  const failedIds: number[] = [];
  const attempts = new Map<number, number>();
  const queue = [...ids];
  let rateLimitedGlobal = false;
  let backoffSpent = 0;
  const startedAt = Date.now();

  const worker = async () => {
    while (queue.length > 0) {
      const id = queue.shift();
      if (!id) break;
      const attempt = (attempts.get(id) || 0);
      try {
        await delay(250); // small spacing between calls
        const data = await tinyPost('https://api.tiny.com.br/api2/pedido.obter.php', {
          token, formato: 'JSON', id: String(id),
        });
        if (data.retorno?.status === 'OK' && data.retorno?.pedido) {
          results[id] = data.retorno.pedido;
          continue;
        }
        if (data.retorno?.status === 'Erro') {
          const erros = data.retorno.erros?.map((e: { erro: string }) => e.erro).join(', ') || '';
          if (isRateLimitError(erros)) {
            if (attempt >= MAX_RETRIES_PER_ID) {
              console.error(`Order ${id}: max retries (${MAX_RETRIES_PER_ID}) exceeded on rate limit — giving up`);
              failedIds.push(id);
              continue;
            }
            const wait = RETRY_BACKOFF_MS[Math.min(attempt, RETRY_BACKOFF_MS.length - 1)];
            if (backoffSpent + wait > GLOBAL_RATE_LIMIT_BUDGET_MS) {
              console.error(`Order ${id}: global backoff budget exhausted — deferring (will retry next sync)`);
              failedIds.push(id);
              // Push remaining queue to failed and stop workers gracefully
              rateLimitedGlobal = true;
              while (queue.length > 0) {
                const rem = queue.shift();
                if (rem) failedIds.push(rem);
              }
              return;
            }
            attempts.set(id, attempt + 1);
            backoffSpent += wait;
            console.warn(`Order ${id}: rate limited (attempt ${attempt + 1}/${MAX_RETRIES_PER_ID}), backing off ${wait}ms (spent ${backoffSpent}ms)`);
            await delay(wait);
            queue.push(id); // re-enqueue for retry
            continue;
          }
          // Non-rate-limit API error — do NOT loop, mark as failed
          console.error(`Order ${id}: Tiny API error (non-rate-limit): ${erros}`);
          failedIds.push(id);
          continue;
        }
        // Unknown response shape — treat as failure, no retry
        console.error(`Order ${id}: unexpected Tiny response`, JSON.stringify(data).slice(0, 200));
        failedIds.push(id);
      } catch (e) {
        // Network / parse error — retry up to MAX_RETRIES_PER_ID
        if (attempt >= MAX_RETRIES_PER_ID) {
          console.error(`Order ${id}: network error after ${attempt} retries — giving up:`, e);
          failedIds.push(id);
          continue;
        }
        attempts.set(id, attempt + 1);
        const wait = 2000 * (attempt + 1);
        console.warn(`Order ${id}: network error (attempt ${attempt + 1}), retrying in ${wait}ms:`, (e as Error).message);
        await delay(wait);
        queue.push(id);
      }
      // Hard safety: if the whole loop is running too long, bail out
      if (Date.now() - startedAt > GLOBAL_RATE_LIMIT_BUDGET_MS + 30_000) {
        console.error(`fetchOrderDetails: hard time cap reached — deferring remaining ${queue.length} orders`);
        rateLimitedGlobal = true;
        while (queue.length > 0) {
          const rem = queue.shift();
          if (rem) failedIds.push(rem);
        }
        return;
      }
    }
  };

  const workers = Array.from({ length: Math.min(concurrency, ids.length) }, () => worker());
  await Promise.all(workers);
  return { results, failedIds, rateLimited: rateLimitedGlobal };
};

// @ts-ignore EdgeRuntime é global no Supabase Edge Runtime
declare const EdgeRuntime: { waitUntil: (p: Promise<unknown>) => void } | undefined;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const tinyApiToken = Deno.env.get('TINY_API_TOKEN');
  if (!tinyApiToken) {
    return new Response(JSON.stringify({ error: 'TINY_API_TOKEN não configurado' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const body = await req.json().catch(() => ({}));
  const mode = body.mode || 'incremental';
  const waitForResult = body.wait === true; // opcional: aguardar (uso em testes)

  const runSync = async () => {
    const db = getSupabaseAdmin();
    try {
      return await doSync(db, tinyApiToken, mode, body);
    } catch (e) {
      console.error('Background sync error:', (e as Error).message);
      return { success: false, error: (e as Error).message };
    }
  };

  if (waitForResult) {
    const result = await runSync();
    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // Fire-and-forget em background — evita IDLE_TIMEOUT 504 no cliente
  if (typeof EdgeRuntime !== 'undefined') {
    EdgeRuntime.waitUntil(runSync());
  } else {
    runSync();
  }
  return new Response(JSON.stringify({ success: true, mode, queued: true, message: 'sync iniciado em background' }), {
    status: 202, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});

async function doSync(db: ReturnType<typeof getSupabaseAdmin>, tinyApiToken: string, mode: string, body: any) {
  {


    // ============ MODE: 'backfill' — only fetch missing details for cached orders ============
    if (mode === 'backfill') {
      const limit = Math.min(body.limit || 200, 500);
      // Pega ids de pedidos que ainda não têm detalhes
      const PAGE = 1000;
      const allCachedIds: number[] = [];
      let pageIdx = 0;
      while (true) {
        const { data, error } = await db
          .from('tiny_orders_cache')
          .select('tiny_order_id')
          .order('tiny_order_id', { ascending: false })
          .range(pageIdx * PAGE, pageIdx * PAGE + PAGE - 1);
        if (error) throw new Error(error.message);
        if (!data || data.length === 0) break;
        data.forEach((r: any) => allCachedIds.push(r.tiny_order_id));
        if (data.length < PAGE) break;
        pageIdx++;
      }
      const { data: existingDet } = await db.from('tiny_order_details_cache').select('tiny_order_id');
      const haveSet = new Set((existingDet || []).map((r: any) => r.tiny_order_id));
      const idsToFetch = allCachedIds.filter(id => !haveSet.has(id)).slice(0, limit);
      console.log(`Backfill: ${allCachedIds.length} orders, ${haveSet.size} have details, fetching ${idsToFetch.length}`);

      let rateLimited = false;
      let fetched = 0;
      const totalFailed: number[] = [];
      for (let i = 0; i < idsToFetch.length; i += 20) {
        if (rateLimited) break;
        const batch = idsToFetch.slice(i, i + 20);
        const { results, failedIds, rateLimited: rl } = await fetchOrderDetails(tinyApiToken, batch, 2);
        const detailRows = Object.entries(results).map(([orderId, pedido]) => buildDetailRow(parseInt(orderId), pedido));
        if (detailRows.length > 0) {
          const { error } = await db.from('tiny_order_details_cache').upsert(detailRows, { onConflict: 'tiny_order_id' });
          if (error) console.error('Backfill upsert error:', error.message);
          fetched += detailRows.length;
        }
        totalFailed.push(...failedIds);
        if (rl) { rateLimited = true; break; }
        await delay(500);
      }
      if (totalFailed.length > 0) console.warn(`Backfill: ${totalFailed.length} orders deferred to next run`);

      return {
        success: true, mode: 'backfill',
        total_orders: allCachedIds.length, missing_details: idsToFetch.length,
        fetched, failed: totalFailed.length, rate_limited: rateLimited,
      };

    }

    // Determine date range
    let dataInicial: string;
    let dataFinal: string;
    const today = new Date();

    if (mode === 'full') {
      // From January 1st of current year
      dataInicial = `01/01/${today.getFullYear()}`;
      dataFinal = formatDate(today);
      console.log(`Full sync: ${dataInicial} to ${dataFinal}`);
    } else {
      // Incremental: just last 2 days to catch any updates
      const twoDaysAgo = new Date(today);
      twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
      dataInicial = formatDate(twoDaysAgo);
      dataFinal = formatDate(today);
      console.log(`Incremental sync: ${dataInicial} to ${dataFinal}`);
    }

    // Step 1: Fetch all order listings (paginate)
    const allOrders: any[] = [];
    let pagina = 1;
    let totalPaginas = 1;
    let rateLimited = false;

    do {
      console.log(`Fetching orders page ${pagina}/${totalPaginas}...`);
      try {
        const data = await tinyPost('https://api.tiny.com.br/api2/pedidos.pesquisa.php', {
          token: tinyApiToken,
          formato: 'JSON',
          pagina: String(pagina),
          dataInicial,
          dataFinal,
        });

        if (data.retorno?.status === 'Erro') {
          const erros = data.retorno.erros?.map((e: { erro: string }) => e.erro).join(', ') || '';
          if (isRateLimitError(erros)) {
            console.error('Rate limited during order listing');
            rateLimited = true;
            break;
          }
          throw new Error(erros);
        }

        const pedidos = data.retorno?.pedidos || [];
        allOrders.push(...pedidos);
        totalPaginas = parseInt(data.retorno?.numero_paginas) || 1;
        pagina++;

        if (pagina <= totalPaginas) await delay(300);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        if (isRateLimitError(msg)) {
          rateLimited = true;
          break;
        }
        throw err;
      }
    } while (pagina <= totalPaginas);

    console.log(`Fetched ${allOrders.length} orders from API`);

    // Step 2: Upsert orders to cache
    let newOrderIds: number[] = [];
    if (allOrders.length > 0) {
      // Detect which orders are new (not yet in cache) BEFORE upsert — for automation triggering
      const incomingIds = allOrders.map((o: any) => Number(o.pedido.id));
      const { data: existingOrders } = await db
        .from('tiny_orders_cache')
        .select('tiny_order_id')
        .in('tiny_order_id', incomingIds);
      const existingOrderSet = new Set((existingOrders || []).map((r: any) => Number(r.tiny_order_id)));
      newOrderIds = incomingIds.filter((id) => !existingOrderSet.has(id));
      console.log(`New orders detected for automation: ${newOrderIds.length}`);

      const rows = allOrders.map((o: any) => ({
        tiny_order_id: o.pedido.id,
        numero: o.pedido.numero,
        numero_ecommerce: o.pedido.numero_ecommerce || null,
        data_pedido: o.pedido.data_pedido || null,
        nome: o.pedido.nome || null,
        valor: o.pedido.valor || 0,
        situacao: o.pedido.situacao || null,
        codigo_rastreamento: o.pedido.codigo_rastreamento || null,
        raw_json: o,
        fetched_at: new Date().toISOString(),
      }));

      for (let i = 0; i < rows.length; i += 500) {
        const chunk = rows.slice(i, i + 500);
        const { error } = await db.from('tiny_orders_cache').upsert(chunk, { onConflict: 'tiny_order_id' });
        if (error) console.error('Orders cache write error:', error.message);
      }
      console.log(`Cached ${rows.length} orders`);
    }

    // Step 3: Fetch details — NEW orders first (guaranteed capture), then updates
    const detailsCaptured = new Set<number>();
    const detailsFailed: number[] = [];
    if (!rateLimited && allOrders.length > 0) {
      const allIds: number[] = allOrders.map((o: any) => Number(o.pedido.id));
      const newSet = new Set(newOrderIds);
      // Priority queue: new orders first, then existing (only re-fetch existing on incremental)
      const prioritized: number[] = [];
      for (const id of allIds) if (newSet.has(id)) prioritized.push(id);
      if (mode === 'incremental') {
        for (const id of allIds) if (!newSet.has(id)) prioritized.push(id);
      } else {
        const { data: existingDetails } = await db
          .from('tiny_order_details_cache')
          .select('tiny_order_id')
          .in('tiny_order_id', allIds);
        const existingIds = new Set((existingDetails || []).map((r: any) => Number(r.tiny_order_id)));
        for (const id of allIds) if (!newSet.has(id) && !existingIds.has(id)) prioritized.push(id);
      }

      console.log(`Details fetch plan: ${newOrderIds.length} new (priority) + ${prioritized.length - newOrderIds.length} others`);

      for (let i = 0; i < prioritized.length; i += 20) {
        const batch = prioritized.slice(i, i + 20);
        console.log(`Fetching details batch ${Math.floor(i / 20) + 1}/${Math.ceil(prioritized.length / 20)}`);
        const { results: details, failedIds, rateLimited: rl } = await fetchOrderDetails(tinyApiToken, batch, 2);
        const detailRows = Object.entries(details).map(([orderId, pedido]) => buildDetailRow(parseInt(orderId), pedido));
        if (detailRows.length > 0) {
          const { error } = await db.from('tiny_order_details_cache').upsert(detailRows, { onConflict: 'tiny_order_id' });
          if (error) {
            console.error('Details cache write error:', error.message);
          } else {
            for (const r of detailRows) detailsCaptured.add(r.tiny_order_id);
          }
        }
        detailsFailed.push(...failedIds);
        if (rl) {
          console.error(`Rate limited during details fetch — ${failedIds.length} in batch + remaining orders deferred to next sync`);
          rateLimited = true;
          break;
        }
        if (i + 20 < prioritized.length) await delay(500);
      }
      if (detailsFailed.length > 0) {
        const newFailed = detailsFailed.filter(id => newSet.has(id));
        if (newFailed.length > 0) {
          console.error(`ATENÇÃO: ${newFailed.length} pedidos NOVOS ficaram sem detalhes (serão reprocessados no próximo sync):`, newFailed);
        }
      }
    }

    // Step 4: Trigger automation engine ONLY for new orders whose details were captured.
    // Orders without details are deferred — the next incremental sync (priority queue) will capture them
    // and their automation will fire then. This prevents silent misses on rate-limit.
    const readyForAutomation = newOrderIds.filter(id => detailsCaptured.has(id));
    const deferredAutomation = newOrderIds.filter(id => !detailsCaptured.has(id));
    if (deferredAutomation.length > 0) {
      console.warn(`Deferring automation for ${deferredAutomation.length} new orders without details:`, deferredAutomation);
    }
    if (readyForAutomation.length > 0) {
      console.log(`Triggering automation-engine for ${readyForAutomation.length} new orders with details`);
      const engineUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/automation-engine`;
      const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
      await Promise.all(readyForAutomation.map(async (orderId) => {
        try {
          const r = await fetch(engineUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${serviceKey}` },
            body: JSON.stringify({ orderId }),
          });
          await r.text();
        } catch (e) {
          console.error(`automation-engine trigger failed for order ${orderId}:`, e);
        }
      }));
    }

    const response = {
      success: true,
      mode,
      orders_synced: allOrders.length,
      new_orders: newOrderIds.length,
      new_orders_with_details: readyForAutomation.length,
      new_orders_deferred: deferredAutomation.length,
      details_failed: detailsFailed.length,
      rate_limited: rateLimited,
      timestamp: new Date().toISOString(),
    };

    console.log('Sync complete:', JSON.stringify(response));
    return response;
  }
}

