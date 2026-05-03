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

// Fetch order details with concurrency control and rate limit handling
const fetchOrderDetails = async (token: string, ids: number[], concurrency = 3) => {
  const results: Record<number, any> = {};
  const queue = [...ids];
  let rateLimited = false;

  const worker = async () => {
    while (queue.length > 0 && !rateLimited) {
      const id = queue.shift();
      if (!id) break;
      try {
        await delay(200); // Small delay to avoid rate limiting
        const data = await tinyPost('https://api.tiny.com.br/api2/pedido.obter.php', {
          token, formato: 'JSON', id: String(id),
        });
        if (data.retorno?.status === 'OK' && data.retorno?.pedido) {
          results[id] = data.retorno.pedido;
        } else if (data.retorno?.status === 'Erro') {
          const erros = data.retorno.erros?.map((e: { erro: string }) => e.erro).join(', ') || '';
          if (isRateLimitError(erros)) {
            console.error(`Rate limited at order ${id}`);
            rateLimited = true;
            break;
          }
        }
      } catch (e) {
        console.error(`Error fetching order ${id}:`, e);
      }
    }
  };

  const workers = Array.from({ length: Math.min(concurrency, ids.length) }, () => worker());
  await Promise.all(workers);
  return { results, rateLimited };
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const tinyApiToken = Deno.env.get('TINY_API_TOKEN');
    if (!tinyApiToken) throw new Error('TINY_API_TOKEN não configurado');

    const body = await req.json().catch(() => ({}));
    const mode = body.mode || 'incremental'; // 'full' | 'incremental' | 'backfill'
    const db = getSupabaseAdmin();

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
      for (let i = 0; i < idsToFetch.length; i += 20) {
        if (rateLimited) break;
        const batch = idsToFetch.slice(i, i + 20);
        const { results, rateLimited: rl } = await fetchOrderDetails(tinyApiToken, batch, 3);
        const detailRows = Object.entries(results).map(([orderId, pedido]) => buildDetailRow(parseInt(orderId), pedido));
        if (detailRows.length > 0) {
          const { error } = await db.from('tiny_order_details_cache').upsert(detailRows, { onConflict: 'tiny_order_id' });
          if (error) console.error('Backfill upsert error:', error.message);
          fetched += detailRows.length;
        }
        if (rl) { rateLimited = true; break; }
        await delay(500);
      }

      return new Response(JSON.stringify({
        success: true, mode: 'backfill',
        total_orders: allCachedIds.length, missing_details: idsToFetch.length,
        fetched, rate_limited: rateLimited,
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
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

    // Step 3: Fetch details for orders that are NOT already in details cache
    if (!rateLimited && allOrders.length > 0) {
      const allIds = allOrders.map((o: any) => o.pedido.id);

      // Check which IDs already have details cached
      const { data: existingDetails } = await db
        .from('tiny_order_details_cache')
        .select('tiny_order_id')
        .in('tiny_order_id', allIds);

      const existingIds = new Set((existingDetails || []).map((r: any) => r.tiny_order_id));
      
      // For incremental syncs, re-fetch details for recent orders (might have updates)
      let idsToFetch: number[];
      if (mode === 'incremental') {
        // Re-fetch all for incremental (it's only ~2 days)
        idsToFetch = allIds;
      } else {
        // For full sync, skip already cached ones
        idsToFetch = allIds.filter((id: number) => !existingIds.has(id));
      }

      console.log(`Details: ${existingIds.size} already cached, ${idsToFetch.length} to fetch`);

      // Fetch details in batches of 20
      for (let i = 0; i < idsToFetch.length; i += 20) {
        const batch = idsToFetch.slice(i, i + 20);
        console.log(`Fetching details batch ${Math.floor(i / 20) + 1}/${Math.ceil(idsToFetch.length / 20)}`);

        const { results: details, rateLimited: rl } = await fetchOrderDetails(tinyApiToken, batch, 3);

        // Upsert fetched details
        const detailRows = Object.entries(details).map(([orderId, pedido]) => buildDetailRow(parseInt(orderId), pedido));

        if (detailRows.length > 0) {
          const { error } = await db.from('tiny_order_details_cache').upsert(detailRows, { onConflict: 'tiny_order_id' });
          if (error) console.error('Details cache write error:', error.message);
    }

    // Step 4: Trigger automation engine for new orders (fire-and-forget per order)
    if (newOrderIds.length > 0) {
      console.log(`Triggering automation-engine for ${newOrderIds.length} new orders`);
      const engineUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/automation-engine`;
      const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
      await Promise.all(newOrderIds.map(async (orderId) => {
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

        if (rl) {
          console.log('Rate limited during details fetch, stopping');
          rateLimited = true;
          break;
        }

        if (i + 20 < idsToFetch.length) await delay(500);
      }
    }

    const response = {
      success: true,
      mode,
      orders_synced: allOrders.length,
      rate_limited: rateLimited,
      timestamp: new Date().toISOString(),
    };

    console.log('Sync complete:', JSON.stringify(response));
    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    console.error('Sync error:', msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
