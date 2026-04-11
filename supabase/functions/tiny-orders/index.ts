import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const CACHE_TTL_HOURS = 6; // Cache valid for 6 hours

const getSupabaseAdmin = () => {
  return createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );
};

const tinyPost = async (endpoint: string, params: Record<string, string>) => {
  const formData = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => formData.append(k, v));
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: formData.toString(),
  });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Tiny API ${res.status}: ${errText}`);
  }
  return res.json();
};

// Check if Tiny API returned a rate limit error
const isRateLimitError = (msg: string) =>
  msg.includes('Bloqueada') || msg.includes('Excedido');

const jsonResponse = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

// ── Cache helpers ──

const getCachedOrders = async (db: ReturnType<typeof getSupabaseAdmin>) => {
  const cutoff = new Date(Date.now() - CACHE_TTL_HOURS * 3600_000).toISOString();
  const { data, error } = await db
    .from('tiny_orders_cache')
    .select('*')
    .gte('fetched_at', cutoff)
    .order('tiny_order_id', { ascending: false });
  if (error) { console.error('Cache read error:', error.message); return null; }
  return data && data.length > 0 ? data : null;
};

const getCachedDetails = async (db: ReturnType<typeof getSupabaseAdmin>, ids: number[]) => {
  const cutoff = new Date(Date.now() - CACHE_TTL_HOURS * 3600_000).toISOString();
  const { data, error } = await db
    .from('tiny_order_details_cache')
    .select('*')
    .in('tiny_order_id', ids)
    .gte('fetched_at', cutoff);
  if (error) { console.error('Detail cache read error:', error.message); return null; }
  return data;
};

const upsertOrdersCache = async (db: ReturnType<typeof getSupabaseAdmin>, orders: any[]) => {
  const rows = orders.map((o: any) => ({
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

  // Batch upsert in chunks of 500
  for (let i = 0; i < rows.length; i += 500) {
    const chunk = rows.slice(i, i + 500);
    const { error } = await db.from('tiny_orders_cache').upsert(chunk, { onConflict: 'tiny_order_id' });
    if (error) console.error('Cache write error:', error.message);
  }
};

const upsertDetailsCache = async (db: ReturnType<typeof getSupabaseAdmin>, details: Record<string, any>) => {
  const rows = Object.entries(details).map(([orderId, detail]) => ({
    tiny_order_id: parseInt(orderId),
    hora: detail.hora || null,
    forma_pagamento: detail.forma_pagamento || 'Não informado',
    items: detail.items || [],
    frete: detail.frete || 0,
    desconto: detail.desconto || 0,
    total_produtos: detail.total_produtos || 0,
    numero_ecommerce: detail.numero_ecommerce || null,
    obs: detail.obs || null,
    endereco_entrega: detail.endereco_entrega || null,
    raw_json: detail,
    fetched_at: new Date().toISOString(),
  }));

  for (let i = 0; i < rows.length; i += 500) {
    const chunk = rows.slice(i, i + 500);
    const { error } = await db.from('tiny_order_details_cache').upsert(chunk, { onConflict: 'tiny_order_id' });
    if (error) console.error('Detail cache write error:', error.message);
  }
};

// ── Fetch order details with concurrency control ──

const fetchOrderDetails = async (token: string, ids: number[], concurrency = 5) => {
  const results: Record<number, any> = {};
  const queue = [...ids];

  const worker = async () => {
    while (queue.length > 0) {
      const id = queue.shift();
      if (!id) break;
      try {
        const data = await tinyPost('https://api.tiny.com.br/api2/pedido.obter.php', {
          token, formato: 'JSON', id: String(id),
        });
        if (data.retorno?.status === 'OK' && data.retorno?.pedido) {
          results[id] = data.retorno.pedido;
        } else if (data.retorno?.status === 'Erro') {
          const erros = data.retorno.erros?.map((e: { erro: string }) => e.erro).join(', ') || '';
          if (isRateLimitError(erros)) {
            console.error(`Rate limited while fetching order ${id}`);
            break; // Stop fetching more
          }
        }
      } catch (e) {
        console.error(`Error fetching order ${id}:`, e);
      }
    }
  };

  const workers = Array.from({ length: Math.min(concurrency, ids.length) }, () => worker());
  await Promise.all(workers);
  return results;
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const tinyApiToken = Deno.env.get('TINY_API_TOKEN');
    if (!tinyApiToken) throw new Error('TINY_API_TOKEN não configurado');

    const { action = 'list', pagina = 1, id, dataInicial, dataFinal, ids, forceRefresh = false } = await req.json().catch(() => ({}));
    const db = getSupabaseAdmin();

    // ── BATCH DETAILS ──
    if (action === 'batch-details') {
      if (!ids || !Array.isArray(ids) || ids.length === 0) {
        throw new Error('ids array is required for batch-details');
      }
      const batchIds = ids.slice(0, 20);

      // Check cache first
      if (!forceRefresh) {
        const cached = await getCachedDetails(db, batchIds);
        if (cached && cached.length === batchIds.length) {
          console.log(`Returning ${cached.length} details from cache`);
          const enriched: Record<string, any> = {};
          for (const row of cached) {
            enriched[String(row.tiny_order_id)] = {
              hora: row.hora,
              forma_pagamento: row.forma_pagamento,
              items: row.items,
              frete: row.frete,
              desconto: row.desconto,
              total_produtos: row.total_produtos,
              numero_ecommerce: row.numero_ecommerce,
              obs: row.obs,
              endereco_entrega: row.endereco_entrega,
            };
          }
          return jsonResponse({ enriched, fromCache: true });
        }
      }

      // Determine which IDs are not cached (skip cache entirely when forceRefresh)
      let uncachedIds = batchIds;
      const enriched: Record<string, any> = {};

      if (!forceRefresh) {
        const cached = await getCachedDetails(db, batchIds);
        const cachedIds = new Set<number>();
        if (cached) {
          for (const row of cached) {
            cachedIds.add(row.tiny_order_id);
            enriched[String(row.tiny_order_id)] = {
              hora: row.hora,
              forma_pagamento: row.forma_pagamento,
              items: row.items,
              frete: row.frete,
              desconto: row.desconto,
              total_produtos: row.total_produtos,
              numero_ecommerce: row.numero_ecommerce,
              obs: row.obs,
              endereco_entrega: row.endereco_entrega,
            };
          }
        }
        uncachedIds = batchIds.filter(id => !cachedIds.has(id));
        console.log(`Details: ${cachedIds.size} cached, ${uncachedIds.length} to fetch`);
      } else {
        console.log(`Force refresh: fetching all ${batchIds.length} from API`);
      }

      if (uncachedIds.length > 0) {
        const details = await fetchOrderDetails(tinyApiToken, uncachedIds, 5);

        for (const [orderId, pedido] of Object.entries(details)) {
          // Log all available keys from Tiny API response for debugging
          console.log(`Order ${orderId} raw keys:`, Object.keys(pedido));
          if (pedido.data_pedido) console.log(`Order ${orderId} data_pedido:`, pedido.data_pedido);
          if (pedido.data_faturamento) console.log(`Order ${orderId} data_faturamento:`, pedido.data_faturamento);
          if (pedido.data_envio) console.log(`Order ${orderId} data_envio:`, pedido.data_envio);
          if (pedido.parcelas) console.log(`Order ${orderId} parcelas:`, JSON.stringify(pedido.parcelas));
          console.log(`Order ${orderId} parcelas:`, JSON.stringify(pedido.parcelas || []));
          console.log(`Order ${orderId} pagamentos:`, JSON.stringify(pedido.pagamentos_integrados || []));
          const items = (pedido.itens || []).map((item: any) => {
            const i = item.item || item;
            return {
              sku: i.codigo || '',
              product_name: i.descricao || 'Sem nome',
              qty: parseFloat(i.quantidade) || 1,
              unit_price: parseFloat(i.valor_unitario) || 0,
              total: parseFloat(i.valor_unitario) * (parseFloat(i.quantidade) || 1),
            };
          });

          enriched[orderId] = {
            hora: pedido.hora || undefined,
            forma_pagamento: pedido.forma_pagamento || 'Não informado',
            items,
            frete: parseFloat(pedido.valor_frete) || 0,
            desconto: parseFloat(pedido.valor_desconto) || 0,
            total_produtos: parseFloat(pedido.total_produtos) || 0,
            numero_ecommerce: pedido.numero_ecommerce || '',
            obs: pedido.obs || '',
            endereco_entrega: pedido.endereco_entrega ? {
              cidade: pedido.endereco_entrega.cidade || '',
              uf: pedido.endereco_entrega.uf || '',
              cep: pedido.endereco_entrega.cep || '',
            } : null,
          };
        }

        // Save newly fetched details to cache
        const newDetails: Record<string, any> = {};
        for (const id of uncachedIds) {
          if (enriched[String(id)]) newDetails[String(id)] = enriched[String(id)];
        }
        if (Object.keys(newDetails).length > 0) {
          await upsertDetailsCache(db, newDetails);
        }
      }

      return jsonResponse({ enriched, fromCache: uncachedIds.length === 0 });
    }

    // ── LIST ORDERS ──
    // Check cache first (only for non-forced, non-paginated initial requests)
    if (action === 'list' && !forceRefresh) {
      const cachedOrders = await getCachedOrders(db);
      if (cachedOrders && cachedOrders.length > 0) {
        console.log(`Returning ${cachedOrders.length} orders from cache`);
        const pedidos = cachedOrders.map(row => row.raw_json);
        return jsonResponse({
          status: 'OK',
          pagina: 1,
          numero_paginas: 1,
          pedidos,
          fromCache: true,
          cacheAge: cachedOrders[0]?.fetched_at,
        });
      }
    }

    // Fetch from Tiny API
    let endpoint = '';
    const formParams: Record<string, string> = { token: tinyApiToken, formato: 'JSON' };

    switch (action) {
      case 'list':
        endpoint = 'https://api.tiny.com.br/api2/pedidos.pesquisa.php';
        formParams.pagina = String(pagina);
        if (dataInicial) {
          formParams.dataInicial = dataInicial;
        } else {
          const thirtyDaysAgo = new Date();
          thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
          formParams.dataInicial = thirtyDaysAgo.toLocaleDateString('pt-BR');
        }
        if (dataFinal) formParams.dataFinal = dataFinal;
        break;
      case 'get':
        if (!id) throw new Error('ID do pedido é obrigatório');
        endpoint = 'https://api.tiny.com.br/api2/pedido.obter.php';
        formParams.id = String(id);
        break;
      default:
        endpoint = 'https://api.tiny.com.br/api2/pedidos.pesquisa.php';
        formParams.pagina = String(pagina);
    }

    console.log(`Fetching from Tiny API V2: ${endpoint}`);
    console.log(`Request params: pagina=${pagina}`);

    const data = await tinyPost(endpoint, formParams);
    console.log('Tiny API Response status:', data.retorno?.status);

    if (data.retorno?.status === 'Erro') {
      const erros = data.retorno.erros?.map((e: { erro: string }) => e.erro).join(', ') || 'Erro desconhecido';
      if (isRateLimitError(erros)) {
        // Try to return cached data as fallback
        const cachedOrders = await getCachedOrders(db);
        if (cachedOrders && cachedOrders.length > 0) {
          console.log(`Rate limited but returning ${cachedOrders.length} orders from cache as fallback`);
          return jsonResponse({
            status: 'OK',
            pagina: 1,
            numero_paginas: 1,
            pedidos: cachedOrders.map(row => row.raw_json),
            fromCache: true,
            rate_limited: true,
            cacheAge: cachedOrders[0]?.fetched_at,
          });
        }
        return jsonResponse({ error: erros, rate_limited: true, fallback: true });
      }
      throw new Error(erros);
    }

    const result = {
      status: data.retorno?.status,
      pagina: data.retorno?.pagina || 1,
      numero_paginas: data.retorno?.numero_paginas || 1,
      pedidos: data.retorno?.pedidos || [],
    };

    // Save to cache if this is a list action
    if (action === 'list' && result.pedidos.length > 0) {
      await upsertOrdersCache(db, result.pedidos);
      console.log(`Cached ${result.pedidos.length} orders`);
    }

    return jsonResponse(result);

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    console.error('Error in tiny-orders function:', errorMessage);

    // On any error, try cache fallback
    if (isRateLimitError(errorMessage)) {
      try {
        const db = getSupabaseAdmin();
        const cachedOrders = await getCachedOrders(db);
        if (cachedOrders && cachedOrders.length > 0) {
          return jsonResponse({
            status: 'OK',
            pagina: 1,
            numero_paginas: 1,
            pedidos: cachedOrders.map(row => row.raw_json),
            fromCache: true,
            rate_limited: true,
            cacheAge: cachedOrders[0]?.fetched_at,
          });
        }
      } catch (_) { /* fallthrough */ }
    }

    return jsonResponse({
      error: errorMessage,
      fallback: isRateLimitError(errorMessage),
      rate_limited: isRateLimitError(errorMessage),
    });
  }
});
